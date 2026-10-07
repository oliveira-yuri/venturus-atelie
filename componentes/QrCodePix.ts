import { createElement } from 'react';
import { gerarQr } from '../compartilhado/qrcode.ts';

/**
 * O QR de verdade do Pix. Só é usado quando a chave real existir
 * (`PIX_E_DE_TESTE = false` em app/doar/page.tsx); enquanto for chave de
 * teste, a página continua desenhando `QrCodeDeTeste`, que NÃO decodifica.
 *
 * SVG com `shape-rendering="crispEdges"` e borda de silêncio de 4 módulos:
 * sem a borda, vários leitores não acham o código. Fundo branco fixo e módulo
 * preto fixo — o leitor precisa de contraste, então o alto contraste do site
 * (que troca tokens) não pode inverter este desenho.
 */
const BORDA = 4;

export function QrCodePix({ payload, rotulo }: { payload: string; rotulo: string }) {
  const matriz = gerarQr(payload);
  const lado = matriz.length + BORDA * 2;
  const caminho: string[] = [];
  matriz.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (!linha[x]) { x++; continue; }
      let fim = x;
      while (fim < linha.length && linha[fim]) fim++;
      caminho.push(`M${x + BORDA} ${y + BORDA}h${fim - x}v1h-${fim - x}z`);
      x = fim;
    }
  });

  return createElement(
    'svg',
    {
      className: 'pix__qr',
      viewBox: `0 0 ${lado} ${lado}`,
      role: 'img',
      'aria-label': rotulo,
      shapeRendering: 'crispEdges',
      width: 220,
      height: 220
    },
    createElement('rect', { width: lado, height: lado, fill: '#ffffff' }),
    createElement('path', { d: caminho.join(''), fill: '#000000' })
  );
}
