'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window { goatcounter?: { count?: (opcoes: { path: string }) => void; no_onload?: boolean } }
}

/**
 * Conta cada página vista no GoatCounter (sem cookie, sem identificar ninguém).
 *
 * - O painel (`/admin`) e as rotas de conta nunca são contados.
 * - `no_onload`: o script não conta sozinho; quem conta é este efeito, a
 *   cada troca de rota — a navegação do roteador não recarrega a página.
 * - O <script> leva o `nonce` da requisição (a CSP usa `strict-dynamic`).
 */
export default function ContagemDeVisitas({ host, nonce }: { host: string; nonce?: string }) {
  const caminho = usePathname();

  useEffect(() => {
    window.goatcounter = { ...window.goatcounter, no_onload: true };
    if (document.querySelector('script[data-goatcounter]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = `${host}/count`;
    if (nonce) script.setAttribute('nonce', nonce);
    document.head.appendChild(script);
  }, [host, nonce]);

  useEffect(() => {
    if (/^\/(admin|auth|entrar|nova-senha|recuperar-acesso|minha-conta)(\/|$)/.test(caminho)) return;
    let tentativas = 0;
    const tentar = () => {
      if (window.goatcounter?.count) window.goatcounter.count({ path: caminho });
      else if (tentativas++ < 20) window.setTimeout(tentar, 250);
    };
    tentar();
  }, [caminho]);

  return null;
}
