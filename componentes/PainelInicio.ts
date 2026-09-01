import { createElement, Fragment } from 'react';

/**
 * A home do painel (RF33): "o que você quer fazer?", e nada além disso.
 *
 * ===================================================================
 * O DEFEITO QUE ESTE ARQUIVO EXISTE PARA NÃO REPETIR
 * ===================================================================
 *
 * A home do painel do site antigo (hoje congelada em
 * testes/apoio/html-original/admin/index.html) prometia SEIS telas que
 * nunca existiram: eventos, presença, contatos, mais, doações,
 * publicações. Seis links, seis becos. É um dos defeitos que este projeto
 * documenta, e a tentação de repeti-lo é grande justamente agora: as três
 * telas de verdade nascem só nas tarefas P2, P3 e P4.
 *
 * DECISÃO (Tarefa P1): as três aparecem, mas **só vira link a tela que já
 * existe**. Enquanto não existe, o item é texto — sem `<a>`, sem `href`,
 * sem nada clicável — com a marca "ainda não está pronta" escrita ao lado,
 * na frase, não só numa cor.
 *
 * Por que não simplesmente omitir o que não existe: a equipe da ONG vai
 * abrir esta tela antes de P2/P3/P4 ficarem prontas, e uma home vazia sob
 * o título "o que você quer fazer?" não responde nada — a pessoa fica sem
 * saber se o painel está quebrado, se ela não tem permissão, ou se aquilo
 * é tudo que existe. Listar com a marca de preparo responde as três de uma
 * vez. E o que a torna diferente da promessa do site antigo é que aqui ela
 * não pode envelhecer em silêncio: `testes/painel-guarda.test.mjs`
 * reconcilia `TELAS_DO_PAINEL` contra as rotas que de fato existem em
 * `app/` e fica vermelho nos DOIS sentidos — tela marcada como pronta sem
 * rota, e rota criada sem alguém virar a marca. Quem escrever a P2
 * descobre isso pelo teste, não pela memória.
 *
 * Escrito com createElement, não JSX, pelo mesmo motivo de
 * componentes/ListaAreas.ts e irmãos: fica um `.ts` puro, que o runtime
 * nativo do Node importa e `react-dom/server` renderiza dentro de um teste
 * — sem subir o Next, sem navegador e, o que importa aqui, SEM SESSÃO. É
 * a única forma de medir o que esta tela desenha enquanto não existe conta
 * de equipe utilizável neste projeto (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2).
 */

export type TelaDoPainel = {
  /** Rota da tela. Só vira `href` quando `pronta` for true. */
  caminho: string;
  titulo: string;
  /** O que se faz lá — frase funcional de interface, não texto da ONG. */
  descricao: string;
  /**
   * A rota existe em `app/`? Reconciliado contra o sistema de arquivos por
   * testes/painel-guarda.test.mjs — mentir aqui deixa a suíte vermelha.
   */
  pronta: boolean;
};

/**
 * As três telas do plano do painel (docs/superpowers/plans/
 * 2026-08-31-painel-administrativo.md), na ordem em que serão construídas.
 *
 * Nenhuma outra entra aqui por antecipação: indicadores (RF30–RF32),
 * eventos (RF13), presença (RF17) e gestão de voluntários (RF26) estão
 * fora do bloco, e listá-los seria de novo prometer tela que ninguém vai
 * construir tão cedo.
 */
export const TELAS_DO_PAINEL: TelaDoPainel[] = [
  {
    caminho: '/admin/publicacoes',
    titulo: 'Notícias e campanhas',
    descricao: 'Escrever, editar e publicar o que aparece na página de notícias.',
    pronta: false
  },
  {
    caminho: '/admin/galeria',
    titulo: 'Galeria',
    descricao: 'Subir foto e vídeo, escrever a descrição e registrar a autorização de uso de imagem.',
    pronta: false
  },
  {
    caminho: '/admin/atividades',
    titulo: 'Atividades',
    descricao: 'Corrigir o texto das atividades que aparecem na página de projetos.',
    pronta: false
  }
];

/**
 * O aviso de que a lista tem item que ainda não abre.
 *
 * Fica FORA do `<li>`, uma vez só, e não repetido em cada item: repetir a
 * mesma frase três vezes é ruído para quem enxerga e é três vezes a mesma
 * leitura para quem usa leitor de tela.
 */
const AVISO_DE_PREPARO = 'As telas marcadas como "ainda não está pronta" não existem no site: '
  + 'elas aparecem aqui para você saber o que vem, e viram link no dia em que ficarem prontas.';

export function PainelInicio({ telas }: { telas: TelaDoPainel[] }) {
  const faltaAlguma = telas.some((tela) => !tela.pronta);

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'painel__telas' },
      telas.map((tela) => createElement(
        'li',
        { className: 'painel__tela', key: tela.caminho },
        tela.pronta
          // Alvo de toque grande e o cartão INTEIRO clicável: a operação é
          // no celular, de pé (regra 4). O `<a>` embrulha título e
          // descrição para que o dedo não precise acertar a palavra.
          ? createElement(
            'a',
            { className: 'painel__tela-alvo', href: tela.caminho },
            createElement('strong', { className: 'painel__tela-titulo' }, tela.titulo),
            createElement('span', { className: 'painel__tela-descricao' }, tela.descricao)
          )
          // Sem <a> e sem href: um link que devolve 404 dentro do painel é
          // exatamente o defeito do site antigo. O estado "em preparo" é
          // TEXTO — quem usa leitor de tela ouve a frase, não depende de
          // enxergar uma cor mais clara.
          : createElement(
            'div',
            { className: 'painel__tela-alvo painel__tela-alvo--em-preparo' },
            createElement('strong', { className: 'painel__tela-titulo' }, tela.titulo),
            createElement('span', { className: 'painel__tela-preparo' }, 'ainda não está pronta'),
            createElement('span', { className: 'painel__tela-descricao' }, tela.descricao)
          )
      ))
    ),
    faltaAlguma
      ? createElement('p', { className: 'painel__aviso' }, AVISO_DE_PREPARO)
      : null
  );
}
