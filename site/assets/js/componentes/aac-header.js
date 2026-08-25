import './aac-acessibilidade.js';

const ITENS = [
  { chave: 'inicio',       texto: 'Início',       href: '/index.html' },
  { chave: 'quem-somos',   texto: 'Quem somos',   href: '/quem-somos.html' },
  { chave: 'projetos',     texto: 'Projetos',     href: '/projetos.html' },
  { chave: 'agenda',       texto: 'Agenda',       href: '/agenda.html' },
  { chave: 'noticias',     texto: 'Notícias',     href: '/noticias.html' },
  { chave: 'galeria',      texto: 'Galeria',      href: '/galeria.html' },
  { chave: 'acervo',       texto: 'Acervo',       href: '/acervo.html' },
  { chave: 'para-escolas', texto: 'Para escolas', href: '/para-escolas.html' },
  { chave: 'voluntariado', texto: 'Voluntariado', href: '/voluntariado.html' },
  { chave: 'doar',         texto: 'Apoiar',       href: '/doar.html' },
  { chave: 'contato',      texto: 'Contato',      href: '/contato.html' }
];

/**
 * Cabeçalho compartilhado por todas as páginas.
 *
 * A marca aparece como tipografia, não como imagem: a ONG só possui o
 * logotipo bordado nas camisetas, e inventar um símbolo contraria a regra
 * de conteúdo do projeto. Quando o vetor chegar (decisão D9), entra aqui.
 */
class AacHeader extends HTMLElement {
  connectedCallback() {
    const atual = this.getAttribute('pagina-atual') || '';

    this.innerHTML = `
      <header class="cabecalho">
        <div class="cabecalho__topo">
          <a class="cabecalho__marca" href="/index.html">
            <span class="cabecalho__marca-nome">Ateliê Afro Cultural</span>
          </a>

          <a class="cabecalho__entrar" href="/entrar.html"${atual === 'entrar' ? ' aria-current="page"' : ''}>Entrar</a>

          <button class="cabecalho__alternar" type="button"
                  aria-expanded="false" aria-controls="menu-principal">
            Menu
          </button>

          <aac-acessibilidade></aac-acessibilidade>
        </div>

        <nav id="menu-principal" class="cabecalho__menu" aria-label="Principal" hidden>
          <ul>
            ${ITENS.map((item) => `
              <li>
                <a href="${item.href}"${item.chave === atual ? ' aria-current="page"' : ''}>${item.texto}</a>
              </li>`).join('')}
          </ul>
        </nav>
      </header>`;

    this.alternar = this.querySelector('.cabecalho__alternar');
    this.menu = this.querySelector('.cabecalho__menu');

    this.alternar.addEventListener('click', () => this.alternarMenu());

    // Esc fecha o menu e devolve o foco ao botão - esperado por quem navega
    // por teclado, e sem isso o foco fica preso num menu invisível.
    this.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && this.aberto()) {
        this.alternarMenu();
        this.alternar.focus();
      }
    });

    this.ajustarAoTamanho();
    window.addEventListener('resize', () => this.ajustarAoTamanho());
  }

  aberto() {
    return this.alternar.getAttribute('aria-expanded') === 'true';
  }

  alternarMenu() {
    const abrindo = !this.aberto();
    this.alternar.setAttribute('aria-expanded', String(abrindo));
    this.menu.hidden = !abrindo;
  }

  /** No desktop o menu é sempre visível e o botão não faz sentido. */
  ajustarAoTamanho() {
    const desktop = window.matchMedia('(min-width: 48rem)').matches;
    this.alternar.hidden = desktop;

    if (desktop) {
      this.menu.hidden = false;
      this.alternar.setAttribute('aria-expanded', 'false');
    } else if (!this.aberto()) {
      this.menu.hidden = true;
    }
  }
}

customElements.define('aac-header', AacHeader);
