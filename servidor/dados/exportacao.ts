import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';
import { listarContatos } from './contatos';
import { listarInscritos } from './inscricoes';
import { rotuloDaSituacao, rotuloDaOrigem } from '@/compartilhado/triagem-de-contatos';
import {
  dataParaPlanilha, rotuloDaCandidatura,
  type ConjuntoExportavel, type LinhaExportada
} from '@/compartilhado/exportacao';
import { formatarTelefone, formatarCpf } from '@/compartilhado/validacao';

/**
 * servidor/dados/exportacao.ts — o que entra em cada arquivo do RF31.
 *
 * A MECÂNICA do CSV (escape, aspas, injeção de fórmula, nome do arquivo) e a
 * lista fechada de conjuntos moram em compartilhado/exportacao.ts, que não
 * importa nada e por isso cabe num teste do Node. Aqui fica só o que precisa
 * do banco — e o mapeamento de coluna do Postgres para coluna da planilha.
 *
 * ===================================================================
 * ESTE MÓDULO EXISTE PORQUE EXPORTAR NÃO É "LER DE NOVO"
 * ===================================================================
 *
 * `listarContatos()` já lê `public.contatos`, e o arquivo de mensagens usa
 * essa mesma função — de propósito: duas consultas para a mesma tabela
 * divergiriam no dia em que uma ganhasse um filtro. O que muda entre a tela
 * e o arquivo não é a CONSULTA, é a apresentação: a tela desenha cartões
 * ordenados por triagem, o arquivo escreve linhas com rótulo e data legível.
 *
 * `voluntarios` é o contrário: nenhuma tela do painel lê essa tabela, porque
 * a gestão de voluntários (RF26) não existe. Então a consulta nasce aqui, e
 * O ARQUIVO É HOJE O ÚNICO CAMINHO ATÉ QUEM SE CANDIDATOU pelo site —
 * `acoes/voluntariado.ts` grava de verdade desde 01/09/2026, e até esta
 * tarefa ninguém tinha como ler. É a mesma história de `contatos` antes do
 * RF29: gente escrevendo para uma ONG que não tem como ver.
 *
 * ===================================================================
 * DEGRADAR AQUI SERIA MENTIR, E POR ISSO A BANDEIRA SOBE ATÉ A ROTA
 * ===================================================================
 *
 * A política do projeto é degradar para lista vazia e manter a página no ar
 * (servidor/dados/degradacao.ts). Num ARQUIVO isso vira outra coisa: um CSV
 * com o cabeçalho e nenhuma linha é indistinguível de "não há candidatura
 * nenhuma", e a equipe arquiva o arquivo vazio achando que aquilo é o
 * retrato do banco.
 *
 * Por isso as duas funções abaixo devolvem `Degradavel<...>`, e
 * app/admin/exportar/[conjunto]/route.ts NÃO ESCREVE ARQUIVO quando
 * `degradou` é true: manda a equipe de volta ao painel com o aviso de que a
 * consulta falhou. Mesma decisão de `listarContatos`, com a diferença de que
 * um arquivo sai da tela e vira anexo de e-mail — o engano vive mais tempo.
 */

/**
 * As mensagens recebidas, como linhas de planilha.
 *
 * A ORDEM É A DA CONSULTA (`criado_em desc`), e NÃO a da triagem que a tela
 * usa. Numa planilha quem ordena é quem abriu: as colunas são clicáveis, e
 * impor "não respondidas primeiro" num arquivo tiraria a única ordem que
 * todo mundo espera de um export — a cronológica.
 *
 * TODAS AS COLUNAS ENTRAM, inclusive `consentimento_dados`: é ela que diz à
 * equipe se pode responder aquela pessoa, e um arquivo de contatos sem ela
 * convidaria a escrever para quem não autorizou.
 */
async function mensagensParaExportar(): Promise<Degradavel<LinhaExportada[]>> {
  const { valor, degradou } = await listarContatos();

  return {
    degradou,
    valor: valor.map((contato) => ({
      recebida_em: dataParaPlanilha(contato.criado_em),
      situacao: rotuloDaSituacao(contato.situacao),
      nome: contato.nome,
      email: contato.email,
      telefone: contato.telefone,
      instituicao: contato.instituicao,
      origem: rotuloDaOrigem(contato.origem),
      mensagem: contato.mensagem,
      // Booleano de verdade, não a string "true": quem transforma em
      // "sim"/"não" é escaparCampoCsv, num lugar só — ver
      // compartilhado/exportacao.ts.
      consentimento: contato.consentimento_dados,
      id: contato.id
    }))
  };
}

