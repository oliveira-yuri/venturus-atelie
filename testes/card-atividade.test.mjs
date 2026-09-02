/**
 * componentes/CardAtividade.ts — cartão de uma atividade em /projetos (RF03).
 *
 * Nasce junto com o componente, de propósito: o comentário da Tarefa A3
 * aponta que a Tarefa A2 replicou o padrão de componente de prova social
 * (createElement + omissão de campo ausente) e esqueceu de replicar o
 * padrão de teste que o acompanha — só apareceu na revisão por mutação.
 * Este arquivo é a réplica do padrão de teste, seguindo
 * testes/secao-na-midia.test.mjs e testes/prova-social.test.mjs: unidade
 * pura, sem Next e sem Supabase, usando react-dom/server direto.
 *
 * As duas situações de "campo sem sinopse" vêm de dados reais medidos em
 * dados-iniciais/atividades.json: "brasil-negreiro" não tem `resumo` nem
 * `descricao`; "projeto-brincantes" tem os dois. Os testes abaixo usam
 * objetos equivalentes, não os arquivos, para não quebrar se o conteúdo
 * real mudar — a garantia estrutural (campo ausente não vira tag vazia)
 * não depende de qual atividade specific tem qual campo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardAtividade } from '../componentes/CardAtividade.ts';

/** Atividade completa: todo campo presente. */
const COMPLETA = {
  id: 'banzo',
  titulo: 'Banzo',
  resumo: 'Uma contação de história sobre a saudade da terra natal.',
  descricao: 'Primeiro parágrafo da sinopse.\n\nSegundo parágrafo da sinopse.',
  genero: 'Contação de história',
  duracao: '50 minutos',
  elenco: '2 atores',
  classificacao: 'Livre',
  local: 'Adaptável a qualquer espaço',
  rider: '1 caixa de som'
};

/** Atividade real (medida): sem resumo, sem descrição, sem rider. */
const SEM_SINOPSE = {
  id: 'brasil-negreiro',
  titulo: 'Brasil Negreiro',
  resumo: null,
  descricao: null,
  genero: 'Show musical',
  duracao: null,
  elenco: '3 músicos',
  classificacao: 'Livre',
  local: 'Adaptável a qualquer espaço',
  rider: null
};

function renderizar(atividade) {
  return renderToStaticMarkup(createElement(CardAtividade, { atividade }));
}

test('o elemento raiz carrega a classe card-atividade, com .atividade num filho — nunca no mesmo elemento', () => {
  const html = renderizar(COMPLETA);
  assert.match(html, /^<div class="card-atividade"><article class="atividade"/,
    'o raiz precisa ser .card-atividade, filho direto da lista, com .atividade dentro dele — '
    + 'senão o nth-child de estilos/componentes.css conta errado e a paleta da ONG sai de ordem');
  assert.doesNotMatch(html, /class="card-atividade atividade"/,
    '.card-atividade e .atividade no mesmo elemento quebram o combinador descendente do CSS');
});

test('o id da atividade vai no <article>, para a âncora #id continuar funcionando', () => {
  const html = renderizar(COMPLETA);
  assert.match(html, /<article class="atividade" id="banzo">/);
});

/* =====================================================================
   O CARTÃO ENCOLHEU (pedido V1, 02/09/2026)
   =====================================================================

   "Na página de projetos do usuário deve ser assim: pequenos blocos, se a
   pessoa quiser ver o projeto ela clica em 'saber mais' e abre uma página
   dedicada ao respectivo projeto."

   A sinopse e a ficha técnica SAÍRAM do cartão e foram para
   `app/projetos/[id]/page.tsx`. O que fica aqui é o que se lê para
   DECIDIR abrir: título, capa e resumo.

   Os testes abaixo mudaram de alvo junto — e os que cobram a OMISSÃO de
   campo vazio (regra 2 aplicada a campo) continuam valendo para o que
   sobrou, porque é ali que a regra ainda se aplica.
   ===================================================================== */

test('o cartão traz título, resumo e o caminho para a página da atividade', () => {
  const html = renderizar(COMPLETA);

  // O TÍTULO É O LINK. Numa lista de onze cartões, onze links com o texto
  // "Saber mais" obrigam quem navega saltando de link em link a adivinhar
  // qual é qual.
  assert.match(html, /<h2 class="atividade__titulo"><a class="atividade__link" href="\/projetos\/banzo">Banzo<\/a><\/h2>/);
  assert.match(html, /<p class="atividade__resumo">Uma contação de história[^<]*<\/p>/);

  // O botão, para o dedo — e com o nome dentro, para quem usa leitor de tela.
  assert.match(html, /href="\/projetos\/banzo"[^>]*>Saber mais/);
  assert.match(html, /apenas-leitor-de-tela">\s*sobre Banzo/);
});

test('a sinopse e a ficha técnica NÃO estão mais no cartão — elas foram para a página', () => {
  const html = renderizar(COMPLETA);

  assert.doesNotMatch(html, /Primeiro parágrafo da sinopse/,
    'a sinopse voltou para o cartão: o bloco deixa de ser pequeno e o "Saber mais" perde o sentido');
  assert.doesNotMatch(html, /atividade__ficha/,
    'a ficha técnica voltou para o cartão');
  assert.doesNotMatch(html, /<dt>Gênero<\/dt>/);
});

test('atividade sem resumo não deixa <p class="atividade__resumo"> vazio — o parágrafo inteiro some', () => {
  const html = renderizar(SEM_SINOPSE);
  assert.doesNotMatch(html, /atividade__resumo/,
    'sem `resumo`, o parágrafo não deveria aparecer nem vazio nem com a classe');
});

test('atividade sem descrição não deixa parágrafo de sinopse vazio', () => {
  const html = renderizar(SEM_SINOPSE);
  assert.doesNotMatch(html, /<p><\/p>/, 'sobrou um <p></p> vazio no lugar da sinopse ausente');
});

test.skip('campo de ficha ausente (duração, rider) não aparece como <dt> com <dd> vazio', () => {
  // PULADO desde o pedido V1: a ficha técnica saiu do cartão e foi para
  // `app/projetos/[id]/page.tsx`. A REGRA continua valendo — campo sem
  // valor é omitido, nunca desenhado vazio —, e ela é medida onde a ficha
  // agora vive: `testes/paginas.test.mjs`, contra a página renderizada.
  //
  // Pular com o motivo escrito, em vez de apagar, porque a asserção volta
  // a valer no dia em que a ficha voltar ao cartão.
  const html = renderizar(SEM_SINOPSE);
  assert.doesNotMatch(html, /<dt>Duração<\/dt>/, 'duração ausente não deveria virar item de ficha');
  assert.doesNotMatch(html, /<dt>Precisa de<\/dt>/, 'rider ausente não deveria virar item de ficha');
  assert.doesNotMatch(html, /<dd><\/dd>/, 'sobrou um <dd></dd> vazio');
  // Os campos que a atividade TEM continuam na ficha.
  assert.match(html, /<dt>Gênero<\/dt><dd>Show musical<\/dd>/);
  assert.match(html, /<dt>Elenco<\/dt><dd>3 músicos<\/dd>/);
});

test('sem nenhum campo de ficha, a <dl> inteira some — não sobra uma lista vazia', () => {
  const semFicha = {
    id: 'sem-ficha', titulo: 'Sem ficha', resumo: null, descricao: null,
    genero: null, duracao: null, elenco: null, classificacao: null, local: null, rider: null
  };
  const html = renderizar(semFicha);
  assert.doesNotMatch(html, /<dl/, 'sem nenhum campo, a ficha não deveria renderizar');
});
