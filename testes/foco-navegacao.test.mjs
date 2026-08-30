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
  // "Ateliê Afro Cultural" era o h1 provisório da home (casca da fase 1,
  // antes da Tarefa A2 portar site/index.html de verdade). O h1 real inclui
  // o <em>, e activeElement.textContent junta o texto do elemento inteiro
  // sem as tags.
  assert.equal(foco.texto, 'Arte, memória e pertencimento — feitos à mão, todo dia');
});

test('a escala de fonte e o alto contraste sobrevivem a navegacao do roteador, nao so a recarga', async () => {
  // Todos os testes de persistencia em navegador.test.mjs usam
  // navegador.navigate().refresh() — recarga completa, onde o script
  // anti-piscada de app/layout.tsx roda de novo e reaplica a preferencia ao
  // <html>. Numa navegacao do roteador esse script nao roda: a persistencia
  // passa a depender de nada limpar --escala-fonte/data-contraste do
  // documentElement durante a troca de rota, e de Acessibilidade.tsx (que e
  // de cliente e sobrevive a troca, por estar no layout raiz) manter o
  // estado do React sincronizado com o que ja esta no documento.
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);

  const aumentar = await navegador.findElement(By.css('[data-acao="aumentar"]'));
  await aumentar.click();
  await navegador.sleep(200);
  await aumentar.click();
  await navegador.sleep(200);

  const escalaAntes = await navegador.executeScript(
    'return getComputedStyle(document.documentElement).getPropertyValue("--escala-fonte").trim()'
  );
  assert.equal(escalaAntes, '125%', `esperava 125% depois de dois cliques em aumentar, veio ${escalaAntes}`);

  const contraste = await navegador.findElement(By.css('[data-acao="contraste"]'));
  await contraste.click();
  await navegador.sleep(200);
  assert.equal(
    await navegador.executeScript('return document.documentElement.getAttribute("data-contraste")'),
    'alto',
    'o alto contraste deveria estar ligado antes de navegar'
  );

  // Navegacao do roteador de verdade: clicar no link do menu, nunca
  // navegador.get() nem refresh() — e exatamente o caminho que o script
  // anti-piscada nao cobre.
  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(800);

  const depois = await navegador.executeScript(`return {
    escala: getComputedStyle(document.documentElement).getPropertyValue('--escala-fonte').trim(),
    contraste: document.documentElement.getAttribute('data-contraste'),
    pressionado: document.querySelector('[data-acao="contraste"]')?.getAttribute('aria-pressed')
  }`);

  assert.equal(depois.escala, '125%', `a escala nao sobreviveu a navegacao do roteador, veio ${depois.escala}`);
  assert.equal(depois.contraste, 'alto', 'o alto contraste nao sobreviveu a navegacao do roteador');
  assert.equal(depois.pressionado, 'true',
    'o botao de contraste nao reflete o estado apos a navegacao — se Acessibilidade remontasse do zero, isto voltaria a "false"');
});
