import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { REDIRECTS_ANTIGOS } from './compartilhado/redirects-antigos';
import { temCookieDeSessao } from './compartilhado/cookies-de-sessao';
import { comPrazo } from './compartilhado/prazo';

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
 * nas rodadas 3 e 4. O comentario da rodada 2 dizia "por referencia no
 * bundle, nunca visto em requisicao real" — texto perigoso, porque
 * instruiria quem viesse depois a tirar o host da lista achando que era so
 * teoria.
 *
 * O widget toca uma ANIMACAO DE SAUDACAO automatica uns +4,3s depois de
 * abrir, que TAMBEM marca `data-status="playing"` mas SEM NENHUMA
 * requisicao de rede — achado da rodada 4, depois de duas medicoes daquela
 * mesma tabela darem respostas diferentes (rodada 3 evitou a saudacao sem
 * saber, esperando 25s antes de clicar; uma re-medicao clicou logo apos o
 * widget assentar em "idle", ~220ms, e pegou a saudacao em vez da
 * traducao). Tabela medida (espera apos o idle x status no clique x
 * chamadas a /translate):
 *
 *   1000ms / 3000ms de espera            -> idle,    0 chamadas
 *   5000/8000/12000/20000/25000ms        -> playing, 2 chamadas
 *
 * Ou seja: clicar MUITO cedo apos o idle cai numa janela morta sem efeito
 * de rede; esperar alguns segundos (a partir de uns 5s) garante traducao
 * de verdade. Com essa condicao respeitada (ver testes/csp-vlibras.test.mjs,
 * que agora espera ~7s apos o idle antes do duplo clique), MEDIDO em
 * sessoes ISOLADAS (paginas novas, `performance.getEntriesByType('resource')`,
 * linha de base tirada 25s apos abrir o widget):
 *
 *   duplo clique, com o player ja carregado ha uns 5s+  -> +2 chamadas a /translate
 *   Menu -> Tradutor -> digitar -> Traduzir              -> +1 chamada a /translate
 *
 * Os DOIS caminhos chamam o host de verdade, DESDE QUE o duplo clique
 * aconteça depois da janela morta — nao e "qualquer duplo clique, a
 * qualquer momento". (Duas correcoes anteriores desta mesma diretiva
 * chegaram a escrever, primeiro, que so o Tradutor chamava o host, depois
 * que qualquer duplo clique chamava sem condicao nenhuma — as duas foram
 * substituidas por esta, apos arbitragem entre medicoes conflitantes; ver
 * relatorio da Tarefa 6, rodadas 3 e 4, para o historico completo.)
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
/**
 * A origem do projeto Supabase, no formato que a CSP espera (" https://..."),
 * ou string vazia quando nao ha projeto configurado.
 *
 * `new URL(...).origin` e nao a variavel crua: SUPABASE_URL pode vir com
 * barra no fim, com caminho, ou malformada — e uma diretiva de CSP com lixo
 * dentro nao da erro, so deixa de valer. Origem invalida vira string vazia,
 * que e a mesma coisa que nao ter configurado: a imagem nao carrega, o que e
 * visivel, em vez de a politica inteira ficar mal formada, que nao e.
 */
function hostDoSupabase(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) return '';

  try {
    return ` ${new URL(url).origin}`;
  } catch {
    console.warn('[csp] SUPABASE_URL nao e uma URL valida: as fotos da galeria vao ser '
      + 'bloqueadas pela politica de conteudo.');
    return '';
  }
}

