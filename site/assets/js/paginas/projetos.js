import '../componentes/aac-card-atividade.js';
import { listarAtividades } from '../dados/conteudo.js';
import { renderizarEstado } from '../util/estados-lista.js';

const lista = document.getElementById('lista-atividades');

async function carregar() {
  renderizarEstado(lista, { situacao: 'carregando' });

  try {
    const atividades = await listarAtividades();
    renderizarEstado(
      lista,
      { situacao: 'pronto', itens: atividades, mensagemVazio: 'Nenhuma atividade publicada ainda.' },
      (itens) => itens.map((atividade) =>
        `<aac-card-atividade dados='${JSON.stringify(atividade).replace(/'/g, '&#39;')}'></aac-card-atividade>`
      ).join('')
    );
  } catch (erro) {
    renderizarEstado(lista, {
      situacao: 'erro',
      erro,
      contexto: 'os projetos',
      aoTentarDeNovo: carregar
    });
  }
}

carregar();
