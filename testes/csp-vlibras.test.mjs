/**
 * Portao de risco da migracao: politica de conteudo (CSP) com nonce e o
 * widget VLibras carregando E TRADUZINDO sob ela.
 *
 * `vlibras-plugin.js` so monta o icone. A traducao de verdade
 * (`vlibras-plugin-app.js`, iframe Unity, chamada a `/translate`) so carrega
 * no clique do botao — por isso este arquivo tem um teste que clica de
 * verdade (dentro do shadow root do widget), nao so verifica o icone
 * fechado. Uma rodada anterior desta tarefa media só o icone e passava
 * verde com a traducao de fato bloqueada — o ponto cego que este teste
 * existe para fechar.
 *
 * A API classica `manage().logs().get('browser')` nao existe neste
 * geckodriver para Firefox (responde "HTTP method not allowed" — mesmo
 * achado documentado em testes/hidratacao.test.mjs). Por isso usamos o
 * inspetor de log do WebDriver BiDi, que e o caminho que de fato funciona
 * neste ambiente, para capturar toda mensagem de bloqueio que a politica
 * gerar no console.
 *
 * Este teste tem que falhar fechado: se o inspetor de log nao inicializar,
 * ele nao tem como observar nada, e um teste cego que passa e pior que
 * nenhum teste — o widget podia estar falhando em silencio.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import getLogInspector from 'selenium-webdriver/bidi/logInspector.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * "Refused to" e a frase do Chromium. Este projeto testa em Firefox (mesmo
 * navegador dos outros testes de navegador.test.mjs), que relata bloqueio de
 * CSP com uma frase totalmente diferente — em pt-BR, medido: "As
 * configuracoes da pagina bloquearam o carregamento de um recurso (...)
 * porque viola a seguinte diretiva". Um teste que so procurasse "Refused to"
 * passaria "verde" aqui mesmo com recursos recusados — exatamente o
 * falso-negativo que este filtro existe para evitar.
 */
function contemRecusaDePolitica(texto) {
  return /Refused to/i.test(texto)
    || (/Content-Security-Policy/i.test(texto) && /bloque|blocked/i.test(texto));
}

test('a resposta traz nonce e a politica cobre o VLibras', async () => {
  const resposta = await fetch(`${BASE}/`);
  const politica = resposta.headers.get('content-security-policy');
  assert.ok(politica, 'sem CSP');
  assert.match(politica, /script-src[^;]*'nonce-/, 'script-src sem nonce');
  assert.match(politica, /connect-src[^;]*vlibras\.gov\.br/, 'connect-src sem o VLibras');
  assert.match(politica, /img-src[^;]*vlibras\.gov\.br/, 'img-src sem o VLibras');
  // A traducao de verdade precisa do iframe Unity: sem frame-src, ele cai em
  // default-src 'self' e e bloqueado assim que alguem clica no icone.
  assert.match(politica, /frame-src[^;]*vlibras\.gov\.br/, 'frame-src sem o VLibras — o iframe de traducao seria bloqueado');
});

let navegador;
let erroInspetor;
let mensagensConsole;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless').enableBidi())
    .build();

  mensagensConsole = [];
  try {
    const inspetor = await getLogInspector(navegador);
    await inspetor.onConsoleEntry((entrada) => { mensagensConsole.push(entrada.text); });
    await inspetor.onJavascriptException((entrada) => { mensagensConsole.push(entrada.text); });
  } catch (erro) {
    erroInspetor = erro;
  }
});

after(async () => { await navegador?.quit(); });

test('nenhum recurso e recusado pela politica com o widget fechado', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o VLibras se monta num setTimeout

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [], `a politica recusou algo: ${JSON.stringify(recusas)}`);
});

test('o widget VLibras monta e recebe a correcao de acessibilidade', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000);

  const estado = await navegador.executeScript(`
    const area = document.getElementById('vlibras-access-wrapper');
    if (!area) return { existe: false };
    return {
      existe: true,
      role: area.getAttribute('role'),
      label: area.getAttribute('aria-label'),
      imagensSemAlt: area.shadowRoot
        ? area.shadowRoot.querySelectorAll('img:not([alt])').length
        : null
    };
  `);

  assert.ok(estado.existe, 'o widget VLibras nao montou — vlibras-access-wrapper nao existe');
  assert.equal(estado.role, 'complementary', 'o wrapper do VLibras deveria ter role complementary');
  assert.equal(estado.label, 'Tradução para Libras');
  assert.equal(estado.imagensSemAlt, 0, 'ainda ha imagem sem alt dentro do shadow root do VLibras');
});

test('clicar no botao do VLibras aciona a traducao de verdade, sem bloqueio de politica', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o widget fechado se monta num setTimeout

  // O botao mora dentro do shadow root aberto de #vlibras-access-wrapper —
  // um seletor comum, de fora, nao alcanca. Dispara um clique de verdade
  // (MouseEvent), nao so chama .click() num proxy: e o mesmo caminho que o
  // handler do widget escuta.
  await navegador.executeScript(`
    document.getElementById('vlibras-access-wrapper').shadowRoot
      .getElementById('vlibras-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  `);

  // Só depois deste clique o widget carrega vlibras-plugin-app.js, abre o
  // iframe Unity (https://vlibras.gov.br/app/unity/index.html, dentro do
  // shadow root de #vlibras-app-root) e chama traducao2.vlibras.gov.br —
  // os dois recursos que a medição anterior desta tarefa nunca exercitou.
  await navegador.wait(async () => navegador.executeScript(`
    const raiz = document.getElementById('vlibras-app-root');
    return Boolean(raiz && raiz.shadowRoot && raiz.shadowRoot.querySelector('iframe'));
  `), 15000, 'o iframe de traducao (#vlibras-app-root) nao apareceu em 15s');

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [],
    `a politica recusou algo ao acionar a traducao de verdade: ${JSON.stringify(recusas)}`);
});