export async function middleware(requisicao: NextRequest) {
  // Redirects das URLs antigas em .html (Tarefa A7, rodada de correção 1).
  // Ver o comentário grande em compartilhado/redirects-antigos.ts para o
  // porquê de morar aqui e não em next.config.ts `redirects()`: só assim o
  // Cache-Control abaixo sobrevive até a resposta sair (medido com curl).
  // Comparação exata de pathname — nenhuma dessas URLs antigas tem parâmetro
  // de rota (tudo o que vier depois de `?` é query string, tratada abaixo).
  const antigo = REDIRECTS_ANTIGOS.find(({ origem }) => requisicao.nextUrl.pathname === origem);
  if (antigo) {
    // A query string PRECISA sobreviver (rodada de correção 2 — regressão
    // desta própria tarefa, sem teste cobrindo na rodada 1): `new
    // URL(antigo.destino, requisicao.url)` sozinho descarta o `search` da
    // requisição original. Um link antigo do tipo
    // `/quem-somos.html?utm_source=folha&fbclid=abc` — o tipo exato que já
    // circulou, com parâmetro de campanha — perderia esses parâmetros.
    //
    // Consumidor real hoje: só `app/acervo/page.tsx`, que lê `?busca`.
    // Correção de fato (Tarefa A8): este comentário citava também
    // `site/assets/js/paginas/entrar.js` lendo `?destino`. Aquele arquivo
    // era do site estático, que a Netlify não publica desde a migração
    // (`publish = ".next"`), e o app novo não lê `destino` em lugar nenhum
    // — o redirecionamento pós-login é Bloco B. O parâmetro de campanha,
    // esse sim, chega de link que já circulou e justifica a propagação
    // sozinho.
    const urlDestino = new URL(antigo.destino, requisicao.url);
    urlDestino.search = requisicao.nextUrl.search;

    const respostaRedirect = NextResponse.redirect(urlDestino, 301);
    // Cache-Control limitado (não ausente, não indefinido): sem cabeçalho
    // explícito um 301 é cacheável por heurística do navegador, e o cache
    // de redirect é notoriamente difícil de limpar. Se um destino precisar
    // de correção — ou se `/admin/index.html` ganhar redirect de verdade no
    // dia em que o Bloco B publicar `/admin` — quem já visitou ficaria
    // preso ao destino antigo sem forma de propagar a correção. max-age=3600
    // limita esse travamento a 1h; must-revalidate impede servir a versão
    // vencida sem checar de novo. Vale igual para 301 e 308 — não decorre
    // da escolha do código de status.
    respostaRedirect.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    return respostaRedirect;
  }

  // RENOVAÇÃO DA SESSÃO — precisa acontecer AQUI, antes da linha seguinte, e
  // a ordem não é gosto: `new Headers(requisicao.headers)` logo abaixo tira
  // uma FOTOGRAFIA dos cabeçalhos que seguem para a renderização. Se a
  // renovação rodasse depois, o cookie novo iria para a resposta (o
  // navegador ficaria certo) mas NÃO para a requisição que renderiza esta
  // página — a página seria desenhada com o token vencido, e a pessoa veria
  // "Entrar" no cabeçalho na exata requisição em que a sessão foi renovada.
  // Ver renovarSessao() abaixo para o resto do porquê.
  const cookiesDaRenovacao = await renovarSessao(requisicao);

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
    // aqui pelo mesmo motivo. `data:` FICA — necessario de verdade,
    // confirmado na rodada 3: rodar so a suite (que nao exercita o fluxo
    // de traducao) continuava verde sem `data:`, mas exercitando duplo
    // clique + Menu -> Tradutor -> Traduzir com o console armado, a
    // remocao reproduziu ao vivo um bloqueio de
    // `data:image/png;base64,...`. O no exato do DOM que carrega essa
    // imagem nao foi localizado (provavel miniatura/quadro transitorio do
    // avatar durante a traducao, substituido antes de dar tempo de
    // inspecionar) — mas o bloqueio ao vivo, reproduzido, e evidencia
    // suficiente. NAO REMOVER sem repetir essa medicao (rodar a suite
    // sozinha nao basta).
    // O HOST DO SUPABASE ENTRA AQUI, E SÓ AQUI — Tarefa P3 (galeria).
    //
    // As fotos da galeria vivem no bucket `galeria` do Storage
    // (006_storage.sql) e sao servidas pelo host do projeto Supabase. Sem
    // esta entrada o <img> e BLOQUEADO EM SILENCIO: a galeria fica com
    // buracos brancos, o painel mostra miniaturas vazias, e nada aparece
    // em teste nenhum — so no console de quem abrir a pagina.
    //
    // O QUE ISTO **NAO** AFROUXA, e precisa estar escrito porque parece que
    // afrouxa: o CLAUDE.md lista o `connect-src` sem o Supabase como uma
    // das tres camadas que impedem o NAVEGADOR de falar com o banco. Essa
    // camada continua intacta — `img-src` permite BAIXAR IMAGEM daquele
    // host, e nada mais. Nao permite fetch, nao permite XHR, nao permite
    // WebSocket: a diretiva que governa isso e `connect-src`, logo abaixo,
    // e o host do Supabase continua fora dela. E o bucket ja e publico por
    // decisao do projeto, entao a imagem nao carrega credencial nenhuma.
    //
    // MONTADO EM EXECUCAO a partir de SUPABASE_URL, e nao escrito a mao:
    // duas cópias do host (uma na variavel de ambiente, outra aqui) e a
    // forma de a galeria quebrar no dia em que o projeto Supabase mudar.
    // Sem a variavel, nada e acrescentado — que e o caso do modo offline
    // da suite e o de um deploy sem as variaveis (CLAUDE.md, item 0e).
    `img-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net${hostDoSupabase()}`,
    // Todos os quatro MEDIDOS de verdade (ver comentario grande no topo do
    // arquivo). vlibras.gov.br: assets redirecionados e chamadas do menu do
    // player, que roda na pagina-mae. traducao2.vlibras.gov.br: acionado por
    // Menu -> Tradutor -> Traduzir, e tambem por duplo clique num texto da
    // pagina — mas so com o player ja carregado ha uns 5s+ (clicar logo
    // apos abrir cai numa janela sem chamada de rede, que uma animacao de
    // saudacao automatica pode confundir com traducao de verdade — ver
    // comentario grande no topo). dicionario2.vlibras.gov.br e
    // repositorio.vlibras.gov.br: Menu -> Dicionario busca categorias
    // nesses dois. Sem qualquer um dos quatro, o painel correspondente
    // degrada em silencio — cada um ja foi visto quebrando assim numa
    // rodada desta tarefa.
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
  // PREVIA: REMOVER NO LANCAMENTO — E SAO TRES LUGARES, NAO SO ESTE:
  //   1. esta linha (middleware.ts) — vale para as paginas renderizadas;
  //   2. `X-Robots-Tag` em netlify.toml — vale para o que a CDN serve
  //      direto, inclusive os caminhos que o `matcher` daqui exclui;
  //   3. `app/robots.ts` — trocar o `disallow` por `allow`.
  // Nenhum dos tres, esquecido sozinho, produz erro visivel: o site sobe,
  // as pessoas navegam normalmente, e so o buscador some. Ate a revisao
  // final do Bloco A este comentario dizia "remover no lancamento" sem
  // dizer que havia outros dois — e quem seguisse so ele publicaria um
  // site invisivel achando que tinha terminado. Desde entao ha teste que
  // NAO deixa isso passar: testes/noindex.test.mjs mede os tres e falha se
  // um sair sozinho.
  resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // O outro lado da renovação: o token novo precisa CHEGAR ao navegador,
  // senão ele manda o vencido de novo na requisição seguinte e a renovação
  // vira um custo por requisição que nunca conclui. Na esmagadora maioria
  // das requisições esta lista está vazia — ou não havia sessão, ou o token
  // ainda valia e o Supabase não pediu para gravar nada.
  for (const { name, value, options } of cookiesDaRenovacao) {
    resposta.cookies.set(name, value, options);
  }

  return resposta;
}

