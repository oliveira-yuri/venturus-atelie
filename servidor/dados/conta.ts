import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';

/**
 * O que a ÁREA DO USUÁRIO lê (RF11): o próprio perfil, as próprias
 * candidaturas ao voluntariado e o próprio histórico de doações.
 *
 * ===================================================================
 * TODA CONSULTA AQUI FILTRA PELO ID DA PESSOA, MESMO COM A RLS FILTRANDO
 * ===================================================================
 *
 * Não é cinto e suspensório: sem o `.eq()`, DUAS destas três consultas
 * mudariam de significado para quem é da equipe. As políticas são
 *
 *     voluntarios: perfil_id = auth.uid() OR public.eh_equipe()
 *     doacoes:     perfil_id = auth.uid() OR public.eh_equipe()
 *
 * (supabase/migrations/004_pessoas.sql) — o `or eh_equipe()` existe para as
 * telas de gestão (RF26, RF20–RF22), que ainda não foram escritas. Numa
 * consulta sem filtro, uma pessoa da equipe abriria "Minhas doações" e veria
 * as doações de TODO MUNDO, com nome e situação, dentro da própria área de
 * conta. Não seria vazamento para fora (a RLS está certa, e quem lê pode
 * ler), mas seria a tela mentindo sobre de quem é aquilo — e a equipe da ONG
 * usa o mesmo celular para as duas coisas.
 *
 * `perfis` tem a mesma forma de política, e ali o `.eq('id', ...)` já é
 * obrigatório por outro motivo: sem ele, `maybeSingle()` numa conta de
 * equipe encontraria várias linhas e devolveria erro.
 *
 * O ID VEM SEMPRE DA SESSÃO VERIFICADA (`usuarioAtual()`, servidor/sessao.ts),
 * nunca de `searchParams` nem de FormData — é por isso que estas funções
 * recebem `perfilId` como argumento em vez de descobri-lo sozinhas: quem
 * chama é uma página ou uma Action que JÁ perguntou quem está autenticado, e
 * um segundo caminho para responder a mesma pergunta seria a diferença entre
 * os dois.
 *
 * ===================================================================
 * AS TRÊS DEVOLVEM `Degradavel`, E ISSO É DECISÃO DESTA TELA
 * ===================================================================
 *
 * Mesmo motivo de servidor/dados/contatos.ts: não há, nem pode haver, JSON
 * versionado com dado pessoal em `dados-iniciais/`, então a degradação é
 * para lista vazia — e uma lista vazia aqui significa "você não tem nenhuma
 * doação registrada", que é uma frase MUITO diferente de "não deu para
 * perguntar". A pessoa que vê a primeira fecha a tela achando que a ONG não
 * registrou a doação dela.
 *
 * As três tabelas estão VAZIAS hoje (RF25 e RF19–RF22 não existem), então na
 * prática o estado vazio é o caso normal — o que torna a distinção mais
 * importante, não menos: sem ela, o dia em que houver dado e o banco cair
 * seria indistinguível de todos os dias anteriores.
 */

/**
 * O perfil da própria pessoa.
 *
 * COLUNA POR COLUNA, e não `select('*')`, ao contrário de
 * servidor/dados/contatos.ts. Lá a tela é de atendimento e não existe coluna
 * que "não interessa"; aqui existe uma que interessa muito e não pode viajar
 * à toa: `eh_equipe`. Ela não é segredo para a própria pessoa (a RLS deixa
 * ela ler a própria linha inteira), mas esta tela não a desenha e não a
 * edita, então trazê-la seria pendurar no HTML um dado que nada usa. O que
 * decide permissão continua sendo `servidor/permissao.ts`, com a consulta
 * dele.
 *
 * `email` vem daqui e não da sessão de propósito: é a coluna que a tela
 * mostra, e é a mesma que a equipe vê. Se um dia as duas divergirem, é a
 * tabela que está certa sobre o que a ONG tem registrado.
 */
export type Perfil = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  tipo_pessoa: string | null;
  eh_voluntario: boolean;
  eh_doador: boolean;
  criado_em: string;
};

