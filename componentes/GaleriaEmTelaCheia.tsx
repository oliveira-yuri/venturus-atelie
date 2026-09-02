'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Abrir a foto em tela cheia e passar de uma para a outra (pedido V1:
 * "usuário clica na imagem e ela abre igual a galeria do celular").
 *
 * =====================================================================
 * SEM JAVASCRIPT, CLICAR NA FOTO ABRE A FOTO — E ISSO NÃO É CONSOLO
 * =====================================================================
 *
 * Cada miniatura da galeria é, no HTML que o servidor entrega, um `<a>`
 * apontando para a imagem em tamanho cheio. Sem script, tocar nela abre a
 * foto no navegador: é o comportamento que qualquer pessoa espera, e o
 * navegador já sabe dar zoom e girar.
 *
 * Este componente INTERCEPTA esse clique quando há script, e troca a
 * navegação por um `<dialog>` que também deixa passar para a próxima —
 * que é o que a galeria do celular faz e um `<a>` sozinho não faz.
 *
 * O mesmo padrão da gaveta, da barra de acessibilidade e da confirmação do
 * painel: o servidor entrega o que funciona, e o script melhora.
 *
 * =====================================================================
 * UM OUVINTE NO DOCUMENTO, E NÃO UM COMPONENTE POR FOTO
 * =====================================================================
 *
 * `componentes/ListaAlbuns.ts` é componente de SERVIDOR, escrito em
 * `createElement`, e é ele que desenha as fotos. Convertê-lo em Client
 * Component mandaria a lista inteira para o navegador. Em vez disso, este
 * componente escuta o clique no documento e lê os `data-` de cada link —
 * a lista só precisa marcá-los.
 *
 * É a mesma solução de `componentes/ConfirmacaoDeAcoes.tsx`, e pelo mesmo
 * motivo.
 *
 * =====================================================================
 * A ORDEM DE NAVEGAÇÃO É A DA TELA
 * =====================================================================
 *
 * As setas percorrem `a[data-foto]` na ordem do DOM, que é a ordem em que
 * as fotos aparecem — álbum por álbum. Guardar uma lista em estado
 * separado abriria a chance de ela divergir do que está desenhado.
 */
type FotoAberta = {
  indice: number;
  url: string;
  alt: string;
  legenda: string;
  album: string;
  projeto: { titulo: string; href: string } | null;
};

function lerFoto(link: HTMLAnchorElement, indice: number): FotoAberta {
  return {
    indice,
    url: link.href,
    alt: link.dataset.alt ?? '',
    legenda: link.dataset.legenda ?? '',
    album: link.dataset.album ?? '',
    projeto: link.dataset.projetoHref
      ? { titulo: link.dataset.projetoTitulo ?? '', href: link.dataset.projetoHref }
      : null
  };
}

function todosOsLinks(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-foto]'));
}

export default function GaleriaEmTelaCheia() {
  const [foto, setFoto] = useState<FotoAberta | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  const irPara = useCallback((indice: number) => {
    const links = todosOsLinks();
    if (links.length === 0) return;
    // Dá a volta nas duas pontas: da última para a primeira e vice-versa.
    // É o que a galeria do celular faz, e evita um botão que não faz nada.
    const alvo = (indice + links.length) % links.length;
    setFoto(lerFoto(links[alvo], alvo));
  }, []);

  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      // Deixa passar o que o navegador faz melhor: abrir em aba nova
      // (ctrl/cmd/meio) e o menu de contexto. Interceptar isso seria tirar
      // da pessoa o "abrir em nova aba" sem oferecer nada em troca.
      if (evento.defaultPrevented || evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;
      const link = alvo.closest<HTMLAnchorElement>('a[data-foto]');
      if (!link) return;

      evento.preventDefault();
      const links = todosOsLinks();
      irPara(links.indexOf(link));
    }

    document.addEventListener('click', aoClicar);
    return () => document.removeEventListener('click', aoClicar);
  }, [irPara]);

  // As setas do teclado. Esc não precisa de código: `showModal()` já o trata.
  useEffect(() => {
    if (!foto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'ArrowRight') { evento.preventDefault(); irPara(foto!.indice + 1); }
      if (evento.key === 'ArrowLeft') { evento.preventDefault(); irPara(foto!.indice - 1); }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [foto, irPara]);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (foto && !elemento.open) elemento.showModal();
    if (!foto && elemento.open) elemento.close();
  }, [foto]);

  const total = typeof document === 'undefined' ? 0 : todosOsLinks().length;

  return (
    <dialog
      ref={dialogo}
      className="lightbox"
      aria-label="Foto em tela cheia"
      onClose={() => setFoto(null)}
      onClick={(evento) => { if (evento.target === dialogo.current) setFoto(null); }}
    >
      {foto ? (
        <div className="lightbox__caixa">
          {/*
            O <img> não é `loading="lazy"`: ele foi pedido AGORA, por um
            toque. Adiar seria mostrar um quadro vazio a quem acabou de
            tocar na foto.
          */}
          <img className="lightbox__foto" src={foto.url} alt={foto.alt} />

          <div className="lightbox__pe">
            <p className="lightbox__legenda">
              {/*
                A MENÇÃO AO PROJETO (pedido V1). Quando o nome do álbum
                bate com uma atividade, ele vira link para o cartão dela em
                /projetos. Quando não bate, continua sendo texto — nunca um
                link para lugar nenhum. Ver compartilhado/albuns-e-projetos.ts.
              */}
              {foto.projeto ? (
                <a className="lightbox__projeto" href={foto.projeto.href}>{foto.album}</a>
              ) : (
                <span className="lightbox__album">{foto.album}</span>
              )}
              {foto.legenda ? <span className="lightbox__texto">{foto.legenda}</span> : null}
            </p>

            <div className="lightbox__controles">
              <button type="button" className="lightbox__seta"
                onClick={() => irPara(foto.indice - 1)} aria-label="Foto anterior">←</button>
              <span className="lightbox__conta">{foto.indice + 1} de {total}</span>
              <button type="button" className="lightbox__seta"
                onClick={() => irPara(foto.indice + 1)} aria-label="Próxima foto">→</button>
              <button type="button" className="lightbox__fechar"
                onClick={() => setFoto(null)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