/**
 * Quanto tempo o middleware espera o Supabase antes de desistir — e são DOIS
 * relógios, não um.
 *
 * O de baixo corta cada `fetch`; o de cima corta a espera INTEIRA, porque o
 * `@supabase/auth-js` repete a renovação com espera exponencial por até 30 s
 * e um abort só faz ele começar a tentativa seguinte. Sem o prazo total,
 * MEDIDO: 50,9 s de resposta com o servidor de autenticação inalcançável.
 * O porquê inteiro está em compartilhado/prazo.ts.
 */
const TIMEOUT_RENOVACAO_MS = 3_000;

/** O que a renovação pediu para gravar no navegador. */
type CookieParaGravar = { name: string; value: string; options: CookieOptions };

/**
 * Renova o token de acesso da sessão, quando há sessão.
 *
 * POR QUE NO MIDDLEWARE, e não na página: Server Component NÃO PODE ESCREVER
 * COOKIE — quando ele roda, a resposta já começou a ser montada e não há
 * mais cabeçalho para escrever. É o `catch` vazio do bloco `setAll` em
 * servidor/supabase.ts, que hoje engole exatamente esta gravação. Sem
 * alguém que possa gravar, o token de acesso vence (uma hora, por padrão) e
 * a pessoa é deslogada no meio do uso mesmo tendo refresh token válido.
 * Middleware roda ANTES da resposta existir: é o único lugar do fluxo de
 * navegação que pode gravar. Aquele comentário em servidor/supabase.ts já
 * apontava para cá; esta função é o que ele previa.
 *
 * TRÊS CUIDADOS QUE NÃO VÊM DA DOCUMENTAÇÃO DO @supabase/ssr, e que existem
 * porque este middleware roda na Netlify como Edge Function, coisa que
 * NUNCA foi exercitada de verdade (CLAUDE.md, "O que trava hoje", item 0):
 *
 *  1. SÓ MONTA O CLIENTE SE HOUVER COOKIE DE SESSÃO — e a frase é essa,
 *     medida, não a que estava escrita aqui antes. A primeira versão dizia
 *     que sem a guarda haveria "uma chamada de rede em toda visita";
 *     MEDIDO removendo a guarda e contando o que chega num servidor de
 *     mentira no lugar do Supabase (testes/renovacao-da-sessao.test.mjs):
 *     ZERO chamadas de autenticação numa visita anônima, com ou sem ela.
 *     O `@supabase/auth-js` já devolve AuthSessionMissingError sem sair
 *     para a rede quando não há sessão no armazenamento.
 *
 *     O que a guarda economiza, então, é montar o cliente e ler os cookies
 *     em toda visita de um site institucional, que é quase todo tráfego
 *     anônimo — e, o que importa mais, é ela que faz a garantia PARAR DE
 *     DEPENDER do interior de uma biblioteca de terceiro. Sem ela, basta
 *     essa biblioteca mudar de ideia (ou alguém trocar `getUser()` por
 *     outra chamada) para toda visita anônima passar a esperar rede antes
 *     de renderizar. A guarda está em compartilhado/cookies-de-sessao.ts,
 *     com teste próprio.
 *  2. NUNCA LANÇA. Qualquer falha — rede, DNS, timeout, Supabase fora do ar
 *     — devolve lista vazia e a requisição segue como se a pessoa fosse
 *     visitante. O pior desfecho aceitável é ver "Entrar" estando
 *     autenticado; um middleware que lança derruba a página inteira, e
 *     derruba TODAS as páginas, porque ele roda em todas.
 *  3. TIMEOUT PRÓPRIO, mais curto que os 5s de servidor/supabase.ts. Lá o
 *     tempo é gasto por uma página que tem conteúdo para degradar; aqui é
 *     cobrado de toda requisição de quem está autenticado, e o que se perde
 *     desistindo é só a renovação — o token atual continua valendo, e a
 *     próxima requisição tenta de novo.
 *
 * NÃO REGISTRA no log o caso comum de token expirado sem renovação possível:
 * `getUser()` devolve isso em `{ error }`, não como exceção, e é o desfecho
 * NORMAL de quem passou dias sem voltar. Mesmo critério de
 * servidor/sessao.ts. O que vira log é só o que ninguém consegue explicar
 * olhando a tela: rede, DNS, timeout.
 */