export async function buscarMeuPerfil(perfilId: string): Promise<Degradavel<Perfil | null>> {
  return consultarComEstado<Perfil | null>('perfis (minha conta)', async () =>
    (await obterCliente())
      .from('perfis')
      .select('id, nome, email, telefone, tipo_pessoa, eh_voluntario, eh_doador, criado_em')
      .eq('id', perfilId)
      .maybeSingle(),
  null);
}

/**
 * Uma candidatura ao voluntariado (RF25/RF26), COM as áreas escolhidas.
 *
 * AS ÁREAS ENTRARAM COM A RF25, e o comentário que vivia aqui já dizia que
 * seria assim: até 01/09/2026 a tabela `voluntarios` estava vazia, ninguém
 * se candidatava por lugar nenhum, e uma segunda consulta para juntar áreas
 * a zero candidaturas era trabalho para desenhar nada. Agora existe o
 * formulário (`/voluntariado/candidatura`), e sem as áreas esta tela
 * mostraria "Recebida, ainda sem resposta" sem dizer PARA QUÊ — que é a
 * única coisa que a pessoa escolheu.
 *
 * Tem uma segunda função, e ela é a razão de não adiar mais: a candidatura
 * é gravada em DUAS tabelas, sem transação (não existe RPC para isto, e
 * criar migration não é desta tarefa). Quando a segunda gravação falha, a
 * candidatura existe SEM áreas — e é aqui, na tela da própria pessoa, que
 * esse desfecho parcial precisa aparecer, senão ele é invisível para todo
 * mundo menos para o log. Ver `acoes/voluntariado.ts`.
 *
 * O JOIN É DO POSTGREST ("resource embedding"), não um segundo `await`:
 * `voluntario_areas(areas_voluntariado(id, nome))` sai numa requisição só,
 * pela chave estrangeira que já está declarada em 004_pessoas.sql. As duas
 * tabelas embutidas têm política de leitura própria — `voluntario_areas: a
 * pessoa le as proprias` e `areas: leitura publica` —, então o embed não
 * fura nada: a RLS vale por tabela, inclusive dentro do join.
 *
 * MEDIDO em 01/09/2026 contra o Supabase real, com sessão de verdade: a
 * consulta com o embed responde sem erro. Isso importa porque relação que
 * o PostgREST não encontra vira `PGRST200` — um erro que, aqui, viraria
 * "não deu para consultar suas candidaturas" para todo mundo, para sempre.
 */
export type Candidatura = {
  id: string;
  mensagem: string | null;
  situacao: string;
  criado_em: string;
  /** Os NOMES das áreas, já prontos para desenhar. Vazio é desfecho parcial. */
  areas: string[];
};

/**
 * A forma CRUA que o PostgREST devolve, antes de virar `Candidatura`.
 *
 * O aninhamento é o do embed, e não o da tela: cada linha de
 * `voluntario_areas` traz um objeto `areas_voluntariado` dentro. Ele pode
 * vir `null` — não acontece hoje (a chave estrangeira garante a área), mas
 * o tipo do PostgREST admite, e um `.nome` em cima de `null` derrubaria a
 * área do usuário inteira com um TypeError, não com um estado vazio.
 */
type CandidaturaCrua = Omit<Candidatura, 'areas'> & {
  voluntario_areas: Array<{ areas_voluntariado: { id: string; nome: string } | null }> | null;
};

export async function listarMinhasCandidaturas(
  perfilId: string
): Promise<Degradavel<Candidatura[]>> {
  const resposta = await consultarComEstado<CandidaturaCrua[]>(
    'voluntarios (minha conta)',
    async () =>
      (await obterCliente())
        .from('voluntarios')
        .select('id, mensagem, situacao, criado_em, voluntario_areas(areas_voluntariado(id, nome))')
        .eq('perfil_id', perfilId)
        .order('criado_em', { ascending: false }),
    []
  );

  // O achatamento acontece AQUI, e não no componente, pelo motivo de sempre
  // neste projeto: componentes/MinhaConta.ts é montado por
  // testes/minha-conta.test.mjs com `react-dom/server`, e um componente que
  // conhecesse a forma do embed do PostgREST obrigaria o teste a escrever
  // aquela forma à mão para desenhar uma lista.
  return {
    degradou: resposta.degradou,
    valor: resposta.valor.map((linha) => ({
      id: linha.id,
      mensagem: linha.mensagem,
      situacao: linha.situacao,
      criado_em: linha.criado_em,
      areas: (linha.voluntario_areas ?? [])
        .map((ligacao) => ligacao.areas_voluntariado?.nome)
        .filter((nome): nome is string => Boolean(nome))
    }))
  };
}

