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
  // APONTA PARA A MARCA DE TESTE desde 02/09/2026. Antes lia a caixa "sem
  // chave Pix", que saiu quando a chave de exemplo entrou. O que este
  // extrator vigia não mudou: a armadilha do JSX comer os espaços ao redor
  // de um link. O parágrafo novo tem exatamente o mesmo padrão — `{' '}`
  // antes e depois do <a> do WhatsApp — e é o mesmo defeito que já
  // aconteceu neste projeto em /privacidade.
  const bloco = paginaHtml.match(/<p class="pix__marca-de-teste"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(bloco, 'não achei <p class="pix__marca-de-teste"> em /doar');
  return bloco[1]
    // React SSR insere `<!-- -->` como marcador de fronteira entre nós de
    // texto adjacentes (aqui, ao redor de cada `{' '}` explícito) — não é
    // conteúdo visível, sai sem virar espaço (mesma ordem de operação do
    // removerTags() de testes/paridade-texto.test.mjs: comentário primeiro,
    // antes das tags).
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?p[^>]*>/g, ' ')
    .replace(/<\/?strong[^>]*>/g, '')
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

/* =====================================================================
   A CHAVE PIX EXISTE AGORA, E É DE TESTE (pedido V1, 02/09/2026)
   =====================================================================

   Estes três testes cobravam a AUSÊNCIA de chave Pix — a decisão D7 estava
   pendente e o site nunca podia mostrar chave inventada. O que eles
   protegiam continua valendo, e ficou MAIS importante, não menos: agora há
   uma chave na tela, e ela é de exemplo.

   A guarda mudou de lugar, não de intenção. `testes/pix.test.mjs`
   reconcilia a chave com a bandeira `PIX_E_DE_TESTE` nos dois sentidos —
   chave de exemplo sem aviso reprova, chave real com aviso também. Foi
   provado quebrável nas duas direções.

   O que sobra aqui é a outra metade: o canal imediato do WhatsApp, que a
   ONG tem HOJE e que precisa continuar alcançável enquanto a conta
   institucional não existe. Ele mudou de caixa (saiu do aviso "sem chave" e
   entrou na marca de teste), e é isso que se cobra abaixo.
   ===================================================================== */

test('/doar mostra a chave como sendo de TESTE, com o canal imediato do WhatsApp', async () => {
  const pagina = await html();

  assert.match(pagina, /Esta chave é de teste/,
    'a chave aparece sem dizer que é de teste — alguém transferiria para o nada');

  assert.match(pagina, /O Ateliê ainda está organizando a\s+conta institucional/,
    'sumiu a explicação de POR QUE a chave é de teste');

  assert.match(pagina, /fale pelo WhatsApp/,
    'sumiu o canal que a ONG tem hoje — enquanto não há conta, é por ali que se doa');

  assert.match(pagina, /wa\.me\/5511953968344/,
    'o link do WhatsApp não aponta para o número real da ONG');
});

test('/doar: a frase da marca de teste chega inteira, com o espaço nas duas pontas do link', async () => {
  // A ARMADILHA DO JSX COME ESPAÇOS (restrição global #3). Uma quebra de
  // linha encostada numa tag é REMOVIDA pelo JSX, e o resultado é
  // "hoje,fale pelo WhatsApp." colado. Já aconteceu neste projeto, em
  // /privacidade, e o teste de paridade pegou. Aqui a asserção é por
  // igualdade da frase inteira — a única forma de observar um espaço que
  // sumiu.
  assert.equal(
    textoDoAviso(await html()),
    'Esta chave é de teste. O Ateliê ainda está organizando a conta institucional — '
    + 'nenhuma transferência para a chave abaixo chega à ONG. Para doar de verdade hoje, '
    + 'fale pelo WhatsApp.'
  );
});

test('/doar não promete recibo nem cobrança (RN08)', async () => {
  // Vale mais agora que há chave na tela: com um QR à vista, é fácil a
  // página parecer um checkout. Ela não é — o site REGISTRA doação, não
  // processa pagamento, e a frase precisa continuar dizendo isso.
  const pagina = await html();
  assert.match(pagina, /não recebe pagamento e não emite\s+recibo/,
    'sumiu a frase que diz que o site não cobra e não emite recibo');
});

