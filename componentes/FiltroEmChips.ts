import { createElement, type ReactNode } from 'react';

/**
 * Chips de filtro do novo layout (Análise UX-UI, 3b Projetos, 4b Busca).
 *
 * CADA CHIP É UM LINK, não um botão com estado: o filtro mora na URL
 * (`?genero=contacao`), funciona sem JavaScript, volta com o botão "voltar"
 * do celular e pode ser compartilhado. É a mesma escolha que /acervo já fez
 * com `?busca`.
 *
 * `aria-current="true"` marca o chip escolhido — não "page", porque o chip
 * não é a página, é um recorte dela. A cor cheia é o sinal para quem
 * enxerga; o atributo é o mesmo sinal para o leitor de tela.
 *
 * O alvo tem 44px de altura (o desenho usa 40): a regra de alvo mínimo do
 * site vale também para o que parece pequeno.
 */
export function Chip({ href, ativo = false, contagem, children }: {
  href: string;
  ativo?: boolean;
  contagem?: number | null;
  children?: ReactNode;
}) {
  return createElement(
    'a',
    {
      className: ativo ? 'af-chip af-chip--ativo' : 'af-chip',
      href,
      'aria-current': ativo ? 'true' : undefined
    },
    children,
    typeof contagem === 'number'
      ? createElement('span', { className: 'af-chip__contagem' }, ` · ${contagem}`)
      : null
  );
}

export type OpcaoDeFiltro = {
  texto: string;
  href: string;
  ativo?: boolean;
  contagem?: number | null;
};

/**
 * A faixa de chips. É um `<nav>` com rótulo próprio ("Filtrar por gênero"):
 * são links que mudam o que a página mostra, e o rótulo diz por qual
 * critério. Rola na horizontal no celular, sem quebrar linha — quebrar
 * empurraria o conteúdo para baixo da dobra.
 */
export function FiltroEmChips({ rotulo, opcoes }: { rotulo: string; opcoes: OpcaoDeFiltro[] }) {
  if (opcoes.length === 0) return null;
  return createElement(
    'nav',
    { className: 'af-chips', 'aria-label': rotulo },
    createElement(
      'ul',
      { className: 'af-chips__lista' },
      opcoes.map((opcao) => createElement(
        'li',
        { key: opcao.href },
        createElement(Chip, { href: opcao.href, ativo: opcao.ativo, contagem: opcao.contagem }, opcao.texto)
      ))
    )
  );
}
