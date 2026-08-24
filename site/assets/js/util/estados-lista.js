import { mensagemDeErro } from './erros.js';

/**
 * Os três estados obrigatórios de toda lista: carregando, vazio e erro.
 *
 * Sem isto, cada tela inventa o seu — e a página fica em branco quando o
 * sinal cai no meio de um evento, que é exatamente quando ela é usada.
 */
export function renderizarEstado(elemento, estado, desenhar) {
  const {
    situacao,
    itens = [],
    erro,
    contexto = 'esta lista',
    mensagemVazio = 'Nada por aqui ainda.',
    aoTentarDeNovo
  } = estado;

  if (situacao === 'carregando') {
    elemento.setAttribute('aria-busy', 'true');
    elemento.innerHTML = '<p class="estado estado--carregando" role="status">Carregando…</p>';
    return;
  }

  elemento.setAttribute('aria-busy', 'false');

  if (situacao === 'erro') {
    const { titulo, acao } = mensagemDeErro(erro, contexto);
    elemento.innerHTML = `
      <div class="estado estado--erro" role="alert">
        <p>${titulo}</p>
        ${acao && aoTentarDeNovo ? `<button type="button" data-acao="repetir">${acao}</button>` : ''}
      </div>`;

    const botao = elemento.querySelector('[data-acao="repetir"]');
    if (botao) botao.addEventListener('click', aoTentarDeNovo);
    return;
  }

  if (situacao === 'vazio' || itens.length === 0) {
    elemento.innerHTML = `<p class="estado estado--vazio">${mensagemVazio}</p>`;
    return;
  }

  elemento.innerHTML = desenhar(itens);
}
