import { createElement, type ReactNode } from 'react';

/**
 * A dobra "Ver mais" dos cartões do painel (pedido V1).
 *
 * =====================================================================
 * O PROBLEMA QUE ELA RESOLVE
 * =====================================================================
 *
 * "Quando for listar qualquer tipo de info que use blocos na página, ela
 * deve ser comprimida para: listar nome + info importante, e o admin clica
 * em ver mais para ver os detalhes."
 *
 * Cada candidatura, mensagem ou doação ocupa hoje uma tela inteira de
 * celular: nome, e-mail, telefone, áreas, data, o texto, e os botões. Com
 * vinte na fila, a equipe rola para sempre e não acha nada — e a ONG
 * trabalha de pé, no celular, no meio de um evento (regra 4).
 *
 * =====================================================================
 * `<details>`, E NÃO JAVASCRIPT
 * =====================================================================
 *
 * É elemento nativo: o `<summary>` já É o botão, abre e fecha sozinho, é
 * alcançável por teclado e anuncia o estado a quem usa leitor de tela —
 * tudo SEM SCRIPT. Um `useState` esconderia os detalhes de quem está sem
 * JavaScript, que é exatamente quem não pode perder nada.
 *
 * É o mesmo elemento que as três listas já usam para a dobra da MENSAGEM,
 * e as classes seguem as mesmas (`painel__dobra`), para que a tela tenha um
 * jeito só de dizer "isto abre".
 *
 * =====================================================================
 * O QUE FICA DE FORA DA DOBRA, E POR QUÊ
 * =====================================================================
 *
 * Quem chama decide, e a regra é uma: FICA VISÍVEL O QUE SE LÊ PARA
 * DECIDIR, e entra na dobra o que se lê para AGIR.
 *
 *   · a marca de situação e o nome ficam — é por eles que se acha a linha;
 *   · os BOTÕES ficam — a fila existe para ser trabalhada, e um botão
 *     atrás de uma dobra é um toque a mais em cada item;
 *   · e-mail, telefone, áreas, datas entram — só interessam depois de a
 *     pessoa ter escolhido aquele item.
 *
 * `aberta` existe para o que ainda espera resposta: numa fila de
 * atendimento, o que é novo merece chegar aberto. É a mesma decisão que a
 * dobra da mensagem já tomava com `open: nova`.
 */
export function VerMais(
  { rotulo, aberta = false, children }: {
    /** O que a dobra revela, dito em uma palavra ("dados", "detalhes"). */
    rotulo: string;
    aberta?: boolean;
    children: ReactNode;
  }
) {
  return createElement(
    'details',
    { className: 'painel__dobra painel__dobra--detalhes', open: aberta },
    createElement(
      'summary',
      { className: 'painel__dobra-titulo' },
      rotulo,
      createElement(
        'span',
        { className: 'painel__dobra-dica' },
        aberta ? 'toque para recolher' : 'toque para ver'
      )
    ),
    children
  );
}
