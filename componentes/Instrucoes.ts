import { createElement, Fragment, type ReactNode } from 'react';

/**
 * As instruções do topo de cada tela do painel, em bullets (pedido V1).
 *
 * =====================================================================
 * O QUE MUDA, E POR QUE ISSO IMPORTA NUMA TELA DE CELULAR
 * =====================================================================
 *
 * "Instruções para admins e user devem ser melhores escritas, com
 * destaques para palavras importantes, em bullet points."
 *
 * Cada tela abria com um parágrafo corrido de três ou quatro linhas. Num
 * celular, de pé, no meio de um evento (regra 4), um parágrafo é uma
 * parede: a pessoa lê a primeira linha, entende que "é sobre isso", e pula
 * — inclusive a frase que dizia que subir NÃO publica.
 *
 * Em bullets, cada regra ocupa uma linha e sobrevive à leitura em
 * diagonal, que é a leitura real desta tela.
 *
 * =====================================================================
 * O DESTAQUE É `<strong>`, E ELE É SEMÂNTICO
 * =====================================================================
 *
 * `<strong>` e não uma classe com `font-weight`: quem usa leitor de tela
 * ouve a ênfase, e quem usa alto contraste continua vendo a diferença
 * (peso é sinal que não depende de cor — regra 8). Os trechos em destaque
 * são escritos pelo próprio texto, com `<strong>` no meio da frase, e não
 * por uma heurística que adivinha "palavras importantes": adivinhar
 * destacaria a palavra errada na primeira frase nova.
 *
 * =====================================================================
 * A PRIMEIRA LINHA CONTINUA SENDO UM PARÁGRAFO
 * =====================================================================
 *
 * `resumo` é o "o que é esta tela", e ele não vira bullet: uma lista que
 * começa sem contexto obriga a pessoa a montar o contexto sozinha. O
 * parágrafo diz onde ela está; os bullets dizem o que fazer.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo de
 * CardAtividade.ts e VerMais.ts: o runtime nativo do Node o importa e o
 * teste o renderiza de verdade, sem subir o Next.
 */
export function Instrucoes(
  { resumo, itens }: {
    /** O "o que é esta tela", em uma frase. Continua parágrafo. */
    resumo: ReactNode;
    /** Uma regra por item. Use <strong> no que não pode ser pulado. */
    itens: ReactNode[];
  }
) {
  return createElement(
    Fragment,
    null,
    createElement('p', { className: 'destaque painel__resumo' }, resumo),
    createElement(
      'ul',
      { className: 'painel__instrucoes' },
      itens.map((item, indice) =>
        createElement('li', { key: indice }, item))
    )
  );
}
