import { createElement, type ReactNode } from 'react';

/**
 * O APLIQUE — o terceiro nível de elevação, e o único com a sombra dura.
 *
 * NO MÁXIMO UM POR TELA (Análise UX-UI, "Elevação em 3 níveis"). A sombra
 * deslocada é a assinatura do Ateliê, e foi justamente por aparecer em toda
 * caixa que ela deixou de destacar alguma coisa. Este componente existe para
 * que o destaque seja um gesto DECLARADO no código — `<Aplique>` — e não uma
 * classe solta que se copia de um cartão para o vizinho.
 *
 * Os outros dois níveis não precisam de componente: plano é a borda fina
 * (`--af-borda-plano`), contorno é a borda marrom (`--af-borda-contorno`).
 *
 * `como` escolhe o elemento (um cartão de evento é `article`, uma faixa é
 * `section`); `escuro` inverte para o fundo marrom com sombra ocre.
 */
export function Aplique({ como = 'div', escuro = false, className, children, ...resto }: {
  como?: 'div' | 'article' | 'section' | 'aside';
  escuro?: boolean;
  className?: string;
  children?: ReactNode;
  [atributo: string]: unknown;
}) {
  const classes = ['af-aplique', escuro ? 'af-aplique--escuro' : null, className].filter(Boolean).join(' ');
  return createElement(como, { ...resto, className: classes }, children);
}
