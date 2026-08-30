/**
 * Prova que /doar nunca exibe uma chave Pix inventada (D7 do escopo,
 * pendente com a ONG) — regra 2 do CLAUDE.md: campo sem dado fica ausente,
 * a página nunca preenche com texto de preenchimento nem com um valor
 * fabricado. Fiel a site/assets/js/paginas/doar.js, que já resolve isso em
 * produção hoje com `const CHAVE_PIX = null` e um aviso honesto no lugar.
 *
 * Roda nos dois modos de teste desta suíte: a chave Pix não vem do banco
 * (é uma constante no código, decisão D7 ainda não resolvida por ninguém),
 * então o resultado esperado é o MESMO em `npm test` e `npm run
 * test:supabase` — diferente de /voluntariado (testes/pagina-
 * voluntariado.test.mjs), onde os dois modos divergem porque ali sim há
 * tabela por trás.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/doar`);
  assert.equal(resposta.status, 200, '/doar não respondeu 200');
  return resposta.text();
}

test('/doar traz a seção "Doação em dinheiro"', async () => {
  const pagina = await html();
  assert.match(pagina, /<h2 id="titulo-financeiro">Doação em dinheiro<\/h2>/);
});

test('/doar nunca mostra uma chave Pix — nem inventada, nem de preenchimento', async () => {
  const pagina = await html();
  assert.doesNotMatch(pagina, /Chave Pix/, 'a chave Pix é decisão D7, ainda pendente com a ONG');
  assert.doesNotMatch(pagina, /aviso--sucesso/, 'o ramo com chave (CHAVE_PIX preenchida) não deveria renderizar');
});

test('/doar mostra o aviso real de conta em organização, com um canal imediato (WhatsApp)', async () => {
  const pagina = await html();
  assert.match(
    pagina,
    /Estamos organizando a conta institucional para receber doações em dinheiro/
  );
  assert.match(pagina, /fale com a gente pelo WhatsApp/);
});