/**
 * A forma que o PostgREST devolve para o embed. Ele decide entre objeto e
 * lista pela cardinalidade da chave estrangeira, e as duas aparecem em
 * versões diferentes — tratar só uma é como este código quebraria numa
 * atualização do Supabase, em silêncio, devolvendo colunas vazias.
 */
type Embutido<T> = T | T[] | null;

function primeiro<T>(embutido: Embutido<T>): T | null {
  if (Array.isArray(embutido)) return embutido[0] ?? null;
  return embutido ?? null;
}

type LinhaDeVoluntario = {
  id: string;
  mensagem: string | null;
  situacao: string;
  criado_em: string;
  perfis: Embutido<{ nome: string | null; email: string | null; telefone: string | null }>;
  voluntario_areas: { areas_voluntariado: Embutido<{ nome: string }> }[] | null;
};

/**
 * As candidaturas de voluntariado, como linhas de planilha.
 *
 * ===================================================================
 * O NOME E O E-MAIL VÊM DE `perfis`, POR EMBED — e é isso que torna o
 * arquivo útil
 * ===================================================================
 *
 * `public.voluntarios` guarda `perfil_id`, `mensagem` e `situacao`, e mais
 * nada: um arquivo com essas três colunas seria uma lista de identificadores
 * — a equipe saberia que três pessoas se candidataram e não teria como falar
 * com nenhuma. Quem tem nome, e-mail e telefone é `public.perfis`.
 *
 * O embed é permitido pela RLS, não por este código: `perfis: equipe
 * gerencia` é `for all using (public.eh_equipe())`
 * (supabase/migrations/001_base.sql), então quem é equipe lê o perfil de
 * quem se candidatou. Para qualquer outra pessoa a política devolve só o
 * próprio registro — o embed não é uma porta lateral, é a mesma porta.
 *
 * NÃO MEDIDO CONTRA O SUPABASE REAL: `voluntario_areas(areas_voluntariado(…))`
 * é o mesmo embed que servidor/dados/conta.ts já usa e que foi medido em
 * 01/09/2026, mas o `perfis(…)` deste select é novo, e exercitá-lo exige
 * uma sessão de EQUIPE, que este projeto ainda não tem (CLAUDE.md, "O que
 * trava hoje", itens 1 e 2). Se o embed não resolver, o PostgREST responde
 * com `error` — `consultarComEstado` transforma isso em `degradou`, e a
 * rota recusa o download em vez de entregar um arquivo com colunas vazias.
 * O aviso `[dados]` no log é onde a causa aparece.
 *
 * ===================================================================
 * AS ÁREAS VIRAM UMA CÉLULA SÓ
 * ===================================================================
 *
 * Uma candidatura tem N áreas, e uma planilha tem uma célula. Elas entram
 * separadas por vírgula e espaço, na ordem em que vieram. A alternativa —
 * uma coluna por área — daria cinco colunas de "sim/não" que mudam de nome
 * toda vez que a ONG criar uma área nova, e o arquivo de março deixaria de
 * bater com o de abril.
 *
 * `filter(Boolean)` porque uma ligação órfã (área apagada com a candidatura
 * viva) devolveria `undefined` no meio da lista, e o que apareceria na
 * célula seria "Comunicação, , Produção".
 */
async function candidaturasParaExportar(): Promise<Degradavel<LinhaExportada[]>> {
  const resposta = await consultarComEstado<LinhaDeVoluntario[]>(
    'voluntarios (exportação)',
    async () => (await obterCliente())
      .from('voluntarios')
      .select('id, mensagem, situacao, criado_em, '
        + 'perfis(nome, email, telefone), voluntario_areas(areas_voluntariado(nome))')
      .order('criado_em', { ascending: false }),
    []
  );

  return {
    degradou: resposta.degradou,
    valor: resposta.valor.map((linha) => {
      const pessoa = primeiro(linha.perfis);

      return {
        recebida_em: dataParaPlanilha(linha.criado_em),
        situacao: rotuloDaCandidatura(linha.situacao),
        nome: pessoa?.nome ?? null,
        email: pessoa?.email ?? null,
        telefone: pessoa?.telefone ?? null,
        areas: (linha.voluntario_areas ?? [])
          .map((ligacao) => primeiro(ligacao.areas_voluntariado)?.nome)
          .filter((nome): nome is string => Boolean(nome))
          .join(', '),
        mensagem: linha.mensagem,
        id: linha.id
      };
    })
  };
}

