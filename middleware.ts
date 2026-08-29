import { NextResponse, type NextRequest } from 'next/server';

/**
 * Politica de conteudo (CSP) com nonce por requisicao, mais os cabecalhos de
 * seguranca que o `netlify.toml` tambem aplica.
 *
 * Por que os dois arquivos coexistem, em vez de um substituir o outro: o
 * `matcher` abaixo exclui `_next/static`, `_next/image`, `favicon.ico` e
 * `fontes/` — caminhos que o Next serve como arquivo estatico, sem passar
 * por aqui. Se os cabecalhos saissem do `netlify.toml`, esses caminhos
 * ficariam sem cabecalho nenhum. O `netlify.toml` cobre o que este
 * middleware nao alcanca; este middleware acrescenta o CSP com nonce (que
 * so faz sentido por requisicao, nao em arquivo estatico) para as paginas.
 *
 * 'strict-dynamic' faz as fontes por host em script-src serem IGNORADAS —
 * por isso o VLibras nao entra na lista de hosts do script-src: ele recebe o
 * nonce na propria tag <script> (ver componentes/VLibras.tsx), e a confianca
 * propaga para os scripts que ele proprio carregar. connect-src, img-src,
 * font-src e frame-src nao sofrem com strict-dynamic e continuam precisando
 * do host explicito na lista.
 *
 * O QUE O VLIBRAS REALMENTE PEDE (medido, nao suposto — ver relatorio da
 * Tarefa 6, rodada de correcao 1):
 *
 * `https://vlibras.gov.br/app/*` responde 302 redirecionando para
 * `https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@v7.8.0/app/*`
 * para TUDO — o script principal, os icones, as fontes. O widget nao busca
 * do jsDelivr por conta propria: e o gov.br quem redireciona pra la. A CSP
 * valida o destino final do redirecionamento, entao toda diretiva que toque
 * asset do widget (img-src, font-src) precisa dos dois hosts — so
 * `vlibras.gov.br` nao basta, porque o navegador reavalia a politica contra
 * a URL de destino do redirect.
 *
 * O icone abre um popup; clicar nele carrega `vlibras-plugin-app.js`, que
 * monta um `<iframe>` para `https://vlibras.gov.br/app/unity/index.html`
 * (precisa de `frame-src`, que cai em `default-src` se nao for listado) e
 * fala com `https://traducao2.vlibras.gov.br/translate` para buscar a
 * traducao de verdade (precisa de `connect-src`). Sem esses dois, o icone
 * ate aparece, mas a traducao em si falha — o widget nunca chega a servir
 * pra quem precisa dele. Uma medicao anterior desta tarefa tinha clicado so
 * ate o icone aparecer e nao tinha acionado a traducao — esse era o ponto
 * cego, corrigido nesta rodada com um clique de verdade no botao.
 *
 * NAO acrescentado: `dicionario2.vlibras.gov.br`. Ele aparece no bundle do
 * widget, mas e baixado de dentro do `<iframe>` Unity, que tem documento e
 * politica proprios — nao herda a nossa. Sem medir aquele documento
 * separadamente, acrescentar esse host aqui seria suposicao, nao medicao.
 */
export function middleware(requisicao: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const politica = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // unsafe-inline em style NAO e para o React — o React nao injeta estilo
    // inline nesta pagina. E para o VLibras: o widget escreve seu proprio
    // <style> via innerHTML dentro do shadow root que ele mesmo cria.
    // Medido removendo a diretiva: um unico bloqueio apareceu, e era esse
    // <style> do widget. NAO trocar por 'nonce-...': estilo injetado por
    // innerHTML nunca carrega o atributo nonce, e a troca quebraria o
    // widget em silencio (sem erro visivel, so sem o estilo aplicado).
    `style-src 'self' 'unsafe-inline'`,
    // vlibras.gov.br redireciona (302) pra cdn.jsdelivr.net em tudo — ver
    // comentario grande no topo do arquivo. Os dois hosts sao necessarios
    // aqui pelo mesmo motivo.
    `img-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net`,
    // vlibras.gov.br: redirect dos assets (ver topo). traducao2.vlibras.gov.br:
    // e para onde o widget manda o texto pra traduzir de verdade, acionado
    // só depois do clique no icone — sem isso a traducao falha em silencio.
    `connect-src 'self' https://vlibras.gov.br https://traducao2.vlibras.gov.br`,
    // Mesmo motivo do img-src: as fontes do widget (rawline-*.woff2) tambem
    // passam pelo redirect de vlibras.gov.br para cdn.jsdelivr.net.
    `font-src 'self' https://vlibras.gov.br https://cdn.jsdelivr.net`,
    // O iframe Unity que renderiza o avatar/traducao so existe depois do
    // clique no icone — sem esta diretiva ele cai em default-src 'self' e
    // e bloqueado, e a traducao nunca aparece.
    `frame-src https://vlibras.gov.br`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Endurecimento barato e padrao: nada de <object>/<embed>/<applet>.
    `object-src 'none'`
  ].join('; ');

  const cabecalhos = new Headers(requisicao.headers);
  cabecalhos.set('x-nonce', nonce);
  // Alem do x-nonce (que os nossos proprios componentes leem via
  // headers().get('x-nonce') em app/layout.tsx), o Next tambem precisa da
  // politica no cabecalho DA REQUISICAO — nao so na resposta. E dali que o
  // proprio Next extrai o nonce (via padrao 'nonce-{valor}') pra aplicar
  // aos scripts que ele mesmo injeta (runtime do React, bundles de pagina).
  // Sem isto, funciona local por acidente: uma funcao interna do dev server
  // copia cabecalhos de resposta de volta pra requisicao, mas isso nao e
  // garantido em toda plataforma de deploy (Netlify roda middleware como
  // Edge Function separada). Sem essa linha, em producao 'strict-dynamic'
  // faria o navegador ignorar 'self' e nenhum script do Next executaria —
  // site sem hidratacao, sem menu, sem acessibilidade, sem VLibras, com a
  // suite local toda verde.
  cabecalhos.set('Content-Security-Policy', politica);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set('Content-Security-Policy', politica);
  resposta.headers.set('X-Content-Type-Options', 'nosniff');
  resposta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  resposta.headers.set('X-Frame-Options', 'DENY');
  // PREVIA: remover no lancamento. Nao ha robots.txt no app Next ainda
  // (/robots.txt da 404 nesta fase) — este cabecalho e a unica barreira
  // contra indexacao ate a pagina de robots nascer.
  resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return resposta;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fontes/).*)' }]
};
