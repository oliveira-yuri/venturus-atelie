import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComContagem, consultarComEstado, type Degradavel } from './degradacao';

/**
 * As candidaturas ao voluntariado vistas PELA EQUIPE (RF26) — a outra metade
 * de `servidor/dados/conta.ts`.
 *
 * ===================================================================
 * A MESMA TABELA, PELO OUTRO LADO — E POR QUE SÃO DOIS ARQUIVOS
 * ===================================================================
 *
 * `listarMinhasCandidaturas` (servidor/dados/conta.ts) lê
 * `public.voluntarios` filtrando por `perfil_id`; esta função lê SEM filtro
 * nenhum. É a mesma diferença que existe entre as duas leituras de
 * servidor/dados/publicacoes.ts, e ela é de INTENÇÃO — quem decide o que
 * volta é a RLS:
 *
 *     voluntarios: a pessoa le a propria candidatura
 *       -> using (perfil_id = auth.uid() or public.eh_equipe())
 *
 * (supabase/migrations/004_pessoas.sql). Para quem não é equipe, a consulta
 * sem filtro devolve exatamente as próprias linhas; para quem é, devolve
 * todas. A tranca é o Postgres, não este arquivo (regras 5 e 6 do
 * CLAUDE.md).
 *
 * NÃO UNIFICAR AS DUAS numa função com `perfilId` opcional. O cabeçalho de
 * conta.ts explica por que o `.eq()` de lá não é redundante: sem ele, uma
 * pessoa da equipe abriria "Minhas candidaturas" e veria as de TODO MUNDO
 * dentro da própria área de conta. Uma função só, com o filtro decidido por
 * um argumento que pode vir `undefined`, é precisamente o desenho em que
 * esse esquecimento volta.
 *
 * ===================================================================
 * TRÊS TABELAS NUMA REQUISIÇÃO, PELO EMBED DO POSTGREST
 * ===================================================================
 *
 * `perfis(...)` e `voluntario_areas(areas_voluntariado(...))` saem no mesmo
 * `select`, pelas chaves estrangeiras já declaradas em 004_pessoas.sql
 * (`perfil_id references public.perfis(id)` e as duas de
 * `voluntario_areas`). Cada tabela embutida tem política própria — `perfis:
 * cada pessoa le o proprio registro` (com `or eh_equipe()`),
 * `voluntario_areas: a pessoa le as proprias` (idem) e `areas: leitura
 * publica` —, então o embed não fura nada: a RLS vale por tabela, inclusive
 * dentro do join.
 *
 * MEDIDO em 01/09/2026 contra o PostgREST de produção, ANONIMAMENTE e sem
 * gravar nada: este `select` inteiro responde `42501 permission denied for
 * table voluntarios` (que é o esperado — `anon` não tem `grant` nesta
 * tabela), enquanto o MESMO endereço com um embed inventado
 * (`tabela_que_nao_existe(nome)`) responde `PGRST200 Could not find a
 * relationship`. Ou seja: o PostgREST resolve os embeds ANTES de checar o
 * grant, e os dois desta consulta resolvem contra o schema real. Isso
 * importa porque relação que ele não encontra vira `PGRST200` — um erro que,
 * aqui, viraria "não deu para carregar as candidaturas" para a equipe
 * inteira, para sempre, sem nada na tela dizendo que a causa é um nome de
 * coluna.
 *
 * ===================================================================
 * SEM JSON IRMÃO, E SEM QUEDA PARA LISTA VAZIA SILENCIOSA
 * ===================================================================
 *
 * Não há, e não pode haver, cópia versionada de candidatura em
 * `dados-iniciais/` — seria dado pessoal de terceiro dentro do repositório
 * (o mesmo motivo escrito em servidor/dados/contatos.ts). Então a degradação
 * é para lista vazia, MAS a função devolve `Degradavel<T>` para a tela poder
 * DIZER que falhou.
 *
 * A indistinção que isso evita é a pior possível nesta tela: uma lista vazia
 * significaria "ninguém se ofereceu para ajudar", e a equipe fecharia o
 * celular. Com a falha declarada, ela sabe que as candidaturas continuam lá
 * e volta depois. O que se perde de vista aqui é gente esperando resposta —
 * gente que já escreveu por que quer ajudar.
 */

/**
 * Uma candidatura como a EQUIPE precisa vê-la: a candidatura, quem a fez e
 * para quê.
 *
 * COLUNA POR COLUNA, e não `select('*')`, ao contrário de
 * servidor/dados/contatos.ts. Lá a tela é de atendimento e a tabela inteira
 * é dado de contato; aqui o embed traz `public.perfis`, que tem uma coluna
 * que não pode viajar à toa: `eh_equipe`. A equipe PODE lê-la (a política é
 * `or eh_equipe()`), e é justamente por isso que ela precisa ser deixada de
 * fora à mão — esta tela não a desenha e não a edita, então trazê-la seria
 * pendurar no HTML de uma lista de pessoas o dado que decide permissão. Quem
 * decide permissão continua sendo `servidor/permissao.ts`, com a consulta
 * dele.
 *
 * `nome`, `email` e `telefone` entram porque são COMO A ONG RESPONDE: uma
 * tela de gestão de voluntários que não deixa falar com o voluntário é uma
 * lista para olhar. `tipo_pessoa`, `eh_voluntario` e `eh_doador` ficam de
 * fora — nada nesta tela os usa, e o que não é desenhado não precisa
 * atravessar a fronteira.
 */
