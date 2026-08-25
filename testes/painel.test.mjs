/**
 * Verificações do painel administrativo.
 *
 * O RNF08 é bloqueante: a ONG não possui computador, e publicar evento,
 * marcar presença e responder doação precisam funcionar inteiramente pelo
 * celular. "Mobile-first" só vale como afirmação se alguém medir.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const CELULAR = { width: 375, height: 720 };
const DESKTOP = { width: 1280, height: 900 };

const RAIZ = new URL('../site/', import.meta.url).pathname;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

let servidor;
let navegador;
let endereco;

before(async () => {
  servidor = createServer(async (requisicao, resposta) => {
    const caminho = requisicao.url === '/' ? '/index.html' : requisicao.url.split('?')[0];
    try {
      const arquivo = join(RAIZ, normalize(caminho));
      const conteudo = await readFile(arquivo);
      resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
      resposta.end(conteudo);
    } catch {
      resposta.writeHead(404).end('nao encontrado');
    }
  });

  await new Promise((pronto) => servidor.listen(0, pronto));
  endereco = `http://localhost:${servidor.address().port}`;

  navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => {
  await navegador?.quit();
  servidor?.close();
});

async function abrirPainel(tamanho) {
  await navegador.manage().window().setRect(tamanho);
  await navegador.get(`${endereco}/admin/index.html`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('.nav-admin'))).length > 0, 5000);
}

test('a navegação fica na parte de baixo no celular — zona do polegar', async () => {
  await abrirPainel(CELULAR);

  const posicao = await navegador.executeScript(`
    const nav = document.querySelector('.nav-admin');
    const caixa = nav.getBoundingClientRect();
    return {
      fixa: getComputedStyle(nav).position === 'fixed',
      distanciaDoRodape: window.innerHeight - caixa.bottom,
      metadeDeBaixo: caixa.top > window.innerHeight / 2
    };
  `);

  assert.ok(posicao.fixa, 'a navegação precisa ficar fixa na tela');
  assert.ok(posicao.metadeDeBaixo, 'a navegação está na metade de cima da tela');
  assert.ok(Math.abs(posicao.distanciaDoRodape) < 2,
    `a navegação está a ${posicao.distanciaDoRodape}px do fim da tela`);
});

test('a navegação do painel não cobre o conteúdo', async () => {
  await abrirPainel(CELULAR);

  const sobreposicao = await navegador.executeScript(`
    // Rola até o fim: é onde o conteúdo correria risco de ficar atrás da barra.
    window.scrollTo(0, document.body.scrollHeight);
    const nav = document.querySelector('.nav-admin').getBoundingClientRect();
    const ultimo = [...document.querySelectorAll('.acao-painel')].pop().getBoundingClientRect();
    return ultimo.bottom > nav.top;
  `);

  assert.equal(sobreposicao, false, 'a barra de navegação cobre o último cartão');
});

test('todo alvo de toque do painel tem 44px no celular', async () => {
  await abrirPainel(CELULAR);

  const pequenos = await navegador.executeScript(`
    const alvos = document.querySelectorAll('.nav-admin a, .acao-painel a, .topo-admin button');
    return [...alvos]
      .map((a) => ({ texto: a.textContent.trim().slice(0, 24), altura: a.getBoundingClientRect().height }))
      .filter((a) => a.altura > 0 && a.altura < 44);
  `);

  assert.deepEqual(pequenos, [], 'alvos menores que 44px');
});

test('o painel não rola na horizontal no celular', async () => {
  await abrirPainel(CELULAR);
  const excesso = await navegador.executeScript(
    'return document.documentElement.scrollWidth - document.documentElement.clientWidth');
  assert.ok(excesso <= 0, `vaza ${excesso}px na horizontal`);
});

test('no desktop a navegação vira lateral', async () => {
  await abrirPainel(DESKTOP);

  const lateral = await navegador.executeScript(`
    const nav = document.querySelector('.nav-admin');
    const caixa = nav.getBoundingClientRect();
    return {
      naEsquerda: caixa.left < window.innerWidth / 3,
      estreita: caixa.width < window.innerWidth / 2,
      empilhada: getComputedStyle(nav.querySelector('ul')).flexDirection === 'column'
    };
  `);

  assert.ok(lateral.naEsquerda, 'a navegação não está à esquerda');
  assert.ok(lateral.estreita, 'a navegação ocupa metade da tela');
  assert.ok(lateral.empilhada, 'os itens não estão empilhados');
});

test('os ícones da navegação são decorativos para o leitor de tela', async () => {
  await abrirPainel(CELULAR);

  const acessivel = await navegador.executeScript(`
    const itens = [...document.querySelectorAll('.nav-admin a')];
    return {
      total: itens.length,
      iconesEscondidos: itens.every((a) =>
        a.querySelector('.nav-admin__icone')?.getAttribute('aria-hidden') === 'true'),
      todosComTexto: itens.every((a) =>
        (a.querySelector('.nav-admin__texto')?.textContent || '').trim().length > 0)
    };
  `);

  assert.ok(acessivel.total >= 4, 'a navegação do painel está vazia');
  assert.ok(acessivel.iconesEscondidos, 'ícone sendo lido pelo leitor de tela');
  assert.ok(acessivel.todosComTexto, 'item de navegação sem texto');
});

test('o painel pede noindex — não é conteúdo público', async () => {
  await abrirPainel(DESKTOP);
  const robots = await navegador.executeScript(
    `return document.querySelector('meta[name="robots"]')?.content || ''`);
  assert.match(robots, /noindex/, 'o painel deveria pedir noindex');
});

test('o painel avisa quando ainda não há banco configurado', async () => {
  // Sem Supabase, o painel não pode simplesmente aparecer vazio: a equipe
  // precisa entender que falta configuração, não que o sistema quebrou.
  await abrirPainel(CELULAR);
  await navegador.wait(async () => {
    const aviso = await navegador.findElement(By.css('#aviso'));
    return (await aviso.getText()).trim().length > 0;
  }, 5000, 'o painel não exibiu aviso algum');

  const texto = await navegador.findElement(By.css('#aviso')).getText();
  assert.doesNotMatch(texto, /undefined|null|\[object/i, 'aviso com jargão técnico');
});

test('entrar.html: os campos têm rótulo vinculado', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${endereco}/entrar.html`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#form-entrar input'))).length > 0, 5000);

  const semRotulo = await navegador.executeScript(`
    return [...document.querySelectorAll('input')]
      .filter((campo) => {
        if (!campo.id) return true;
        return !document.querySelector('label[for="' + campo.id + '"]');
      })
      .map((campo) => campo.name || campo.type);
  `);

  assert.deepEqual(semRotulo, [], 'campos sem rótulo vinculado');
});

test('entrar.html: as duas abas funcionam pelo teclado', async () => {
  await navegador.get(`${endereco}/entrar.html`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#aba-criar'))).length > 0, 5000);

  await navegador.findElement(By.css('#aba-criar')).click();

  const estado = await navegador.executeScript(`
    return {
      criarVisivel: !document.querySelector('#painel-criar').hidden,
      entrarEscondido: document.querySelector('#painel-entrar').hidden,
      selecionada: document.querySelector('#aba-criar').getAttribute('aria-selected')
    };
  `);

  assert.equal(estado.criarVisivel, true, 'o painel de criar conta não apareceu');
  assert.equal(estado.entrarEscondido, true, 'os dois painéis ficaram visíveis');
  assert.equal(estado.selecionada, 'true', 'a aba não foi marcada como selecionada');
});

test('RF12: a caixa de maioridade existe e é obrigatória', async () => {
  await navegador.get(`${endereco}/entrar.html`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('#aba-criar'))).length > 0, 5000);
  await navegador.findElement(By.css('#aba-criar')).click();

  const caixa = await navegador.executeScript(`
    const campo = document.querySelector('#campo-maioridade');
    if (!campo) return null;
    return {
      obrigatoria: campo.required,
      rotulo: document.querySelector('label[for="campo-maioridade"]')?.textContent.trim() || ''
    };
  `);

  assert.ok(caixa, 'a caixa de maioridade não existe — RF12 e RN01');
  assert.equal(caixa.obrigatoria, true, 'a caixa de maioridade não é obrigatória');
  assert.match(caixa.rotulo, /18/, 'o rótulo precisa dizer a idade');
});
