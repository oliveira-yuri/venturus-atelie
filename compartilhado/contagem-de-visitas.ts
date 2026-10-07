/**
 * Contagem de visitas SEM cookie (GoatCounter): conta páginas vistas, não
 * pessoas. Fica DESLIGADA até alguém criar a conta e cadastrar o código na
 * variável `GOATCOUNTER_CODIGO` — sem ela nada é carregado, nenhum host novo
 * entra na política de conteúdo e /privacidade não fala disso.
 *
 * O código vira parte de um endereço (`<codigo>.goatcounter.com`) e de uma
 * diretiva de CSP, então só aceita letras minúsculas, dígitos e hífen.
 */
const CODIGO_VALIDO = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/;

export function codigoDaContagem(env: Record<string, string | undefined> = process.env): string | null {
  const codigo = env.GOATCOUNTER_CODIGO?.trim().toLowerCase();
  return codigo && CODIGO_VALIDO.test(codigo) ? codigo : null;
}

export function hostDaContagem(env?: Record<string, string | undefined>): string | null {
  const codigo = codigoDaContagem(env);
  return codigo ? `https://${codigo}.goatcounter.com` : null;
}