/**
 * Uma doação registrada (RF19–RF22).
 *
 * `resposta` e `respondida_em` entram porque são a metade da conversa que
 * pertence a quem doou: é ali que a ONG diz se conseguiu receber (RN03,
 * RF20). Uma tela de histórico que mostrasse só "recusada" sem o motivo
 * escrito seria pior que não ter tela.
 *
 * `doador_nome`/`doador_email` NÃO entram: eles existem para a doação que a
 * equipe registra de alguém sem conta (`identificacao_obrigatoria`, em
 * 004_pessoas.sql). Nesta tela toda linha tem `perfil_id` — é a própria
 * pessoa —, então os dois seriam sempre nulos ou uma segunda cópia do nome
 * que já está em `perfis`.
 */
export type Doacao = {
  id: string;
  tipo: string;
  descricao: string;
  valor: string | number | null;
  situacao: string;
  resposta: string | null;
  criado_em: string;
  recebida_em: string | null;
};

export async function listarMinhasDoacoes(perfilId: string): Promise<Degradavel<Doacao[]>> {
  return consultarComEstado<Doacao[]>('doacoes (minha conta)', async () =>
    (await obterCliente())
      .from('doacoes')
      .select('id, tipo, descricao, valor, situacao, resposta, criado_em, recebida_em')
      .eq('perfil_id', perfilId)
      .order('criado_em', { ascending: false }),
  []);
}

/*
 * ===================================================================
 * O BLOCO QUE NÃO EXISTE: "MINHAS INSCRIÇÕES"
 * ===================================================================
 *
 * `public.inscricoes` (RF15) NÃO tem como ser lida pela própria pessoa, e
 * são DOIS impedimentos independentes — MEDIDOS em 01/09/2026 contra o
 * Supabase real, com uma sessão de verdade de quem não é equipe:
 *
 *  1. NÃO HÁ POLÍTICA DE SELECT para ela. As duas políticas de
 *     supabase/migrations/003_eventos.sql são "qualquer pessoa se inscreve"
 *     (insert) e "equipe gerencia" (`for all using eh_equipe()`). O papel
 *     `authenticated` TEM `grant select`, então a consulta não dá erro: ela
 *     volta `[]`. Medido, exatamente assim. É a pior forma possível de não
 *     funcionar — um bloco escrito em cima disso diria "você não tem
 *     nenhuma inscrição" para alguém que se inscreveu em três eventos, sem
 *     erro nenhum em lugar nenhum;
 *  2. NÃO HÁ COLUNA que ligue a inscrição a uma conta. A tabela não tem
 *     `perfil_id`, e isso é a decisão D4 do projeto, escrita na própria
 *     migration: inscrição sem conta, de propósito, porque reduzir atrito
 *     importa mais que histórico individual. O único elo seria o `email`
 *     digitado no formulário, que não é o mesmo que "a conta é dela".
 *
 * Ou seja: nem uma política nova resolveria sozinha. Ligar inscrição a conta
 * é mudar a decisão D4, e isso é do grupo, não de quem implementa.
 *
 * O ESCOPO TAMBÉM NÃO PEDE: o RF11 diz "os próprios dados, as próprias
 * candidaturas e o próprio histórico de doações" — inscrição não está lá.
 * Este comentário existe porque a AUSÊNCIA é o que precisa de explicação:
 * sem ele, a próxima pessoa a abrir esta tela vê três blocos, lembra que
 * existe uma tabela de inscrições e acrescenta o quarto, que voltaria vazio
 * para sempre.
 */
