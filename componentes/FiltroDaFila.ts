import { createElement } from 'react';

/**
 * O filtro das filas do painel (pedido V1).
 *
 * =====================================================================
 * `<form method="get">`, E NÃO JAVASCRIPT
 * =====================================================================
 *
 * Um formulário GET comum: o navegador monta a URL sozinho, a página
 * recarrega com o filtro aplicado, o botão voltar desfaz, e o endereço
 * pode ser mandado por WhatsApp para outra pessoa da equipe. Tudo isso sem
 * uma linha de script — que é a condição de toda tela deste painel.
 *
 * O botão "Filtrar" fica na tela SEMPRE, e não só quando o JavaScript
 * carrega: sem ele, quem está sem script escolhe no `<select>` e não tem
 * como enviar. Com script, o botão continua sendo o que envia — nada aqui
 * filtra "enquanto se digita", porque isso exigiria script e mudaria a
 * página debaixo do dedo de quem está lendo.
 *
 * =====================================================================
 * FILTRAR NÃO PODE ESCONDER SEM DIZER
 * =====================================================================
 *
 * É a mesma regra da paginação, e é a mais importante das duas: quando há
 * filtro ativo, `componentes/Paginacao.ts` escreve quantos registros
 * existem NAQUELE recorte — e este componente desenha o botão "Ver todas",
 * que é a saída. Sem ele, a equipe que filtrou por "nova" e esqueceu
 * concluiria que só há duas candidaturas no mundo.
 *
 * =====================================================================
 * O FILTRO ZERA A PÁGINA, DE PROPÓSITO
 * =====================================================================
 *
 * Não há `<input type="hidden" name="pagina">` aqui. Filtrar por "nova"
 * estando na página 3 e continuar na 3 mostraria uma tela vazia — o
 * recorte novo tem menos páginas. Voltar para a primeira é o único
 * desfecho que sempre faz sentido.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo de
 * Paginacao.ts: o runtime nativo do Node o importa e o teste o renderiza.
 */
export type OpcaoDeFiltro = { valor: string; rotulo: string };

export function FiltroDaFila(
  { opcoes, atual, rotulo, nomePlural }: {
    opcoes: OpcaoDeFiltro[];
    /** O valor em vigor, ou '' para "todas". */
    atual: string;
    /** O que se filtra ("Situação"). */
    rotulo: string;
    /** Para o texto do botão de limpar ("Ver todas as candidaturas"). */
    nomePlural: string;
  }
) {
  const filtrando = atual !== '';

  return createElement(
    'form',
    { className: 'filtro', method: 'get', role: 'search' },

    createElement(
      'p',
      { className: 'filtro__campo' },
      createElement('label', { className: 'filtro__rotulo', htmlFor: 'filtro-situacao' }, rotulo),
      createElement(
        'select',
        { id: 'filtro-situacao', name: 'situacao', defaultValue: atual },
        // A opção "todas" vem PRIMEIRO e tem valor vazio: é o estado
        // natural da fila, e um valor vazio some da URL sozinho quando o
        // navegador monta a query.
        createElement('option', { key: '', value: '' }, `Todas as ${nomePlural}`),
        ...opcoes.map((opcao) =>
          createElement('option', { key: opcao.valor, value: opcao.valor }, opcao.rotulo))
      )
    ),

    createElement(
      'p',
      { className: 'filtro__acoes' },
      createElement('button', { type: 'submit', className: 'filtro__botao' }, 'Filtrar'),

      // A SAÍDA, e ela só aparece quando há de onde sair. É um link, e não
      // um botão de reset: `reset` devolveria o <select> ao valor inicial
      // sem recarregar a página, ou seja, a lista continuaria filtrada e a
      // tela passaria a mentir sobre o próprio estado.
      filtrando
        ? createElement(
          'a',
          { className: 'filtro__limpar', href: '?' },
          `Ver todas as ${nomePlural}`
        )
        : null
    )
  );
}
