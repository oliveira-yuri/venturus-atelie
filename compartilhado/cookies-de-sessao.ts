/**
 * "Esta requisição carrega uma sessão?" — respondido sem falar com a rede.
 *
 * POR QUE ISTO EXISTE, e por que mora em `compartilhado/` e não em
 * `servidor/`: os dois lugares que precisam da resposta rodam em runtimes
 * diferentes. `middleware.ts` roda no Edge (na Netlify, uma Edge Function
 * separada) e não pode importar nada que comece com `import 'server-only'`;
 * `servidor/sessao.ts` roda no Node. Duplicar a regra do nome do cookie nos
 * dois seria duas cópias de uma decisão que vem de uma biblioteca de fora —
 * o tipo de coisa que envelhece sozinha quando o `@supabase/ssr` mudar.
 *
 * O NOME DO COOKIE não é escolha deste projeto: o `@supabase/ssr` grava a
 * sessão em `sb-<ref-do-projeto>-auth-token` (o `storageKey` padrão) e, se
 * o valor não couber num cookie só, o parte em `...-auth-token.0`,
 * `...-auth-token.1` (MEDIDO lendo node_modules/@supabase/ssr/dist/main/
 * utils/chunker.js, `createChunks`, que numera `${key}.${i}`).
 *
 * O `(\.\d+)?` no fim é o que aceita os pedaços — e é também o que RECUSA
 * `sb-<ref>-auth-token-code-verifier`, o cookie do PKCE, que existe no
 * meio do fluxo do link de e-mail e NÃO é sessão. Tratá-lo como sessão faria
 * o middleware perguntar ao Supabase por gente que ainda não entrou, que é
 * exatamente o gasto que a guarda existe para evitar.
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ: dizer que a pessoa está autenticada. O cookie é
 * dado do navegador — qualquer um manda um cookie com esse nome e conteúdo
 * inventado. Isto aqui é só o filtro barato que decide se VALE A PENA
 * perguntar ao Supabase; quem responde de verdade é `getUser()`, que
 * verifica a assinatura no servidor de autenticação (ver servidor/sessao.ts).
 * Usar esta função para autorizar qualquer coisa seria confiar no cliente.
 */
const COOKIE_DE_SESSAO = /^sb-.+-auth-token(\.\d+)?$/;

export function temCookieDeSessao(nomes: Iterable<string>): boolean {
  for (const nome of nomes) {
    if (COOKIE_DE_SESSAO.test(nome)) return true;
  }
  return false;
}
