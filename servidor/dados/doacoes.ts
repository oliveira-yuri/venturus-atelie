import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComContagem, consultarComEstado, type Degradavel } from './degradacao';

/**
 * As doações (RF19–RF22) COMO A EQUIPE as vê — a fila de análise do painel.
 *
 * ===================================================================
 * ESTE MÓDULO NÃO TEM LEITOR PÚBLICO, E NÃO PODE TER
 * ===================================================================
 *
 * Como servidor/dados/contatos.ts: a política de leitura é
 *
 *     doacoes: o doador le as proprias — using (perfil_id = auth.uid() or eh_equipe())
 *
 * (supabase/migrations/004_pessoas.sql), e `anon` não tem `grant` NENHUM
 * sobre esta tabela — `grant select, insert, update, delete on ...
 * public.doacoes to authenticated`, e só.
 *
 * MEDIDO em 01/09/2026, contra o Supabase real, com a chave publicável (ou
 * seja, como `anon`): `GET /rest/v1/doacoes?select=*` responde
 *
 *     401 {"code":"42501","message":"permission denied for table doacoes",
 *          "hint":"Grant the required privileges to the current role with:
 *                  GRANT SELECT ON public.doacoes TO anon;"}
 *
 * — sem sequer chegar à RLS. Compare com `public.contatos`, que tem
 * `grant insert on public.contatos to anon` de propósito. Uma leitura
 * pública aqui não seria perigosa, seria INÚTIL: responderia isso sempre.
 *
 * A METADE DE QUEM DOOU já existe e mora em servidor/dados/conta.ts
 * (`listarMinhasDoacoes`), com `.eq('perfil_id', ...)` — separada por
 * INTENÇÃO, como `servidor/dados/publicacoes.ts` faz com a página pública
 * e o painel. Quem decide de verdade é a RLS; o filtro à mão existe porque
 * uma pessoa da equipe abrindo "Minhas doações" veria, sem ele, as doações
 * de todo mundo dentro da própria área de conta (o motivo inteiro está no
 * cabeçalho daquele arquivo).
 *
 * ===================================================================
 * SEM JSON IRMÃO, E SEM QUEDA PARA LISTA VAZIA SILENCIOSA
 * ===================================================================
 *
 * Não há, e não pode haver, cópia versionada de doação de pessoa real em
 * `dados-iniciais/` — seria dado pessoal de terceiro dentro do
 * repositório. Então a degradação é para lista vazia, como em
 * eventos/acervo, MAS as funções devolvem `Degradavel<T>` para a tela
 * poder DIZER que falhou.
 *
 * A indistinção que isso evita é a pior possível nesta tela: uma lista
 * vazia significaria "ninguém ofereceu nada", e a equipe fecharia o
 * celular. Com a falha declarada, ela sabe que as ofertas continuam lá e
 * volta depois. É o mesmo raciocínio de contatos.ts, com o agravante de
 * que aqui o que some de vista é gente esperando resposta sobre uma doação
 * que já se dispôs a fazer.
 */

/**
 * Uma doação, com TODAS as colunas — numa tela de análise não há coluna que
 * "não interessa".
 *
 * `doador_nome`/`doador_email` entram aqui e NÃO entram no tipo `Doacao` de
 * servidor/dados/conta.ts, e a diferença é o público: lá toda linha tem
 * `perfil_id` (é a própria pessoa), então os dois seriam sempre nulos ou
 * uma segunda cópia do nome que já está em `perfis`. Aqui eles são a única
 * identificação de quem doou SEM ter conta.
 *
 * `perfil_nome`/`perfil_email` são o contrário: quem doou COM conta. Não
 * são colunas de `public.doacoes` — vêm de uma segunda consulta (ver
 * `comOsNomesDeQuemTemConta`, abaixo) e nascem `null` quando a doação não
 * tem `perfil_id` ou quando aquela consulta não voltou.
 */
export type DoacaoDoPainel = {
  id: string;
  perfil_id: string | null;
  doador_nome: string | null;
  doador_email: string | null;
  tipo: string;
  descricao: string;
  /** `numeric(12,2)` chega do PostgREST como STRING, para preservar a precisão. */
  valor: string | number | null;
  situacao: string;
  resposta: string | null;
  respondida_em: string | null;
  recebida_em: string | null;
  criado_em: string;
  /** De `public.perfis`, por segunda consulta. `null` também quando ela falha. */
  perfil_nome: string | null;
  perfil_email: string | null;
};

