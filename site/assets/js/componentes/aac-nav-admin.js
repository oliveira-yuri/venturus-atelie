const ITENS = [
  { chave: 'inicio',      texto: 'Início',    icone: '⌂', href: '/admin/index.html' },
  { chave: 'eventos',     texto: 'Eventos',   icone: '▤', href: '/admin/eventos.html' },
  { chave: 'presenca',    texto: 'Presença',  icone: '✓', href: '/admin/presenca.html' },
  { chave: 'contatos',    texto: 'Contatos',  icone: '✉', href: '/admin/contatos.html' },
  { chave: 'mais',        texto: 'Mais',      icone: '⋯', href: '/admin/mais.html' }
];

/**
 * Navegacao do painel.
 *
 * No celular fica na parte de baixo da tela, na zona alcancavel pelo polegar:
 * a equipe opera de pe, no meio de um evento, com uma mao. No desktop vira
 * barra lateral.
 *
 * Os icones sao decorativos e ficam com aria-hidden — quem usa leitor de tela
 * ouve o texto, nao o simbolo.
 */
class AacNavAdmin extends HTMLElement {
  connectedCallback() {
    const atual = this.getAttribute('pagina-atual') || '';

    this.innerHTML = `
      <nav class="nav-admin" aria-label="Painel">
        <ul>
          ${ITENS.map((item) => `
            <li>
              <a href="${item.href}"${item.chave === atual ? ' aria-current="page"' : ''}>
                <span class="nav-admin__icone" aria-hidden="true">${item.icone}</span>
                <span class="nav-admin__texto">${item.texto}</span>
              </a>
            </li>`).join('')}
        </ul>
      </nav>`;
  }
}

customElements.define('aac-nav-admin', AacNavAdmin);
