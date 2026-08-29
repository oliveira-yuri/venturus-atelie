'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Devolve ao leitor de tela o que a navegacao completa dava de graca.
 *
 * Com carregamento de pagina inteiro o foco voltava ao topo e o titulo novo
 * era anunciado. A navegacao parcial do roteador nao faz nem um nem outro, e
 * a falha e silenciosa: a pagina troca e quem nao ve a tela continua no
 * contexto antigo.
 *
 * O tabindex="-1" e aplicado por script, depois da hidratacao (dentro do
 * useEffect) — nunca no JSX renderizado pelo servidor. Isso importa por dois
 * motivos: nao gera divergencia de hidratacao (testes/hidratacao.test.mjs) e
 * nao entra na ordem natural de Tab, so no foco programatico via .focus().
 */
export default function FocoNaNavegacao() {
  const rota = usePathname();
  const primeira = useRef(true);

  useEffect(() => {
    // Na primeira carga o navegador ja posiciona o foco corretamente.
    if (primeira.current) { primeira.current = false; return; }

    const titulo = document.querySelector<HTMLElement>('main h1');
    if (!titulo) return;
    titulo.setAttribute('tabindex', '-1');
    titulo.focus();
  }, [rota]);

  return null;
}
