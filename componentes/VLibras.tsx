'use client';
import { useEffect } from 'react';

declare global { interface Window { VLibras?: { Widget: new (url: string) => unknown } } }

/**
 * VLibras e widget gratuito do gov.br. Se nao carregar, o rodape segue inteiro.
 *
 * Este componente nao renderiza nenhum DOM proprio: o widget se anexa
 * sozinho a `document.body` (`script.onload` -> `new window.VLibras.Widget`),
 * por fora de qualquer arvore que o React conheca. Um container aqui seria
 * codigo morto — o widget nunca toca nele.
 *
 * O <script> recebe o nonce da propria requisicao: sob 'strict-dynamic' (ver
 * middleware.ts), liberar https://vlibras.gov.br no script-src nao valeria
 * nada — 'strict-dynamic' ignora fontes por host. O nonce na tag e o que
 * autoriza este script, e a confianca propaga dele para os scripts que ele
 * proprio carregar.
 */
export default function VLibras({ nonce }: { nonce?: string }) {
  useEffect(() => {
    if (document.querySelector('script[data-vlibras]')) return;

    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.dataset.vlibras = 'true';
    if (nonce) script.nonce = nonce;
    script.onload = () => {
      try {
        new window.VLibras!.Widget('https://vlibras.gov.br/app');
        corrigirAcessibilidade();
      } catch {
        // Sem traducao para Libras nesta visita. O resto da pagina nao muda.
      }
    };
    document.body.appendChild(script);
  }, [nonce]);

  return null;
}

/**
 * O widget injeta duas imagens sem alt e monta seu conteudo fora de qualquer
 * landmark — violacoes que o axe acusa e que nao sao nossas.
 *
 * Ele tem valor real para pessoas surdas, entao corrigimos por fora em vez de
 * remove-lo. As imagens ficam dentro de um shadow root aberto, o que exige
 * atravessar `shadowRoot` — um querySelector comum nao as alcanca.
 *
 * O widget se monta sozinho num setTimeout, entao observamos ate ele existir.
 *
 * Portado literalmente de aac-rodape.js:corrigirAcessibilidadeVLibras — este
 * e o codigo mais caro do projeto, ver o histórico do site antigo.
 */
function corrigirAcessibilidade() {
  const ajustar = () => {
    const area = document.getElementById('vlibras-access-wrapper');
    if (!area) return false;

    if (!area.hasAttribute('role')) {
      area.setAttribute('role', 'complementary');
      area.setAttribute('aria-label', 'Tradução para Libras');
    }

    // As imagens sao decorativas: o botao ja carrega a descricao em aria-label.
    area.shadowRoot?.querySelectorAll('img:not([alt])').forEach((imagem) => {
      imagem.setAttribute('alt', '');
    });

    return true;
  };

  if (ajustar()) return;

  const observador = new MutationObserver(() => {
    if (ajustar()) observador.disconnect();
  });
  observador.observe(document.body, { childList: true, subtree: true });
}
