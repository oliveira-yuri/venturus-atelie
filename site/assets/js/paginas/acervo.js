import '../componentes/aac-form-campo.js';
import { listarMateriais, enderecoDoArquivo } from '../dados/acervo.js';
import { renderizarEstado } from '../util/estados-lista.js';

const lista = document.getElementById('lista-acervo');
const formulario = document.getElementById('filtros-acervo');

function tamanhoLegivel(bytes) {
  if (!bytes) return null;
  const mega = bytes / (1024 * 1024);
  return mega >= 1 ? `${mega.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function desenhar(itens) {
  return itens.map((material) => {
    const tamanho = tamanhoLegivel(material.tamanho_bytes);
    return `
      <article class="atividade">
        <h3 class="atividade__titulo">${material.titulo}</h3>
        ${material.descricao ? `<p>${material.descricao}</p>` : ''}
        <dl class="atividade__ficha">
          ${material.tema ? `<div><dt>Tema</dt><dd>${material.tema}</dd></div>` : ''}
          ${material.faixa_etaria ? `<div><dt>Para</dt><dd>${material.faixa_etaria}</dd></div>` : ''}
          ${tamanho ? `<div><dt>Tamanho</dt><dd>${tamanho}</dd></div>` : ''}
        </dl>
        <p>
          <a class="botao" href="${enderecoDoArquivo(material.arquivo_caminho)}"
             download>Baixar material</a>
        </p>
      </article>`;
  }).join('');
}

async function carregar(filtros = {}) {
  renderizarEstado(lista, { situacao: 'carregando' });

  try {
    const materiais = await listarMateriais(filtros);
    renderizarEstado(lista, {
      situacao: 'pronto',
      itens: materiais,
      mensagemVazio: filtros.busca
        ? `Nada encontrado para "${filtros.busca}". Tente outra palavra.`
        : 'Ainda não há material publicado no acervo. Estamos preparando os primeiros.'
    }, desenhar);
  } catch (erro) {
    renderizarEstado(lista, {
      situacao: 'erro', erro, contexto: 'o acervo', aoTentarDeNovo: () => carregar(filtros)
    });
  }
}

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campo = formulario.querySelector('aac-form-campo[nome="busca"]');
  carregar({ busca: campo.valor.trim() });
});

carregar();