/**
 * As linhas de um conjunto da lista fechada.
 *
 * O `switch` é sobre um tipo de união fechado, então o TypeScript cobra o
 * caso novo aqui no dia em que alguém acrescentar um conjunto em
 * compartilhado/exportacao.ts — que é a trava que impede uma chave de
 * existir na URL sem ter de onde ler.
 */
/**
 * A lista de inscritos de UM evento, como linhas de planilha (RF16 + RF31).
 *
 * ===================================================================
 * REAPROVEITA `listarInscritos()`, E NÃO FAZ CONSULTA PRÓPRIA
 * ===================================================================
 *
 * É a mesma decisão de `mensagensParaExportar`, e pelo mesmo motivo: duas
 * consultas para a mesma tabela divergiriam no dia em que uma ganhasse um
 * filtro, e aí a planilha e a tela mostrariam listas diferentes do mesmo
 * evento — sem nada acusar. O que muda entre as duas não é a CONSULTA, é a
 * apresentação.
 *
 * ===================================================================
 * A PRESENÇA VIRA TRÊS PALAVRAS, NÃO UM BOOLEANO
 * ===================================================================
 *
 * `escaparCampoCsv` transforma `true`/`false` em "sim"/"não", e para as
 * outras colunas isso é o certo. Aqui não serve: a ausência de marcação é
 * um TERCEIRO estado ("ninguém conferiu"), e mandá-lo como célula vazia ao
 * lado de uma coluna "sim/não" faria o vazio ser lido como "não veio" — que
 * é exatamente a conclusão errada numa prestação de contas.
 *
 * Por isso `presenca` sai como texto escrito, e não como booleano.
 */
async function inscritosParaExportar(
  eventoId: string
): Promise<Degradavel<LinhaExportada[]>> {
  const { valor, degradou } = await listarInscritos(eventoId);

  return {
    degradou,
    valor: valor.map((pessoa) => ({
      nome: pessoa.nome,
      presenca: pessoa.presente === null ? 'não conferido'
        : pessoa.presente ? 'veio' : 'não veio',
      // Estes DOIS continuam booleanos de verdade: "sim"/"não" respondem a
      // pergunta inteira, e quem transforma é escaparCampoCsv, num lugar
      // só (compartilhado/exportacao.ts).
      autoriza_imagem: pessoa.autoriza_imagem,
      eh_menor: pessoa.eh_menor,
      responsavel_nome: pessoa.responsavel_nome,
      // Formatados como a equipe lê e disca — a planilha é para ligar para
      // as pessoas, não para processar número.
      responsavel_telefone: pessoa.responsavel_telefone
        ? formatarTelefone(pessoa.responsavel_telefone) : null,
      email: pessoa.email,
      telefone: pessoa.telefone ? formatarTelefone(pessoa.telefone) : null,
      cpf: pessoa.cpf ? formatarCpf(pessoa.cpf) : null,
      inscrita_em: dataParaPlanilha(pessoa.criado_em),
      consentimento: pessoa.consentimento_dados,
      id: pessoa.id
    }))
  };
}

/**
 * As linhas de um conjunto da lista fechada.
 *
 * O `switch` é sobre um tipo de união fechado, então o TypeScript cobra o
 * caso novo aqui no dia em que alguém acrescentar um conjunto em
 * compartilhado/exportacao.ts — que é a trava que impede uma chave de
 * existir na URL sem ter de onde ler. (Ela DISPAROU quando `inscritos`
 * entrou, que é a prova de que funciona.)
 *
 * `eventoId` só é usado pelos conjuntos que `exigeEvento()` marca. Quem
 * garante que ele chegou é a rota, ANTES de chamar aqui — sem ele,
 * `inscritos` devolveria a lista de um evento chamado "" , que é lista
 * nenhuma.
 */
export function linhasParaExportar(
  conjunto: ConjuntoExportavel,
  eventoId = ''
): Promise<Degradavel<LinhaExportada[]>> {
  switch (conjunto) {
    case 'contatos': return mensagensParaExportar();
    case 'voluntarios': return candidaturasParaExportar();
    case 'inscritos': return inscritosParaExportar(eventoId);
  }
}
