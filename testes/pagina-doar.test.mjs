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
 *
 * RODADA DE CORREÇÃO 1 (Tarefa A5): uma revisão removeu os dois `{' '}` de
 * app/doar/page.tsx:93-94 (a armadilha do JSX come espaços, restrição
 * global #3) — o HTML saiu "Enquanto isso,<a ...>fale com a gente pelo
 * WhatsApp</a>que explicamos..." colado — e rodou a suíte inteira: 327
 * testes, 0 falhas. Nada acusou, porque:
 *
 *   1. `<div id="dados-pix">` sai de testes/paridade-texto.test.mjs (exclusão
 *      LEGÍTIMA — a div chegava vazia no HTML estático original — mas
 *      também um ponto cego para exatamente este tipo de defeito);
 *   2. o teste que havia aqui (`/doar mostra o aviso real...`) fazia dois
 *      `assert.match` de TRECHOS ISOLADOS ("Estamos organizando..." e "fale
 *      com a gente pelo WhatsApp") — nenhum dos dois observa a JUNÇÃO entre
 *      texto e elemento onde o espaço sumiu.
 *
 * `textoDoAviso()` extrai o texto do `<div class="aviso">` inteiro (as duas
 * frases, incluindo a que atravessa o link de WhatsApp) e compara por
 * IGUALDADE — sensível a espaço — em vez de checar fragmentos que passam
 * mesmo com as pontas coladas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/doar`);
  assert.equal(resposta.status, 200, '/doar não respondeu 200');
  return resposta.text();
}

/**
 * Texto visível do `<div class="aviso">` sem chave Pix — tags fora,
 * entidades decodificadas, espaços normalizados.
 *
 * CUIDADO MEDIDO NESTA MESMA RODADA: uma primeira versão deste extrator
 * fazia `.replace(/<[^>]+>/g, ' ')` — trocava QUALQUER tag por espaço,
 * `<a>` incluso. Isso FABRICA um espaço em toda fronteira de tag, inclusive
 * onde o JSX comeu o espaço de verdade — rodei esta função contra o HTML
 * com os `{' '}` removidos de propósito (reproduzindo o achado da revisão)
 * e o teste passou do mesmo jeito, porque o `<a>` virava espaço sozinho,
 * mascarando a ausência do espaço real. `<a>` é elemento INLINE: sem
 * espaço no texto ao redor dele, não há espaço na tela, e o extrator não
 * pode inventar um. Só `<p>` (bloco, sempre quebra linha, timeline de
 * `estilos/base.css`) vira espaço aqui; `<a>` desaparece sem deixar nada
 * no lugar — mesma distinção bloco/inline que `removerTags()` de
 * testes/paridade-texto.test.mjs já faz para o `<main>` inteiro.
 */
function textoDoAviso(paginaHtml) {
  const bloco = paginaHtml.match(/<div class="aviso">([\s\S]*?)<\/div>/);
  assert.ok(bloco, 'não achei <div class="aviso"> em /doar — o ramo sem chave Pix deveria estar no ar');
  return bloco[1]
    // React SSR insere `<!-- -->` como marcador de fronteira entre nós de
    // texto adjacentes (aqui, ao redor de cada `{' '}` explícito) — não é
    // conteúdo visível, sai sem virar espaço (mesma ordem de operação do
    // removerTags() de testes/paridade-texto.test.mjs: comentário primeiro,
    // antes das tags).
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?p[^>]*>/g, ' ')
    .replace(/<a[^>]*>|<\/a>/g, '')
    .replace(/&#x27;|&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
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

test('/doar: o aviso sem chave Pix é a frase inteira, com o espaço certo nas duas pontas do link de WhatsApp', async () => {
  const pagina = await html();
  assert.equal(
    textoDoAviso(pagina),
    'Estamos organizando a conta institucional para receber doações em dinheiro com a '
    + 'transparência que o assunto merece. Enquanto isso, fale com a gente pelo WhatsApp que '
    + 'explicamos exatamente para onde vai o recurso e quem recebe.'
  );
});
