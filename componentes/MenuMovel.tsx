'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { itensDeQuemEntrou } from '@/compartilhado/itens-de-quem-entrou';

type Grupo = 'conhecer' | 'participar' | 'ler' | 'falar';

/**
 * Os 11 destinos de toda visita, agora COM GRUPO (Análise UX-UI, 3a).
 *
 * `naBarra`: o item também está na barra de atalhos (Cabecalho.tsx). Na
 * folha ele não se repete — a barra continua visível por cima dela.
 * `noCabecalho`: idem, só no desktop, onde o cabeçalho mostra mais dois.
 * `naRodape`: "Apoiar" já é o botão do pé da folha (e do cabeçalho do
 * desktop). Os três continuam no HTML, porque sem JavaScript esta lista é
 * a navegação inteira.
 *
 * "Acervo" passou a se chamar "Biblioteca" na navegação (decisão do grupo
 * ao escolher a barra Início · Agenda · Biblioteca · Menu). O endereço
 * continua /acervo até a Fase 6 do plano, que traz o redirect.
 *
 * A declaração termina em `];`, sem anotação de tipo, DE PROPÓSITO:
 * testes/cabecalho.test.mjs lê esta fonte e conta os `href` entre
 * `export const ITENS = [` e o primeiro `];`.
 */
export const ITENS = [
  { texto: 'Início', href: '/', grupo: 'conhecer', naBarra: true },
  { texto: 'Quem somos', href: '/quem-somos', grupo: 'conhecer', noCabecalho: true },
  { texto: 'Projetos', href: '/projetos', grupo: 'conhecer', noCabecalho: true },
  { texto: 'Agenda', href: '/agenda', grupo: 'participar', naBarra: true },
  { texto: 'Notícias', href: '/noticias', grupo: 'ler' },
  { texto: 'Galeria', href: '/galeria', grupo: 'conhecer' },
  { texto: 'Biblioteca', href: '/acervo', grupo: 'ler', naBarra: true },
  { texto: 'Para escolas', href: '/para-escolas', grupo: 'participar' },
  { texto: 'Voluntariado', href: '/voluntariado', grupo: 'participar' },
  { texto: 'Apoiar', href: '/doar', grupo: 'participar', naRodape: true },
  { texto: 'Contato', href: '/contato', grupo: 'falar' }
];

/**
 * A barra de atalhos: os três destinos ao alcance do polegar (mais o botão
 * "Menu", que Cabecalho.tsx acrescenta). `soDesktop`: no cabeçalho do
 * desktop cabem mais dois, e eles são os que mais se procuram depois dos
 * três (6a). Os textos são os MESMOS de `ITENS` — um destino tem um nome só.
 */
export const ATALHOS = [
  { texto: 'Início', href: '/' },
  { texto: 'Agenda', href: '/agenda' },
  { texto: 'Biblioteca', href: '/acervo' },
  { texto: 'Projetos', href: '/projetos', soDesktop: true },
  { texto: 'Quem somos', href: '/quem-somos', soDesktop: true }
];

const GRUPOS: Array<{ id: Grupo; titulo: string }> = [
  { id: 'conhecer', titulo: 'Conhecer' },
  { id: 'participar', titulo: 'Participar' },
  { id: 'ler', titulo: 'Ler' },
  { id: 'falar', titulo: 'Fale com a gente' }
];

function classeDoItem(i: { naBarra?: boolean; noCabecalho?: boolean; naRodape?: boolean }) {
  if (i.naBarra) return 'af-nav__item--na-barra';
  if (i.noCabecalho) return 'af-nav__item--no-cabecalho';
  if (i.naRodape) return 'af-nav__item--no-rodape';
  return '';
}

/** O mesmo número do rodapé e de /contato. */
const WHATSAPP_DA_ONG = 'https://wa.me/5511953968344';

/**
 * A navegação principal.
 *
 * =====================================================================
 * NOVO LAYOUT: DE GAVETA LATERAL PARA FOLHA QUE SOBE DE BAIXO
 * =====================================================================
 *
 * A gaveta marrom entrava pela esquerda, longe do polegar, com os 11 itens
 * numa coluna só. A folha (3a) sobe de baixo, sobre um fundo escurecido,
 * com os itens em grupos — Conhecer, Participar, Ler, Fale com a gente —,
 * o WhatsApp, os controles de leitura e, no pé, "Apoiar o Ateliê".
 * No desktop ela é o painel do "Mais", que abre sob o cabeçalho.
 *
 * =====================================================================
 * O QUE NÃO MUDOU, E É O MAIS IMPORTANTE DESTE ARQUIVO
 * =====================================================================
 *
 * O SERVIDOR SEMPRE ENTREGA A LISTA VISÍVEL, com os 11 links no HTML. Quem
 * não roda JavaScript enxerga a navegação inteira no fluxo da página — pior
 * esteticamente, infinitamente melhor que sumir. A classe `af-nav--gaveta`
 * só entra depois de hidratar, e `af-nav--fechada` só depois disso.
 * (testes/sem-javascript.test.mjs mede isso rota a rota.)
 *
 * O <nav aria-label="Principal"> TEM EXATAMENTE OS 11 ITENS de `ITENS` (mais
 * os de quem entrou). O WhatsApp e "Apoiar o Ateliê" ficam FORA dele: são
 * ações, não destinos do site — e `testes/cabecalho.test.mjs` conta 11.
 *
 * O ESTADO NÃO MORA AQUI: quem guarda "aberto/fechado", o Esc e o foco é
 * componentes/Cabecalho.tsx, que enxerga os botões e a folha.
 */
