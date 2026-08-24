/**
 * Rodapé compartilhado.
 *
 * Traz os cinco contatos nomeados pela ONG (RF06) e, no noscript, a navegação
 * completa: como o cabeçalho é um custom element, sem JavaScript não haveria
 * nenhum caminho entre as páginas.
 */
class AacRodape extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="rodape">
        <div class="rodape__conteudo">
          <section aria-labelledby="rodape-contato">
            <h2 id="rodape-contato">Fale com a gente</h2>
            <ul class="rodape__lista">
              <li><a href="tel:+5511953968344">(11) 95396-8344</a></li>
              <li><a href="https://wa.me/5511953968344" rel="noopener">WhatsApp</a></li>
              <li><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></li>
              <li><a href="https://instagram.com/atelie_afrocultural" rel="noopener">Instagram</a></li>
              <li><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">TikTok</a></li>
            </ul>
          </section>

          <section aria-labelledby="rodape-endereco">
            <h2 id="rodape-endereco">Onde estamos</h2>
            <address class="rodape__endereco">
              Rua Dr. Paulo Gatti, 135 — Vila Romero<br>
              São Paulo/SP — CEP 02468-030
            </address>
          </section>
        </div>

        <p class="rodape__aviso">
          <a href="/privacidade.html">Política de privacidade</a>
        </p>

        <noscript>
          <nav aria-label="Navegação sem JavaScript">
            <ul class="rodape__lista">
              <li><a href="/index.html">Início</a></li>
              <li><a href="/quem-somos.html">Quem somos</a></li>
              <li><a href="/projetos.html">Projetos</a></li>
              <li><a href="/agenda.html">Agenda</a></li>
              <li><a href="/acervo.html">Acervo</a></li>
              <li><a href="/para-escolas.html">Para escolas</a></li>
              <li><a href="/voluntariado.html">Voluntariado</a></li>
              <li><a href="/doar.html">Apoiar</a></li>
              <li><a href="/contato.html">Contato</a></li>
            </ul>
          </nav>
        </noscript>
      </footer>

      <div vw class="enabled">
        <div vw-access-button class="active"></div>
        <div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>
      </div>`;

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
      } catch {
        // Sem tradução para Libras nesta visita. O resto da página não muda.
      }
    };
    document.body.appendChild(script);
  }
}

customElements.define('aac-rodape', AacRodape);
