import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerPagina, paginar, frasePaginacao, POR_PAGINA, MENSAGENS, CANDIDATURAS
} from '../compartilhado/paginacao.ts';

/**
 * =====================================================================
 * A PAGINAÇÃO DAS FILAS DO PAINEL (pedido V1)
 * =====================================================================
 *
 * Paginação errada esconde registro, e esconder registro é o defeito mais
 * caro que uma fila de atendimento pode ter: a mensagem de número 21
 * simplesmente não existe na tela, e ninguém descobre. Por isso a conta é
 * função pura e tem teste — e por isso `total` faz parte do resultado, e
 * não só o recorte.
 */

test('lerPagina trata QUALQUER lixo como página 1 — o número vem da URL', () => {
  // `?pagina=` é escrito por quem quiser. Nada aqui pode lançar, devolver
  // NaN, ou deixar passar um número que viraria um range() inválido.
  for (const lixo of [
    undefined, null, '', '   ', 'abc', '1abc', '-3', '0', '2.5', 'NaN',
    'Infinity', '-Infinity', {}, [], true, '<script>'
  ]) {
    const resultado = lerPagina(lixo);
    assert.equal(resultado, 1, `lerPagina(${JSON.stringify(lixo)}) devolveu ${resultado}`);
  }

  assert.equal(lerPagina('3'), 3);
  assert.equal(lerPagina(7), 7);
});

test('paginar: o recorte e a contagem batem, página a página', () => {
  const total = 47;

  const primeira = paginar(total, '1', 20);
  assert.deepEqual(
    [primeira.pagina, primeira.de, primeira.ate, primeira.primeiroDaPagina, primeira.ultimoDaPagina],
    [1, 0, 19, 1, 20]);
  assert.equal(primeira.temAnterior, false);
  assert.equal(primeira.temProxima, true);
  assert.equal(primeira.totalDePaginas, 3);

  const meio = paginar(total, '2', 20);
  assert.deepEqual([meio.de, meio.ate, meio.primeiroDaPagina, meio.ultimoDaPagina], [20, 39, 21, 40]);
  assert.equal(meio.temAnterior, true);
  assert.equal(meio.temProxima, true);

  // A ÚLTIMA PÁGINA É PARCIAL, e é onde a conta costuma errar: 47 itens em
  // páginas de 20 terminam em 41–47, não em 41–60.
  const ultima = paginar(total, '3', 20);
  assert.deepEqual([ultima.de, ultima.primeiroDaPagina, ultima.ultimoDaPagina], [40, 41, 47]);
  assert.equal(ultima.temProxima, false);
});

test('paginar: nenhum registro cai fora — a soma das páginas é o total', () => {
  // A prova de que nada é escondido: percorrendo todas as páginas, a soma
  // do que cada uma mostra tem de ser exatamente o total. Vale para
  // qualquer total, inclusive os múltiplos exatos e os de uma sobra só.
  for (const total of [0, 1, 19, 20, 21, 40, 41, 99, 100, 101]) {
    const primeira = paginar(total, '1', 20);
    let soma = 0;
    for (let p = 1; p <= primeira.totalDePaginas; p += 1) {
      const pagina = paginar(total, String(p), 20);
      soma += Math.max(0, pagina.ultimoDaPagina - pagina.primeiroDaPagina + (total === 0 ? 0 : 1));
    }
    assert.equal(soma, total,
      `com ${total} registros, as ${primeira.totalDePaginas} páginas somam ${soma} — `
      + 'algum registro ficaria invisível');
  }
});

test('paginar: pedir além do fim aterrissa na ÚLTIMA página, não na primeira', () => {
  // Quem clicou "próxima" e passou do fim perdeu o lugar se voltar ao
  // começo. Aqui já se sabe quantas páginas há.
  const alem = paginar(47, '999', 20);
  assert.equal(alem.pagina, 3);
  assert.equal(alem.temProxima, false);
});

test('paginar: lista vazia continua tendo uma página, e ela não mente sobre a contagem', () => {
  const vazia = paginar(0, '1', 20);
  assert.equal(vazia.totalDePaginas, 1, 'com zero registros ainda há uma página — a que diz que está vazio');
  assert.equal(vazia.total, 0);
  assert.equal(vazia.primeiroDaPagina, 0);
  assert.equal(vazia.ultimoDaPagina, 0);
  assert.equal(vazia.temAnterior, false);
  assert.equal(vazia.temProxima, false);
});

test('paginar: total inválido vira zero em vez de quebrar o range', () => {
  // `count` pode voltar null do PostgREST quando a consulta degrada.
  for (const ruim of [null, undefined, NaN, -5, Infinity]) {
    const p = paginar(ruim, '1', 20);
    assert.equal(p.total, 0, `total ${ruim} devia virar 0`);
    assert.ok(Number.isInteger(p.de) && p.de >= 0);
    assert.ok(Number.isInteger(p.ate) && p.ate >= p.de);
  }
});

