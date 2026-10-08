import { createElement } from 'react';

export type Aba = { texto: string; href: string; ativa?: boolean };

/**
 * Abas de página do novo layout (Análise UX-UI, 2b Agenda: "Em breve" /
 * "Já aconteceu"; 3f Entrar).
 *
 * SÃO LINKS, NÃO `role="tab"`. Cada aba leva a um endereço (`?quando=antes`)
 * que o servidor desenha inteiro: funciona sem JavaScript, e o "voltar" do
 * celular desfaz a troca. O padrão ARIA de abas (setas do teclado, um painel
 * por aba no mesmo documento) é o de componentes/AbasEntrar.tsx, onde os
 * dois painéis estão na mesma página — aqui não estão.
 *
 * `aria-current="page"` marca a aba escolhida, que é o endereço atual.
 *
 * `fixa`: gruda abaixo do cabeçalho ao rolar (o desenho a mantém à vista
 * numa lista longa de eventos).
 */
export function Abas({ rotulo, abas, fixa = false }: { rotulo: string; abas: Aba[]; fixa?: boolean }) {
  return createElement(
    'nav',
    { className: fixa ? 'af-abas af-abas--fixa' : 'af-abas', 'aria-label': rotulo },
    createElement(
      'ul',
      { className: 'af-abas__lista', style: { gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` } },
      abas.map((aba) => createElement(
        'li',
        { key: aba.href },
        createElement('a', {
          className: aba.ativa ? 'af-abas__aba af-abas__aba--ativa' : 'af-abas__aba',
          href: aba.href,
          'aria-current': aba.ativa ? 'page' : undefined
        }, aba.texto)
      ))
    )
  );
}
