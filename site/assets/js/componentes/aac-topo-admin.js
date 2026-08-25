import { sair, perfilAtual } from '../dados/auth.js';

/**
 * Barra superior do painel: onde a pessoa esta, quem esta usando e como sair.
 * Enxuta de proposito — no celular, cada linha aqui e uma linha a menos de
 * conteudo util.
 */
class AacTopoAdmin extends HTMLElement {
  async connectedCallback() {
    const titulo = this.getAttribute('titulo') || 'Painel';

    this.innerHTML = `
      <header class="topo-admin">
        <div class="topo-admin__conteudo">
          <div>
            <p class="topo-admin__marca">Ateliê Afro Cultural</p>
            <h1 class="topo-admin__titulo">${titulo}</h1>
          </div>
          <div class="topo-admin__pessoa">
            <span data-papel="nome"></span>
            <button type="button" data-acao="sair">Sair</button>
          </div>
        </div>
      </header>`;

    this.querySelector('[data-acao="sair"]').addEventListener('click', async () => {
      await sair();
      window.location.assign('/index.html');
    });

    try {
      const perfil = await perfilAtual();
      if (perfil) {
        // Só o primeiro nome: espaço é escasso no celular.
        this.querySelector('[data-papel="nome"]').textContent = perfil.nome.split(' ')[0];
      }
    } catch {
      // Sem nome na barra. Não é motivo para quebrar o painel.
    }
  }
}

customElements.define('aac-topo-admin', AacTopoAdmin);
