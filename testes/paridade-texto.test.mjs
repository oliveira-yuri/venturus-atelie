/**
 * Compara o texto visível do <main> renderizado pelo Next com o texto
 * visível do <main> do HTML original em site/*.html.
 *
 * Existe porque o Defeito 1 da correção de 2026-08-28 passou por 212 testes
 * e pela verificação de fidelidade anterior: aquela verificação comparava
 * PALAVRAS, e todas as palavras estavam presentes — o que sumiu foi só o
 * ESPAÇO entre elas ("pelo e-mailatelieafro@gmail.com"). Uma quebra de linha
 * entre texto e elemento vira um espaço em HTML, mas é removida em JSX
 * quando fica encostada na tag (armadilha clássica do JSX).
 *
 * Por isso a comparação aqui é de string completa (espaços normalizados),
 * não de presença de palavra: é o único jeito de um espaço que sumiu doer.
 *
 * Este teste protege as 12 páginas que ainda faltam migrar na fase 2 — é o
 * que impede este defeito de se repetir a cada página nova.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

// Mesma convenção de testes/paginas.test.mjs: a suíte inteira (via
// ferramentas/rodar-testes.mjs) já builda e sobe o Next uma vez só. Aqui
// basta um fetch da resposta já renderizada no servidor — o texto do <main>
// não muda com a hidratação, então dispensa selenium/Firefox.
const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Só as três páginas já migradas para o Next entram aqui. As outras nove do
// menu migram na fase 2 (ver testes/paginas.test.mjs) — quando migrarem,
// ganham uma linha aqui também.
const PAGINAS = [
  { rota: '/quem-somos', arquivoOriginal: 'site/quem-somos.html' },
  { rota: '/privacidade', arquivoOriginal: 'site/privacidade.html' },
  { rota: '/para-escolas', arquivoOriginal: 'site/para-escolas.html' }
];

function extrairTextoDoMain(html) {
  const abre = html.match(/<main\b[^>]*id=["']conteudo["'][^>]*>/i);
  assert.ok(abre, 'não achou <main id="conteudo"> no documento');

  const inicio = abre.index + abre[0].length;
  const fim = html.indexOf('</main>', inicio);
  assert.ok(fim !== -1, 'não achou </main> no documento');

  const miolo = html.slice(inicio, fim);
  return normalizarEspacos(decodificarEntidades(removerTags(miolo)));
}

// Elementos de bloco sempre quebram linha na tela, com ou sem espaço em
// branco no HTML fonte entre eles — por isso viram espaço aqui mesmo quando
// estão colados na tag vizinha (ex.: "</h1><p>" sem espaço nenhum no
// arquivo). Elementos em linha (a, strong...) não: se o texto some colado
// neles, é porque coisa nenhuma teria feito a tela mostrar espaço ali — é
// exatamente o Defeito 1 que este teste existe para pegar.
const BLOCOS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'header', 'footer', 'nav', 'main',
  'blockquote', 'pre', 'table', 'tr', 'td', 'th', 'form', 'fieldset',
  'figure', 'figcaption', 'br', 'hr'
]);

function removerTags(html) {
  return html
    // Comentários primeiro: o React usa `<!--$-->` como marcador interno de
    // hidratação, e o formato deles ("<!--...-->") não bate com o padrão de
    // tag abaixo (não começa com letra) — ficariam no texto se não saírem
    // aqui, sem inserir espaço, por não corresponderem a conteúdo nenhum.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, tag) =>
      BLOCOS.has(tag.toLowerCase()) ? ' ' : '');
}

function decodificarEntidades(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ');
}

// Uma quebra de linha entre texto e elemento vale um espaço em HTML — é a
// regra que a normalização replica aqui, dos dois lados da comparação.
function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

for (const pagina of PAGINAS) {
  test(`${pagina.rota}: texto visível do <main> é idêntico ao HTML original`, async () => {
    const htmlOriginal = readFileSync(path.join(RAIZ, pagina.arquivoOriginal), 'utf-8');
    const textoOriginal = extrairTextoDoMain(htmlOriginal);

    const resposta = await fetch(`${BASE}${pagina.rota}`);
    assert.equal(resposta.status, 200, `${pagina.rota} não respondeu 200`);
    const htmlRenderizado = await resposta.text();
    const textoRenderizado = extrairTextoDoMain(htmlRenderizado);

    assert.equal(textoRenderizado, textoOriginal);
  });
}
