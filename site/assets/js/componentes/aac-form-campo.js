/**
 * Campo de formulário com rótulo e mensagem de erro vinculados.
 *
 * Existe por um motivo de acessibilidade: não há caminho neste código para
 * criar um input sem rótulo. Confiar que ninguém vai esquecer o <label> é
 * como acessibilidade se perde — aqui ela é estrutural.
 *
 * Uso:
 *   <aac-form-campo nome="email" rotulo="E-mail" tipo="email" obrigatorio
 *                   ajuda="Usamos para responder sua mensagem"></aac-form-campo>
 *
 * A página lê e escreve pelo valor:
 *   campo.valor           // lê
 *   campo.valor = 'x'     // escreve
 *   campo.erro = 'texto'  // mostra erro; campo.erro = null limpa
 */
class AacFormCampo extends HTMLElement {
  connectedCallback() {
    if (this.querySelector('input, textarea, select')) return; // já montado

    const nome = this.getAttribute('nome');
    const rotulo = this.getAttribute('rotulo');
    const tipo = this.getAttribute('tipo') || 'text';
    const ajuda = this.getAttribute('ajuda');
    const obrigatorio = this.hasAttribute('obrigatorio');
    const autocomplete = this.getAttribute('autocomplete');
    const inputmode = this.getAttribute('inputmode');
    const opcoes = this.getAttribute('opcoes');

    if (!nome || !rotulo) {
      throw new Error('aac-form-campo exige os atributos "nome" e "rotulo"');
    }

    const idCampo = `campo-${nome}`;
    const idAjuda = ajuda ? `${idCampo}-ajuda` : null;
    const idErro = `${idCampo}-erro`;

    // aria-describedby aponta para ajuda e erro: o leitor de tela anuncia os
    // dois junto com o rótulo.
    const descrito = [idAjuda, idErro].filter(Boolean).join(' ');

    const atributosComuns = [
      `id="${idCampo}"`,
      `name="${nome}"`,
      obrigatorio ? 'required' : '',
      `aria-describedby="${descrito}"`,
      autocomplete ? `autocomplete="${autocomplete}"` : '',
      inputmode ? `inputmode="${inputmode}"` : ''
    ].filter(Boolean).join(' ');

    let controle;
    if (tipo === 'textarea') {
      controle = `<textarea ${atributosComuns} rows="5"></textarea>`;
    } else if (tipo === 'select') {
      const itens = (opcoes || '').split('|').filter(Boolean)
        .map((item) => {
          const [valor, texto] = item.split(':');
          return `<option value="${valor}">${texto || valor}</option>`;
        }).join('');
      controle = `<select ${atributosComuns}>${itens}</select>`;
    } else if (tipo === 'checkbox') {
      controle = `<input type="checkbox" ${atributosComuns}>`;
    } else {
      controle = `<input type="${tipo}" ${atributosComuns}>`;
    }

    const marcaObrigatorio = obrigatorio
      ? ' <span class="campo__obrigatorio" aria-hidden="true">*</span>'
      : '';

    // Caixa de marcar inverte a ordem: o rótulo vem depois do controle.
    this.innerHTML = tipo === 'checkbox'
      ? `<div class="campo campo--caixa">
           <div class="campo__linha">
             ${controle}
             <label for="${idCampo}">${rotulo}${marcaObrigatorio}</label>
           </div>
           ${ajuda ? `<p class="campo__ajuda" id="${idAjuda}">${ajuda}</p>` : ''}
           <p class="campo__erro" id="${idErro}" role="alert"></p>
         </div>`
      : `<div class="campo">
           <label for="${idCampo}">${rotulo}${marcaObrigatorio}</label>
           ${ajuda ? `<p class="campo__ajuda" id="${idAjuda}">${ajuda}</p>` : ''}
           ${controle}
           <p class="campo__erro" id="${idErro}" role="alert"></p>
         </div>`;

    this.controle = this.querySelector('input, textarea, select');
    this.saidaErro = this.querySelector('.campo__erro');
  }

  get valor() {
    if (!this.controle) return '';
    return this.controle.type === 'checkbox' ? this.controle.checked : this.controle.value;
  }

  set valor(novo) {
    if (!this.controle) return;
    if (this.controle.type === 'checkbox') {
      this.controle.checked = Boolean(novo);
    } else {
      this.controle.value = novo ?? '';
    }
  }

  get erro() {
    return this.saidaErro?.textContent || null;
  }

  set erro(mensagem) {
    if (!this.saidaErro || !this.controle) return;

    this.saidaErro.textContent = mensagem || '';
    this.classList.toggle('tem-erro', Boolean(mensagem));
    this.controle.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  }

  /** Leva o foco ao campo — usado para mandar a pessoa ao primeiro erro. */
  focar() {
    this.controle?.focus();
  }
}

customElements.define('aac-form-campo', AacFormCampo);
