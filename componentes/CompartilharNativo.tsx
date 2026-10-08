'use client';
import { useEffect } from 'react';

/**
 * Melhora, sem substituir, os links `LinkCompartilhar`: onde o navegador tem
 * `navigator.share` (celulares), o toque abre a folha de compartilhamento do
 * aparelho em vez de abrir o WhatsApp Web. Sem a API — ou se a pessoa fechar
 * a folha — nada quebra: o <a> continua sendo um link válido.
 */
export default function CompartilharNativo() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;

    function aoClicar(evento: MouseEvent) {
      const alvo = (evento.target as Element | null)?.closest?.('a[data-compartilhar-url]');
      if (!alvo) return;
      const url = alvo.getAttribute('data-compartilhar-url');
      const titulo = alvo.getAttribute('data-compartilhar-titulo') ?? undefined;
      if (!url) return;
      evento.preventDefault();
      navigator.share({ title: titulo, url }).catch((erro: unknown) => {
        // Cancelar a folha não é erro; qualquer outra falha cai no WhatsApp.
        if ((erro as { name?: string })?.name !== 'AbortError') {
          window.open((alvo as HTMLAnchorElement).href, '_blank', 'noopener');
        }
      });
    }

    document.addEventListener('click', aoClicar);
    return () => document.removeEventListener('click', aoClicar);
  }, []);

  return null;
}
