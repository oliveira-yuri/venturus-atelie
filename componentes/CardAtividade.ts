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
export function CardAtividade({ atividade, capa }: { atividade: Atividade; capa?: string | null }) {
  return createElement(
    'div',
    { className: 'card-atividade' },
    createElement(
      'article',
      { className: 'atividade', id: atividade.id },

      // A CAPA, quando há (pedido V1, migration 009). `alt` vem do banco e
      // é obrigatório quando há imagem — o `check` da 009 recusa a linha
      // sem ele.
      capa
        ? createElement('img', {
          className: 'atividade__capa',
          src: capa,
          alt: atividade.imagem_alt ?? '',
          loading: 'lazy',
          decoding: 'async'
        })
        : null,

      createElement('h2', { className: 'atividade__titulo' },
        // O TÍTULO É O LINK, e não um "Saber mais" solto ao lado: numa
        // lista de onze cartões, onze links com o mesmo texto obrigam quem
        // navega saltando de link em link a adivinhar qual é qual. O botão
        // "Saber mais" existe embaixo, para o dedo, e leva o nome dentro.
        createElement('a', { className: 'atividade__link', href: `/projetos/${atividade.id}` },
          atividade.titulo)),

      atividade.resumo
        ? createElement('p', { className: 'atividade__resumo' }, atividade.resumo)
        : null,

      // O BOTÃO. A sinopse e a ficha técnica saíram daqui e foram para a
      // página da atividade (pedido V1: "pequenos blocos, se a pessoa
      // quiser ver o projeto ela clica em saber mais").
      createElement(
        'p',
        { className: 'atividade__acoes' },
        createElement(
          'a',
          { className: 'botao botao--secundario', href: `/projetos/${atividade.id}` },
          'Saber mais',
          // O nome dentro do link, para leitor de tela: "Saber mais"
          // repetido onze vezes não diz qual é qual.
          createElement('span', { className: 'apenas-leitor-de-tela' }, ` sobre ${atividade.titulo}`)
        )
      )
    )
  );
}
