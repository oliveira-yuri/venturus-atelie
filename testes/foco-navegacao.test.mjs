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

test('a navegacao atualiza uma regiao aria-live com o nome da pagina nova', async () => {
  // Foco no h1 e necessario mas nao suficiente: a troca de document.title
  // sozinha nao e anunciada por leitor de tela nenhum sem foco associado, e
  // "focar um elemento tabindex=-1 gera anuncio de cabecalho" varia entre
  // pares de leitor e navegador. A regiao aria-live cobre o anuncio sonoro
  // independente dessa variacao.
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);

  // A regiao precisa existir no DOM antes da troca de rota, vazia — uma
  // regiao criada e preenchida no mesmo ciclo costuma nao ser anunciada.
  const antes = await navegador.executeScript(`
    const regiao = document.querySelector('[aria-live="polite"]');
    return regiao ? { existe: true, texto: regiao.textContent.trim() } : { existe: false, texto: null };
  `);
  assert.ok(antes.existe, 'a regiao aria-live deveria existir antes de qualquer navegacao');
  assert.equal(antes.texto, '', 'a regiao nao deveria ter texto no carregamento inicial');

  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  const depois = await navegador.executeScript(`
    const regiao = document.querySelector('[aria-live="polite"]');
    return regiao ? regiao.textContent.trim() : null;
  `);
  assert.match(depois ?? '', /Quem somos/,
    `a regiao aria-live deveria anunciar a pagina nova, veio "${depois}"`);
});

test('o botao voltar do navegador tambem move o foco para o h1 de cada rota', async () => {
  // Confirmado a mao na rodada de correcao 1: popstate muda usePathname(),
  // o efeito roda de novo, e o foco vai ao h1 de cada rota no caminho de
  // volta. Sem teste isso dependia de alguem lembrar de verificar de novo.
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);

  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  await navegador.findElement(By.css('#menu-principal a[href="/para-escolas"]')).click();
  await navegador.sleep(800);

  await navegador.navigate().back();
  await navegador.sleep(800);
  let foco = await navegador.executeScript(`return {
    tag: document.activeElement.tagName,
    texto: (document.activeElement.textContent || '').trim()
  }`);
  assert.equal(foco.tag, 'H1', `voltando para /quem-somos, o foco ficou em ${foco.tag}`);
  assert.equal(foco.texto, 'Quem somos');

  await navegador.navigate().back();
  await navegador.sleep(800);
  foco = await navegador.executeScript(`return {
    tag: document.activeElement.tagName,
    texto: (document.activeElement.textContent || '').trim()
  }`);
  assert.equal(foco.tag, 'H1', `voltando para /, o foco ficou em ${foco.tag}`);
  assert.equal(foco.texto, 'Ateliê Afro Cultural');
});