export default function MenuMovel({
  hidratado,
  aberto,
  focado = false,
  temSessao = false,
  ehEquipe = false,
  ehVoluntario = false,
  aoFechar,
  children
}: {
  hidratado: boolean;
  aberto: boolean;
  /** Layout focado (telas de conta): a folha mostra só a leitura. */
  focado?: boolean;
  temSessao?: boolean;
  ehEquipe?: boolean;
  ehVoluntario?: boolean;
  aoFechar: () => void;
  /** Os controles de leitura (Acessibilidade.tsx). */
  children?: React.ReactNode;
}) {
  const rota = usePathname();

  // Só vira folha depois de hidratar: é a marca que garante que o HTML do
  // servidor nunca carrega essas classes.
  const classes = ['af-nav'];
  if (hidratado) {
    classes.push('af-nav--gaveta');
    if (!aberto) classes.push('af-nav--fechada');
  }
  if (focado) classes.push('af-nav--focado');

  const deQuemEntrou = itensDeQuemEntrou(temSessao, ehEquipe, ehVoluntario);

  function item(texto: string, href: string, classeExtra = '') {
    return (
      <li key={href} className={classeExtra || undefined}>
        <Link
          className="af-navlink"
          href={href}
          aria-current={rota === href ? 'page' : undefined}
        >
          {texto}
        </Link>
      </li>
    );
  }

  return (
    <div
      id="menu-principal"
      className={classes.join(' ')}
      /*
        Clicar no scrim fecha. Só conta o clique que caiu no fundo, não o
        que caiu num link. Sem JavaScript nada disto existe — sem folha não
        há scrim.
      */
      onClick={hidratado ? (evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      } : undefined}
    >
      <div className="af-nav__painel">
        <div className="af-nav__cabeca">
          <span className="af-nav__alca" aria-hidden="true"></span>
          {/* No layout focado a folha só mostra os controles de leitura. */}
          <span className="af-nav__titulo">{focado ? 'Leitura' : 'Menu'}</span>
          <button
            type="button"
            className="af-nav__fechar"
            aria-label="Fechar menu"
            onClick={aoFechar}
          >
            &times;
          </button>
        </div>

        <nav aria-label="Principal" className="af-nav__principal">
          {GRUPOS.map((grupo) => (
            <div key={grupo.id} className={`af-nav__grupo af-nav__grupo--${grupo.id}`}>
              <p className="af-nav__grupo-titulo" id={`menu-grupo-${grupo.id}`}>{grupo.titulo}</p>
              <ul className="af-nav__lista" aria-labelledby={`menu-grupo-${grupo.id}`}>
                {ITENS.filter((i) => i.grupo === grupo.id).map((i) => item(
                  i.texto, i.href, classeDoItem(i)
                ))}
              </ul>
            </div>
          ))}

          {/*
            OS ITENS DE QUEM ESTÁ DENTRO (pedido V1, mais o mural), num grupo
            próprio. Quem decide quais aparecem é `itensDeQuemEntrou`, em
            compartilhado/ — função pura, provada com uma tabela em
            testes/cabecalho.test.mjs.
          */}
          {deQuemEntrou.length > 0 ? (
            <div className="af-nav__grupo af-nav__grupo--conta">
              <p className="af-nav__grupo-titulo" id="menu-grupo-conta">Sua conta</p>
              <ul className="af-nav__lista" aria-labelledby="menu-grupo-conta">
                {deQuemEntrou.map((i) => (
                  <li key={i.href}>
                    <Link
                      className={`af-navlink ${i.classe}`}
                      href={i.href}
                      aria-current={
                        rota === i.href || (i.href === '/admin' && rota.startsWith('/admin'))
                          ? 'page' : undefined
                      }
                    >
                      {i.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>

        {/*
          O WHATSAPP MORA AQUI desde que o botão flutuante saiu (Análise
          UX-UI, ponto 5; aval do grupo em 08/10/2026). É o canal que a ONG
          lê todo dia — por isso é o botão CHEIO da folha, logo abaixo de
          "Contato". Um <a> comum para wa.me: abre o aplicativo no celular,
          funciona sem JavaScript.
        */}
        <p className="af-nav__whatsapp">
          <a className="af-btn af-btn--primary" href={WHATSAPP_DA_ONG} rel="noopener">
            Conversar no WhatsApp
          </a>
        </p>

        <div className="af-nav__leitura">{children}</div>

        {/*
          "Apoiar o Ateliê" ao pé da folha, em ocre: no celular a barra de
          atalhos não tem "Apoiar", e é aqui que ele fica sempre a um toque
          do Menu. Aponta para /doar, a rota real.
        */}
        <div className="af-nav__rodape">
          <Link className="af-btn af-btn--ochre" href="/doar">Apoiar o Ateliê</Link>
        </div>
      </div>
    </div>
  );
}
