import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { QrCodeDeTeste } from '../componentes/QrCodeDeTeste.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * =====================================================================
 * A CHAVE PIX DE TESTE E O QR FALSO (pedido V1, 02/09/2026)
 * =====================================================================
 *
 * O dono do projeto pediu uma chave de teste e um QR falso para a
 * apresentação, com a ressalva — dele — de deixar explícito na tela que é
 * de teste. A decisão D7 (a chave real da ONG) segue pendente.
 *
 * Este arquivo existe para uma coisa acima de todas: IMPEDIR QUE A CHAVE DE
 * TESTE VÁ AO AR SEM A MARCA. Uma chave de exemplo sem aviso é pior que
 * chave nenhuma — alguém transfere dinheiro para o nada.
 *
 * Por isso a trava é uma RECONCILIAÇÃO, e não uma asserção sobre o texto:
 * enquanto a constante for a chave de exemplo, as três marcas precisam
 * existir. Quando a chave real entrar e `PIX_E_DE_TESTE` virar `false`, as
 * marcas somem e o teste continua correto — ele passa a exigir que NÃO
 * haja marca de teste com chave de verdade.
 */

async function fontePaginaDoar() {
  return readFile(new URL('../app/doar/page.tsx', import.meta.url), 'utf-8');
}

function chaveEBandeira(fonte) {
  const chave = fonte.match(/const CHAVE_PIX: string \| null = (null|'([^']*)');/);
  const bandeira = fonte.match(/const PIX_E_DE_TESTE = (true|false);/);
  return {
    chave: chave ? (chave[1] === 'null' ? null : chave[2]) : undefined,
    deTeste: bandeira ? bandeira[1] === 'true' : undefined
  };
}

test('a chave de teste e a bandeira de teste andam juntas — nas duas direções', async () => {
  const { chave, deTeste } = chaveEBandeira(await fontePaginaDoar());

  assert.notEqual(chave, undefined, 'não achei CHAVE_PIX em app/doar/page.tsx');
  assert.notEqual(deTeste, undefined, 'não achei PIX_E_DE_TESTE em app/doar/page.tsx');

  const pareceDeTeste = chave !== null && /teste|exemplo|123/i.test(chave);

  if (pareceDeTeste) {
    assert.equal(deTeste, true,
      `CHAVE_PIX é "${chave}", que parece chave de teste, mas PIX_E_DE_TESTE está false — `
      + 'a página mostraria uma chave de exemplo SEM avisar. Alguém transferiria dinheiro '
      + 'para o nada.');
  } else if (chave !== null) {
    assert.equal(deTeste, false,
      `CHAVE_PIX é "${chave}", que parece a chave de verdade, mas PIX_E_DE_TESTE continua `
      + 'true — a página diria que a chave real não funciona, e ninguém doaria.');
  }
});

test('com chave de teste, a página serve as TRÊS marcas', async () => {
  const { deTeste } = chaveEBandeira(await fontePaginaDoar());
  if (!deTeste) return; // chave real: as marcas não devem existir, e o teste acima cobre.

  const html = await fetch(`${BASE}/doar`).then((r) => r.text());

  // 1. a caixa acima da chave
  assert.match(html, /Esta chave é de teste/,
    'falta o aviso acima da chave');
  // 2. a tarja DENTRO do SVG — a que sobrevive a uma captura de tela
  assert.match(html, /EXEMPLO — NÃO FUNCIONA/,
    'falta a tarja dentro do próprio QR');
  // 3. a legenda abaixo do QR, que é a que o pedido V1 nomeia
  assert.match(html, /QR Code de exemplo, apenas para demonstração/,
    'falta a legenda abaixo do QR');
});

test('o QR de teste não é aleatório: a mesma chave desenha sempre o mesmo quadrado', () => {
  // Se fosse aleatório, servidor e cliente desenhariam diferente e o React
  // acusaria divergência de hidratação.
  const um = renderToStaticMarkup(createElement(QrCodeDeTeste, { chave: 'chaveteste-123' }));
  const dois = renderToStaticMarkup(createElement(QrCodeDeTeste, { chave: 'chaveteste-123' }));
  assert.equal(um, dois, 'o QR mudou entre duas renderizações da MESMA chave');

  const outra = renderToStaticMarkup(createElement(QrCodeDeTeste, { chave: 'outra-chave' }));
  assert.notEqual(um, outra, 'chaves diferentes desenharam o mesmo quadrado — o hash não espalha');
});

test('o QR de teste é anunciado como exemplo por quem usa leitor de tela', () => {
  const html = renderToStaticMarkup(createElement(QrCodeDeTeste, { chave: 'chaveteste-123' }));
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="[^"]*não funciona/,
    'o aria-label não diz que o QR não funciona: quem não vê a tarja precisa ouvir');
});

test('a tarja cabe na imagem — o aviso cortado é pior que nenhum', () => {
  // MEDIDO: sem `textLength`/`lengthAdjust`, a 220px a tarja dizia
  // "EMPLO — NÃO FUNCIO". A garantia é do SVG, não da fonte.
  const html = renderToStaticMarkup(createElement(QrCodeDeTeste, { chave: 'chaveteste-123' }));
  assert.match(html, /textLength=/, 'sem textLength a frase da tarja transborda o viewBox');
  assert.match(html, /lengthAdjust="spacingAndGlyphs"/);
});
