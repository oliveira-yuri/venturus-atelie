'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MenuMovel, { ATALHOS } from './MenuMovel';
import Acessibilidade from './Acessibilidade';
import { sair } from '@/acoes/autenticacao';
import { caminhoInternoSeguro } from '@/compartilhado/destino-apos-entrar';

/**
 * O tipo é declarado AQUI, e não importado de `servidor/sessao.ts` (onde
 * `SessaoNoCabecalho` nasce), por causa da fronteira: aquele módulo começa
 * com `import 'server-only'`, e um Client Component que o importa quebra a
 * build de propósito. As duas formas são conferidas uma contra a outra em
 * `app/layout.tsx`, que enxerga os dois lados; se divergirem, o TypeScript
 * acusa lá.
 */
type SessaoNoCabecalho = { nome: string };

/**
 * As telas de conta usam o layout FOCADO (Análise UX-UI, 3f; plano, 2.6):
 * sem barra de atalhos, só "Voltar". Quem está entrando ou trocando a senha
 * tem uma tarefa só, e quatro destinos de navegação no pé da tela são quatro
 * jeitos de abandoná-la no meio.
 */
const ROTAS_FOCADAS = ['/entrar', '/recuperar-acesso', '/nova-senha'];

type Abertura = 'menu' | 'leitura';

/**
 * =====================================================================
 * REESCRITO PARA O NOVO LAYOUT (Análise UX-UI, 08/10/2026)
 * =====================================================================
 *
 * O que a análise apontou, e o que mudou por isso:
 *
 *   - "OCRE DEMAIS NO TOPO": cabeçalho e herói em ocre somavam uns 600px de
 *     cor forte antes do primeiro conteúdo. O cabeçalho agora é CREME, de
 *     60px, com o logotipo real da ONG no lugar do nome escrito em duas
 *     linhas. O ocre fica para "Apoiar", estado ativo e data.
 *
 *   - "NAVEGAÇÃO ESCONDIDA": a gaveta tinha 11 itens sem grupo e "Apoiar"
 *     era o 10º. Agora há uma BARRA DE ATALHOS — Início · Agenda ·
 *     Biblioteca · Menu — que no celular mora no pé da tela, ao alcance do
 *     polegar, e no desktop vira a navegação do próprio cabeçalho (com
 *     Projetos e Quem somos a mais, porque ali cabe). O "Menu" abre uma
 *     FOLHA que sobe de baixo, com o resto em grupos (MenuMovel.tsx).
 *
 *   - "ELEMENTOS FLUTUANDO POR CIMA DO CONTEÚDO": cabeçalho fixo, barra de
 *     acessibilidade fixa, botão de WhatsApp e VLibras disputavam a tela.
 *     O WhatsApp e os controles de leitura passaram a morar DENTRO da folha
 *     do menu; o VLibras continua onde está (regra 8: nunca remover).
 *
 * =====================================================================
 * UMA FOLHA SÓ, DOIS BOTÕES QUE A ABREM
 * =====================================================================
 *
 * "Menu" (na barra de atalhos) abre a folha no topo; "Aa" (no cabeçalho)
 * abre a MESMA folha já no bloco "Leitura" — A-, A, A+, alto contraste e
 * ouvir a página. Uma folha só porque os controles de leitura são UM
 * componente com estado próprio (as preferências); duas cópias dele
 * divergiriam.
 *
 * O estado mora AQUI pelo mesmo motivo de antes: os dois botões e a folha
 * ficam em lugares diferentes do HTML, e duas instâncias separadas não
 * compartilhariam `useState`.
 *
 * =====================================================================
 * O QUE CONTINUA VALENDO DA VERSÃO ANTERIOR — não reler é reintroduzir bug
 * =====================================================================
 *
 * O SERVIDOR ENTREGA TUDO ABERTO. Sem JavaScript, a folha é uma lista no
 * fluxo da página e os controles de leitura vêm junto — e os dois botões são
 * LINKS para âncoras (`#menu-principal`, `#barra-acessibilidade`), que levam
 * a pessoa até lá. Botão que só o React faz funcionar seria controle morto
 * para quem está sem script; um link para uma âncora funciona sempre. Com
 * script, o MESMO elemento ganha `role="button"` e `aria-expanded` (trocar
 * de elemento na hidratação deixaria os testes, e o leitor de tela,
 * segurando um nó que deixou de existir).
 *
 * QUEM LÊ A SESSÃO NÃO É ESTE ARQUIVO. Client Component não fala com o
 * Supabase neste projeto (spec §4.1). Quem pergunta é `app/layout.tsx`, que
 * manda para cá o MÍNIMO: um nome. E nada disto autoriza coisa alguma — o
 * cabeçalho decide o que DESENHAR; a RLS decide o que pode (regra 6).
 *
 * "SAIR" É UM <form> COM SERVER ACTION, para funcionar sem JavaScript.
 *
 * ESC FECHA E DEVOLVE O FOCO A QUEM ABRIU, preso no documento (e não na
 * folha): no caminho mais comum — abrir e desistir sem dar Tab — o foco
 * poderia continuar no botão, fora da folha.
 */
