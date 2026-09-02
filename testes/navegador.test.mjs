/**
 * Verificações que só um navegador real responde: foco, escala de fonte,
 * contraste, persistência de preferência e largura de celular.
 *
 * Roda em Firefox headless contra o servidor da suíte inteira (URL_BASE) —
 * quem sobe e derruba o Next é ferramentas/rodar-testes.mjs.
 *
 * Executar com: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By, Key } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const endereco = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

before(async () => {
  navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => {
  await navegador?.quit();
});

/** Escala em % que o navegador está aplicando ao elemento raiz. */
async function escalaAtual() {
  return navegador.executeScript(
    'return parseFloat(getComputedStyle(document.documentElement).fontSize)'
  );
}


/**
 * O design system v1 pos os controles de acessibilidade atras do botao "Aa".
 * Com JavaScript ligado a barra chega recolhida, entao TODO teste que clica
 * em A-/A/A+/contraste precisa abri-la antes — e' um toque a mais para quem
 * usa, e uma linha a mais aqui.
 *
 * Sem JavaScript a barra chega ABERTA, e e' isso que o teste
 * "a barra de acessibilidade chega aberta no HTML do servidor" garante:
 * esconde-la atras de um botao que nao existe sem script seria tirar o
 * controle de tamanho de texto de quem mais precisa dele (regra 8).
 */
async function abrirBarraDeAcessibilidade() {
  const barra = await navegador.findElement(By.css('#barra-acessibilidade'));
  if (await barra.isDisplayed()) return;
  await navegador.findElement(By.css('[aria-controls="barra-acessibilidade"]')).click();
  await navegador.wait(async () => await barra.isDisplayed(), 2000);
}

test('o primeiro Tab alcança o link de pular para o conteúdo', async () => {
  await navegador.get(endereco);
  await navegador.actions().sendKeys(Key.TAB).perform();
  const foco = await navegador.switchTo().activeElement();
  assert.equal(await foco.getAttribute('class'), 'pular-para-conteudo');
});

/**
 * Percorre a página por Tab, como faz quem navega por teclado, e reporta todo
 * elemento que receba foco sem contorno visível.
 *
 * Precisa ser Tab de verdade: `:focus-visible` depende da modalidade de entrada
 * que o navegador detecta, então `elemento.focus()` programático — ainda mais
 * depois de um clique — dá falso positivo.
 */
async function percorrerPorTeclado(passos = 26) {
  const falhas = [];
  const visitados = new Set();

  for (let i = 0; i < passos; i += 1) {
    await navegador.actions().sendKeys(Key.TAB).perform();
    const info = await navegador.executeScript(`
      // Com shadow DOM, document.activeElement aponta para o host. O elemento
      // realmente focado esta na ponta da cadeia de shadow roots.
      let ativo = document.activeElement;
      while (ativo && ativo.shadowRoot && ativo.shadowRoot.activeElement) {
        ativo = ativo.shadowRoot.activeElement;
      }
      if (!ativo || ativo === document.body) return null;
      const estilo = getComputedStyle(ativo);
      return {
        nome: (ativo.textContent || '').trim().slice(0, 30)
              || ativo.getAttribute('aria-label')?.slice(0, 30)
              || ativo.id || ativo.tagName,
        temContorno: Boolean(parseFloat(estilo.outlineWidth)) && estilo.outlineStyle !== 'none'
      };
    `);
    if (!info) continue;
    if (visitados.has(info.nome)) break;   // deu a volta
    visitados.add(info.nome);
    if (!info.temContorno) falhas.push(info.nome);
  }

  return { falhas, alcancados: visitados.size };
}

test('todo elemento alcançado por Tab tem contorno de foco no desktop', async () => {
  await navegador.manage().window().setRect({ width: 1280, height: 900 });
  await navegador.get(endereco);

  const { falhas, alcancados } = await percorrerPorTeclado();
  assert.deepEqual(falhas, [], 'elementos sem contorno de foco');
  assert.ok(alcancados >= 15, `só ${alcancados} elementos alcançados por teclado`);
});

test('todo elemento alcançado por Tab tem contorno de foco no celular', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(endereco);

  // Abre o menu pelo teclado, para não trocar a modalidade de entrada.
  await navegador.actions().sendKeys(Key.TAB, Key.TAB, Key.TAB, Key.ENTER).perform();

  const { falhas } = await percorrerPorTeclado();
  assert.deepEqual(falhas, [], 'elementos sem contorno de foco');
});

