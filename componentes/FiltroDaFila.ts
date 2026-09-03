import { createElement } from 'react';
import type { FiltroDeVoluntarios } from '../compartilhado/filtro-de-voluntarios.ts';
import { TIPOS_DE_PESSOA_DO_FILTRO } from '../compartilhado/filtro-de-voluntarios.ts';

/**
 * componentes/FiltroDaFila.ts — o filtro da fila de candidaturas.
 *
 * =====================================================================
 * TUDO POR `GET`, E ISSO DÁ TRÊS COISAS DE GRAÇA
 * =====================================================================
 *
 * `method="get"` num `<form>` sem `action` recarrega a MESMA página com os
 * campos na query. Consequências, e as três importam:
 *
 *  · funciona SEM JavaScript — não há `onChange`, não há estado no
 *    cliente. É o requisito de sempre neste projeto;
 *  · o botão VOLTAR desfaz o filtro, porque cada busca é uma entrada no
 *    histórico. Um filtro em memória não teria isso, e a equipe ficaria
 *    presa até achar o botão de limpar;
 *  · o endereço filtrado é um LINK. "Olha as candidaturas de comunicação
 *    que estão em contato" vira uma mensagem de WhatsApp.
 *
 * =====================================================================
 * QUATRO CAMPOS, E A BUSCA É UM SÓ PARA NOME E E-MAIL
 * =====================================================================
 *
 * O pedido V1 pede filtro por "nome, email, cpf/pj, área de atuação e
 * status". Nome e e-mail ficaram no MESMO campo: quem procura digita o que
 * lembra, e obrigar a escolher em qual coluna procurar é pedir que a
 * pessoa saiba onde o dado mora. Ver `combina` em
 * compartilhado/filtro-de-voluntarios.ts.
 *
 * "CPF/PJ" virou tipo de pessoa, porque não existe CPF em `public.perfis`
 * — e não deve existir (coleta mínima, RNF09). O motivo inteiro está no
 * módulo do filtro.
 *
 * Escrito com createElement (`.ts`, não `.tsx`) pelo mesmo motivo dos
 * outros componentes do painel: o runtime nativo do Node o importa e o
 * teste o renderiza de verdade, sem subir o Next.
 */

export type OpcaoDeFiltro = { valor: string; rotulo: string };

/** Um `<select>` com a opção "todas" na frente. */
function campoSelect(
  id: string,
  nome: string,
  rotulo: string,
  textoDeTodas: string,
  opcoes: OpcaoDeFiltro[],
  atual: string
) {
  return createElement(
    'p',
    { className: 'filtro__campo' },
    createElement('label', { className: 'filtro__rotulo', htmlFor: id }, rotulo),
    createElement(
      'select',
      { id, name: nome, defaultValue: atual },
      // A opção "todas" vem PRIMEIRO e tem valor vazio: é o estado natural
      // da fila, e um valor vazio some da URL sozinho quando o navegador
      // monta a query.
      createElement('option', { key: '', value: '' }, textoDeTodas),
      ...opcoes.map((opcao) =>
        createElement('option', { key: opcao.valor, value: opcao.valor }, opcao.rotulo))
    )
  );
}

export function FiltroDaFila(
  { filtro, situacoes, areas, nomePlural, ativo }: {
    filtro: FiltroDeVoluntarios;
    situacoes: OpcaoDeFiltro[];
    /** As áreas reais, do banco. Vazio esconde o campo — ver abaixo. */
    areas: string[];
    /** Para o texto do botão de limpar ("Ver todas as candidaturas"). */
    nomePlural: string;
    /** Há algum campo preenchido? Decide se a saída aparece. */
    ativo: boolean;
  }
) {
  return createElement(
    'form',
    { className: 'filtro', method: 'get', role: 'search' },

    createElement(
      'p',
      { className: 'filtro__campo' },
      createElement('label', { className: 'filtro__rotulo', htmlFor: 'filtro-busca' },
        'Nome ou e-mail'),
      createElement('input', {
        id: 'filtro-busca',
        name: 'busca',
        type: 'search',
        defaultValue: filtro.busca,
        placeholder: 'parte do nome serve',
        // `search` em vez de `text`: no celular o teclado ganha a tecla
        // "buscar" no lugar do Enter, e o campo ganha o botão de limpar
        // do próprio navegador.
        autoComplete: 'off'
      })
    ),

    // O CAMPO DE ÁREA SÓ EXISTE SE HOUVER ÁREAS. Sem elas — banco fora do
    // ar, ou tabela vazia — um select com uma opção só ("todas") seria um
    // controle que não faz nada, e a equipe tentaria usá-lo.
    areas.length > 0
      ? campoSelect('filtro-area', 'area', 'Área de atuação', 'Todas as áreas',
        areas.map((nome) => ({ valor: nome, rotulo: nome })), filtro.area)
      : null,

    campoSelect('filtro-situacao', 'situacao', 'Situação', `Todas as ${nomePlural}`,
      situacoes, filtro.situacao),

    campoSelect('filtro-tipo', 'tipo_pessoa', 'Pessoa', 'Física e jurídica',
      TIPOS_DE_PESSOA_DO_FILTRO.map((t) => ({ valor: t.valor, rotulo: t.rotulo })),
      filtro.tipoPessoa),

    createElement(
      'p',
      { className: 'filtro__acoes' },
      createElement('button', { type: 'submit', className: 'filtro__botao' }, 'Filtrar'),

      // A SAÍDA, e ela só aparece quando há de onde sair. É um link, e não
      // um botão de reset: `reset` devolveria os campos ao valor inicial
      // SEM recarregar a página, ou seja, a lista continuaria filtrada e a
      // tela passaria a mentir sobre o próprio estado.
      ativo
        ? createElement(
          'a',
          { className: 'filtro__limpar', href: '?' },
          `Ver todas as ${nomePlural}`
        )
        : null
    )
  );
}
