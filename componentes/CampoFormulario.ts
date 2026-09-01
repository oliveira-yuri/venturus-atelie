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
 * `erro` existia para o dia em que uma Server Action devolvesse erro de
 * validação por campo — a Tarefa A6 criou a prop sem nenhum uso. Esse dia
 * chegou na Tarefa 3 da autenticação: os quatro formulários de conta
 * (/entrar, /recuperar-acesso, /nova-senha) passam `erro` com a mensagem
 * que veio do servidor, indexada pelo `name` do campo. A capacidade é a
 * mesma do componente original (`campo.erro = texto`), só que como prop em
 * vez de setter imperativo. `valorInicial` nasceu na mesma tarefa, e por
 * defeito medido — ver a prop.
 *
 * Escrito com createElement em vez de JSX, mesmo motivo de
 * componentes/CardAtividade.ts e das duas seções de prova social: fica um
 * .ts puro, sem nada que só funcione dentro de uma requisição do Next, e
 * testes/campo-formulario.test.mjs consegue importá-lo direto pelo runtime
 * nativo do Node (que despe os tipos, mas não transforma JSX).
 */

type TipoCampo = 'text' | 'email' | 'tel' | 'password' | 'checkbox' | 'textarea' | 'select'
  | 'file';

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
  /**
   * `accept` do `<input type="file">` — só para `tipo="file"`.
   *
   * DITO EM VOZ ALTA PORQUE CONVIDA AO ENGANO: isto NÃO valida nada. É uma
   * sugestão para o seletor de arquivos do sistema, que ajuda quem está no
   * celular a achar a foto no meio de tudo. Quem monta a requisição à mão
   * escolhe o que quiser — a verificação que conta é a dos BYTES, no
   * servidor (`tipoDaImagem`, em compartilhado/validacao.ts).
   */
  accept?: string;
  /**
   * `capture` — a dica que abre a CÂMERA em vez da galeria, no celular.
   *
   * NÃO É USADA NA GALERIA DA ONG, e o motivo está em componentes/
   * FormularioMidia.tsx: a foto quase sempre já foi tirada. A prop existe
   * porque o atributo é o par natural de `accept` num campo de arquivo, e
   * deixá-la de fora obrigaria a próxima tela a mexer neste componente.
   */
  capture?: string;
  /**
   * O que a pessoa já tinha escrito, devolvido pela Server Action que
   * recusou o envio (`valores` de EstadoFormulario) — vira `defaultValue`
   * no controle, ou `defaultChecked` na caixa de marcar ('on' = marcada).
   *
   * TAREFA 3, POR DEFEITO MEDIDO: sem isto, toda recusa devolvia o
   * formulário em branco, com script (o React 19 reseta o <form> ao fim de
   * uma action) e sem script (a página é renderizada do zero). Continua
   * sendo `defaultValue`, e não `value`: o campo segue NÃO CONTROLADO, ou
   * seja, o que a pessoa digita depois manda mais que o que veio do
   * servidor — e é o mesmo atributo que o reset do React restaura.
   */
  valorInicial?: string;
  /**
   * Prefixo de id — Rodada de correção 1 da Tarefa A6. Achado da revisão:
   * `componentes/AbasEntrar.tsx` monta os dois `<form>` (entrar e criar
   * conta) sempre os DOIS no DOM ao mesmo tempo — o painel oculto só ganha
   * `hidden`, nunca é desmontado — e os dois têm um campo "email" e um
   * campo "senha". Sem prefixo, os dois geravam o MESMO id
   * (`campo-email`, `campo-senha`), e o `label[for=]` do segundo formulário
   * resolvia para o campo do primeiro (medido no navegador real:
   * `label.control` do rótulo "E-mail" de "Criar conta" apontava para o
   * `<input>` de "Entrar"). Defeito herdado de
   * site/assets/js/componentes/aac-form-campo.js, que também deriva o id só
   * do nome — mas lá cada instância de aac-header vivia numa página só,
   * nunca dois formulários com os mesmos nomes de campo ao mesmo tempo no
   * mesmo documento.
   */
  prefixo?: string;
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
  erro,
  prefixo,
  valorInicial,
  accept,
  capture
}: PropsCampoFormulario) {
  const idCampo = prefixo ? `${prefixo}-campo-${nome}` : `campo-${nome}`;
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
    disabled: desabilitado || undefined,
    // Caixa de marcar e campo de texto não usam o mesmo atributo, e passar
    // `defaultValue` para um checkbox é erro de React, não estilo. As duas
    // chaves são declaradas sempre (uma delas `undefined`, que o React
    // ignora): um spread condicional produziria dois tipos de objeto
    // diferentes, e o createElement recusa a união.
    // Campo de arquivo NÃO aceita `defaultValue`: nenhum navegador deixa o
    // site preencher um <input type="file"> (o site escolheria um arquivo
    // do disco de quem está do outro lado). É por isso que a Action de
    // envio devolve os textos e diz, na mensagem, que a foto precisa ser
    // escolhida de novo — ver SEM_PERMISSAO em acoes/galeria.ts.
    defaultValue: tipo === 'checkbox' || tipo === 'file' ? undefined : valorInicial,
    defaultChecked: tipo === 'checkbox' ? Boolean(valorInicial) : undefined
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
  } else if (tipo === 'file') {
    controle = createElement('input', { ...atributosComuns, type: 'file', accept, capture });
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
