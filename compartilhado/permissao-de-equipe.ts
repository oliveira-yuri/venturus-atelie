/**
 * A DECISÃO "esta resposta do banco prova que a pessoa é equipe?", isolada
 * do que faz a consulta.
 *
 * ===================================================================
 * FALHA FECHADA — E ISTO É O CONTRÁRIO DO RESTO DO SITE
 * ===================================================================
 *
 * `servidor/dados/degradacao.ts` é a política única de erro da camada de
 * dados: consulta que não volta NÃO derruba a página, vira lista vazia ou
 * JSON versionado, com aviso no log. Para conteúdo público isso está certo
 * — uma página institucional no ar com uma seção vazia é melhor que a
 * mesma página fora do ar.
 *
 * Aqui a mesma regra produziria o desastre exato: "não deu para perguntar
 * se é equipe" degradaria para ALGUM valor, e o único valor que mantém a
 * tela no ar é `true`. Um painel que ABRE quando o banco está fora do ar é
 * pior que um painel indisponível — nesse estado ninguém sabe quem é quem,
 * e as telas de P2/P3/P4 mostram nome, telefone e responsável de crianças
 * a partir de 10 anos (RN07, regra 9 do CLAUDE.md).
 *
 * Então a inversão é deliberada: **toda dúvida vira "não é equipe"**. Erro
 * do PostgREST, linha ausente, coluna ausente, prazo estourado, exceção de
 * rede — tudo o mesmo desfecho, `false`, e daí `notFound()` em
 * `app/admin/layout.tsx`. Quem ler isto depois e achar inconsistente com
 * `degradacao.ts` está lendo certo: são políticas opostas de propósito,
 * porque uma protege conteúdo público de sumir e a outra protege dado
 * pessoal de aparecer.
 *
 * O preço, dito em voz alta: com o Supabase fora do ar a equipe fica sem
 * painel e vê um 404 — a mesma tela de quem não tem permissão nenhuma, sem
 * nada que explique. É o lado certo do erro para errar, e o log
 * (`servidor/painel/permissao.ts`) é o único lugar onde a diferença
 * aparece.
 *
 * ===================================================================
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO, em compartilhado/
 * ===================================================================
 *
 * Porque sem ele a falha fechada não teria como ser MEDIDA. Todo módulo de
 * `servidor/` começa com `import 'server-only'`, que lança fora de um
 * React Server Component — é impossível importá-los de um teste do Node
 * (ver testes/servidor-so-no-servidor.test.mjs). E pelo HTTP também não
 * dá: sem sessão utilizável neste projeto (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2), `usuarioAtual()` devolve `null` antes de qualquer consulta
 * sair, então o ramo "a consulta falhou" nunca é alcançado por fetch.
 *
 * Isolando a decisão numa função pura, `testes/painel-guarda.test.mjs`
 * exercita os desfechos um a um, inclusive o que ninguém consegue produzir
 * de fora hoje: resposta com `error` E com `data` dizendo `eh_equipe:
 * true`. É a única forma honesta de afirmar que a guarda falha fechada.
 *
 * NADA AQUI AUTORIZA COISA ALGUMA SOZINHO. Esta função só lê uma resposta
 * que o Postgres já devolveu sob RLS — quem decide o que pode ser lido ou
 * gravado continua sendo a política do banco (regras 5 e 6 do CLAUDE.md).
 * `eh_equipe` só é concedido à mão no painel do Supabase, e um trigger
 * (`proteger_papel_equipe`, supabase/migrations/001_base.sql) recusa
 * qualquer tentativa de alterá-lo por fora.
 */

/** O formato que o PostgREST devolve: nunca lança, sempre `{ data, error }`. */
export type RespostaDePerfil = { data: unknown; error: unknown };

/**
 * `true` SÓ quando a consulta voltou sem erro e a linha diz, literalmente,
 * `eh_equipe: true`.
 *
 * Três detalhes que parecem preciosismo e não são:
 *
 *  1. `error` é checado ANTES de olhar o `data`. O PostgREST pode devolver
 *     os dois preenchidos, e confiar no `data` nesse caso seria acreditar
 *     numa resposta que o próprio servidor marcou como problemática.
 *  2. `=== true`, não "é verdadeiro". A string `'false'` é verdadeira em
 *     JavaScript. A coluna é `boolean not null` no Postgres, mas o que
 *     chega aqui é JSON decodificado, e o dia em que a consulta mudar (um
 *     `select` com apelido, uma view, um `rpc`) o valor pode chegar como
 *     texto — e a comparação frouxa promoveria a pessoa em silêncio.
 *  3. `data` ausente é `false` sem erro nenhum: é o que `.maybeSingle()`
 *     devolve quando não há linha com aquele id. Acontece de verdade com
 *     conta criada à mão no painel do Supabase antes do trigger
 *     `criar_perfil()` existir — pessoa autenticada, sem perfil.
 */
export function ehEquipeNaResposta(resposta: RespostaDePerfil): boolean {
  if (resposta.error) return false;

  const linha = resposta.data;
  if (!linha || typeof linha !== 'object') return false;

  return (linha as { eh_equipe?: unknown }).eh_equipe === true;
}