/** A linha como o PostgREST devolve — sem as duas colunas de `perfis`. */
type LinhaCrua = Omit<DoacaoDoPainel, 'perfil_nome' | 'perfil_email'>;

/**
 * ===================================================================
 * DUAS CONSULTAS, E NÃO UM EMBED DO POSTGREST — A DECISÃO E A MEDIÇÃO
 * ===================================================================
 *
 * `servidor/dados/conta.ts` junta as áreas de uma candidatura com um embed
 * (`voluntario_areas(areas_voluntariado(id, nome))`), numa requisição só,
 * e o comentário de lá diz que isso FOI MEDIDO contra o Supabase real, com
 * sessão. O caminho óbvio aqui seria `.select('*, perfis(nome, email)')`,
 * pela chave estrangeira `perfil_id references public.perfis(id)`.
 *
 * NÃO FOI FEITO ASSIM, e o motivo é o que dá para medir hoje. Esta tela
 * exige sessão de EQUIPE, e não existe conta de equipe utilizável neste
 * projeto (CLAUDE.md, "O que trava hoje", itens 1 e 2). Tentei confirmar a
 * relação com a chave publicável, em 01/09/2026, e as três formas
 * (`perfis(...)`, `perfis!doacoes_perfil_id_fkey(...)` e sem embed nenhum)
 * responderam o MESMO `42501 permission denied for table doacoes`: o grant
 * barra antes de o PostgREST resolver a relação, então a medição que
 * conta.ts pôde fazer, aqui é impossível.
 *
 * O QUE ISSO MUDA: relação que o PostgREST não encontra vira `PGRST200`, e
 * `PGRST200` num `select` embutido derruba a consulta INTEIRA. Com embed, o
 * desfecho de um erro não medido seria "a fila de doações não carrega, para
 * sempre, para todo mundo" — e ninguém descobriria até a primeira pessoa da
 * equipe abrir a tela. Com duas consultas, o pior desfecho é a lista
 * inteira na tela com os NOMES faltando, e a tela dizendo isso.
 *
 * Não é preferência por duas idas à rede: é escolher o modo de falhar,
 * quando não dá para verificar qual falha acontece. No dia em que houver
 * sessão de equipe e alguém medir o embed, trocar é uma linha — e aí a
 * medição substitui este comentário.
 */
async function comOsNomesDeQuemTemConta(
  linhas: LinhaCrua[]
): Promise<DoacaoDoPainel[]> {
  const ids = [...new Set(linhas.map((linha) => linha.perfil_id).filter(Boolean))] as string[];

  // Nenhuma doação veio pelo site: não há o que perguntar. Poupa uma ida à
  // rede no caso — hoje o mais provável — em que a tabela só tem doações
  // registradas pela equipe.
  if (ids.length === 0) {
    return linhas.map((linha) => ({ ...linha, perfil_nome: null, perfil_email: null }));
  }

  // COLUNA POR COLUNA, e não `select('*')`: `public.perfis` tem `eh_equipe`,
  // e esta tela não a desenha nem a edita. Trazê-la seria pendurar no
  // servidor um dado que nada usa — mesma decisão de `buscarMeuPerfil`, em
  // servidor/dados/conta.ts. Quem decide permissão continua sendo
  // servidor/permissao.ts, com a consulta dele.
  //
  // A RLS DECIDE, COMO SEMPRE: a política de `perfis` é
  // `using (id = auth.uid() or public.eh_equipe())`, então quem é equipe lê
  // os nomes, e quem não é lê só o próprio — e não chegaria aqui de
  // qualquer forma, porque a página responde 404 antes.
  const { valor: perfis } = await consultarComEstado<
    Array<{ id: string; nome: string; email: string }>
  >('perfis (nomes na fila de doações)', async () =>
    (await obterCliente())
      .from('perfis')
      .select('id, nome, email')
      .in('id', ids),
  []);

  const porId = new Map(perfis.map((perfil) => [perfil.id, perfil]));

  return linhas.map((linha) => {
    const perfil = linha.perfil_id ? porId.get(linha.perfil_id) : undefined;
    return {
      ...linha,
      perfil_nome: perfil?.nome ?? null,
      perfil_email: perfil?.email ?? null
    };
  });
}

