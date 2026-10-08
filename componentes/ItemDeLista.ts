import { createElement, type ReactNode } from 'react';

/**
 * Uma linha de lista do novo layout (Análise UX-UI: "Por onde começar",
 * Projetos sem capa, "Todas as telas" do painel).
 *
 * Substitui o cartão com borda e sombra para o que é LISTA: linhas de pelo
 * menos 72px separadas por um fio, com a seta à direita quando a linha leva
 * a algum lugar. Alvo maior que o cartão, menos tinta na tela.
 *
 * A LINHA INTEIRA É O LINK, quando há `href` — some o "Saber mais" repetido
 * em cada item. Sem `href` é só uma linha de leitura, sem seta: uma seta que
 * não leva a lugar nenhum promete um toque que não existe.
 *
 * O `numero` ("01") e o `rotulo` (categoria, em azul) são opcionais e
 * decorativos de ordem; o nome acessível do link é o título + descrição,
 * lidos na ordem do HTML.
 */
export function ItemDeLista({ href, titulo, descricao, rotulo, numero, externo = false }: {
  href?: string | null;
  titulo: ReactNode;
  descricao?: ReactNode;
  rotulo?: ReactNode;
  numero?: string | null;
  externo?: boolean;
}) {
  const corpo = createElement(
    'span',
    { className: 'af-item__corpo' },
    rotulo ? createElement('span', { className: 'af-item__rotulo' }, rotulo) : null,
    createElement('span', { className: 'af-item__titulo' }, titulo),
    descricao ? createElement('span', { className: 'af-item__descricao' }, descricao) : null
  );

  const filhos = [
    numero ? createElement('span', { key: 'n', className: 'af-item__numero', 'aria-hidden': 'true' }, numero) : null,
    createElement('span', { key: 'c', className: 'af-item__conteudo' }, corpo),
    href ? createElement('span', { key: 's', className: 'af-item__seta', 'aria-hidden': 'true' }) : null
  ];

  const classe = ['af-item', numero ? 'af-item--numerado' : null].filter(Boolean).join(' ');

  return href
    ? createElement('a', {
      className: classe,
      href,
      rel: externo ? 'noopener' : undefined
    }, ...filhos)
    : createElement('div', { className: classe }, ...filhos);
}
