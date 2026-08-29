/**
 * Verifica o componente de acessibilidade: o servidor nao conhece o
 * localStorage, entao tem que sair sempre neutro; so depois de hidratar o
 * botao passa a refletir a preferencia guardada. Tambem verifica, por
 * interacao real (clique), que a escala muda, que os botoes ficam inertes
 * nas pontas do intervalo e que o anuncio para leitor de tela e o certo.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

/** Carrega a pagina do zero, sem nenhuma preferencia gravada. */
async function prepararEstadoLimpo() {
  await navegador.get(`${BASE}/`);
  await navegador.executeScript(`localStorage.clear()`);
  await navegador.navigate().refresh();
  await navegador.sleep(600);
}

test('servidor entrega os 4 botoes em estado neutro', async () => {
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  const botoes = html.match(/<button[^>]*data-acao=/g) || [];
  assert.equal(botoes.length, 4, 'o servidor precisa entregar os 4 botoes');
  assert.ok(!html.includes('data-contraste="alto"'),
    'o servidor nao pode adivinhar a preferencia: HTML tem que sair neutro');
});

test('apos hidratar, o botao reflete a preferencia guardada', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.executeScript(
    `localStorage.setItem('aac-preferencias', JSON.stringify({escala:125,contraste:'alto'}))`);
  await navegador.navigate().refresh();
  await navegador.sleep(600);

  const estado = await navegador.executeScript(`return {
    pressionado: document.querySelector('[data-acao="contraste"]').getAttribute('aria-pressed'),
    contraste: document.documentElement.getAttribute('data-contraste'),
    escala: document.documentElement.style.getPropertyValue('--escala-fonte')
  }`);

  assert.equal(estado.pressionado, 'true');
  assert.equal(estado.contraste, 'alto');
  assert.equal(estado.escala, '125%');
});

test('clique em aumentar e depois em padrao altera a escala de verdade', async () => {
  await prepararEstadoLimpo();

  await navegador.findElement(By.css('[data-acao="aumentar"]')).click();
  await navegador.sleep(300);
  let escala = await navegador.executeScript(
    `return document.documentElement.style.getPropertyValue('--escala-fonte')`);
  assert.equal(escala, '112.5%', 'um clique em aumentar deveria subir um degrau, de 100% para 112.5%');

  await navegador.findElement(By.css('[data-acao="padrao"]')).click();
  await navegador.sleep(300);
  escala = await navegador.executeScript(
    `return document.documentElement.style.getPropertyValue('--escala-fonte')`);
  assert.equal(escala, '100%', 'o botao padrao deveria voltar a escala para 100%');
});

test('botoes de escala ficam inertes nas pontas do intervalo, e so nelas', async () => {
  await prepararEstadoLimpo();

  const aumentar = await navegador.findElement(By.css('[data-acao="aumentar"]'));
  const diminuir = await navegador.findElement(By.css('[data-acao="diminuir"]'));

  // De 100% ate o teto (137.5%) sao 3 degraus: 112.5, 125, 137.5.
  for (let i = 0; i < 3; i++) {
    await aumentar.click();
    await navegador.sleep(200);
  }
  assert.notEqual(await aumentar.getAttribute('disabled'), null,
    'no teto da escala, aumentar precisa estar desabilitado');
  assert.equal(await diminuir.getAttribute('disabled'), null,
    'no teto da escala, diminuir nao pode estar desabilitado');

  // Do teto (137.5%) ate o piso (87.5%) sao 4 degraus.
  for (let i = 0; i < 4; i++) {
    await diminuir.click();
    await navegador.sleep(200);
  }
  assert.notEqual(await diminuir.getAttribute('disabled'), null,
    'no piso da escala, diminuir precisa estar desabilitado');
  assert.equal(await aumentar.getAttribute('disabled'), null,
    'no piso da escala, aumentar nao pode estar desabilitado');
});

test('anuncio para leitor de tela descreve a acao feita', async () => {
  await prepararEstadoLimpo();

  const contraste = await navegador.findElement(By.css('[data-acao="contraste"]'));
  const anuncio = await navegador.findElement(By.css('[role="status"]'));

  await contraste.click();
  await navegador.sleep(300);
  assert.equal(await anuncio.getText(), 'Alto contraste ativado');

  await contraste.click();
  await navegador.sleep(300);
  assert.equal(await anuncio.getText(), 'Alto contraste desativado');

  await navegador.findElement(By.css('[data-acao="aumentar"]')).click();
  await navegador.sleep(300);
  assert.equal(await anuncio.getText(), 'Texto em 112.5%');
});
