import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, consultarOuDegradar, type Degradavel } from './degradacao';
import { FUNCAO_NAO_EXISTE } from '@/compartilhado/erros';

/**
 * servidor/dados/inscricoes.ts — quem se inscreveu (RF15, RF16, RF17).
 *
 * =====================================================================
 * DUAS METADES COM POLÍTICAS OPOSTAS, NO MESMO ARQUIVO
 * =====================================================================
 *
 * A de cima é PÚBLICA e não lê a tabela: `vagasRestantes()` chama uma
 * função do banco que devolve um NÚMERO. `anon` tem `grant insert` em
 * `public.inscricoes` e nenhum select (003_eventos.sql), então ler a
 * tabela do lado público é impossível por construção — e é assim que
 * precisa continuar.
 *
 * A de baixo é da EQUIPE e lê tudo, porque é a lista de presença de uma
 * oficina. Quem separa as duas não é este arquivo: é a RLS
 * (`inscricoes: equipe gerencia`, `for all using (public.eh_equipe())`).
 *
 * =====================================================================
 * A DEGRADAÇÃO AQUI TEM UM CASO QUE NÃO EXISTE EM OUTRO LUGAR
 * =====================================================================
 *
 * `vagasRestantes()` pode responder três coisas diferentes, e as três
 * levam a telas diferentes:
 *
 *   · um NÚMERO — restam tantas;
 *   · `null` — o evento não limita vagas ("vagas abertas");
 *   · `null` TAMBÉM quando a migration 010 não foi aplicada, ou quando a
 *     consulta falhou.
 *
 * Os dois últimos são indistinguíveis para quem lê o valor, e por isso a
 * função devolve `Degradavel`: `degradou` é o que separa "este evento não
 * limita" de "não deu para perguntar". A tela usa a diferença — sem ela,
 * uma falha de banco escreveria "vagas abertas" num evento lotado, e a
 * pessoa preencheria o formulário inteiro para ser recusada no fim.
 */

/* =====================================================================
   PÚBLICO — RF15
   ===================================================================== */

/**
 * Quantas vagas restam num evento, ou `null` quando ele não limita.
 *
 * NÃO LÊ `public.inscricoes`, e não poderia: chama
 * `public.vagas_restantes()`, que é `security definer` justamente porque
 * `anon` não pode contar essa tabela (supabase/migrations/
 * 010_inscricao_por_visitante.sql explica a decisão por inteiro).
 *
 * MIGRATION 010 NÃO APLICADA: o PostgREST responde `PGRST202`, e aqui isso
 * vira `degradou: true` com `valor: null` — ou seja, a tela deixa de
 * prometer um número que não tem como conferir, em vez de mostrar "vagas
 * abertas" por engano. O aviso no log traz o nome do arquivo a aplicar.
 */
export async function vagasRestantes(eventoId: string): Promise<Degradavel<number | null>> {
  try {
    const { data, error } = await (await obterCliente())
      .rpc('vagas_restantes', { p_evento_id: eventoId });

    if (error) {
      if ((error as { code?: string }).code === FUNCAO_NAO_EXISTE) {
        console.warn('[inscricoes] a função public.vagas_restantes não existe neste projeto '
          + 'Supabase: supabase/migrations/010_inscricao_por_visitante.sql ainda NÃO foi '
          + 'aplicada. A página de inscrição deixa de mostrar quantas vagas restam, e a '
          + 'gravação segue pelo caminho de degradação descrito em acoes/inscricoes.ts.');
      } else {
        console.error('[inscricoes] não deu para contar as vagas:', error);
      }
      return { valor: null, degradou: true };
    }

    // O PostgREST devolve `null` para o "sem limite" da função, e um número
    // caso contrário. `Number()` porque `integer` pode chegar como string.
    return { valor: data === null || data === undefined ? null : Number(data), degradou: false };
  } catch (erro) {
    console.error('[inscricoes] vagasRestantes (exceção):', erro);
    return { valor: null, degradou: true };
  }
}

/* =====================================================================
   EQUIPE — RF16 (consulta) e RF17 (presença)
   ===================================================================== */

/**
 * Uma pessoa inscrita, como a EQUIPE a vê.
 *
 * TODAS AS COLUNAS DA TABELA ESTÃO AQUI, e é a única leitura do projeto de
 * que isso é verdade. O motivo é o uso: esta é a lista que a ONG leva para
 * a porta da oficina. Faltar o telefone do responsável ali é não conseguir
 * ligar para a família de uma criança que não foi buscada.
 *
 * `presente` vem de `public.presencas` por embed, e é `null` quando ninguém
 * marcou nada ainda — que é DIFERENTE de `false` ("faltou"). A tela de
 * presença desenha os três estados, porque "ainda não conferi" e "não veio"
 * não são a mesma informação para quem vai prestar contas de um edital.
 */
export type Inscrito = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  eh_menor: boolean;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  autoriza_imagem: boolean;
  consentimento_dados: boolean;
  criado_em: string;
  /** `true` presente, `false` faltou, `null` ninguém marcou ainda. */
  presente: boolean | null;
};

/**
 * A forma que o PostgREST devolve para o embed — ele decide entre objeto e
 * lista pela cardinalidade, e as duas aparecem em versões diferentes.
 * Tratar só uma é como este código quebraria numa atualização do Supabase,
 * em silêncio, devolvendo `presente` sempre nulo. Mesma precaução de
 * servidor/dados/exportacao.ts.
 */
type Embutido<T> = T | T[] | null;

function primeiro<T>(embutido: Embutido<T>): T | null {
  if (Array.isArray(embutido)) return embutido[0] ?? null;
  return embutido ?? null;
}

