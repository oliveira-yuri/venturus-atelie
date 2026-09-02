import { createElement } from 'react';

/**
 * Um QR Code de MENTIRA, desenhado à mão, para a fase de homologação.
 *
 * =====================================================================
 * POR QUE ELE EXISTE, E POR QUE ELE GRITA QUE É FALSO
 * =====================================================================
 *
 * A chave Pix real da ONG não existe (decisão D7, pendente desde o começo:
 * a conta institucional ainda está sendo organizada). Para a apresentação
 * do projeto, o dono pediu uma chave de teste e um QR falso — com a
 * ressalva, dele mesmo, de deixar explícito que é de teste.
 *
 * Um QR que PARECE de verdade é pior que nenhum: alguém aponta a câmera,
 * nada acontece, e a pessoa conclui que o site está quebrado — ou, pior,
 * que a doação foi feita. Por isso este desenho:
 *
 *   1. NÃO é um QR válido. O padrão dos módulos não codifica nada; nenhum
 *      leitor vai reconhecê-lo. Isso é característica, não limitação.
 *   2. Tem os três quadrados de canto que todo mundo reconhece, para que
 *      se leia como "aqui vai um QR" — e o resto é padrão, não dado.
 *   3. Carrega o aviso DENTRO da própria imagem (a tarja) além da legenda
 *      que a página escreve embaixo. Uma captura de tela do QR sozinho,
 *      circulando por WhatsApp, continua dizendo que é teste.
 *   4. `role="img"` com `aria-label` explícito: quem usa leitor de tela
 *      ouve que é um exemplo que não funciona, e não "imagem".
 *
 * =====================================================================
 * O PADRÃO É DETERMINÍSTICO, E ISSO NÃO É DETALHE
 * =====================================================================
 *
 * Nada de `Math.random()`: este componente é renderizado no SERVIDOR e
 * depois hidratado no navegador. Um padrão aleatório sairia diferente nos
 * dois lados e o React acusaria divergência de hidratação — o mesmo
 * problema que `suppressHydrationWarning` no <html> existe para tratar em
 * outro lugar.
 *
 * O padrão sai de um hash simples da própria chave, então a mesma chave
 * desenha sempre o mesmo quadrado, no servidor e no cliente.
 *
 * Escrito com createElement em vez de JSX (arquivo `.ts`, não `.tsx`) pelo
 * mesmo motivo de CardAtividade.ts e SecaoNaMidia.ts: assim o runtime
 * nativo do Node o importa direto e o teste de unidade o renderiza de
 * verdade, sem subir o Next.
 */

const LADO = 25;          // módulos por lado, como num QR pequeno de verdade
const MODULO = 8;         // px por módulo
const BORDA = 4;          // "zona quieta", em módulos

/** Os três marcadores de canto, em coordenadas de módulo. */
const CANTOS = [
  [0, 0],
  [LADO - 7, 0],
  [0, LADO - 7]
];

function dentroDeUmCanto(x: number, y: number): boolean {
  return CANTOS.some(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7);
}

/**
 * Hash determinístico e minúsculo — só precisa espalhar, não precisa ser
 * bom. É o mesmo espírito do `djb2`.
 */
function embaralhar(texto: string, x: number, y: number): number {
  let valor = 5381;
  const semente = `${texto}:${x}:${y}`;
  for (let i = 0; i < semente.length; i += 1) {
    valor = ((valor * 33) ^ semente.charCodeAt(i)) >>> 0;
  }
  return valor;
}

export function QrCodeDeTeste({ chave }: { chave: string }) {
  const total = (LADO + BORDA * 2) * MODULO;
  const modulos = [];

  for (let y = 0; y < LADO; y += 1) {
    for (let x = 0; x < LADO; x += 1) {
      if (dentroDeUmCanto(x, y)) continue;
      // ~45% de preenchimento é o que dá a textura de QR sem virar mancha.
      if (embaralhar(chave, x, y) % 100 >= 45) continue;
      modulos.push(createElement('rect', {
        key: `${x}-${y}`,
        x: (x + BORDA) * MODULO,
        y: (y + BORDA) * MODULO,
        width: MODULO,
        height: MODULO
      }));
    }
  }

  // Os marcadores de canto: quadrado cheio, anel branco, miolo cheio.
  const marcadores = CANTOS.flatMap(([cx, cy]) => {
    const px = (cx + BORDA) * MODULO;
    const py = (cy + BORDA) * MODULO;
    return [
      createElement('rect', {
        key: `f${cx}-${cy}`, x: px, y: py, width: 7 * MODULO, height: 7 * MODULO
      }),
      createElement('rect', {
        key: `b${cx}-${cy}`, fill: '#FFFFFF',
        x: px + MODULO, y: py + MODULO, width: 5 * MODULO, height: 5 * MODULO
      }),
      createElement('rect', {
        key: `m${cx}-${cy}`,
        x: px + 2 * MODULO, y: py + 2 * MODULO, width: 3 * MODULO, height: 3 * MODULO
      })
    ];
  });

  return createElement(
    'svg',
    {
      className: 'pix__qr',
      viewBox: `0 0 ${total} ${total}`,
      width: 220,
      height: 220,
      role: 'img',
      'aria-label': 'Exemplo de QR Code, apenas para demonstração. Ele não funciona: '
        + 'a chave Pix definitiva do Ateliê ainda não existe.',
      // O fundo branco é do próprio desenho, e não do CSS: um QR sobre
      // fundo creme não é lido por leitor nenhum — e este, ainda que falso,
      // precisa PARECER um QR utilizável para cumprir o papel na
      // apresentação.
      style: { background: '#FFFFFF' }
    },
    createElement('g', { fill: '#2B2019' }, ...marcadores, ...modulos),

    // A TARJA DENTRO DA IMAGEM. Existe para sobreviver a uma captura de
    // tela: o QR recortado e mandado por WhatsApp continua dizendo o que é.
    createElement('rect', {
      x: 0, y: total / 2 - 22, width: total, height: 44, fill: '#D69A10',
      stroke: '#2B2019', strokeWidth: 3
    }),
    createElement(
      'text',
      {
        x: total / 2, y: total / 2 + 7, textAnchor: 'middle',
        fontFamily: 'Bitter, Georgia, serif', fontSize: 22, fontWeight: 700, fill: '#2B2019',
        // `textLength` + `lengthAdjust` GARANTEM que a frase cabe, seja
        // qual for a fonte que o navegador acabe usando. MEDIDO sem eles:
        // a 220px o texto saía pelos dois lados e a tarja dizia
        // "EMPLO — NÃO FUNCIO" — um aviso cortado é pior que nenhum.
        textLength: total - 24,
        lengthAdjust: 'spacingAndGlyphs'
      },
      'EXEMPLO — NÃO FUNCIONA'
    )
  );
}
