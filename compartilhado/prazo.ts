/**
 * Um prazo em volta de uma promessa — e o defeito MEDIDO que fez isto nascer.
 *
 * O TIMEOUT POR TENTATIVA NÃO BASTA, e a diferença entre um e outro custou 50
 * segundos de resposta num teste. Medido em 30/08/2026, com o servidor de
 * autenticação inalcançável e um `AbortSignal.timeout(3s)` em cada `fetch`:
 * uma página levou **50,9 s** para responder. O motivo está em
 * node_modules/@supabase/auth-js — `_refreshAccessToken` REPETE a tentativa
 * com espera exponencial (200 ms, 400, 800, 1600…) enquanto
 * `Date.now() - inicio < AUTO_REFRESH_TICK_DURATION_MS` (30 s), e falha de
 * rede — inclusive um `abort` — é justamente o erro que ela considera
 * repetível. Ou seja: o abort corta cada tentativa, e a biblioteca começa
 * outra. O tempo total é a soma, não o máximo.
 *
 * O QUE ISSO SIGNIFICA EM PRODUÇÃO, se ninguém puser um prazo total: com o
 * Supabase fora do ar, TODA requisição de quem está autenticado fica ~50 s
 * pendurada — no middleware, que roda em todas as rotas. Não é uma página
 * lenta: é o site inteiro parado para quem tem cookie de sessão, e na
 * Netlify é também a função sendo cobrada por esse tempo. É exatamente o
 * modo de falha que a política de degradação do projeto existe para impedir
 * (servidor/dados/degradacao.ts).
 *
 * NÃO CANCELA NADA, e é bom que fique dito: quando o prazo vence, a promessa
 * original continua correndo até onde for — o que se ganha é a RESPOSTA
 * seguir sem ela. Por isso os dois andam juntos e nenhum substitui o outro:
 * o `AbortSignal` por tentativa (servidor/supabase.ts e middleware.ts) corta
 * a conexão pendurada, e este prazo corta a espera acumulada.
 *
 * Mora em `compartilhado/` porque os dois chamadores rodam em runtimes
 * diferentes: `middleware.ts` é bundle de Edge e não pode importar nada de
 * `servidor/`, que é todo `import 'server-only'`.
 */

/**
 * Devolve o valor da promessa, ou `null` se ela passar do prazo.
 *
 * `null` e não uma exceção: quem chama já trata "não deu para saber" como
 * visitante, e transformar prazo estourado em `throw` obrigaria cada
 * chamador a lembrar de capturar — a política do projeto é que a camada de
 * dados não lança para cima.
 */
export function comPrazo<T>(promessa: Promise<T>, milissegundos: number): Promise<T | null> {
  // A promessa original pode rejeitar DEPOIS de o prazo vencer, quando
  // ninguém mais está esperando por ela — e uma rejeição sem tratamento
  // derruba o processo do Node. Este `catch` é só a rede para esse caso: ele
  // não engole a rejeição para quem chamou, porque `Promise.race` abaixo
  // continua observando a promessa original, e não esta derivada.
  promessa.catch(() => {});

  return Promise.race([
    promessa,
    new Promise<null>((resolve) => { setTimeout(() => resolve(null), milissegundos); })
  ]);
}
