import {
  ESCALAS, PADRAO, proximaEscala, lerPreferencias, gravarPreferencias
} from '../util/preferencias.js';

/**
 * Controles de tamanho de fonte e alto contraste.
 *
 * Sem Shadow DOM de propósito: os tokens precisam alcançar a página inteira,
 * e o isolamento de estilo impediria justamente isso.
 */
class AacAcessibilidade extends HTMLElement {
  connectedCallback() {
    this.preferencias = lerPreferencias(window.localStorage);
    this.render();
    this.aplicar();
  }

  render() {
    this.innerHTML = `
      <div class="acessibilidade" role="group" aria-label="Acessibilidade">
        <button type="button" data-acao="diminuir" aria-label="Diminuir tamanho do texto">A-</button>
        <button type="button" data-acao="padrao"   aria-label="Tamanho normal do texto">A</button>
        <button type="button" data-acao="aumentar" aria-label="Aumentar tamanho do texto">A+</button>
        <button type="button" data-acao="contraste" aria-pressed="false">Alto contraste</button>
        <p class="apenas-leitor-de-tela" role="status" data-papel="anuncio"></p>
      </div>`;

    this.anuncio = this.querySelector('[data-papel="anuncio"]');
    this.addEventListener('click', (evento) => {
      const botao = evento.target.closest('button[data-acao]');
      if (botao) this.executar(botao.dataset.acao);
    });
  }

  executar(acao) {
    if (acao === 'aumentar') this.preferencias.escala = proximaEscala(this.preferencias.escala, 1);
    if (acao === 'diminuir') this.preferencias.escala = proximaEscala(this.preferencias.escala, -1);
    if (acao === 'padrao')   this.preferencias.escala = PADRAO.escala;
    if (acao === 'contraste') {
      this.preferencias.contraste = this.preferencias.contraste === 'alto' ? 'normal' : 'alto';
    }
    gravarPreferencias(window.localStorage, this.preferencias);
    this.aplicar();
    this.anunciar(acao);
  }

  aplicar() {
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala-fonte', `${this.preferencias.escala}%`);

    if (this.preferencias.contraste === 'alto') {
      raiz.setAttribute('data-contraste', 'alto');
    } else {
      raiz.removeAttribute('data-contraste');
    }

    const alto = this.preferencias.contraste === 'alto';
    this.querySelector('[data-acao="contraste"]').setAttribute('aria-pressed', String(alto));

    // Nas pontas o botão fica inerte, e isso precisa ser perceptível sem ver a tela.
    this.querySelector('[data-acao="aumentar"]').disabled =
      this.preferencias.escala === ESCALAS[ESCALAS.length - 1];
    this.querySelector('[data-acao="diminuir"]').disabled =
      this.preferencias.escala === ESCALAS[0];
  }

  /** Quem usa leitor de tela não vê o texto crescer: precisa ser dito. */
  anunciar(acao) {
    this.anuncio.textContent = acao === 'contraste'
      ? (this.preferencias.contraste === 'alto' ? 'Alto contraste ativado' : 'Alto contraste desativado')
      : `Texto em ${this.preferencias.escala}%`;
  }
}

customElements.define('aac-acessibilidade', AacAcessibilidade);
