/**
 * "Na mídia" na home — Tarefa A2, mesma decisão 1 da Tarefa 10 que
 * componentes/SecaoOndeEstivemos.ts já implementa (testado em
 * testes/prova-social.test.mjs).
 *
 * Arquivo irmão dedicado, não uma ampliação de testes/prova-social.test.mjs:
 * aquele arquivo tem o cabeçalho e a identidade inteiros voltados a "Onde já
 * estivemos" em /para-escolas ("decisão 1 da Tarefa 10" é sobre aquele
 * componente especificamente). Empilhar SecaoNaMidia ali obrigaria reescrever
 * esse cabeçalho para falar de dois componentes, ou deixar um comentário que
 * descreve só metade do arquivo — o oposto de "comentário afirma o que foi
 * medido". Um arquivo por componente, nomeado como ele, mantém a leitura
 * direta: quem procura a cobertura de SecaoNaMidia acha exatamente aqui.
 *
 * Nasce da Rodada de correção 1 da Tarefa A2: uma revisão por mutação
 * comentou `if (midia.length === 0) return null;` em
 * componentes/SecaoNaMidia.ts e NENHUM teste da suíte (220/206/0/14) caiu —
 * a seção "Na mídia" podia passar a aparecer com o <h2> sozinho, sem nada
 * embaixo, sem que nada acusasse. testes/pagina-home.test.mjs só cobre o
 * caminho COM dado (roda contra o servidor real, que sempre tem os 3
 * registros de dados-iniciais/clipping.json); a omissão sem dado nunca
 * tinha teste — a mesma classe de buraco que testes/prova-social.test.mjs
 * fechou para o componente irmão na Tarefa 10 (ver o comentário daquele
 * arquivo, linhas 43-46 na época da revisão que motivou aquela correção).
 *
 * Escolhas de teste espelham as de testes/prova-social.test.mjs, adaptadas:
 * SecaoNaMidia isola tipo === 'midia' (o oposto do filtro do componente
 * irmão), e por isso o teste de "só o outro tipo" aqui usa registros
 * instituicao/programacao para provar que eles não vazam para "Na mídia".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { selecionarMidia, SecaoNaMidia } from '../componentes/SecaoNaMidia.ts';

test('lista vazia: selecionarMidia não sobra nenhum registro', () => {
  assert.deepEqual(selecionarMidia([]), []);
});

test('selecionarMidia filtra só midia, nunca instituicao ou programacao', () => {
  const registros = [
    { id: 'a', tipo: 'midia', titulo: 'Folha de S.Paulo', detalhe: null, ano: null },
    { id: 'b', tipo: 'instituicao', titulo: 'SESC Interlagos', detalhe: null, ano: null },
    { id: 'c', tipo: 'programacao', titulo: 'Mês da Consciência Negra', detalhe: null, ano: null }
  ];

  assert.deepEqual(selecionarMidia(registros).map((r) => r.id), ['a']);
});

test('sem registros de mídia, a seção inteira não renderiza', () => {
  const html = renderToStaticMarkup(createElement(SecaoNaMidia, { registros: [] }));
  assert.equal(html, '', 'a seção deveria sumir por completo, não só ficar sem itens embaixo do título');
});

test('só clipping de instituicao/programacao também produz lista vazia e omite a seção', () => {
  const registros = [
    { id: 'sesc-interlagos', tipo: 'instituicao', titulo: 'SESC Interlagos', detalhe: null, ano: null },
    { id: 'consciencia-negra', tipo: 'programacao', titulo: 'Mês da Consciência Negra', detalhe: null, ano: null }
  ];
  const html = renderToStaticMarkup(createElement(SecaoNaMidia, { registros }));
  assert.equal(html, '');
});

test('com pelo menos um registro, a seção aparece com título e item', () => {
  const registros = [
    { id: 'folha-materia', tipo: 'midia', titulo: 'Folha de S.Paulo', detalhe: null, ano: null }
  ];
  const html = renderToStaticMarkup(createElement(SecaoNaMidia, { registros }));

  assert.match(html, /titulo-midia-home/);
  assert.match(html, /Na mídia/);
  assert.match(html, /Folha de S\.Paulo/);
});

test('detalhe e ano só aparecem quando existem, nunca como texto vazio', () => {
  const registros = [
    {
      id: 'globo-caldeirao', tipo: 'midia', titulo: 'Rede Globo — Caldeirão do Huck',
      detalhe: 'Participação em rede nacional', ano: 2021
    },
    { id: 'folha-materia', tipo: 'midia', titulo: 'Folha de S.Paulo', detalhe: null, ano: null }
  ];
  const html = renderToStaticMarkup(createElement(SecaoNaMidia, { registros }));

  assert.match(html, /Participação em rede nacional/);
  assert.match(html, /2021/);
  // O registro sem detalhe/ano não pode deixar um <span> vazio no lugar.
  assert.doesNotMatch(html, /<span class="clipping__detalhe"><\/span>/);
  assert.doesNotMatch(html, /<span class="clipping__ano"><\/span>/);
});

test('strong e span do item ficam colados, sem espaço solto entre eles', () => {
  // Mesma razão do teste equivalente em testes/prova-social.test.mjs: essa
  // seção sai de testes/paridade-texto.test.mjs (idsExcluidos por comparar
  // conteúdo real contra o <div id="lista-midia"> vazio do HTML estático
  // original), então esta asserção aqui é o que cobre a fronteira do espaço
  // que o cabeçalho daquele arquivo existe para pegar.
  const registros = [
    {
      id: 'globo-caldeirao', tipo: 'midia', titulo: 'Rede Globo — Caldeirão do Huck',
      detalhe: 'Participação em rede nacional', ano: 2021
    }
  ];
  const html = renderToStaticMarkup(createElement(SecaoNaMidia, { registros }));

  assert.match(html, /<\/strong><span/);
});
