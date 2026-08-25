/**
 * Todo link interno precisa resolver.
 *
 * Este arquivo existe porque o menu apontou para agenda, acervo, voluntariado
 * e doar antes de essas paginas existirem: quem clicava recebia 404. Os
 * testes de pagina so olhavam as paginas que existiam — ninguem perguntava se
 * os destinos existiam.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

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

  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless')).build();
});

after(async () => {
  await navegador?.quit();
  servidor?.close();
});

/** Todas as paginas .html do site, publicas e do painel. */
async function paginasDoSite() {
  const raiz = (await readdir(new URL('../site/', import.meta.url)))
    .filter((n) => n.endsWith('.html'));
  const admin = (await readdir(new URL('../site/admin/', import.meta.url)))
    .filter((n) => n.endsWith('.html')).map((n) => `admin/${n}`);
  return [...raiz, ...admin];
}

test('todo link interno do site leva a uma pagina que existe', async () => {
  const paginas = await paginasDoSite();
  const quebrados = [];

  for (const pagina of paginas) {
    await navegador.get(`${endereco}/${pagina}`);

    const destinos = await navegador.executeScript(`
      return [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((href) => href && href.startsWith('/') && !href.startsWith('//'));
    `);

    for (const destino of new Set(destinos)) {
      const resposta = await fetch(`${endereco}${destino}`);
      if (!resposta.ok) quebrados.push(`${pagina} -> ${destino} (${resposta.status})`);
    }
  }

  assert.deepEqual(quebrados, [], `links quebrados:\n  ${quebrados.join('\n  ')}`);
});

test('todo destino do menu principal existe', async () => {
  await navegador.get(`${endereco}/index.html`);

  const itens = await navegador.executeScript(`
    return [...document.querySelectorAll('#menu-principal a')].map((a) => a.getAttribute('href'));
  `);

  assert.ok(itens.length >= 10, `o menu tem so ${itens.length} itens`);

  const faltando = [];
  for (const destino of itens) {
    const resposta = await fetch(`${endereco}${destino}`);
    if (!resposta.ok) faltando.push(destino);
  }

  assert.deepEqual(faltando, [], 'itens de menu sem pagina');
});
