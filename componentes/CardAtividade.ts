import { createElement, Fragment } from 'react';
import type { Atividade } from '@/servidor/dados/conteudo';

/**
 * Um cartão do catálogo de atividades (RF03), em /projetos.
 *
 * Porta site/assets/js/componentes/aac-card-atividade.js: aquele componente
 * recebia o dado pronto (não buscava nada) para servir tanto a página
 * pública quanto, mais adiante, o painel da equipe — a mesma divisão de
 * responsabilidade continua valendo aqui, só que como função pura de
 * apresentação em vez de custom element.
 *
 * Campos ausentes são OMITIDOS, nunca exibidos vazios (regra 2 do
 * CLAUDE.md aplicada a campo): várias das 11 atividades reais não têm
 * `resumo` nem `descricao` (ex.: "brasil-negreiro", medido em
 * dados-iniciais/atividades.json), e a ficha técnica muda de campo a
 * campo. Um `<p class="atividade__resumo"></p>` vazio, ou um item de ficha
 * com `<dd></dd>` sem valor, seriam o mesmo defeito que motivou a correção
 * de "Onde já estivemos" (componentes/SecaoOndeEstivemos.ts) — só que no
 * nível do campo, não da seção inteira.
 *
 * O ELEMENTO RAIZ carrega a classe `card-atividade`, e precisa continuar
 * sendo filho DIRETO de `#lista-atividades` (app/projetos/page.tsx mapeia
 * as atividades direto para <CardAtividade>, sem nenhum wrapper no meio).
 * `estilos/componentes.css` alterna a cor do "aplique" (a costura) por
 * `.card-atividade:nth-child(3n+2)`/`(3n+3)` — um elemento a mais entre a
 * lista e este componente muda a contagem do nth-child e tira a paleta da
 * ordem amarelo/azul/marrom que a ONG declarou (ver o comentário daquele
 * arquivo). `.atividade`, por sua vez, vai num elemento FILHO do raiz
 * (nunca nele mesmo): o seletor CSS é `.card-atividade .atividade`, um
 * combinador descendente, que não bate no próprio elemento.
 *
 * Escrito com createElement em vez de JSX, de propósito — mesma razão de
 * componentes/SecaoOndeEstivemos.ts e componentes/SecaoNaMidia.ts: fica um
 * .ts puro, sem nada que só funcione dentro de uma requisição do Next, e
 * testes/card-atividade.test.mjs consegue importá-lo direto pelo runtime
 * nativo do Node (que despe os tipos, mas não transforma JSX) e provar a
 * omissão renderizando de verdade com react-dom/server — sem subir o Next.
 * Isto é uma escolha deliberada de arquivo (.ts, não .tsx): repete o
 * "padrão de componente" das duas seções de prova social, e junto com ele
 * o "padrão de teste" que as protege — a lição que a Tarefa A2 deixou
 * (revisão apontou um componente replicado sem o teste que o acompanha).
 */
export function CardAtividade({ atividade }: { atividade: Atividade }) {
  const camposFicha: Array<[string, string | null]> = [
    ['Gênero', atividade.genero],
    ['Duração', atividade.duracao],
    ['Elenco', atividade.elenco],
    ['Classificação', atividade.classificacao],
    ['Local', atividade.local],
    ['Precisa de', atividade.rider]
  ];
  const ficha = camposFicha.filter(
    (campo): campo is [string, string] => Boolean(campo[1])
  );

  return createElement(
    'div',
    { className: 'card-atividade' },
    createElement(
      'article',
      { className: 'atividade', id: atividade.id },
      createElement('h2', { className: 'atividade__titulo' }, atividade.titulo),
      atividade.resumo
        ? createElement('p', { className: 'atividade__resumo' }, atividade.resumo)
        : null,
      atividade.descricao
        ? createElement(
            Fragment,
            null,
            ...atividade.descricao.split('\n\n').map((paragrafo, indice) =>
              createElement('p', { key: indice }, paragrafo)
            )
          )
        : null,
      ficha.length > 0
        ? createElement(
            'dl',
            { className: 'atividade__ficha' },
            ficha.map(([rotulo, valor]) =>
              createElement(
                'div',
                { key: rotulo },
                createElement('dt', null, rotulo),
                createElement('dd', null, valor)
              )
            )
          )
        : null
    )
  );
}
