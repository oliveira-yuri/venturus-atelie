import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemDeErro } from '../compartilhado/erros.ts';

test('falha de rede diz o que fazer', () => {
  const resultado = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.match(resultado.titulo, /conex/i);
  assert.equal(resultado.acao, 'Tentar de novo');
});

test('o contexto entra na mensagem', () => {
  const resultado = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.match(resultado.titulo, /agenda/);
});

test('nenhuma mensagem pede desculpas', () => {
  // Regra da seção 11 do escopo: dizer o que houve e o que fazer, sem se desculpar.
  const casos = [
    new TypeError('Failed to fetch'),
    { code: 'PGRST301' },
    { code: '23505' },
    { code: '42501' },
    new Error('qualquer outra coisa'),
    null
  ];
  for (const caso of casos) {
    const { titulo } = mensagemDeErro(caso, 'a agenda');
    assert.doesNotMatch(titulo, /desculp|ops|oops|infelizmente/i);
  }
});

test('nenhuma mensagem vaza jargão técnico', () => {
  const { titulo } = mensagemDeErro(new TypeError('Failed to fetch'), 'a agenda');
  assert.doesNotMatch(titulo, /fetch|null|undefined|error|http|500/i);
});

test('sessão expirada orienta a entrar de novo', () => {
  const resultado = mensagemDeErro({ code: 'PGRST301' }, 'o painel');
  assert.match(resultado.titulo, /entrar de novo/i);
});

test('registro duplicado é explicado, não codificado', () => {
  const resultado = mensagemDeErro({ code: '23505' }, 'a inscrição');
  assert.match(resultado.titulo, /já/i);
  assert.equal(resultado.acao, null);
});

test('erro desconhecido ainda produz mensagem útil', () => {
  const resultado = mensagemDeErro(null, 'a agenda');
  assert.ok(resultado.titulo.length > 0);
  assert.equal(resultado.acao, 'Tentar de novo');
});
