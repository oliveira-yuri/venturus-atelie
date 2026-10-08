import { createElement } from 'react';
import { linkDoWhatsApp } from '../compartilhado/compartilhar.ts';

/**
 * "Compartilhar": um <a> comum para o WhatsApp, que funciona sem JavaScript.
 * Com JavaScript, `componentes/CompartilharNativo.tsx` intercepta o clique
 * (pelos atributos `data-compartilhar-*`) e abre a folha de compartilhamento
 * do aparelho, quando ela existe.
 */
export function LinkCompartilhar({ titulo, endereco, rotulo = 'Compartilhar' }: {
  titulo: string;
  /** Endereço ABSOLUTO — quem recebe a mensagem não está neste site. */
  endereco: string;
  rotulo?: string;
}) {
  return createElement(
    'a',
    {
      className: 'botao botao--secundario',
      href: linkDoWhatsApp(titulo, endereco),
      target: '_blank',
      rel: 'noopener',
      'data-compartilhar-titulo': titulo,
      'data-compartilhar-url': endereco
    },
    rotulo,
    createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${titulo}`)
  );
}
