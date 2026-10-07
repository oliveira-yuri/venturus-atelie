import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { gerarQr } from '../compartilhado/qrcode.ts';
import { crc16, montarPix, paraBrCode } from '../compartilhado/pix.ts';
import { QrCodePix } from '../componentes/QrCodePix.ts';

const referencia = JSON.parse(
  await readFile(new URL('./apoio/qr-referencia.json', import.meta.url), 'utf-8')
);

test('QR: a matriz é idêntica à de uma implementação independente (qrcode, Python) para os mesmos dados e máscara', () => {
  for (const { payload, mascara, linhas } of referencia.casos) {
    const meu = gerarQr(payload, mascara).map((linha) => linha.map((c) => (c ? '1' : '0')).join(''));
    assert.deepEqual(meu, linhas, `divergiu em "${payload.slice(0, 24)}…" (máscara ${mascara})`);
  }
});

test('QR: sem máscara forçada escolhe uma das oito, e o resultado é quadrado e estável', () => {
  const a = gerarQr('https://www.atelieafrocultural.site');
  const b = gerarQr('https://www.atelieafrocultural.site');
  assert.deepEqual(a, b);
  assert.ok(a.length >= 21 && a.every((linha) => linha.length === a.length));
});

test('QR: o que não cabe LANÇA em vez de truncar (QR cortado que parece de verdade é pior que nenhum)', () => {
  assert.throws(() => gerarQr('x'.repeat(300)), /não cabem/);
});

test('Pix: CRC-16/CCITT-FALSE confere com o vetor padrão e com a biblioteca do Python', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('Pix: o código tem a estrutura do BR Code e o CRC fecha', () => {
  const codigo = montarPix({ chave: 'contato@exemplo.org', nome: 'Ateliê Afro Cultural', cidade: 'São Paulo' });
  assert.equal(codigo, '00020101021126410014br.gov.bcb.pix0119contato@exemplo.org5204000053039865802BR5920ATELIE AFRO CULTURAL6009SAO PAULO62070503***6304198D');
  assert.equal(codigo.slice(-4), crc16(codigo.slice(0, -4)));
  assert.match(codigo, /^000201010211/, 'QR estático (11), sem valor');
  assert.doesNotMatch(codigo, /54\d\d\d/, 'sem valor: quem doa escolhe a quantia');
});

test('Pix: nome e cidade viram ASCII em maiúsculas dentro dos limites, e chave inválida recusa', () => {
  assert.equal(paraBrCode('Ateliê Afro Cultural Casa Verde Zona Norte', 25).length <= 25, true);
  assert.equal(paraBrCode('São Paulo', 15), 'SAO PAULO');
  assert.throws(() => montarPix({ chave: '', nome: 'A', cidade: 'B' }), /chave/);
  assert.throws(() => montarPix({ chave: 'x'.repeat(78), nome: 'A', cidade: 'B' }), /chave/);
  assert.throws(() => montarPix({ chave: 'a', nome: '!!!', cidade: 'B' }), /recebedor/);
});

test('QrCodePix: SVG com branco/preto fixos (alto contraste do site não pode inverter) e legível por leitor de tela', () => {
  const html = renderToStaticMarkup(createElement(QrCodePix, { payload: 'hello', rotulo: 'QR do Pix' }));
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="QR do Pix"/);
  assert.match(html, /fill="#ffffff"/);
  assert.match(html, /fill="#000000"/);
});
