import { createElement } from 'react';

/**
 * componentes/CampoFormulario.ts — campo de formulário com rótulo,
 * mensagem de ajuda e mensagem de erro vinculados.
 *
 * Porta site/assets/js/componentes/aac-form-campo.js (custom element) para
 * função pura de apresentação. O motivo de existir é o mesmo do original:
 * não há caminho no código para desenhar um controle sem rótulo — confiar
 * que ninguém vai esquecer o <label> é como acessibilidade se perde, aqui
 * ela é estrutural.
 *
 * O ELEMENTO RAIZ troca a seleção `aac-form-campo` (custom element, que
 * deixa de existir neste port) pela classe `form-campo` — decisão da
 * Tarefa A6, já assumida por estilos/componentes.css
 * (`.form-campo.tem-erro input, textarea, select`). A estrutura INTERNA
 * (`.campo`, `.campo--caixa`, `.campo__linha`, `.campo__ajuda`,
 * `.campo__erro`, `.campo__obrigatorio`) é a mesma do componente original,
 * porta 1:1 — só a raiz muda de tag/seletor.
 *
 * `erro` existe para o dia em que uma Server Action (Bloco B) devolver
 * erro de validação por campo — nenhuma das três páginas da Tarefa A6 passa
 * essa prop (nenhum formulário desta tarefa valida nem envia nada ainda),
 * mas a capacidade é a mesma do componente original (`campo.erro = texto`),
 * só que como prop em vez de setter imperativo.
 *
 * Escrito com createElement em vez de JSX, mesmo motivo de
 * componentes/CardAtividade.ts e das duas seções de prova social: fica um
 * .ts puro, sem nada que só funcione dentro de uma requisição do Next, e
 * testes/campo-formulario.test.mjs consegue importá-lo direto pelo runtime
 * nativo do Node (que despe os tipos, mas não transforma JSX).
 */

type TipoCampo = 'text' | 'email' | 'tel' | 'password' | 'checkbox' | 'textarea' | 'select';

interface OpcaoCampo {
  valor: string;
  texto: string;
}

interface PropsCampoFormulario {
  nome: string;
  rotulo: string;
  tipo?: TipoCampo;
  autoComplete?: string;
  inputMode?: 'email' | 'tel' | 'numeric' | 'text';
  obrigatorio?: boolean;
  ajuda?: string;
  opcoes?: OpcaoCampo[];
  desabilitado?: boolean;
  erro?: string | null;
}

export function CampoFormulario({
  nome,
  rotulo,
  tipo = 'text',
  autoComplete,
  inputMode,
  obrigatorio,
  ajuda,
  opcoes,
  desabilitado,
  erro
}: PropsCampoFormulario) {
  const idCampo = `campo-${nome}`;
  const idAjuda = ajuda ? `${idCampo}-ajuda` : undefined;
  const idErro = `${idCampo}-erro`;

  // aria-describedby aponta para ajuda e erro: o leitor de tela anuncia os
  // dois junto com o rótulo — mesma junção do original.
  const descritoPor = [idAjuda, idErro].filter(Boolean).join(' ');

  const atributosComuns = {
    id: idCampo,
    name: nome,
    required: obrigatorio || undefined,
    'aria-describedby': descritoPor,
    'aria-invalid': erro ? 'true' : 'false',
    autoComplete,
    inputMode,
    disabled: desabilitado || undefined
  };

  let controle;
  if (tipo === 'textarea') {
    controle = createElement('textarea', { ...atributosComuns, rows: 5 });
  } else if (tipo === 'select') {
    controle = createElement(
      'select',
      atributosComuns,
      (opcoes ?? []).map((item) => createElement('option', { key: item.valor, value: item.valor }, item.texto || item.valor))
    );
  } else if (tipo === 'checkbox') {
    controle = createElement('input', { ...atributosComuns, type: 'checkbox' });
  } else {
    controle = createElement('input', { ...atributosComuns, type: tipo });
  }

  const marcaObrigatorio = obrigatorio
    ? createElement('span', { className: 'campo__obrigatorio', 'aria-hidden': 'true' }, '*')
    : null;

  // Rótulo e marca de obrigatório: mesma junção "rótulo + espaço + *" do
  // original (`${rotulo}${marcaObrigatorio}`, com o espaço já dentro da
  // string do marcador) — aqui como nó de texto próprio, não colado no
  // literal, para o espaço não depender de onde o marcador entra.
  const rotuloElemento = createElement(
    'label',
    { htmlFor: idCampo },
    rotulo,
    obrigatorio ? ' ' : null,
    marcaObrigatorio
  );

  const ajudaElemento = ajuda
    ? createElement('p', { className: 'campo__ajuda', id: idAjuda }, ajuda)
    : null;

  const erroElemento = createElement('p', { className: 'campo__erro', id: idErro, role: 'alert' }, erro || null);

  // Caixa de marcar inverte a ordem: o rótulo vem depois do controle —
  // mesma regra do original.
  const conteudoInterno = tipo === 'checkbox'
    ? createElement(
        'div',
        { className: 'campo campo--caixa' },
        createElement('div', { className: 'campo__linha' }, controle, rotuloElemento),
        ajudaElemento,
        erroElemento
      )
    : createElement('div', { className: 'campo' }, rotuloElemento, ajudaElemento, controle, erroElemento);

  const classeRaiz = erro ? 'form-campo tem-erro' : 'form-campo';

  return createElement('div', { className: classeRaiz }, conteudoInterno);
}
