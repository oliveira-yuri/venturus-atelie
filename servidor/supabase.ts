import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cada tentativa de requisição ao Supabase desiste depois disso. */
const TIMEOUT_MS = 5_000;

/**
 * Cliente do Supabase, sempre com a sessao da pessoa lida do cookie.
 *
 * Nao existe cliente com chave que ignora o RLS neste projeto: nenhum caso de
 * uso precisou furar as politicas. Enquanto for assim, o codigo da rota e a
 * politica do banco sao um E — a requisicao precisa sobreviver aos dois, e o
 * efetivo e o mais restritivo. Ver spec §4.2.
 */
export async function obterCliente() {
  const armazenamento = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_CHAVE_PUBLICAVEL!,
    {
      cookies: {
        getAll: () => armazenamento.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) =>
              armazenamento.set(name, value, options));
          } catch {
            // Chamado de um Server Component, onde `cookies().set()` lanca:
            // a resposta ja comecou a ser montada, nao ha mais cabecalho
            // para escrever. E o unico caso em que este catch corre.
            //
            // ESCREVER COOKIE FUNCIONA nos dois lugares onde este projeto
            // precisa escrever, e nenhum deles passa por aqui:
            //
            //  - Server Action — `acoes/autenticacao.ts`. signInWithPassword
            //    e signOut gravam e apagam a sessao de verdade;
            //  - Route Handler — a rota `/auth/confirm`, que troca o codigo
            //    do link do e-mail pela sessao.
            //
            // O que ESTE catch engole, portanto, e so a RENOVACAO de token
            // tentada durante a renderizacao de uma pagina: o cliente
            // renova, nao consegue gravar o token novo, e a pagina renderiza
            // com a sessao que veio no cookie. Nada quebra na hora; na
            // proxima Action ou Route Handler a gravacao acontece.
            //
            // O middleware (middleware.ts) continua sem falar com o
            // Supabase: so cuida de CSP/nonce e dos redirects antigos. Se um
            // dia a renovacao no meio da navegacao passar a importar (sessao
            // expirando durante o uso do painel, RF33), o lugar de fazer
            // isso e la — um `getUser()` no middleware, que responde por
            // requisicao e pode escrever cabecalho.
          }
        }
      },
      // Duas causas separadas de latencia, medidas as duas de proposito
      // (Rodada de correcao 1 da Tarefa 10) porque a primeira sozinha nao
      // resolvia nada:
      //
      // 1. AbortSignal por tentativa: sem ele, uma tentativa contra host
      // inalcancavel so desiste no timeout padrao do fetch/SO.
      //
      // 2. db.retry desligado: o @supabase/postgrest-js tenta de novo
      // requisicoes GET por padrao, ate 3 vezes, com backoff exponencial
      // 1s/2s/4s ENTRE tentativas — medido com um host que falha rapido
      // (DNS resolve NXDOMAIN em ~15-40ms cada vez): 4 tentativas rapidas,
      // mas 7,2s TOTAIS de espera parada nos intervalos de backoff. So o
      // item 1 (AbortSignal) nao mudava esse numero em nada, porque a
      // demora nunca esteve numa tentativa pendurada — estava nos
      // intervalos entre tentativas que já falhavam rápido sozinhas.
      // listarAtividades/listarClipping (servidor/dados/conteudo.ts) ja
      // caem pro JSON versionado em qualquer erro OU excecao; essas duas
      // opcoes juntas sao o que garante que a excecao chega rapido o
      // bastante para quem visita o site nao sentir, mesmo com o Supabase
      // fora do ar de verdade (nao so DNS falhando rapido).
      db: { retry: false },
      global: {
        // AbortSignal.any (não sobrescrita direta): o postgrest-js preenche
        // init.signal quando alguém chama .abortSignal() na query. Ninguém
        // usa isso hoje, mas sobrescrever silenciosamente quebraria essa
        // chamada na primeira vez que a fase 2 precisar dela — o abort do
        // chamador simplesmente nunca abortaria nada. Combinando os dois,
        // a requisição desiste no que vier primeiro: o timeout daqui ou um
        // abort explícito de quem chamou.
        fetch: (entrada, init) => {
          const sinais = [AbortSignal.timeout(TIMEOUT_MS)];
          if (init?.signal) sinais.push(init.signal);
          return fetch(entrada, { ...init, signal: AbortSignal.any(sinais) });
        }
      }
    }
  );
}