export default function Cabecalho(
  { sessao, ehEquipe = false, ehVoluntario = false }:
  { sessao?: SessaoNoCabecalho | null; ehEquipe?: boolean; ehVoluntario?: boolean }
) {
  const rota = usePathname();
  const emEntrar = rota === '/entrar' || rota === '/recuperar-acesso';
  const focado = ROTAS_FOCADAS.includes(rota);

  const [hidratado, setHidratado] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // Quem abriu a folha: decide onde o foco cai e para onde ele volta.
  const [abertoPor, setAbertoPor] = useState<Abertura>('menu');
  // "Voltar" do layout focado: o `?voltar=` que /entrar já usa, se for um
  // caminho interno seguro. Lido do endereço só depois de hidratar —
  // `useSearchParams` no layout raiz exigiria um Suspense em toda rota.
  const [voltarPara, setVoltarPara] = useState('/');

  const botaoMenu = useRef<HTMLAnchorElement>(null);
  const botaoLeitura = useRef<HTMLAnchorElement>(null);

  useEffect(() => { setHidratado(true); }, []);

  useEffect(() => {
    if (!focado) return;
    const pedido = new URLSearchParams(window.location.search).get('voltar');
    setVoltarPara(caminhoInternoSeguro(pedido) ?? '/');
  }, [focado, rota]);

  const fechar = useCallback(() => {
    setMenuAberto(false);
    (abertoPor === 'leitura' ? botaoLeitura : botaoMenu).current?.focus();
  }, [abertoPor]);

  function alternar(por: Abertura, evento: React.SyntheticEvent) {
    // Sem JavaScript o link leva à âncora; com ele, abre e fecha a folha.
    evento.preventDefault();
    if (menuAberto && abertoPor === por) { setMenuAberto(false); return; }
    setAbertoPor(por);
    setMenuAberto(true);
  }

  // Esc fecha; Tab fica preso dentro da folha enquanto ela está aberta.
  useEffect(() => {
    if (!hidratado || !menuAberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') { fechar(); return; }
      if (evento.key !== 'Tab') return;

      const painel = document.querySelector<HTMLElement>('#menu-principal .af-nav__painel');
      if (!painel) return;
      const alvos = [...painel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
        .filter((alvo) => alvo.offsetParent !== null);
      if (alvos.length === 0) return;

      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const dentro = painel.contains(document.activeElement);
      if (evento.shiftKey && (document.activeElement === primeiro || !dentro)) {
        evento.preventDefault(); ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !dentro)) {
        evento.preventDefault(); primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [hidratado, menuAberto, fechar]);

  // Ao abrir, o foco entra na folha: no "Fechar" (pelo Menu) ou no primeiro
  // controle de leitura (pelo Aa). Quem usa leitor de tela ouve onde está;
  // quem usa teclado não atravessa a página até chegar nela.
  useEffect(() => {
    if (!hidratado || !menuAberto) return;
    if (abertoPor === 'leitura') {
      const barra = document.getElementById('barra-acessibilidade');
      barra?.scrollIntoView({ block: 'nearest' });
      barra?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    } else {
      document.querySelector<HTMLElement>('#menu-principal .af-nav__fechar')?.focus();
    }
  }, [hidratado, menuAberto, abertoPor]);

  // A folha cobre a tela: o corpo não rola por baixo dela.
  useEffect(() => {
    if (!hidratado) return;
    document.body.style.overflow = menuAberto ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [hidratado, menuAberto]);

  // Trocar de página fecha a folha. Sem isto, navegar por um link de dentro
  // dela deixaria o scrim por cima da página nova.
  useEffect(() => { setMenuAberto(false); }, [rota]);

  // Os atributos de BOTÃO só existem depois de hidratar: antes disso o
  // elemento é um link para a âncora, e `aria-expanded` mentiria.
  function comoBotao(por: Abertura) {
    if (!hidratado) return {};
    return {
      role: 'button',
      'aria-expanded': menuAberto && (por === 'menu' || abertoPor === 'leitura'),
      onClick: (evento: React.MouseEvent) => alternar(por, evento),
      // Um <a role="button"> não responde à barra de espaço sozinho, como
      // um <button> responderia. Enter já funciona (é o clique do link).
      onKeyDown: (evento: React.KeyboardEvent) => { if (evento.key === ' ') alternar(por, evento); }
    };
  }

  const classes = ['af-header', 'cabecalho'];
  if (focado) classes.push('af-header--focado');

  return (
    <header className={classes.join(' ')}>
      <div className="af-header__barra">
        {focado ? (
          <Link className="af-header__voltar" href={voltarPara}>
            <span className="af-voltar__seta" aria-hidden="true"></span>Voltar
          </Link>
        ) : (
          <Link className="af-header__marca" href="/">
            {/*
              O logotipo REAL da ONG (public/imagens/logo-atelie.png, extraído
              do formulário de levantamento — ver componentes/Rodape.tsx). O
              `alt` é o nome: aqui a imagem É o nome do site, e é o único
              lugar do cabeçalho onde ele está escrito.
            */}
            <img src="/imagens/logo-atelie.png" alt="Ateliê Afro Cultural"
              width={260} height={106} decoding="async" />
          </Link>
        )}

        {focado ? null : (
          /*
            A BARRA DE ATALHOS. No celular, o CSS a põe no pé da tela; no
            desktop ela é a navegação do cabeçalho. É um elemento só nos dois
            casos — nada de duas cópias dos mesmos links no HTML.

            "Menu" é o ÚLTIMO item e é um link para `#menu-principal`: sem
            JavaScript ele leva à lista no fluxo da página. A classe
            `af-burger` sobreviveu ao hambúrguer de propósito: é o gancho
            pelo qual os testes de teclado acham este botão.
          */
          <nav className="af-atalhos" aria-label="Atalhos">
            <ul className="af-atalhos__lista">
              {ATALHOS.map((atalho) => (
                <li key={atalho.href} className={atalho.soDesktop ? 'af-atalhos__item--desktop' : undefined}>
                  <Link
                    className="af-atalho"
                    href={atalho.href}
                    aria-current={rota === atalho.href ? 'page' : undefined}
                  >
                    {atalho.texto}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  ref={botaoMenu}
                  className="af-burger"
                  href="#menu-principal"
                  aria-controls="menu-principal"
                  aria-label={menuAberto && abertoPor === 'menu' ? 'Fechar menu' : 'Abrir menu'}
                  {...comoBotao('menu')}
                >
                  <span className="af-burger__celular" aria-hidden="true">Menu</span>
                  <span className="af-burger__desktop" aria-hidden="true">Mais</span>
                </a>
              </li>
            </ul>
          </nav>
        )}

        <div className="af-header__acoes">
          {/*
            "Aa" abre a folha no bloco de leitura. O nome acessível é o
            `aria-label`; os dois rótulos visíveis são `aria-hidden`.
          */}
          <a
            ref={botaoLeitura}
            className="af-control af-control--leitura"
            href="#barra-acessibilidade"
            aria-controls="barra-acessibilidade"
            aria-label="Opções de acessibilidade"
            {...comoBotao('leitura')}
          >
            <span className="af-control__curto" aria-hidden="true">Aa</span>
            <span className="af-control__longo" aria-hidden="true">Aa · Leitura</span>
          </a>

          {sessao ? (
            <div className="af-header__sessao">
              {/*
                O NOME É LINK PARA /minha-conta desde a RF11 — um dos dois
                caminhos até a área do usuário (o outro é o menu).
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
              `cabecalho__entrar` é gancho de teste, não estilo: testes/
              links.test.mjs o retira do inventário de links, e testes/
              links-menu.test.mjs lê o href dele.
            */
            <Link
              className="af-control cabecalho__entrar"
              href="/entrar"
              aria-current={emEntrar ? 'page' : undefined}
            >
              Entrar
            </Link>
          )}

          {/*
            "Apoiar" no cabeçalho do DESKTOP, sempre visível e em ocre — a
            única ação do site com essa cor (6a). No celular ele mora no pé
            da folha do menu, e o CSS o esconde daqui.
          */}
          {focado ? null : (
            <Link className="af-control af-control--apoiar" href="/doar">Apoiar</Link>
          )}
        </div>
      </div>

      <MenuMovel
        hidratado={hidratado}
        aberto={menuAberto}
        focado={focado}
        temSessao={Boolean(sessao)}
        ehEquipe={ehEquipe}
        ehVoluntario={ehVoluntario}
        aoFechar={fechar}
      >
        <Acessibilidade />
      </MenuMovel>
    </header>
  );
}
