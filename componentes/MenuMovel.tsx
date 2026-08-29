'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
 * O menu de celular.
 *
 * O servidor SEMPRE entrega o <nav> visivel, com os 11 links soltos no HTML —
 * quem nao roda JavaScript enxerga a navegacao inteira, so que expandida em
 * vez de recolhida (pior esteticamente, infinitamente melhor que sumir). Uma
 * versao anterior deste componente escondia o nav atras de `hidden`, com a
 * visibilidade calculada dentro de um useEffect: o servidor entregava sempre
 * oculto, e sem JavaScript ninguem via o menu. Ja aconteceu neste projeto
 * (a navegacao alternativa morava num custom element que so existia se o
 * script rodasse) — nao repetir.
 *
 * Por isso o recolhimento no celular e feito por CSS, com a classe
 * `cabecalho__menu--fechado` (ver estilos/componentes.css), e essa classe so
 * entra depois de hidratar. Antes disso — sem JS, ou no instante entre o HTML
 * chegar e o React assumir — o menu fica do jeito que o servidor mandou:
 * aberto.
 *
 * Botao e nav ficam dentro de um <div class="cabecalho__menu-grupo"> comum.
 * Rodada de correcao: o onKeyDown do Esc morava so no <nav>, entao so
 * funcionava depois que o foco ja tinha entrado nele (Tab a partir do botao).
 * No caminho mais comum — abrir pelo botao e desistir sem dar Tab — o foco
 * fica no proprio botao, fora do <nav>, e o evento nunca chegava la. Prender
 * o listener no grupo cobre os dois. `display: contents` no grupo (ver CSS)
 * garante que ele nao interfere no layout flex de .cabecalho__topo — botao e
 * nav continuam se comportando como se fossem itens diretos dela.
 */
export default function MenuMovel() {
  const [aberto, setAberto] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  const rota = usePathname();

  useEffect(() => { setHidratado(true); }, []);

  // So recolhe depois de hidratar: e a marca que garante que o HTML do
  // servidor nunca carrega essa classe.
  const recolhido = hidratado && !aberto;

  return (
    <div className="cabecalho__menu-grupo"
      // Esc fecha e devolve o foco ao botao, venha o evento de onde vier
      // dentro do grupo (botao ou qualquer link do nav) — sem isso o foco
      // fica preso num menu invisivel para quem navega por teclado.
      onKeyDown={(evento) => {
        if (evento.key === 'Escape' && aberto) {
          setAberto(false);
          document.querySelector<HTMLButtonElement>('.cabecalho__alternar')?.focus();
        }
      }}>
      {/*
        Visibilidade do botao e so CSS (display:none no desktop, ver
        estilos/componentes.css) — nao depende de JavaScript detectar a
        largura da tela.
      */}
      <button className="cabecalho__alternar" type="button"
        aria-expanded={aberto} aria-controls="menu-principal"
        onClick={() => setAberto((atual) => !atual)}>Menu</button>

      <nav id="menu-principal" aria-label="Principal"
        className={recolhido ? 'cabecalho__menu cabecalho__menu--fechado' : 'cabecalho__menu'}>
        <ul>
          {ITENS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={rota === item.href ? 'page' : undefined}>
                {item.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
