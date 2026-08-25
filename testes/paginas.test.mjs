/**
 * Verificações estruturais em todas as páginas públicas.
 *
 * Roda em Firefox headless com servidor próprio, como testes/navegador.test.mjs.
 * Cada página nova entra na lista PAGINAS e ganha toda a bateria de graça.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  { arquivo: 'index.html',        chave: 'inicio' },
  { arquivo: 'quem-somos.html',   chave: 'quem-somos' },
  { arquivo: 'projetos.html',     chave: 'projetos' },
  { arquivo: 'noticias.html',     chave: 'noticias' },
  { arquivo: 'galeria.html',      chave: 'galeria' },
  { arquivo: 'para-escolas.html', chave: 'para-escolas' },
  { arquivo: 'contato.html',      chave: 'contato' },
  { arquivo: 'entrar.html',       chave: 'entrar' },
  { arquivo: 'agenda.html',       chave: 'agenda' },
  { arquivo: 'acervo.html',       chave: 'acervo' },
  { arquivo: 'voluntariado.html', chave: 'voluntariado' },
  { arquivo: 'doar.html',         chave: 'doar' }
];

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

for (const pagina of PAGINAS) {
  test(`${pagina.arquivo}: estrutura semântica completa`, async () => {
    await navegador.manage().window().setRect({ width: 1280, height: 900 });
    await navegador.get(`${endereco}/${pagina.arquivo}`);

    const estrutura = await navegador.executeScript(`
      return {
        titulo: document.title,
        descricao: document.querySelector('meta[name="description"]')?.content || '',
        h1: document.querySelectorAll('h1').length,
        main: Boolean(document.querySelector('main#conteudo')),
        skip: Boolean(document.querySelector('.pular-para-conteudo')),
        idioma: document.documentElement.lang
      };
    `);

    assert.ok(estrutura.titulo.includes('Ateliê Afro Cultural'), 'título sem o nome da organização');
    assert.ok(estrutura.descricao.length > 30, 'meta description ausente ou curta');
    assert.equal(estrutura.h1, 1, 'a página precisa de exatamente um h1');
    assert.ok(estrutura.main, 'falta <main id="conteudo">');
    assert.ok(estrutura.skip, 'falta o link de pular para o conteúdo');
    assert.equal(estrutura.idioma, 'pt-BR');
  });

  test(`${pagina.arquivo}: cabeçalho e rodapé montam`, async () => {
    await navegador.get(`${endereco}/${pagina.arquivo}`);

    const montou = await navegador.executeScript(`
      return {
        menu: Boolean(document.querySelector('#menu-principal')),
        atual: document.querySelector('[aria-current="page"]')?.textContent.trim() || null,
        contatos: document.querySelectorAll('.rodape__lista a').length,
        acessibilidade: document.querySelectorAll('.acessibilidade button').length
      };
    `);

    assert.ok(montou.menu, 'o menu não montou');
    assert.ok(montou.atual, 'nenhum item marcado como página atual');
    assert.ok(montou.contatos >= 5, 'o rodapé precisa dos cinco contatos do RF06');
    assert.equal(montou.acessibilidade, 4, 'faltam controles de acessibilidade');
  });

  test(`${pagina.arquivo}: toda imagem tem alt`, async () => {
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const semAlt = await navegador.executeScript(`
      return [...document.querySelectorAll('img')]
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.src);
    `);
    assert.deepEqual(semAlt, [], 'imagens sem alt');
  });

  test(`${pagina.arquivo}: sem rolagem horizontal em 375px`, async () => {
    await navegador.manage().window().setRect({ width: 375, height: 720 });
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const excesso = await navegador.executeScript(
      'return document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );
    assert.ok(excesso <= 0, `vaza ${excesso}px na horizontal`);
  });
}

test('projetos.html mostra as onze atividades', async () => {
  await navegador.manage().window().setRect({ width: 1280, height: 900 });
  await navegador.get(`${endereco}/projetos.html`);

  // O catálogo carrega por fetch: espera o primeiro cartão aparecer.
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('aac-card-atividade'))).length > 0, 5000);

  const cartoes = await navegador.findElements(By.css('aac-card-atividade'));
  assert.equal(cartoes.length, 11, 'o escopo lista 11 atividades');
});

test('as atividades sem sinopse não exibem bloco vazio', async () => {
  await navegador.get(`${endereco}/projetos.html`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('aac-card-atividade'))).length > 0, 5000);

  const vazios = await navegador.executeScript(`
    return [...document.querySelectorAll('.atividade')]
      .filter((a) => [...a.querySelectorAll('p')].some((p) => p.textContent.trim() === ''))
      .map((a) => a.id);
  `);
  assert.deepEqual(vazios, [], 'atividades com parágrafo vazio');
});

test('a prova social carrega na home e em para-escolas', async () => {
  for (const [arquivo, seletor] of [['index.html', '#lista-midia'], ['para-escolas.html', '#lista-instituicoes']]) {
    await navegador.get(`${endereco}/${arquivo}`);
    await navegador.wait(async () =>
      (await navegador.findElements(By.css(`${seletor} .clipping__item`))).length > 0, 5000,
      `a prova social não carregou em ${arquivo}`);

    const itens = await navegador.findElements(By.css(`${seletor} .clipping__item`));
    assert.ok(itens.length >= 3, `${arquivo}: só ${itens.length} registros`);
  }
});

test('nenhum texto escapa da caixa que o contém', async () => {
  // O CSS pode ser escrito para uma estrutura de HTML que não é a que existe.
  // Foi o que aconteceu com os cartões da home: o preenchimento ficou no link
  // do título, e o parágrafo encostou na borda, saindo do cartão.
  const escapando = [];

  for (const pagina of PAGINAS) {
    await navegador.manage().window().setRect({ width: 1280, height: 900 });
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    await navegador.sleep(400);

    const fugitivos = await navegador.executeScript(`
      const caixas = document.querySelectorAll(
        '.caminho, .setor, .atividade, .clipping__item, .aviso, .abertura__peca, .estado');
      const falhas = [];

      for (const caixa of caixas) {
        const limite = caixa.getBoundingClientRect();
        for (const filho of caixa.querySelectorAll('p, h2, h3, dl, ul')) {
          const c = filho.getBoundingClientRect();
          if (c.width === 0) continue;
          // Meio pixel de folga para arredondamento do navegador.
          if (c.left < limite.left - 0.5 || c.right > limite.right + 0.5) {
            falhas.push(
              (caixa.className || caixa.tagName) + ' > ' + filho.tagName +
              ': ' + (filho.textContent || '').trim().slice(0, 30));
          }
        }
      }
      return falhas;
    `);

    fugitivos.forEach((f) => escapando.push(`${pagina.arquivo}: ${f}`));
  }

  assert.deepEqual(escapando, [], 'conteúdo saindo da caixa');
});

test('nenhuma página pública usa linguagem assistencialista', async () => {
  // Seção 3.1 do escopo: o Ateliê é organização de arte, cultura e identidade,
  // não de assistência social. Linguagem de caridade invalida a entrega.
  const proibidos = /crianças carentes|ajude uma criança|doe um sorriso|vidas salvas|apadrinhe|carência|coitad/i;

  for (const pagina of PAGINAS) {
    await navegador.get(`${endereco}/${pagina.arquivo}`);
    const texto = await navegador.executeScript('return document.body.innerText');
    assert.doesNotMatch(texto, proibidos, `linguagem assistencialista em ${pagina.arquivo}`);
  }
});
