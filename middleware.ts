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
 * Tarefa 6, rodadas de correcao 1 e 2):
 *
 * NEM TUDO redireciona igual — confirmado com `curl -I` direto nas URLs,
 * sem depender do navegador:
 *
 *   - `vlibras-plugin.js`, `vlibras-plugin-app.js`, os icones
 *     (`vlibras-access.svg`, `vlibras-popup.webp`) e as fontes
 *     (`rawline-*.woff2`) respondem 302, redirecionando para
 *     `https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@v7.8.0/...`.
 *     O navegador reavalia a CSP contra o destino final do redirect, entao
 *     `img-src` e `font-src` precisam dos DOIS hosts — so `vlibras.gov.br`
 *     nao basta.
 *   - `https://vlibras.gov.br/app/unity/index.html` (o alvo do iframe do
 *     avatar) responde 200 DIRETO, sem redirecionar. Por isso `frame-src`
 *     lista so `vlibras.gov.br` — acrescentar `cdn.jsdelivr.net` aqui seria
 *     afrouxar a politica sem necessidade real.
 *
 * O icone abre um popup; clicar nele carrega `vlibras-plugin-app.js`, que
 * monta o `<iframe>` do avatar (precisa de `frame-src`) e fala com
 * `https://traducao2.vlibras.gov.br/translate` para buscar a traducao de
 * verdade (precisa de `connect-src`). Sem esses dois, o icone ate aparece,
 * mas a traducao em si falha — o widget nunca chega a servir pra quem
 * precisa dele. Uma medicao anterior desta tarefa tinha clicado so ate o
 * icone aparecer e nao tinha acionado a traducao — esse era o ponto cego,
 * corrigido na rodada 1 com um clique de verdade no botao.
 *
 * MECANISMO FRAGIL, achado na rodada 3 — NAO MEXER em script-src sem ler
 * isto: cada painel do menu (`dictionary-*.js`, `translator-*.js`,
 * `guide-*.js`, `about-*.js`, `settings-*.js` e outros) baixa o PROPRIO
 * bundle de `cdn.jsdelivr.net` SOB DEMANDA, so quando a pessoa abre aquele
 * painel. Isso passa pela politica sem NENHUM host em `script-src` — nao
 * ha `cdn.jsdelivr.net` nem `vlibras.gov.br` ali, de proposito. Funciona
 * porque `'strict-dynamic'` propaga a confianca do nonce a partir do
 * script inicial (`vlibras-plugin.js`, que TEM o nonce): qualquer script
 * que ELE carregar — e qualquer script que os scripts carregados por ele
 * carregarem, em cadeia — herda a mesma confianca, nao importa o host.
 *
 * Duas consequencias praticas: (1) acrescentar `cdn.jsdelivr.net` ou
 * qualquer outro host a `script-src` NAO faz nada de util — sob
 * 'strict-dynamic' esses hosts sao ignorados, exatamente como o `frame-src`
 * ja documentado acima nao precisa deles para os scripts, so para o iframe.
 * (2) remover `'strict-dynamic'` (ou trocar por uma lista de hosts) QUEBRA
 * todo painel carregado sob demanda, em silencio — o script do painel
 * deixaria de ter qualquer credencial de confianca. Se um dia alguem
 * precisar apertar `script-src`, meça de novo abrindo cada painel do menu
 * antes de mudar qualquer coisa aqui.
 *
 * `traducao2.vlibras.gov.br` E MEDIDO — RODADA 2 TINHA ERRADO AQUI, corrigido
 * na rodada 3. O comentario da rodada 2 dizia "por referencia no bundle,
 * nunca visto em requisicao real" — texto perigoso, porque instruiria quem
 * viesse depois a tirar o host da lista achando que era so teoria.
 *
 * Medido de verdade, em sessoes ISOLADAS (paginas novas, `performance.
 * getEntriesByType('resource')` com linha de base tirada 25s apos abrir o
 * widget — tempo de sobra pra qualquer chamada automatica de saudacao ja
 * ter acontecido — e so entao comparada com o que aparece depois de CADA
 * caminho, sozinho):
 *
 *   duplo clique num texto real da pagina  -> +2 chamadas a /translate
 *   Menu -> Tradutor -> digitar -> Traduzir -> +1 chamada a /translate
 *
 * Os DOIS caminhos chamam o host de verdade — nao so o Tradutor. Faz sentido
 * mecanicamente: um duplo clique seleciona a palavra sob o cursor, e esse
 * widget trata qualquer selecao de texto como um pedido de traducao,
 * chamando o mesmo endpoint que o painel Tradutor chama para o texto
 * digitado. (Uma correcao anterior desta mesma rodada tinha chegado a
 * escrever que so o Tradutor chamava o host — essa versao foi substituida
 * por esta, depois de medir de novo com sessoes isoladas; ver relatorio da
 * Tarefa 6, rodada 3, para o historico completo da divergencia.)
 *
 * `dicionario2.vlibras.gov.br` e `repositorio.vlibras.gov.br`: A RODADA 1
 * TINHA UM ERRO DE MODELO MENTAL AQUI, corrigido na rodada 2. O comentario
 * antigo dizia que o menu do player (Menu -> Dicionario) rodava dentro do
 * iframe Unity, com documento e politica proprios, e por isso nao precisava
 * entrar na nossa lista. Falso: o menu do player inteiro mora no shadow
 * root de `#vlibras-app-root`, NA PAGINA-MAE — so o avatar (a animacao 3D)
 * fica de fato dentro do iframe Unity. Clicar em Menu -> Dicionario dispara,
 * a partir da pagina-mae, sob a NOSSA politica:
 *   - `https://dicionario2.vlibras.gov.br/static/TREES/2018.3.1.json`
 *   - `https://repositorio.vlibras.gov.br/api/tags`
 * Sem os dois em `connect-src`, o Dicionario abre vazio — degradacao
 * silenciosa identica a de img-src/font-src na rodada 1, um nivel abaixo.
 * Confirmado clicando de verdade em Menu -> Dicionario, nao por suposicao.
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
    // aqui pelo mesmo motivo. Sem `data:`: a rodada 3 varreu o DOM, os dois
    // shadow roots do widget e o nosso codigo-fonte atras de um data:image
    // e nao achou nenhum uso — removido, e a suite inteira continuou verde.
    `img-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net`,
    // Todos os quatro MEDIDOS de verdade (ver comentario grande no topo do
    // arquivo). vlibras.gov.br: assets redirecionados e chamadas do menu do
    // player, que roda na pagina-mae. traducao2.vlibras.gov.br: acionado
    // por QUALQUER traducao de texto real — tanto duplo clique numa palavra
    // da pagina quanto Menu -> Tradutor -> Traduzir (medido nos dois,
    // isoladamente). dicionario2.vlibras.gov.br e repositorio.vlibras.gov.br:
    // Menu -> Dicionario busca categorias nesses dois. Sem qualquer um dos
    // quatro, o painel correspondente degrada em silencio — cada um ja foi
    // visto quebrando assim numa rodada desta tarefa.
    `connect-src 'self' https://vlibras.gov.br https://traducao2.vlibras.gov.br https://dicionario2.vlibras.gov.br https://repositorio.vlibras.gov.br`,
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