test('Esc fecha o menu e devolve o foco ao botão', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(endereco);

  const botao = await navegador.findElement(By.css('.af-burger'));
  await botao.click();
  assert.equal(await botao.getAttribute('aria-expanded'), 'true');

  await navegador.actions().sendKeys(Key.ESCAPE).perform();
  assert.equal(await botao.getAttribute('aria-expanded'), 'false');

  const foco = await navegador.switchTo().activeElement();
  assert.equal(await foco.getAttribute('class'), 'af-burger',
    'o foco deveria voltar ao botão Menu');
});

test('A+ aumenta o texto de toda a página', async () => {
  await navegador.get(endereco);
  const antes = await escalaAtual();
  await abrirBarraDeAcessibilidade();
  await navegador.findElement(By.css('[data-acao="aumentar"]')).click();
  assert.ok(await escalaAtual() > antes, 'a escala não subiu');
});

test('a escala para no último degrau em vez de crescer sem limite', async () => {
  await navegador.get(endereco);
  await abrirBarraDeAcessibilidade();
  const botao = await navegador.findElement(By.css('[data-acao="aumentar"]'));
  for (let i = 0; i < 6; i += 1) {
    if (!(await botao.isEnabled())) break;
    await botao.click();
  }
  assert.equal(await botao.isEnabled(), false, 'o botão deveria ficar inerte no topo');
});

test('a preferência sobrevive ao recarregar', async () => {
  await navegador.get(endereco);
  await abrirBarraDeAcessibilidade();
  await navegador.findElement(By.css('[data-acao="aumentar"]')).click();
  const escolhida = await escalaAtual();

  await navegador.navigate().refresh();
  assert.equal(await escalaAtual(), escolhida, 'a preferência não foi reaplicada');
});

test('alto contraste marca o documento e inverte fundo e texto', async () => {
  await navegador.get(endereco);
  await abrirBarraDeAcessibilidade();
  await navegador.findElement(By.css('[data-acao="contraste"]')).click();

  const marcado = await navegador.executeScript(
    'return document.documentElement.getAttribute("data-contraste")'
  );
  assert.equal(marcado, 'alto');

  const cores = await navegador.executeScript(`
    const estilo = getComputedStyle(document.body);
    return { fundo: estilo.backgroundColor, texto: estilo.color };
  `);
  assert.equal(cores.fundo, 'rgb(255, 255, 255)');
  assert.equal(cores.texto, 'rgb(0, 0, 0)');
});

test('não há rolagem horizontal em largura de celular', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(endereco);

  const excesso = await navegador.executeScript(
    'return document.documentElement.scrollWidth - document.documentElement.clientWidth'
  );
  assert.ok(excesso <= 0, `a página vaza ${excesso}px na horizontal`);
});

test('todo alvo de toque tem pelo menos 44px', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(endereco);
  await navegador.findElement(By.css('.af-burger')).click();

  const pequenos = await navegador.executeScript(`
    const alvos = document.querySelectorAll(
      '.af-navlink, .af-burger, .af-a11y button, .af-footer__links a'
    );
    const falhas = [];
    for (const alvo of alvos) {
      const caixa = alvo.getBoundingClientRect();
      if (caixa.height > 0 && caixa.height < 44) {
        falhas.push((alvo.textContent.trim().slice(0, 24)) + ': ' + Math.round(caixa.height) + 'px');
      }
    }
    return falhas;
  `);
  assert.deepEqual(pequenos, [], 'alvos menores que 44px');
});

test('a escala máxima não corta nem sobrepõe conteúdo', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(endereco);

  await abrirBarraDeAcessibilidade();

  const botao = await navegador.findElement(By.css('[data-acao="aumentar"]'));
  for (let i = 0; i < 6; i += 1) {
    if (!(await botao.isEnabled())) break;
    await botao.click();
  }

  const excesso = await navegador.executeScript(
    'return document.documentElement.scrollWidth - document.documentElement.clientWidth'
  );
  assert.ok(excesso <= 0, `a 137,5% a página vaza ${excesso}px na horizontal`);
});
