/**
 * A faixa "Próxima atividade" da home (componentes/ProximaAtividade.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProximaAtividade } from '../componentes/ProximaAtividade.ts';

const EVENTO = {
  id: 'oficina-de-capoeira',
  titulo: 'Oficina de capoeira',
  descricao: null,
  // 22:00Z = 19h em São Paulo. Se o fuso escapasse para UTC, sairia "22:00".
  comeca_em: '2026-11-05T22:00:00.000Z',
  termina_em: null,
  local: 'Sede do Ateliê',
  faixa_etaria: 'a partir de 10 anos'
};

const html = (evento) => renderToStaticMarkup(createElement(ProximaAtividade, { evento }));

test('sem evento não desenha NADA — nem um "em breve" inventado (regra 2)', () => {
  assert.equal(html(null), '');
  assert.equal(html(undefined), '');
});

test('com evento: título, data no fuso da ONG e o caminho de inscrição', () => {
  const saida = html(EVENTO);
  assert.match(saida, /id="titulo-proxima-atividade"/);
  assert.match(saida, /Oficina de capoeira/);
  assert.match(saida, /19:00/, 'a hora precisa sair no fuso de São Paulo, não em UTC');
  assert.match(saida, /Sede do Ateliê/);
  assert.match(saida, /href="\/agenda\/oficina-de-capoeira\/inscricao"/);
  assert.match(saida, /href="\/agenda"/);
});

test('o link de inscrição diz DE QUAL evento é, para quem navega por links', () => {
  assert.match(html(EVENTO), /Quero me inscrever<span class="apenas-leitor-de-tela"> em Oficina de capoeira<\/span>/);
});

test('faixa etária e local são opcionais — campo sem dado não vira texto vazio', () => {
  const saida = html({ ...EVENTO, local: null, faixa_etaria: null });
  assert.doesNotMatch(saida, /Para:/);
  assert.doesNotMatch(saida, / · /);
});
