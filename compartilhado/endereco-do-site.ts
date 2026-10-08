/**
 * O endereço público do site, para o que precisa de URL ABSOLUTA: prévia do
 * WhatsApp (Open Graph), sitemap, botão "Compartilhar" e o .ics.
 *
 * Mesma ideia de `URL_DO_SITE` em `acoes/autenticacao.ts`, com uma diferença:
 * aqui o último recurso é o endereço oficial (www.atelieafrocultural.site) e
 * NÃO o `Host` da requisição — `Host` é cabeçalho do cliente, e um link de
 * compartilhamento montado com ele poderia apontar para outro domínio.
 */
const ENDERECO_OFICIAL = 'https://www.atelieafrocultural.site';

export function enderecoDoSite(env: Record<string, string | undefined> = process.env): string {
  const candidato = env.URL_DO_SITE?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || '';
  if (!candidato) return ENDERECO_OFICIAL;
  const limpo = candidato.replace(/\/+$/, '');
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
}

/** Caminho do próprio site (`/agenda`) → endereço absoluto. */
export function enderecoAbsoluto(caminho: string, env?: Record<string, string | undefined>): string {
  return `${enderecoDoSite(env)}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}
