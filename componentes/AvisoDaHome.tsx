'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * A confirmação que a pessoa vê ao chegar na home depois de fazer alguma
 * coisa: criar conta, candidatar-se ao voluntariado, ofertar uma doação.
 *
 * =====================================================================
 * "POPUP" AQUI É `<dialog>`, E SÓ DEPOIS DE HIDRATAR
 * =====================================================================
 *
 * O pedido V1 diz "popup". Um popup que só existe com JavaScript deixaria
 * quem está sem script sem NENHUMA confirmação de que a candidatura foi
 * registrada — e este site funciona sem script por requisito, medido rota a
 * rota (testes/sem-javascript.test.mjs).
 *
 * Então o servidor entrega uma CAIXA COMUM, no topo do `<main>`, visível e
 * legível. Depois de hidratar, o React a promove a `<dialog>` modal. É a
 * mesma regra da gaveta e da barra de acessibilidade: o servidor entrega o
 * conteúdo, e o recolhimento (aqui, a promoção a modal) é o que vem depois.
 *
 * Sem script: caixa no topo da página. Com script: popup que interrompe,
 * porque é isso que uma confirmação de ação precisa fazer.
 *
 * =====================================================================
 * ELE FECHA, E FECHAR LIMPA A URL
 * =====================================================================
 *
 * Sem limpar, um F5 (ou o botão voltar) reabriria o popup dizendo
 * "candidatura registrada" de novo — e a pessoa não saberia se registrou
 * duas. `replaceState` tira o `?aviso=` sem recarregar nada e sem
 * acrescentar entrada ao histórico.
 *
 * A caixa NÃO some depois de fechada: ela volta a ser a caixa comum no topo
 * do `<main>`. Quem fechou sem ler ainda alcança o texto.
 */
export type AvisoParaDesenhar = {
  texto: string;
  ok: boolean;
  link?: { href: string; texto: string };
};

export default function AvisoDaHome({ aviso }: { aviso: AvisoParaDesenhar }) {
  const [comoModal, setComoModal] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => { setComoModal(true); }, []);

  useEffect(() => {
    if (!comoModal) return;
    const elemento = dialogo.current;
    if (elemento && !elemento.open) elemento.showModal();
  }, [comoModal]);

  function fechar() {
    setComoModal(false);
    // Tira o `?aviso=` sem recarregar e sem empilhar histórico.
    const url = new URL(window.location.href);
    if (url.searchParams.has('aviso')) {
      url.searchParams.delete('aviso');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }

  const corpo = (
    <>
      <p className="af-dialogo__corpo">{aviso.texto}</p>
      {aviso.link ? (
        <p className="af-dialogo__acoes">
          <Link className="af-btn af-btn--primary" href={aviso.link.href} onClick={fechar}>
            {aviso.link.texto}
          </Link>
        </p>
      ) : null}
    </>
  );

  // ANTES DE HIDRATAR (e para sempre, sem JavaScript): caixa comum.
  if (!comoModal) {
    return (
      <div className="conteudo">
        <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
          {corpo}
        </div>
      </div>
    );
  }

  return (
    <dialog
      ref={dialogo}
      className="af-dialogo"
      aria-labelledby="aviso-da-home-titulo"
      onClose={fechar}
      onClick={(evento) => { if (evento.target === dialogo.current) fechar(); }}
    >
      <div className="af-dialogo__caixa">
        {/*
          O título é fixo e curto porque a frase que importa é a do corpo —
          e porque um <dialog> sem nome acessível é anunciado como "diálogo"
          e mais nada por quem usa leitor de tela.
        */}
        <h2 id="aviso-da-home-titulo" className="af-dialogo__titulo">Pronto</h2>
        {corpo}
        <div className="af-dialogo__acoes">
          <button type="button" className="af-dialogo__cancelar" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