type LinhaDeInscrito = Omit<Inscrito, 'presente'> & {
  presencas: Embutido<{ presente: boolean }>;
};

/**
 * Quem se inscreveu num evento, na ordem em que se inscreveu (RF16).
 *
 * A ORDEM É CRONOLÓGICA, e não alfabética, e a escolha é de uso: numa lista
 * de espera a ordem de chegada é INFORMAÇÃO — é ela que diz quem entrou
 * antes de as vagas acabarem. Ordenar por nome apagaria isso. Quem quiser
 * por nome ordena na planilha, que é clicável (RF31).
 *
 * SEM `.limit()`, pelo mesmo motivo da fila de contatos e da agenda do
 * painel: um corte silencioso numa lista de presença esconderia gente sem
 * dizer que escondeu, e quem está de pé na porta não tem como desconfiar.
 *
 * DEVOLVE `Degradavel` porque uma lista vazia numa tela de presença é uma
 * AFIRMAÇÃO perigosa: "ninguém se inscreveu" faz a equipe ir embora. Falha
 * de consulta precisa aparecer como falha.
 */
export async function listarInscritos(eventoId: string): Promise<Degradavel<Inscrito[]>> {
  const resposta = await consultarComEstado<LinhaDeInscrito[]>(
    'inscricoes (painel)',
    async () => (await obterCliente())
      .from('inscricoes')
      .select('id, nome, email, telefone, cpf, eh_menor, responsavel_nome, '
        + 'responsavel_telefone, autoriza_imagem, consentimento_dados, criado_em, '
        + 'presencas(presente)')
      .eq('evento_id', eventoId)
      .order('criado_em', { ascending: true }),
    []
  );

  return {
    degradou: resposta.degradou,
    valor: resposta.valor.map((linha) => {
      const { presencas, ...resto } = linha;
      return { ...resto, presente: primeiro(presencas)?.presente ?? null };
    })
  };
}

/**
 * Quantas pessoas se inscreveram em cada evento, para a LISTA de eventos do
 * painel poder mostrar o número ao lado de cada um.
 *
 * `head: true` com `count`: o Postgres devolve o número e NENHUMA linha
 * atravessa a rede — a mesma técnica dos indicadores da home do painel
 * (RF30). Desenhar "12 inscritos" não precisa trazer 12 nomes.
 *
 * DEGRADA PARA `null`, e não para zero. Zero é um número: escrito ao lado
 * de um evento ele diz "ninguém se inscreveu", que é exatamente a
 * conclusão errada quando a consulta falhou. `null` vira um traço na tela.
 */
export async function contarInscritos(eventoId: string): Promise<number | null> {
  return consultarOuDegradar<number | null>('inscricoes (contagem)', async () => {
    const { count, error } = await (await obterCliente())
      .from('inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', eventoId);

    // `consultarOuDegradar` espera `{ data, error }`; o count vem fora do
    // data quando `head: true`, então ele é embrulhado aqui.
    return { data: count ?? null, error };
  }, null);
}

/**
 * Quantas pessoas se inscreveram e quantas vieram, POR EVENTO (RF32).
 *
 * ===================================================================
 * UMA CONSULTA SÓ, E ELA NÃO TRAZ DADO PESSOAL NENHUM
 * ===================================================================
 *
 * O caminho óbvio seria chamar `listarInscritos()` uma vez por evento, e
 * ele tem dois problemas: é N+1 (dez eventos, onze consultas), e traz nome,
 * e-mail, telefone e CPF de todo mundo para a memória do servidor só para
 * contar linhas.
 *
 * Esta consulta seleciona DUAS colunas — `evento_id` e a presença embutida
 * — e agrupa aqui. Nenhum dado de pessoa atravessa a rede para produzir um
 * relatório que é feito de números.
 *
 * ===================================================================
 * O QUE ELA NÃO FAZ: PAGINAR
 * ===================================================================
 *
 * Ela traz uma linha por inscrição do banco inteiro. Com a agenda desta
 * ONG isso é dezenas de linhas, e o custo é irrelevante perto da clareza.
 * O dia em que isso pesar tem um sinal visível — o relatório demorando a
 * abrir —, e a saída então é uma view no banco que já devolva os totais.
 * Escrito aqui para que a conta seja uma decisão, e não um esquecimento.
 */
export type ResumoDeEvento = { inscritos: number; presentes: number; semConferir: number };

export async function resumoDeInscricoesPorEvento(): Promise<
  Degradavel<Record<string, ResumoDeEvento>>
> {
  const resposta = await consultarComEstado<
    { evento_id: string; presencas: Embutido<{ presente: boolean }> }[]
  >(
    'inscricoes (resumo por evento)',
    async () => (await obterCliente())
      .from('inscricoes')
      .select('evento_id, presencas(presente)'),
    []
  );

  const resumo: Record<string, ResumoDeEvento> = {};

  for (const linha of resposta.valor) {
    const atual = resumo[linha.evento_id]
      ?? (resumo[linha.evento_id] = { inscritos: 0, presentes: 0, semConferir: 0 });

    atual.inscritos += 1;

    const presente = primeiro(linha.presencas)?.presente ?? null;
    if (presente === true) atual.presentes += 1;
    // "Ninguém conferiu" é contado à parte, e não somado às faltas: num
    // relatório de prestação de contas essa diferença é a diferença entre
    // "faltaram 8" e "não sabemos de 8". Ver acoes/presencas.ts.
    if (presente === null) atual.semConferir += 1;
  }

  return { valor: resumo, degradou: resposta.degradou };
}
