/**
 * Rodapé compartilhado. Traz os cinco contatos nomeados pela ONG (RF06).
 *
 * A navegação alternativa para quem está sem JavaScript NÃO mora aqui: ela
 * precisa estar no HTML estático de cada página. Um <noscript> dentro deste
 * componente nunca chegaria ao DOM, porque o componente só existe se o
 * JavaScript rodar — a proteção não protegeria nada.
 */
class AacRodape extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="rodape">
        <div class="rodape__conteudo">
          <div class="rodape__bloco">
            <h2>Fale com a gente</h2>
            <ul class="rodape__lista">
              <li><a href="tel:+5511953968344">(11) 95396-8344</a></li>
              <li><a href="https://wa.me/5511953968344" rel="noopener">WhatsApp</a></li>
              <li><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></li>
              <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener">Instagram</a></li>
              <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">TikTok</a></li>
            </ul>
          </div>

          <div class="rodape__bloco">
            <h2>Onde estamos</h2>
            <address class="rodape__endereco">
              Rua Dr. Paulo Gatti, 135 — Vila Romero<br>
              São Paulo/SP — CEP 02468-030
            </address>
          </div>
        </div>

        <p class="rodape__aviso">
          <a href="/privacidade.html">Política de privacidade</a>
        </p>
      </footer>`;

    this.carregarVLibras();
  }

  /** VLibras é widget gratuito do gov.br. Se não carregar, o rodapé segue inteiro. */
  carregarVLibras() {
    if (document.querySelector('script[data-vlibras]')) return;

    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.dataset.vlibras = 'true';
    script.onload = () => {
      try {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
        this.corrigirAcessibilidadeVLibras();
      } catch {
        // Sem tradução para Libras nesta visita. O resto da página não muda.
      }
    };
    document.body.appendChild(script);
  }

  /**
   * O widget injeta duas imagens sem alt e monta seu conteúdo fora de qualquer
   * landmark — violações que o axe acusa e que não são nossas.
   *
   * Ele tem valor real para pessoas surdas, então corrigimos por fora em vez de
   * removê-lo. As imagens ficam dentro de um shadow root aberto, o que exige
   * atravessar `shadowRoot` — um querySelector comum não as alcança.
   *
   * O widget se monta sozinho num setTimeout, então observamos até ele existir.
   */
  corrigirAcessibilidadeVLibras() {
    const ajustar = () => {
      const area = document.getElementById('vlibras-access-wrapper');
      if (!area) return false;

      if (!area.hasAttribute('role')) {
        area.setAttribute('role', 'complementary');
        area.setAttribute('aria-label', 'Tradução para Libras');
      }

      // As imagens são decorativas: o botão já carrega a descrição em aria-label.
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
}

customElements.define('aac-rodape', AacRodape);