async function renovarSessao(requisicao: NextRequest): Promise<CookieParaGravar[]> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_CHAVE_PUBLICAVEL;

  // Mesma pergunta de temSupabase() (servidor/dados/degradacao.ts), repetida
  // aqui de propósito: aquele módulo começa com `import 'server-only'` e
  // importá-lo do middleware, que é bundle de Edge, é justamente o que o
  // 'server-only' existe para impedir. Sem as variáveis não há o que
  // renovar — é o modo offline da suíte e o deploy sem as variáveis no
  // painel da Netlify (item 0e de "O que trava hoje").
  if (!url || !chave) return [];

  if (!temCookieDeSessao(requisicao.cookies.getAll().map(({ name }) => name))) return [];

  const paraGravar: CookieParaGravar[] = [];

  try {
    const supabase = createServerClient(url, chave, {
      cookies: {
        getAll: () => requisicao.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value, options } of lista) {
            // NOS DOIS LUGARES, e são coisas diferentes: na REQUISIÇÃO para
            // que a renderização desta mesma página já use o token novo (é
            // daqui que servidor/sessao.ts vai ler), e a lista devolvida
            // para quem chamou gravar na RESPOSTA, para o navegador mandar o
            // token novo da próxima vez. Fazer só um dos dois produz um
            // defeito que só aparece de vez em quando, na requisição em que
            // o token vence.
            requisicao.cookies.set(name, value);
            paraGravar.push({ name, value, options });
          }
        }
      },
      global: {
        fetch: (entrada, init) => {
          const limite = AbortSignal.timeout(TIMEOUT_RENOVACAO_MS);
          return fetch(entrada, {
            ...init,
            signal: init?.signal ? AbortSignal.any([init.signal, limite]) : limite
          });
        }
      }
    });

    // getUser() e não getSession(): getSession() acredita no cookie, que é
    // dado do navegador. Ver o comentário grande de servidor/sessao.ts. Aqui
    // o valor de retorno não interessa — o efeito colateral (renovar e
    // mandar gravar, via setAll acima) é o ponto.
    const concluiu = await comPrazo(supabase.auth.getUser(), TIMEOUT_RENOVACAO_MS);

    if (concluiu === null) {
      console.warn('[sessao] a renovação do token passou de '
        + `${TIMEOUT_RENOVACAO_MS}ms e a requisição seguiu sem esperar. `
        + 'A página vai ao ar com o cookie que veio; se ele já tiver vencido, a pessoa '
        + 'aparece como visitante mesmo estando autenticada.');
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.warn('[sessao] não foi possível renovar o token nesta requisição: '
      + `${motivo}. A página segue com o cookie que veio; se ele já tiver vencido, `
      + 'a pessoa aparece como visitante mesmo estando autenticada.');
    return [];
  }

  // Cópia, e não a lista viva: se a renovação estourou o prazo, ela continua
  // correndo em segundo plano e pode chamar `setAll` depois — gravar na
  // resposta um cookie que chegou tarde demais é pior que não gravar.
  return [...paraGravar];
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|fontes/).*)' }]
};
