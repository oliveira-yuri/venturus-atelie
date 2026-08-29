/**
 * Verifica o componente de acessibilidade: o servidor nao conhece o
 * localStorage, entao tem que sair sempre neutro; so depois de hidratar o
 * botao passa a refletir a preferencia guardada.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

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
