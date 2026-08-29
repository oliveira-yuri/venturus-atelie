/**
 * Portao de risco da migracao: politica de conteudo (CSP) com nonce e o
 * widget VLibras carregando sob ela.
 *
 * A API classica `manage().logs().get('browser')` nao existe neste
 * geckodriver para Firefox (responde "HTTP method not allowed" — mesmo
 * achado documentado em testes/hidratacao.test.mjs). Por isso usamos o
 * inspetor de log do WebDriver BiDi, que e o caminho que de fato funciona
 * neste ambiente, para capturar toda mensagem "Refused to" que a politica
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

test('a resposta traz nonce e a politica cobre o VLibras', async () => {
  const resposta = await fetch(`${BASE}/`);
  const politica = resposta.headers.get('content-security-policy');
  assert.ok(politica, 'sem CSP');
  assert.match(politica, /script-src[^;]*'nonce-/, 'script-src sem nonce');
  assert.match(politica, /connect-src[^;]*vlibras\.gov\.br/, 'connect-src sem o VLibras');
  assert.match(politica, /img-src[^;]*vlibras\.gov\.br/, 'img-src sem o VLibras');
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

test('nenhum recurso e recusado pela politica', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o VLibras se monta num setTimeout

  // "Refused to" e a frase do Chromium. Este projeto testa em Firefox
  // (mesmo navegador dos outros testes de navegador.test.mjs), que relata
  // bloqueio de CSP com uma frase totalmente diferente — em pt-BR, medido:
  // "As configuracoes da pagina bloquearam o carregamento de um recurso
  // (...) porque viola a seguinte diretiva". Um teste que so procurasse
  // "Refused to" passaria "verde" aqui mesmo com recursos recusados —
  // exatamente o falso-negativo que este teste existe para evitar.
  const recusas = mensagensConsole.filter((texto) =>
    /Refused to/i.test(texto)
    || (/Content-Security-Policy/i.test(texto) && /bloque|blocked/i.test(texto)));
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
