import { listarAreas } from '../dados/voluntariado.js';
import { renderizarEstado } from '../util/estados-lista.js';

const lista = document.getElementById('lista-areas');

async function carregar() {
  renderizarEstado(lista, { situacao: 'carregando' });

  try {
    const areas = await listarAreas();
    renderizarEstado(
      lista,
      {
        situacao: 'pronto',
        itens: areas,
        mensagemVazio: 'As áreas de atuação ainda estão sendo organizadas. '
          + 'Fale com a gente que explicamos pessoalmente.'
      },
      (itens) => itens.map((area) => `
        <article class="setor">
          <h3>${area.nome}</h3>
          <p>${area.descricao}</p>
        </article>`).join('')
    );
  } catch (erro) {
    renderizarEstado(lista, {
      situacao: 'erro', erro, contexto: 'as áreas de voluntariado', aoTentarDeNovo: carregar
    });
  }
}

carregar();
