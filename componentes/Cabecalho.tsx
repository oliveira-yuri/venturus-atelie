'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MenuMovel from './MenuMovel';
import Acessibilidade from './Acessibilidade';
import { sair } from '@/acoes/autenticacao';

/**
 * O tipo é declarado AQUI, e não importado de `servidor/sessao.ts` (onde
 * `SessaoNoCabecalho` nasce), por causa da fronteira: aquele módulo começa
 * com `import 'server-only'`, e um Client Component que o importa quebra a
 * build de propósito. `import type` é apagado na compilação e passaria — mas
 * deixaria neste arquivo uma linha que só funciona porque um detalhe do
 * compilador a apaga. As duas formas são conferidas uma contra a outra em
 * `app/layout.tsx`, que enxerga os dois lados; se divergirem, o TypeScript
 * acusa lá.
 */
type SessaoNoCabecalho = { nome: string };

/**
 * =====================================================================
 * REESCRITO PARA O DESIGN SYSTEM "ATELIÊ AFRO" v1 (01/09/2026)
 * =====================================================================
 *
 * Desenho de origem: `docs/Três variações mobile do sistema/`, variação 1a
 * aprovada. O cabeçalho do sistema tem quatro coisas numa faixa ocre fixa:
 * hambúrguer 46×46 à esquerda, marca em duas linhas, botão "Aa" e o
 * controle de conta.
 *
 * O QUE VEIO DO SISTEMA:
 *   - faixa ocre `position: sticky`, borda inferior de 1,5px;
 *   - o hambúrguer, que era um "Menu" textual à direita;
 *   - a segunda linha da marca, "Casa Verde · São Paulo" — que não é texto
 *     inventado: é o que a ONG diz de si em /quem-somos e no rodapé, e é o
 *     que o handoff especifica ali;
 *   - o botão "Aa", que passa a comandar a barra de acessibilidade.
 *
 * O QUE NÃO VEIO, E POR QUÊ: o handoff desenha só "Entrar". O estado de
 * quem ESTÁ dentro (nome + "Sair") não aparece no mockup porque o mockup é
 * da home pública; ele continua aqui, com o visual novo, porque tirá-lo
 * deixaria a equipe sem como sair de uma sessão num celular compartilhado
 * (regra 4 do CLAUDE.md).
 *
 * =====================================================================
 * POR QUE O ESTADO MORA AQUI, E NÃO DENTRO DE CADA COMPONENTE
 * =====================================================================
 *
 * O botão e o que ele abre ficam em lugares DIFERENTES do HTML: o
 * hambúrguer dentro da faixa ocre, a gaveta fora dela; o "Aa" dentro da
 * faixa, a barra abaixo. Duas instâncias separadas de um mesmo componente
 * não compartilham `useState` — o botão abriria um estado que a gaveta não
 * lê. Então quem guarda "aberto/fechado" é este componente, que enxerga os
 * dois lados, e MenuMovel/Acessibilidade recebem o estado por prop.
 *
 * `hidratado` também nasce aqui e desce igual: é ele que garante que o
 * HTML DO SERVIDOR nunca traz a gaveta nem a barra recolhidas. Ver o bloco
 * no topo de estilos/sistema.css.
 *
 * =====================================================================
 * O QUE CONTINUA VALENDO DA VERSÃO ANTERIOR — não reler é reintroduzir bug
 * =====================================================================
 *
 * QUEM LÊ A SESSÃO NÃO É ESTE ARQUIVO. Client Component não fala com o
 * Supabase neste projeto (spec §4.1) — nem poderia, `servidor/` inteiro é
 * `import 'server-only'`. Quem pergunta é `app/layout.tsx`, que é Server
 * Component, e manda para cá o MÍNIMO: um nome. Nem id, nem e-mail, nem o
 * objeto de usuário — tudo que entra por prop num Client Component fica
 * escrito, em texto legível, no HTML de toda página.
 *
 * E NADA DISTO AUTORIZA COISA ALGUMA. O cabeçalho decide o que DESENHAR.
 * Quem decide o que pode ser lido ou gravado é a RLS do banco, sempre
 * (regra 6).
 *
 * "SAIR" É UM <form> COM SERVER ACTION, e não um botão com onClick: assim
 * ele funciona sem JavaScript, pelo mesmo mecanismo já medido nos
 * formulários de /entrar. Um `onClick` deixaria justamente quem está sem
 * script preso na sessão.
 */
