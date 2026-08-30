/**
 * A home (RF01, Tarefa A2) tem o conteúdo real de site/index.html: os
 * quatro caminhos de "Por onde começar", os três setores de "O que
 * fazemos" e a prova social de "Na mídia" com registros de verdade.
 *
 * Antes desta tarefa app/page.tsx era uma casca — só <h1>Ateliê Afro
 * Cultural</h1> — e a suíte inteira passava porque não havia conteúdo
 * nenhum para dar errado. Este arquivo escreve a prova de que o conteúdo
 * existe de verdade na página renderizada, não só no HTML estático de
 * origem (isso é papel de testes/paridade-texto.test.mjs, que compara
 * string completa e pega até um espaço que sumiu).
 *
 * Como testes/pagina-para-escolas.test.mjs, busca a rota via HTTP contra o
 * servidor que a suíte inteira já sobe (ver ferramentas/rodar-testes.mjs) —
 * sem subir servidor próprio, sem selenium.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Mesma fonte que alimenta o fallback local de listarClippingComOrigem() —
// dados-iniciais/clipping.json é o que o modo offline (padrão de `npm test`)
// realmente serve.
const clipping = JSON.parse(
  readFileSync(new URL('../dados-iniciais/clipping.json', import.meta.url), 'utf8')
);
const midia = clipping.filter((registro) => registro.tipo === 'midia');

test('a home responde 200', async () => {
  const resposta = await fetch(`${BASE}/`);
  assert.equal(resposta.status, 200, '/ não respondeu 200');
});

test('os quatro caminhos de "Por onde começar" aparecem', async () => {
  const html = await (await fetch(`${BASE}/`)).text();
  for (const caminho of ['Conhecer', 'Participar', 'Ser voluntário', 'Apoiar']) {
    assert.ok(html.includes(caminho), `caminho "${caminho}" não apareceu na home`);
  }
});

test('os três setores de "O que fazemos" aparecem', async () => {
  const html = await (await fetch(`${BASE}/`)).text();
  for (const setor of ['Literário', 'Musical', 'Artístico criativo']) {
    assert.ok(html.includes(setor), `setor "${setor}" não apareceu na home`);
  }
});

test('"Na mídia" mostra pelo menos 3 registros reais de clipping', async () => {
  // Isto verifica o próprio arquivo de dados, não a página: se algum dia
  // clipping.json tiver menos de 3 registros de mídia, este teste falharia
  // pelo motivo errado (dado insuficiente, não defeito de produto). Falhar
  // aqui, cedo e com mensagem clara, é melhor do que a asserção de baixo
  // falhar sem dizer por quê.
  assert.ok(
    midia.length >= 3,
    'dados-iniciais/clipping.json tem menos de 3 registros de tipo "midia" — ' +
    'este teste não tem o que exigir da página'
  );

  const html = await (await fetch(`${BASE}/`)).text();
  const presentes = midia.filter((registro) => html.includes(registro.titulo));
  assert.ok(
    presentes.length >= 3,
    `só ${presentes.length} dos ${midia.length} títulos de mídia apareceram na home`
  );
});
