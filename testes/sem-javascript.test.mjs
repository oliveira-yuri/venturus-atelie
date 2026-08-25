/**
 * O site precisa continuar navegável e legível sem JavaScript.
 *
 * Cabeçalho e rodapé são custom elements — sem script, nenhum dos dois existe.
 * A rede de segurança é um <noscript> no HTML estático de cada página. Este
 * teste existe porque a primeira tentativa colocou esse <noscript> dentro do
 * próprio componente de rodapé, onde ele nunca chegava ao DOM.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  'index.html', 'quem-somos.html', 'projetos.html', 'noticias.html',
  'galeria.html', 'para-escolas.html', 'contato.html', 'entrar.html'
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

  const opcoes = new Options().addArguments('-headless');
  opcoes.setPreference('javascript.enabled', false);
  navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();
});

after(async () => {
  await navegador?.quit();
  servidor?.close();
});

for (const pagina of PAGINAS) {
  test(`${pagina}: o conteúdo principal existe sem JavaScript`, async () => {
    await navegador.get(`${endereco}/${pagina}`);
    const html = await navegador.getPageSource();

    assert.match(html, /<main[^>]*id="conteudo"/, 'falta <main id="conteudo">');
    assert.match(html, /<h1[^>]*>/, 'falta h1');
  });

  test(`${pagina}: existe navegação sem JavaScript`, async () => {
    await navegador.get(`${endereco}/${pagina}`);
    const html = await navegador.getPageSource();

    const destinos = new Set(
      [...html.matchAll(/href="\/([a-z-]+\.html)"/g)].map((achado) => achado[1])
    );

    assert.ok(destinos.size >= 5,
      `só ${destinos.size} destinos alcançáveis sem JavaScript: ${[...destinos]}`);
    assert.ok(destinos.has('quem-somos.html'), 'falta caminho para Quem somos');
    assert.ok(destinos.has('contato.html'), 'falta caminho para Contato');
  });

  test(`${pagina}: os contatos aparecem sem JavaScript`, async () => {
    await navegador.get(`${endereco}/${pagina}`);
    const html = await navegador.getPageSource();

    assert.match(html, /tel:\+5511953968344/, 'falta telefone');
    assert.match(html, /mailto:atelieafro@gmail\.com/, 'falta e-mail');
  });
}
