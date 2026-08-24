/**
 * Cartao de uma atividade do catalogo.
 *
 * Recebe o dado pronto — nao busca nada. E o que permite o mesmo cartao
 * servir a pagina publica e, na Fase 02, o painel da equipe.
 *
 * Campos ausentes sao omitidos em vez de exibidos vazios: varias atividades
 * ainda nao tem sinopse fornecida pela ONG.
 */
class AacCardAtividade extends HTMLElement {
  connectedCallback() {
    const dados = JSON.parse(this.getAttribute('dados'));
    const ficha = [
      ['Gênero', dados.genero],
      ['Duração', dados.duracao],
      ['Elenco', dados.elenco],
      ['Classificação', dados.classificacao],
      ['Local', dados.local],
      ['Precisa de', dados.rider]
    ].filter(([, valor]) => valor);

    this.innerHTML = `
      <article class="atividade" id="${dados.id}">
        <h2 class="atividade__titulo">${dados.titulo}</h2>
        ${dados.resumo ? `<p class="atividade__resumo">${dados.resumo}</p>` : ''}
        ${dados.descricao ? dados.descricao.split('\n\n')
            .map((paragrafo) => `<p>${paragrafo}</p>`).join('') : ''}
        ${ficha.length ? `
          <dl class="atividade__ficha">
            ${ficha.map(([rotulo, valor]) => `
              <div><dt>${rotulo}</dt><dd>${valor}</dd></div>`).join('')}
          </dl>` : ''}
      </article>`;
  }
}

customElements.define('aac-card-atividade', AacCardAtividade);