/**
 * O que a fila da equipe mostra: TUDO.
 *
 * ===================================================================
 * A CONSULTA PEDE `criado_em desc`, E A ORDEM FINAL É OUTRA
 * ===================================================================
 *
 * A ordem da TELA — "o que ainda espera resposta primeiro" — é decidida por
 * `montarAnalise`, em compartilhado/doacoes.ts, e aplicada na página. Duas
 * etapas, e não um `.order('situacao')` no PostgREST, pelos mesmos dois
 * motivos escritos em servidor/dados/contatos.ts:
 *
 *  1. ordenar por `situacao` no banco daria a ordem ALFABÉTICA ('aceita',
 *     'ofertada', 'recebida', 'recusada'), que não é nem de longe a ordem
 *     de trabalho — 'ofertada', a única que exige resposta, cairia no
 *     meio;
 *  2. em JavaScript a regra fica num módulo puro sem imports, que
 *     `testes/doacoes.test.mjs` exercita sem subir o Next — e esta tela
 *     responde 404 para quem não é equipe, então o que não for medido
 *     assim não é medido.
 *
 * PAGINADA DESDE O PEDIDO V1 — do jeito que o comentário anterior já
 * exigia: "o caminho é filtro por situação com o TOTAL ESCRITO NA TELA,
 * nunca um corte silencioso". `count: 'exact'` traz o total junto com o
 * recorte.
 *
 * `comOsNomesDeQuemTemConta` roda DEPOIS do recorte, e é o ganho escondido
 * desta mudança: ela faz uma segunda consulta para buscar os nomes dos
 * perfis, e agora busca os nomes de vinte doações em vez de todas.
 */
export async function listarDoacoesDoPainel(
  paginacao?: { de: number; ate: number }
): Promise<Degradavel<DoacaoDoPainel[]> & { total: number | null }> {
  const resposta = await consultarComContagem<LinhaCrua[]>('doacoes (painel)', async () => {
    const consulta = (await obterCliente())
      .from('doacoes')
      .select('*', { count: 'exact' })
      .order('criado_em', { ascending: false });

    return paginacao ? consulta.range(paginacao.de, paginacao.ate) : consulta;
  }, []);

  return {
    degradou: resposta.degradou,
    total: resposta.total,
    valor: await comOsNomesDeQuemTemConta(resposta.valor)
  };
}

/**
 * Uma doação só, para a tela de resposta (RF20/RF21).
 *
 * DUAS RAZÕES PARA ELA EXISTIR em vez de a tela filtrar a lista:
 *
 *  1. a tela de resposta é alcançada por `?id=`, que é entrada de usuário —
 *     e um id que não existe precisa virar 404, não um cartão em branco;
 *  2. `responderDoacao` (acoes/doacoes.ts) PRECISA da linha atual antes de
 *     escrever, por causa dos dois carimbos (`respondida_em`,
 *     `recebida_em`) e do `tipo`, que decide se o campo de valor faz
 *     sentido. Ler antes de escrever é a mesma disciplina de
 *     `alternarPublicacao` com `publicado_em`.
 *
 * `null` significa DUAS coisas — não existe linha com esse id, ou a
 * consulta falhou —, e por isso a bandeira `degradou` vem junto: sem ela, o
 * banco fora do ar viraria "esta doação não existe" e a equipe concluiria
 * que alguém apagou.
 */
export async function buscarDoacaoDoPainel(
  id: string
): Promise<Degradavel<DoacaoDoPainel | null>> {
  const resposta = await consultarComEstado<LinhaCrua | null>(
    'doacoes (uma, painel)',
    async () =>
      (await obterCliente())
        .from('doacoes')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
    null
  );

  if (!resposta.valor) return { degradou: resposta.degradou, valor: null };

  const [comNome] = await comOsNomesDeQuemTemConta([resposta.valor]);
  return { degradou: resposta.degradou, valor: comNome };
}
