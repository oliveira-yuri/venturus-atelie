'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { itensDeQuemEntrou } from '@/compartilhado/itens-de-quem-entrou';

export const ITENS = [
  { texto: 'Início', href: '/' },
  { texto: 'Quem somos', href: '/quem-somos' },
  { texto: 'Projetos', href: '/projetos' },
  { texto: 'Agenda', href: '/agenda' },
  { texto: 'Notícias', href: '/noticias' },
  { texto: 'Galeria', href: '/galeria' },
  { texto: 'Acervo', href: '/acervo' },
  { texto: 'Para escolas', href: '/para-escolas' },
  { texto: 'Voluntariado', href: '/voluntariado' },
  { texto: 'Apoiar', href: '/doar' },
  { texto: 'Contato', href: '/contato' }
];

/**
 * A navegação principal.
 *
 * =====================================================================
 * REESCRITO PARA O DESIGN SYSTEM v1: VIROU GAVETA
 * =====================================================================
 *
 * O sistema (variação 1a aprovada) troca o menu que empurrava a página por
 * uma gaveta: scrim escuro sobre tudo, painel marrom de 82% da largura
 * entrando pela esquerda, borda direita ocre de 2px, itens de 48px. No
 * desktop a gaveta some e a navegação vira uma faixa horizontal — quem
 * faz isso é CSS puro (estilos/sistema.css), não JavaScript medindo a
 * largura da tela.
 *
 * =====================================================================
 * O QUE NÃO MUDOU, E É O MAIS IMPORTANTE DESTE ARQUIVO
 * =====================================================================
 *
 * O SERVIDOR SEMPRE ENTREGA O <nav> VISÍVEL, com os 11 links soltos no
 * HTML. Quem não roda JavaScript enxerga a navegação inteira, só que
 * empilhada no fluxo da página em vez de recolhida numa gaveta — pior
 * esteticamente, infinitamente melhor que sumir.
 *
 * O handoff faz o contrário: `<div class="af-drawer" hidden>`, revelada
 * por script. Copiar aquilo reintroduziria um defeito que este projeto já
 * teve — a navegação alternativa morava num custom element que só existia
 * se o script rodasse — e derrubaria testes/sem-javascript.test.mjs.
 *
 * Por isso a classe `af-nav--gaveta` só entra depois de `hidratado`, e
 * `af-nav--fechada` só depois disso. Antes: `af-nav` puro, no fluxo.
 *
 * O ESTADO NÃO MORA AQUI. O hambúrguer vive dentro da faixa ocre do
 * cabeçalho e a gaveta vive fora dela; duas instâncias separadas não
 * compartilhariam `useState`. Quem guarda "aberto/fechado" é
 * componentes/Cabecalho.tsx, que enxerga os dois lados, e manda por prop.
 * O Esc e a devolução do foco também moram lá, pelo mesmo motivo.
 */
export default function MenuMovel({
  hidratado,
  aberto,
  temSessao = false,
  ehEquipe = false,
  ehVoluntario = false,
  aoFechar
}: {
  hidratado: boolean;
  aberto: boolean;
  temSessao?: boolean;
  ehEquipe?: boolean;
  ehVoluntario?: boolean;
  aoFechar: () => void;
}) {
  const rota = usePathname();

  // Só vira gaveta depois de hidratar: é a marca que garante que o HTML do
  // servidor nunca carrega essas classes.
  const classes = ['af-nav'];
  if (hidratado) {
    classes.push('af-nav--gaveta');
    if (!aberto) classes.push('af-nav--fechada');
  }

  return (
    /*
      TRES ELEMENTOS, E CADA UM TEM UM MOTIVO:

        <div id="menu-principal">   o que abre e fecha, e o scrim
          <div class="__painel">    a folha marrom que desliza
            <nav aria-label>        SO' os 11 itens de navegacao
            <div class="__rodape">  o CTA "Doar agora"

      "Doar agora" fica FORA do <nav> de proposito. Ele nao e' item de
      menu: e' uma chamada para acao que o sistema poe ao pe da gaveta. Se
      morasse dentro do <nav>, o landmark de navegacao passaria a anunciar
      doze destinos onde ha' onze, e — foi assim que se descobriu —
      testes/cabecalho.test.mjs comecaria a contar 12 links onde o
      requisito diz 11.
    */
    <div
      id="menu-principal"
      className={classes.join(' ')}
      /*
        Clicar no scrim fecha. O teste é `currentTarget === target`: só
        conta o clique que caiu no fundo, não o que caiu num link. Sem
        JavaScript nada disto existe, e não precisa existir — sem gaveta
        não há scrim.
      */
      onClick={hidratado ? (evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      } : undefined}
    >
      <div className="af-nav__painel">
        <div className="af-nav__cabeca">
          <span className="af-nav__titulo">Menu</span>
          <button
            type="button"
            className="af-nav__fechar"
            aria-label="Fechar menu"
            onClick={aoFechar}
          >
            &times;
          </button>
        </div>

        <nav aria-label="Principal">
        <ul className="af-nav__lista">
          {ITENS.map((item) => (
            <li key={item.href}>
              <Link
                className="af-navlink"
                href={item.href}
                aria-current={rota === item.href ? 'page' : undefined}
              >
                {item.texto}
              </Link>
            </li>
          ))}

          {/*
            OS ITENS DE QUEM ESTÁ DENTRO (pedido V1, mais o mural). Quem decide
            quais aparecem é `itensDeQuemEntrou`, em compartilhado/ — função
            pura, provada com uma tabela em testes/cabecalho.test.mjs.
            A decisão não mora aqui porque este arquivo é `.tsx`, e o
            runtime nativo do Node não o importa: ela ficaria sem
            verificação justamente na parte que a suíte não alcança por
            falta de sessão. Ver o cabeçalho daquele módulo.
          */}
          {itensDeQuemEntrou(temSessao, ehEquipe, ehVoluntario).map((item) => (
            <li key={item.href}>
              <Link
                className={`af-navlink ${item.classe}`}
                href={item.href}
                aria-current={
                  rota === item.href || (item.href === '/admin' && rota.startsWith('/admin'))
                    ? 'page' : undefined
                }
              >
                {item.texto}
              </Link>
            </li>
          ))}
        </ul>
        </nav>

        {/*
          "Doar agora" ao pé da gaveta, como o sistema pede. Aponta para
          /doar, que é a rota real — o handoff escreve /apoiar, que é o
          nome da tela no menu, não o endereço dela neste site.
        */}
        <div className="af-nav__rodape">
          <Link className="af-btn af-btn--ochre" href="/doar">Doar agora</Link>
        </div>
      </div>
    </div>
  );
}
