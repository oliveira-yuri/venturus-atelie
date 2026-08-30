/**
 * Prova que /voluntariado mostra as cinco áreas REAIS do banco (RF24) —
 * não só que componentes/ListaAreas.ts sabe desenhar cartão ou estado
 * vazio isoladamente (isso já está provado em testes/lista-areas.test.mjs).
 *
 * DOIS MODOS, direções opostas de propósito (mesma estrutura de
 * testes/origem-dos-dados.test.mjs):
 *
 *   - `npm test` (offline, sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL):
 *     servidor/dados/voluntariado.ts devolve lista vazia — `areas_
 *     voluntariado` não tem JSON versionado irmão para servir de
 *     fallback (ao contrário de atividades/clipping). A página precisa
 *     mostrar o estado vazio HONESTO, não a lista em branco.
 *
 *   - `npm run test:supabase` (credenciais reais): a tabela TEM as cinco
 *     áreas do seed (supabase/seed.sql) — a página precisa mostrar as
 *     cinco, não o estado vazio.
 *
 * Uma regressão tão simples quanto trocar `<ListaAreas areas={areas} .../>`
 * por `<ListaAreas areas={[]} .../>` em app/voluntariado/page.tsx faria
 * este teste falhar no modo com credenciais, mesmo com
 * testes/lista-areas.test.mjs inteiro verde — mesma lição de
 * testes/pagina-para-escolas.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
const comCredenciais = process.env.COM_SUPABASE === '1';

// As cinco áreas reais do seed (supabase/seed.sql) — mesma lista de
// testes/lista-areas.test.mjs.
const NOMES_REAIS = [
  'Apoio pedagógico e oficinas',
  'Comunicação e mídias',
  'Produção de eventos',
  'Organização de acervo',
  'Apoio administrativo'
];

async function html() {
  const resposta = await fetch(`${BASE}/voluntariado`);
  assert.equal(resposta.status, 200, '/voluntariado não respondeu 200');
  return resposta.text();
}

test('/voluntariado responde e traz a seção "Onde você pode ajudar"', async () => {
  const pagina = await html();
  assert.match(pagina, /<h2 id="titulo-areas">Onde você pode ajudar<\/h2>/);
});

if (!comCredenciais) {
  test('modo offline: sem tabela para consultar, mostra o estado vazio honesto, não a lista em branco', async () => {
    const pagina = await html();
    assert.match(pagina, /class="estado estado--vazio"/);
    assert.match(
      pagina,
      /As áreas de atuação ainda estão sendo organizadas\. Fale com a gente que explicamos pessoalmente\./
    );
    assert.doesNotMatch(pagina, /class="setor"/);
  });
} else {
  test('modo com credenciais: mostra as cinco áreas reais do banco, não o estado vazio', async () => {
    const pagina = await html();
    assert.doesNotMatch(pagina, /class="estado estado--vazio"/);
    for (const nome of NOMES_REAIS) {
      assert.ok(pagina.includes(nome), `área real "${nome}" não apareceu em /voluntariado`);
    }
    assert.equal((pagina.match(/class="setor"/g) || []).length, 5, 'esperava exatamente 5 áreas');
  });
}