export default function Cabecalho(
  { sessao, ehEquipe = false }: { sessao?: SessaoNoCabecalho | null; ehEquipe?: boolean }
) {
  const rota = usePathname();
  const emEntrar = rota === '/entrar' || rota === '/recuperar-acesso';

  const [hidratado, setHidratado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [barraAberta, setBarraAberta] = useState(false);

  const botaoMenu = useRef<HTMLButtonElement>(null);
  const botaoBarra = useRef<HTMLButtonElement>(null);

  useEffect(() => { setHidratado(true); }, []);

  // Esc fecha o que estiver aberto e devolve o foco a quem abriu. Prende no
  // documento, e não no painel: no caminho mais comum — abrir pelo botão e
  // desistir sem dar Tab — o foco continua no próprio botão, fora do painel,
  // e um listener preso ao painel nunca receberia o evento. Era um defeito
  // real da versão anterior deste componente, corrigido lá e mantido aqui.
  useEffect(() => {
    if (!hidratado) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      if (menuAberto) { setMenuAberto(false); botaoMenu.current?.focus(); }
      if (barraAberta) { setBarraAberta(false); botaoBarra.current?.focus(); }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [hidratado, menuAberto, barraAberta]);

  // A gaveta cobre a tela inteira; deixar o corpo rolando por baixo dela é o
  // defeito clássico desse padrão no celular.
  useEffect(() => {
    if (!hidratado) return;
    document.body.style.overflow = menuAberto ? 'hidden' : '';

    // A MARCA NO <html>, e ela não é enfeite: o botão flutuante de WhatsApp
    // (componentes/BotaoWhatsApp.ts) é irmão do <header>, não da gaveta —
    // então nenhum seletor CSS a partir dela o alcança. O scrim já o cobre
    // visualmente (z-index 40 contra 25), mas ele continuaria na ordem de
    // Tab, atrás de um fundo escuro, para quem navega por teclado.
    if (menuAberto) document.documentElement.setAttribute('data-gaveta', 'aberta');
    else document.documentElement.removeAttribute('data-gaveta');

    return () => {
      document.body.style.overflow = '';
      document.documentElement.removeAttribute('data-gaveta');
    };
  }, [hidratado, menuAberto]);

  // Trocar de página fecha a gaveta. Sem isto, navegar por um link de dentro
  // dela deixaria o scrim por cima da página nova.
  useEffect(() => { setMenuAberto(false); }, [rota]);

  return (
    <header className="af-header cabecalho">
      <div className="af-header__barra">
        <button
          type="button"
          ref={botaoMenu}
          className="af-burger"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={hidratado ? menuAberto : undefined}
          aria-controls="menu-principal"
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          <span></span><span></span><span></span>
        </button>

        <Link className="af-header__marca" href="/">
          <span className="af-header__nome">Ateliê Afro Cultural</span>
          <span className="af-header__meta">Casa Verde · São Paulo</span>
        </Link>

        {/*
          "Aa" é o único controle do cabeçalho que não leva a lugar nenhum:
          ele revela a barra. `aria-expanded` só aparece depois de hidratar,
          porque antes disso a barra está ABERTA e o atributo mentiria.
        */}
        <button
          type="button"
          ref={botaoBarra}
          className="af-control"
          aria-label="Opções de acessibilidade"
          aria-expanded={hidratado ? barraAberta : undefined}
          aria-controls="barra-acessibilidade"
          onClick={() => setBarraAberta((aberta) => !aberta)}
        >
          Aa
        </button>

        {sessao ? (
          /*
            SEM aria-current no "Sair": o atributo marca "este link leva à
            página em que você está", e "Sair" não leva a página nenhuma —
            é uma ação.
          */
          <div className="af-header__sessao">
            {/*
              O NOME É LINK PARA /minha-conta desde a RF11, e é o único
              caminho até a área do usuário — ela não é item de menu, porque
              para a maioria anônima aquele item só redirecionaria.

              O `aria-hidden` continua fora: quem usa leitor de tela precisa
              saber com qual conta está, tanto quanto quem enxerga.
            */}
            <Link
              className="af-control af-control--nome"
              href="/minha-conta"
              aria-current={rota === '/minha-conta' ? 'page' : undefined}
            >
              {sessao.nome}
            </Link>
            <form action={sair}>
              <button type="submit" className="af-control af-control--sair">Sair</button>
            </form>
          </div>
        ) : (
          /*
            `cabecalho__entrar` sobreviveu ao rename, e de proposito: NAO e'
            estilo (nao existe mais regra CSS com esse nome), e' o gancho
            estavel pelo qual tres testes acham este link — testes/links.test
            .mjs o RETIRA do inventario de links antes de conferir o resto, e
            testes/links-menu.test.mjs le o href dele. Um gancho de teste com
            nome de classe e' mais barato que um `data-` novo que ninguem
            saberia manter.
          */
          <Link
            className="af-control cabecalho__entrar"
            href="/entrar"
            aria-current={emEntrar ? 'page' : undefined}
          >
            Entrar
          </Link>
        )}
      </div>

      <Acessibilidade
        hidratado={hidratado}
        aberta={barraAberta}
      />

      <MenuMovel
        hidratado={hidratado}
        aberto={menuAberto}
        temSessao={Boolean(sessao)}
        ehEquipe={ehEquipe}
        aoFechar={() => { setMenuAberto(false); botaoMenu.current?.focus(); }}
      />
    </header>
  );
}
