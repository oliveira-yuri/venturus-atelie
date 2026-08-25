import { listarProximos, listarPassados } from '../dados/eventos.js';
import { renderizarEstado } from '../util/estados-lista.js';

const proximos = document.getElementById('lista-proximos');
const passados = document.getElementById('lista-passados');

/** Data por extenso, como uma pessoa escreveria. */
function quando(iso) {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, às ${hora}`;
}

function desenharEventos(itens) {
  return itens.map((evento) => `
    <article class="atividade">
      <h3 class="atividade__titulo">${evento.titulo}</h3>
      <p class="atividade__resumo">
        <time datetime="${evento.comeca_em}">${quando(evento.comeca_em)}</time>
        ${evento.local ? ` · ${evento.local}` : ''}
      </p>
      ${evento.descricao ? `<p>${evento.descricao}</p>` : ''}
      ${evento.faixa_etaria ? `<p><strong>Para:</strong> ${evento.faixa_etaria}</p>` : ''}
      <p><a class="botao" href="/inscricao.html?evento=${evento.id}">Quero me inscrever</a></p>
    </article>`).join('');
}

async function carregar() {
  renderizarEstado(proximos, { situacao: 'carregando' });
  renderizarEstado(passados, { situacao: 'carregando' });

  try {
    const [emBreve, jaFoi] = await Promise.all([listarProximos(), listarPassados()]);

    renderizarEstado(proximos, {
      situacao: 'pronto',
      itens: emBreve,
      mensagemVazio: 'Nenhuma atividade marcada por enquanto. '
        + 'Acompanhe nosso Instagram ou fale com a gente para saber das próximas.'
    }, desenharEventos);

    renderizarEstado(passados, {
      situacao: 'pronto',
      itens: jaFoi,
      mensagemVazio: 'Ainda não há registro de atividades passadas por aqui.'
    }, (itens) => desenharEventos(itens).replace(
      /<p><a class="botao"[^<]*<\/a><\/p>/g, ''));
  } catch (erro) {
    renderizarEstado(proximos, {
      situacao: 'erro', erro, contexto: 'a agenda', aoTentarDeNovo: carregar
    });
    renderizarEstado(passados, { situacao: 'vazio' });
  }
}

carregar();