export type CandidaturaDaEquipe = {
  id: string;
  mensagem: string | null;
  situacao: string;
  criado_em: string;
  /** Quem se candidatou. Nulo é impossível hoje — ver `achatar`. */
  nome: string | null;
  email: string | null;
  telefone: string | null;
  /** Os NOMES das áreas, já prontos para desenhar. Vazio é desfecho parcial. */
  areas: string[];
};

/**
 * A forma CRUA que o PostgREST devolve, antes de virar `CandidaturaDaEquipe`.
 *
 * O aninhamento é o do embed, e não o da tela. Os dois `| null` são do TIPO
 * do PostgREST, não do banco: `perfil_id` é `not null references
 * public.perfis(id)` e cada linha de `voluntario_areas` tem `area_id` `not
 * null`, então nenhum dos dois vem nulo hoje. Estão declarados porque um
 * `.nome` em cima de `null` derrubaria a tela inteira com um TypeError, e o
 * desfecho certo para "não veio o perfil" é um cartão dizendo isso — não uma
 * página de erro.
 */
type CandidaturaCrua = {
  id: string;
  mensagem: string | null;
  situacao: string;
  criado_em: string;
  perfis: { nome: string; email: string; telefone: string | null } | null;
  voluntario_areas: Array<{ areas_voluntariado: { id: string; nome: string } | null }> | null;
};

/**
 * O que a tela da equipe mostra: TODAS as candidaturas.
 *
 * A CONSULTA PEDE `criado_em desc` e a ordem final é OUTRA. O banco ordena
 * pelo que sabe ordenar; a ordem da TELA — "quem ainda não teve resposta
 * primeiro" — é decidida por `montarTriagemDeVoluntarios`, em
 * compartilhado/triagem-de-voluntarios.ts, e aplicada na página. Duas
 * etapas, e não um `.order('situacao')` no PostgREST, pelo mesmo par de
 * motivos escrito em servidor/dados/contatos.ts:
 *
 *  1. ordenar por `situacao` no banco daria a ordem alfabética ('ativo',
 *     'em_contato', 'inativo', 'novo'), que não é a ordem certa nem por
 *     acaso;
 *  2. em JavaScript a regra fica num módulo puro sem imports, que
 *     `testes/voluntarios.test.mjs` exercita sem subir o Next — e esta tela
 *     está atrás de uma guarda que responde 404 para todo mundo que não é
 *     equipe, então o que não for medido assim não é medido.
 *
 * PAGINADA DESDE O PEDIDO V1 — do jeito que o comentário anterior já
 * exigia: "no dia em que não couber, o caminho é filtro por situação com o
 * TOTAL ESCRITO NA TELA, nunca um corte silencioso". `count: 'exact'` traz
 * quantas candidaturas há no total junto com o recorte.
 *
 * O `count` CONTA AS CANDIDATURAS, não as linhas do embed. `voluntarios`
 * é a tabela raiz da consulta, e `perfis`/`voluntario_areas` vêm embutidos
 * — o PostgREST conta a raiz. Se contasse o embed, uma candidatura com três
 * áreas valeria três, e a paginação mentiria.
 */
export async function listarCandidaturas(
  paginacao?: { de: number; ate: number },
  situacao?: string
): Promise<Degradavel<CandidaturaDaEquipe[]> & { total: number | null }> {
  const resposta = await consultarComContagem<CandidaturaCrua[]>(
    'voluntarios (painel)',
    async () => {
      let consulta = (await obterCliente())
        .from('voluntarios')
        .select(
          'id, mensagem, situacao, criado_em,'
          + ' perfis(nome, email, telefone),'
          + ' voluntario_areas(areas_voluntariado(id, nome))',
          { count: 'exact' }
        )
        .order('criado_em', { ascending: false });

      // O FILTRO ENTRA ANTES DO RECORTE, e a ordem é o que faz a paginação
      // ficar honesta: `count: 'exact'` passa a contar o que RESTOU do
      // filtro, então a tela escreve "3 candidaturas" quando há três novas,
      // e não "3 de 47". Filtrar depois de paginar daria vinte linhas das
      // quais três apareceriam — e a contagem mentiria.
      //
      // `situacao` já veio da lista fechada de quem chama; aqui ela é só
      // repassada. Um valor inventado não chega até este ponto.
      if (situacao) consulta = consulta.eq('situacao', situacao);

      return paginacao ? consulta.range(paginacao.de, paginacao.ate) : consulta;
    },
    []
  );

  return {
    degradou: resposta.degradou,
    total: resposta.total,
    valor: resposta.valor.map(achatar)
  };
}

/**
 * Do embed para a forma da tela.
 *
 * O achatamento acontece AQUI, e não no componente, pelo motivo de sempre
 * neste projeto: componentes/ListaVoluntarios.ts é montado por
 * `testes/voluntarios.test.mjs` com `react-dom/server`, e um componente que
 * conhecesse a forma do embed do PostgREST obrigaria o teste a escrever
 * aquela forma à mão para desenhar uma lista. É a mesma função que
 * `listarMinhasCandidaturas` faz do outro lado.
 */
function achatar(linha: CandidaturaCrua): CandidaturaDaEquipe {
  return {
    id: linha.id,
    mensagem: linha.mensagem,
    situacao: linha.situacao,
    criado_em: linha.criado_em,
    nome: linha.perfis?.nome ?? null,
    email: linha.perfis?.email ?? null,
    telefone: linha.perfis?.telefone ?? null,
    areas: (linha.voluntario_areas ?? [])
      .map((ligacao) => ligacao.areas_voluntariado?.nome)
      .filter((nome): nome is string => Boolean(nome))
  };
}
