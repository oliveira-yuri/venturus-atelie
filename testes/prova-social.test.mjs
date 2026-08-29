/**
 * "Onde já estivemos" em /para-escolas — decisão 1 da Tarefa 10.
 *
 * O usuário reportou a seção aparecendo com o título e nada embaixo: o
 * <div id="lista-instituicoes"> tinha sido portado vazio, porque quem o
 * preenchia no site antigo era JavaScript de cliente
 * (assets/js/paginas/prova-social.js), lendo listarClipping().
 *
 * A regra 2 do CLAUDE.md diz que campo sem dado fica null e a PÁGINA OMITE
 * A SEÇÃO — título sem conteúdo embaixo é pior que não ter a seção. Este
 * arquivo prova, forçando a lista vazia, que a <section> inteira some, não
 * só os itens de dentro dela.
 *
 * `componentes/SecaoOndeEstivemos.ts` é testado aqui por import direto,
 * sem subir o Next: o módulo não tem `import 'server-only'` nem depende de
 * `next/headers` (ao contrário de servidor/dados/conteudo.ts, que faz a
 * consulta ao Supabase) — só recebe a lista de registros já carregada e
 * decide o que desenhar. É essa separação que torna a omissão testável sem
 * precisar de rede nem de servidor. Ele mora em componentes/, não em
 * servidor/dados/, porque é apresentação, não acesso a dado — ver o
 * comentário no topo do próprio arquivo (Rodada de correção 1 da Tarefa 10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { selecionarInstituicoes, SecaoOndeEstivemos } from '../componentes/SecaoOndeEstivemos.ts';

test('lista vazia: selecionarInstituicoes não sobra nenhum registro', () => {
  assert.deepEqual(selecionarInstituicoes([]), []);
});

test('selecionarInstituicoes filtra só instituicao e programacao, nunca midia', () => {
  const registros = [
    { id: 'a', tipo: 'midia', titulo: 'Folha de S.Paulo', detalhe: null, ano: null },
    { id: 'b', tipo: 'instituicao', titulo: 'SESC Interlagos', detalhe: null, ano: null },
    { id: 'c', tipo: 'programacao', titulo: 'Mês da Consciência Negra', detalhe: null, ano: null }
  ];

  assert.deepEqual(selecionarInstituicoes(registros).map((r) => r.id), ['b', 'c']);
});

test('sem registros de instituição/programação, a seção inteira não renderiza', () => {
  const html = renderToStaticMarkup(createElement(SecaoOndeEstivemos, { registros: [] }));
  assert.equal(html, '', 'a seção deveria sumir por completo, não só ficar sem itens embaixo do título');
});

test('só clipping de mídia também produz lista vazia e omite a seção', () => {
  const registros = [{ id: 'a', tipo: 'midia', titulo: 'Folha de S.Paulo', detalhe: null, ano: null }];
  const html = renderToStaticMarkup(createElement(SecaoOndeEstivemos, { registros }));
  assert.equal(html, '');
});

test('com pelo menos um registro, a seção aparece com título e item', () => {
  const registros = [
    { id: 'sesc-interlagos', tipo: 'instituicao', titulo: 'SESC Interlagos', detalhe: null, ano: null }
  ];
  const html = renderToStaticMarkup(createElement(SecaoOndeEstivemos, { registros }));

  assert.match(html, /titulo-onde-estivemos/);
  assert.match(html, /Onde já estivemos/);
  assert.match(html, /SESC Interlagos/);
});

test('detalhe e ano só aparecem quando existem, nunca como texto vazio', () => {
  const registros = [
    { id: 'ambev', tipo: 'instituicao', titulo: 'Ambev', detalhe: 'Ação de Dia das Crianças', ano: 2021 },
    { id: 'sesc', tipo: 'instituicao', titulo: 'SESC Interlagos', detalhe: null, ano: null }
  ];
  const html = renderToStaticMarkup(createElement(SecaoOndeEstivemos, { registros }));

  assert.match(html, /Ação de Dia das Crianças/);
  assert.match(html, /2021/);
  // O registro sem detalhe/ano não pode deixar um <span> vazio no lugar.
  assert.doesNotMatch(html, /<span class="clipping__detalhe"><\/span>/);
  assert.doesNotMatch(html, /<span class="clipping__ano"><\/span>/);
});

test('strong e span do item ficam colados, sem espaço solto entre eles', () => {
  // O site antigo (assets/js/paginas/prova-social.js) separava <strong> e
  // <span> por quebra de linha no template; aqui saem colados
  // (`</strong><span`). Na tela não muda nada — o CSS aplica
  // `display: block` nos três elementos do item (.clipping__item,
  // .clipping__detalhe, .clipping__ano; ver estilos/componentes.css) — mas
  // é exatamente a classe de defeito que testes/paridade-texto.test.mjs
  // existe para pegar (documentado no cabeçalho daquele arquivo: um espaço
  // que sumiu entre texto e elemento). Essa seção específica sai da
  // comparação de testes/paridade-texto.test.mjs (ver o comentário sobre
  // idsExcluidos lá), por bater conteúdo real contra um <div> vazio no HTML
  // estático original — então esta asserção aqui é o que cobre essa
  // fronteira, já que nenhum outro teste cobriria.
  const registros = [
    { id: 'ambev', tipo: 'instituicao', titulo: 'Ambev', detalhe: 'Ação de Dia das Crianças', ano: 2021 }
  ];
  const html = renderToStaticMarkup(createElement(SecaoOndeEstivemos, { registros }));

  assert.match(html, /<\/strong><span/);
});
