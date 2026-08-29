/**
 * Foco e anuncio na navegacao do roteador (App Router).
 *
 * No site antigo cada navegacao era um carregamento de pagina inteiro: o
 * navegador levava o foco de volta ao <body>/topo e anunciava o titulo novo
 * de graca, para quem usa leitor de tela. A navegacao parcial do roteador do
 * Next nao faz nem um nem outro sozinha — sem correcao, o foco fica onde
 * estava (tipicamente no proprio link clicado) e quem nao ve a tela continua
 * "ouvindo" o contexto da pagina antiga, sem nenhum aviso de que ela mudou.
 *
 * FocoNaNavegacao (componentes/FocoNaNavegacao.tsx) corrige isso: a cada
 * troca de rota, move o foco para o <h1> da pagina nova. O titulo do
 * documento muda porque cada rota tem seu proprio `metadata.title`
 * (app/*\/page.tsx), e isso e o que o leitor de tela anuncia.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By, Key } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

test('apos navegar pelo cabecalho, o foco vai para o h1 da pagina nova', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);
  const tituloAntes = await navegador.getTitle();

  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  const depois = await navegador.executeScript(`return {
    titulo: document.title,
    focoEh: document.activeElement.tagName,
    focoTexto: (document.activeElement.textContent || '').trim().slice(0, 40)
  }`);

  assert.notEqual(depois.titulo, tituloAntes, 'o titulo nao mudou');
  assert.equal(depois.focoEh, 'H1', `o foco ficou em ${depois.focoEh}, nao no h1`);
  assert.equal(depois.focoTexto, 'Quem somos');
});

test('numa segunda navegacao, o foco volta a acompanhar a rota', async () => {
  // Repete a partir de uma rota que ja nao e a inicial, para garantir que a
  // correcao nao depende de "primeira navegacao == pagina inicial" — ela
  // precisa disparar em toda troca de rota, nao so na primeira.
  await navegador.get(`${BASE}/quem-somos`);
  await navegador.sleep(500);

  await navegador.findElement(By.css('#menu-principal a[href="/para-escolas"]')).click();
  await navegador.sleep(800);

  const foco = await navegador.executeScript(`return {
    focoEh: document.activeElement.tagName,
    focoTexto: (document.activeElement.textContent || '').trim().slice(0, 40)
  }`);

  assert.equal(foco.focoEh, 'H1', `o foco ficou em ${foco.focoEh}, nao no h1`);
  assert.equal(foco.focoTexto, 'Para escolas e instituições');
});

test('o h1 recebe tabindex="-1" mas nao entra na ordem de Tab', async () => {
  // tabindex="-1" torna o elemento focavel por script (.focus()), mas
  // continua fora da ordem natural de Tab — e isso que diferencia "levar o
  // foco la uma vez" de "empurrar o h1 para o meio da navegacao por
  // teclado", o que seria pior que o problema original.
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);
  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  const h1 = await navegador.findElement(By.css('main h1'));
  assert.equal(await h1.getAttribute('tabindex'), '-1');

  // Tira o foco do h1 (ele acabou de recebe-lo) e navega por Tab a partir do
  // topo do documento: o h1 nao deve aparecer no caminho.
  await navegador.executeScript('document.activeElement.blur(); document.body.focus();');

  let encontrouH1 = false;
  for (let i = 0; i < 20; i += 1) {
    await navegador.actions().sendKeys(Key.TAB).perform();
    const chegouAoH1 = await navegador.executeScript(
      `return document.activeElement === document.querySelector('main h1')`
    );
    if (chegouAoH1) { encontrouH1 = true; break; }
  }
  assert.equal(encontrouH1, false, 'o h1 apareceu na ordem de Tab — tabindex="-1" nao deveria permitir isso');
});