test('a frase escreve o TOTAL — é a promessa que o corte silencioso quebraria', () => {
  assert.equal(frasePaginacao(paginar(0, '1', 20), MENSAGENS), 'Nenhuma mensagem por aqui.');
  assert.equal(frasePaginacao(paginar(1, '1', 20), MENSAGENS), '1 mensagem.');
  assert.equal(frasePaginacao(paginar(12, '1', 20), MENSAGENS),
    '12 mensagens, todas nesta tela.');
  assert.equal(frasePaginacao(paginar(47, '2', 20), MENSAGENS),
    'Mostrando 21–40 de 47 mensagens.');

  // O TOTAL aparece SEMPRE que há mais de uma página. Sem isso, a tela
  // diria "próxima" sem dizer de quantas — que é o corte silencioso com
  // outra roupa.
  const frase = frasePaginacao(paginar(47, '1', 20), CANDIDATURAS);
  assert.match(frase, /47/, 'a frase não diz quantos registros existem no total');
});

test('POR_PAGINA é um número de tela de celular, não de planilha', () => {
  // A ONG trabalha no celular, de pé (regra 4). Vinte cartões comprimidos
  // rolam; cem não.
  assert.ok(POR_PAGINA >= 10 && POR_PAGINA <= 30,
    `POR_PAGINA é ${POR_PAGINA} — fora da faixa que cabe numa rolagem de celular`);
});

test('o plural NÃO é deduzido do singular — a primeira versão dizia "mensagen"', () => {
  // `replace(/s$/, '')` sobre "mensagens" produz "mensagen". O português
  // não faz plural só com "s", e adivinhar morfologia dentro de um
  // utilitário quebra em silêncio na palavra seguinte. As duas formas são
  // PEDIDAS.
  const doacoes = { singular: 'doação', plural: 'doações', artigo: 'a' };
  assert.equal(frasePaginacao(paginar(0, '1', 20), doacoes), 'Nenhuma doação por aqui.');
  assert.equal(frasePaginacao(paginar(1, '1', 20), doacoes), '1 doação.');
  assert.equal(frasePaginacao(paginar(5, '1', 20), doacoes), '5 doações, todas nesta tela.');

  // E o gênero também é pedido, não deduzido da terminação.
  const materiais = { singular: 'material', plural: 'materiais', artigo: 'o' };
  assert.equal(frasePaginacao(paginar(0, '1', 20), materiais), 'Nenhum material por aqui.');
  assert.equal(frasePaginacao(paginar(3, '1', 20), materiais), '3 materiais, todos nesta tela.');
});

/* =====================================================================
   O COMPONENTE — renderizado de verdade, sem subir o Next
   ===================================================================== */

async function desenhar(total, pedida, parametros) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement } = await import('react');
  const { Paginacao } = await import('../componentes/Paginacao.ts');
  const { MENSAGENS } = await import('../compartilhado/paginacao.ts');
  return renderToStaticMarkup(createElement(Paginacao, {
    paginacao: paginar(total, pedida), nome: MENSAGENS, parametros
  }));
}

test('a paginação são LINKS, não botões: funciona sem JavaScript', async () => {
  // Navegação comum. O botão voltar do navegador faz o que se espera, e a
  // URL de uma página pode ser mandada por WhatsApp para outra pessoa da
  // equipe. Um onClick perderia as três coisas.
  const html = await desenhar(47, '2');
  assert.match(html, /<a[^>]+href="\?pagina=3"[^>]*rel="next"/);
  assert.match(html, /<a[^>]+href="\?"[^>]*rel="prev"/);
  assert.doesNotMatch(html, /<button/, 'a paginação virou botão: deixaria de funcionar sem script');
});

test('a página 1 tem endereço limpo — sem ?pagina=1', async () => {
  // É o endereço que a equipe copia e manda para outra pessoa.
  const html = await desenhar(47, '2');
  assert.match(html, /href="\?"/, 'o link de voltar para a página 1 leva ?pagina=1 pendurado');
});

test('o TOTAL aparece na tela em toda página — a promessa contra o corte silencioso', async () => {
  for (const pedida of ['1', '2', '3']) {
    const html = await desenhar(47, pedida);
    assert.match(html, /de 47 mensagens/,
      `a página ${pedida} não escreve quantas mensagens existem no total`);
  }
});

test('com uma página só, os controles somem e a frase FICA', async () => {
  const html = await desenhar(12, '1');
  assert.match(html, /12 mensagens, todas nesta tela/);
  assert.doesNotMatch(html, /Próximas/,
    'desenhou "Próximas" com uma página só — a equipe procuraria um botão que não faz nada');
});

test('os controles não pulam de lugar entre a primeira página e as outras', async () => {
  // Na primeira página não há "anteriores" para onde ir. Se o controle
  // simplesmente sumisse, "Próximas" ocuparia o lugar dele e o dedo que ia
  // num acertaria o outro.
  const primeira = await desenhar(47, '1');
  assert.match(primeira, /paginacao__link--inerte[^>]*>← Anteriores/,
    'o controle de anteriores sumiu da primeira página em vez de ficar inerte');

  const ultima = await desenhar(47, '3');
  assert.match(ultima, /paginacao__link--inerte[^>]*>Próximas/,
    'o controle de próximas sumiu da última página em vez de ficar inerte');
});

test('trocar de página NÃO apaga o filtro que estiver na URL', async () => {
  // Sem isto, ir para a página 2 devolveria a lista inteira — e a equipe
  // veria uma lista diferente da que estava lendo, sem entender por quê.
  const html = await desenhar(47, '1', { situacao: 'novo' });
  assert.match(html, /href="\?situacao=novo&amp;pagina=2"/,
    'o link da próxima página perdeu o filtro de situação');
});
