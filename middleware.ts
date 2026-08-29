import { NextResponse, type NextRequest } from 'next/server';

/**
 * Politica de conteudo (CSP) com nonce por requisicao, mais os cabecalhos de
 * seguranca que o `netlify.toml` tambem aplica.
 *
 * Por que os dois arquivos coexistem, em vez de um substituir o outro: o
 * `matcher` abaixo exclui `_next/static`, `_next/image`, `favicon.ico` e
 * `fontes` — caminhos que o Next serve como arquivo estatico, sem passar por
 * aqui. Se os cabecalhos saissem do `netlify.toml`, esses caminhos ficariam
 * sem cabecalho nenhum. O `netlify.toml` cobre o que este middleware nao
 * alcanca; este middleware acrescenta o CSP com nonce (que so faz sentido
 * por requisicao, nao em arquivo estatico) para as paginas.
 *
 * 'strict-dynamic' faz as fontes por host em script-src serem IGNORADAS —
 * por isso o VLibras nao entra na lista de hosts do script-src: ele recebe o
 * nonce na propria tag <script> (ver componentes/VLibras.tsx), e a confianca
 * propaga para os scripts que ele proprio carregar. connect-src e img-src
 * nao sofrem com strict-dynamic e continuam precisando do host na lista —
 * confirmado medindo o console com a politica aplicada (ver relatorio da
 * Tarefa 6).
 */
export function middleware(requisicao: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const politica = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // unsafe-inline em style e pragmatico: o React injeta estilo inline e o
    // risco de style-src e ordens de magnitude menor que o de script-src.
    `style-src 'self' 'unsafe-inline'`,
    // cdn.jsdelivr.net entrou medindo: o VLibras busca seu proprio icone e
    // popup (vlibras-access.svg, vlibras-popup.webp) desse CDN, nao de
    // vlibras.gov.br — sem isso o widget carrega mas fica sem os icones,
    // uma falha silenciosa (ver relatorio da Tarefa 6).
    `img-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net`,
    `connect-src 'self' https://vlibras.gov.br`,
    `font-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`
  ].join('; ');

  const cabecalhos = new Headers(requisicao.headers);
  cabecalhos.set('x-nonce', nonce);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set('Content-Security-Policy', politica);
  resposta.headers.set('X-Content-Type-Options', 'nosniff');
  resposta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  resposta.headers.set('X-Frame-Options', 'DENY');
  // PREVIA: remover no lancamento, junto com o Disallow do robots.txt.
  resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return resposta;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fontes).*)' }]
};
