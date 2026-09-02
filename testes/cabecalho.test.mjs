/**
 * Cabeçalho e menu principal.
 *
 * O teste de HTML cru existe porque o pseudocódigo original desta tarefa
 * escondia o <nav> atrás de `hidden={!visivel}`, com `visivel` só virando
 * verdadeiro dentro de um useEffect — o servidor entregava o menu sempre
 * oculto e quem não rodasse JavaScript ficava sem navegação nenhuma. Já
 * aconteceu neste projeto (a navegação alternativa morava num custom element
 * que só existia se o script rodasse). Por isso o servidor precisa entregar
 * o <nav> com os 11 links soltos no HTML, sem o atributo `hidden` — o
 * recolhimento no celular é responsabilidade do CSS, não do servidor.
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

test('sem JavaScript, os 11 links do menu chegam no HTML cru e o nav nao vem oculto', async () => {
  // fetch puro, sem navegador: exatamente o que alcança quem visita sem JS.
  const html = await fetch(`${BASE}/`).then((resposta) => resposta.text());

  // O design system v1 separou o INVOLUCRO (o que abre, fecha e desenha o
  // scrim, com o id) do LANDMARK (o <nav> com os 11 itens). "Doar agora"
  // fica entre os dois, fora do <nav>: e' CTA, nao destino de navegacao.
  // Este teste continua medindo as duas coisas que importam — o involucro
  // nao chega `hidden`, e o <nav> traz exatamente 11 links.
  const abertura = html.match(/<div[^>]*id="menu-principal"[^>]*>/);
  assert.ok(abertura, 'div#menu-principal nao encontrado no HTML entregue pelo servidor');
  assert.doesNotMatch(abertura[0], /\shidden(\s|=|>)/,
    'o servidor entregou a navegacao com o atributo hidden: sem JS ninguem ve o menu');
  assert.doesNotMatch(abertura[0], /af-nav--(gaveta|fechada)/,
    'o servidor entregou a navegacao ja recolhida: sem JS ninguem ve o menu');

  const bloco = html.match(/<nav[^>]*aria-label="Principal"[\s\S]*?<\/nav>/);
  assert.ok(bloco, 'nao foi possivel isolar o bloco do nav no HTML');
  const links = [...bloco[0].matchAll(/<a[^>]+href="[^"]+"/g)];
  assert.equal(links.length, 11, `esperava 11 links no menu, o HTML cru trouxe ${links.length}`);
});


test('sem JavaScript, a barra de acessibilidade chega ABERTA no HTML do servidor', async () => {
  // O design system v1 (variação 1a) esconde os controles A-/A/A+ e alto
  // contraste atrás do botão "Aa". Isso é aceitável COM script: um toque a
  // mais. Sem script seria a ONG perder o "textos grandes" que ela pediu —
  // um botão que só o React faz funcionar esconderia o controle para sempre.
  //
  // Por isso `af-a11y--recolhida` só entra depois de hidratar, e é
  // exatamente isso que este teste mede: no HTML CRU, a barra existe, tem os
  // quatro controles, e não vem recolhida nem `hidden`.
  //
  // MEDIDO na tarefa que trouxe o sistema: com a classe aplicada no
  // servidor, o Firefox com `javascript.enabled=false` não mostrava
  // controle de acessibilidade nenhum em nenhuma rota.
  const html = await fetch(`${BASE}/`).then((resposta) => resposta.text());

  const abertura = html.match(/<div[^>]*id="barra-acessibilidade"[^>]*>/);
  assert.ok(abertura, 'a barra de acessibilidade não foi entregue pelo servidor');
  assert.doesNotMatch(abertura[0], /\shidden(\s|=|>)/,
    'o servidor entregou a barra com `hidden`: sem JS ninguém aumenta o texto');
  assert.doesNotMatch(abertura[0], /af-a11y--recolhida/,
    'o servidor entregou a barra já recolhida: sem JS ninguém aumenta o texto');

  const bloco = html.match(/<div[^>]*id="barra-acessibilidade"[\s\S]*?<\/div>\s*<\/header>|<div[^>]*id="barra-acessibilidade"[\s\S]{0,4000}/);
  const acoes = [...bloco[0].matchAll(/data-acao="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(acoes.slice(0, 4), ['diminuir', 'padrao', 'aumentar', 'contraste'],
    `a barra crua não trouxe os quatro controles, trouxe: ${acoes.join(', ') || 'nenhum'}`);
});

test('o cabecalho monta com os 11 itens e marca a pagina atual', async () => {
  // O brief original testava em /quem-somos, mas essa rota ainda nao existia
  // nesta fase (so / existia — as outras ficavam para tarefas futuras). A
  // pagina 404 padrao do Next, sem app/not-found.tsx proprio, e servida
  // estaticamente e nao carrega o pathname real da requisicao: usePathname()
  // nao reflete "/quem-somos" nela, entao nenhum item fica com aria-current
  // ali — nao e defeito do cabecalho, e uma caracteristica do 404 generico.
  // Por isso o teste verificava a marcacao so na unica rota real de entao.
  await navegador.get(`${BASE}/`);
  const montou = await navegador.executeScript(`return {
    menu: Boolean(document.querySelector('#menu-principal')),
    // Os ITENS sao os do <nav>. O "Doar agora" mora no involucro, fora
    // dele — e' CTA, nao destino de navegacao — e por isso e' contado
    // separado: sem esta separacao, o dia em que alguem puser um segundo
    // botao ali o numero 11 subiria sem ninguem notar.
    itens: document.querySelectorAll('#menu-principal nav a').length,
    cta: document.querySelector('#menu-principal > * > .af-nav__rodape a')?.getAttribute('href') || null,
    atual: document.querySelector('[aria-current="page"]')?.textContent.trim() || null
  }`);
  assert.ok(montou.menu, 'o menu nao montou');
  assert.equal(montou.itens, 11);
  assert.equal(montou.cta, '/doar',
    'o CTA "Doar agora" do pe da gaveta sumiu, ou deixou de apontar para /doar');
  assert.equal(montou.atual, 'Início');
});

test('em /quem-somos, o item "Quem somos" do menu marca a pagina atual', async () => {
  // Cobertura recuperada agora que /quem-somos existe de verdade (Tarefa 9):
  // essa rota deixa de cair no 404 generico do teste acima, entao
  // usePathname() aqui reflete o caminho real da requisicao.
  await navegador.get(`${BASE}/quem-somos`);
  const atual = await navegador.executeScript(
    `return document.querySelector('[aria-current="page"]')?.textContent.trim() || null`
  );
  assert.equal(atual, 'Quem somos');
});

test('Esc fecha o menu mesmo sem sair do botao, e devolve o foco a ele', async () => {
  // Caminho mais comum de quem navega por teclado: abre pelo botao e desiste
  // sem nunca dar Tab para dentro do <nav>. Uma versao anterior prendia o
  // onKeyDown so no <nav>, entao Esc so funcionava depois de focar um link —
  // apertar Esc logo apos abrir, com o foco ainda no botao, nao fazia nada.
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${BASE}/`);

  const botao = await navegador.findElement(By.css('.af-burger'));
  await botao.click();
  assert.equal(await botao.getAttribute('aria-expanded'), 'true', 'o clique deveria abrir o menu');

  // Esc sem nunca ter saido do botao: o foco do navegador, apos um clique,
  // fica naturalmente no proprio botao.
  await botao.sendKeys(Key.ESCAPE);

  assert.equal(await botao.getAttribute('aria-expanded'), 'false',
    'Esc no botao deveria fechar o menu, sem precisar focar o nav antes');

  const nav = await navegador.findElement(By.css('#menu-principal'));
  assert.match(await nav.getAttribute('class'), /af-nav--fechada/,
    'a classe de recolhido deveria voltar');

  const classeAtiva = await navegador.executeScript('return document.activeElement.className');
  assert.equal(classeAtiva, 'af-burger',
    'o foco deveria estar no botao Menu — sem isso ele fica preso num menu invisivel');
});

test('abre pelo botao, da Tab ate um link do menu, e Esc fecha e devolve o foco ao botao', async () => {
  // Pendente desde a Tarefa 5: o caso acima cobre Esc apertado direto no
  // botao, mas quem navega por teclado tambem pode dar Tab para dentro do
  // <nav> antes de desistir. O onKeyDown mora no <div class="cabecalho__
  // menu-grupo"> que envolve botao e nav (ver comentario no topo de
  // MenuMovel.tsx), entao o evento deveria borbulhar dali tambem — mas isso
  // nunca tinha sido provado contra o app Next, so verificado a mao.
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${BASE}/`);

  const botao = await navegador.findElement(By.css('.af-burger'));
  await botao.click();
  assert.equal(await botao.getAttribute('aria-expanded'), 'true', 'o clique deveria abrir o menu');

  // Um Tab a partir do botao entra no primeiro link do nav ("Inicio").
  await navegador.actions().sendKeys(Key.TAB).perform();
  const focoAntes = await navegador.executeScript('return document.activeElement.tagName');
  assert.equal(focoAntes, 'A', 'o Tab deveria ter entrado num link do menu');

  await navegador.actions().sendKeys(Key.ESCAPE).perform();

  assert.equal(await botao.getAttribute('aria-expanded'), 'false',
    'Esc dado a partir de um link do menu tambem deveria fechar o menu');

  const nav = await navegador.findElement(By.css('#menu-principal'));
  assert.match(await nav.getAttribute('class'), /af-nav--fechada/,
    'a classe de recolhido deveria voltar');

  const classeAtiva = await navegador.executeScript('return document.activeElement.className');
  assert.equal(classeAtiva, 'af-burger',
    'o foco deveria voltar ao botao Menu mesmo vindo de um link do menu');
});

test('o alvo do link de pular para o conteudo existe na pagina', async () => {
  const html = await fetch(`${BASE}/`).then((resposta) => resposta.text());
  assert.match(html, /<a class="pular-para-conteudo" href="#conteudo">/,
    'falta o link de pular para o conteudo');
  assert.match(html, /id="conteudo"/,
    'o link de pular aponta para #conteudo, mas nenhum elemento tem esse id');
});
