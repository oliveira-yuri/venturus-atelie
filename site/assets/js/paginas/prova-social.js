import { listarClipping } from '../dados/conteudo.js';
import { renderizarEstado } from '../util/estados-lista.js';

/**
 * Preenche as secoes de prova social onde elas existirem.
 *
 * A mesma fonte alimenta "Na midia" na home e "Onde ja estivemos" na pagina
 * para escolas — por isso o script e tolerante a ausencia de cada elemento.
 */
const midia = document.getElementById('lista-midia');
const instituicoes = document.getElementById('lista-instituicoes');

function desenhar(registros) {
  return `<ul class="clipping">${registros.map((registro) => `
    <li class="clipping__item">
      <strong>${registro.titulo}</strong>
      ${registro.detalhe ? `<span class="clipping__detalhe">${registro.detalhe}</span>` : ''}
      ${registro.ano ? `<span class="clipping__ano">${registro.ano}</span>` : ''}
    </li>`).join('')}</ul>`;
}

async function carregar() {
  const alvos = [midia, instituicoes].filter(Boolean);
  if (alvos.length === 0) return;

  alvos.forEach((alvo) => renderizarEstado(alvo, { situacao: 'carregando' }));

  try {
    const registros = await listarClipping();

    if (midia) {
      renderizarEstado(
        midia,
        { situacao: 'pronto', itens: registros.filter((r) => r.tipo === 'midia') },
        desenhar
      );
    }

    if (instituicoes) {
      renderizarEstado(
        instituicoes,
        {
          situacao: 'pronto',
          itens: registros.filter((r) => r.tipo === 'instituicao' || r.tipo === 'programacao')
        },
        desenhar
      );
    }
  } catch (erro) {
    alvos.forEach((alvo) => renderizarEstado(alvo, {
      situacao: 'erro', erro, contexto: 'esta lista', aoTentarDeNovo: carregar
    }));
  }
}

carregar();
