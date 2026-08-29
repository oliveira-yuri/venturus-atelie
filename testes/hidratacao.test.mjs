import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless')).build();
});
after(async () => { await navegador?.quit(); });

test('nenhum aviso de divergencia de hidratacao', async () => {
  for (const rota of ['/', '/quem-somos', '/privacidade']) {
    await navegador.get(`${BASE}${rota}`);
    await navegador.sleep(600);

    const avisos = await navegador.manage().logs().get('browser')
      .then((entradas) => entradas
        .map((e) => e.message)
        .filter((m) => /hydrat|did not match|server rendered/i.test(m)))
      .catch(() => []);

    assert.deepEqual(avisos, [], `divergencia de hidratacao em ${rota}`);
  }
});
