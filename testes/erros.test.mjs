import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemDeErro, mensagemDeErroDeAutenticacao } from '../compartilhado/erros.ts';

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

// =====================================================================
// Erros de autenticação (RF08–RF12)
//
// O que o Supabase Auth devolve é texto em inglês para quem programa. Estes
// testes existem para garantir que nada disso chega à tela, e que os quatro
// códigos que a ONG vai encontrar de verdade têm resposta escrita.
// =====================================================================

/** Erro do supabase-js: objeto com `code`, `message` e `status`. */
function erroDoSupabase(code, status = 400) {
  return { name: 'AuthApiError', code, status, message: `${code} (texto em inglês do SDK)` };
}

test('credencial errada não diz qual dos dois campos errou', () => {
  const { mensagem, campo, conhecido } = mensagemDeErroDeAutenticacao(erroDoSupabase('invalid_credentials'));
  assert.equal(conhecido, true);
  assert.equal(campo, undefined, 'apontar para um campo revelaria se o e-mail existe');
  assert.match(mensagem, /não conferem/i);
});

test('conta sem confirmar manda a pessoa ao link do e-mail', () => {
  const { mensagem, conhecido } = mensagemDeErroDeAutenticacao(erroDoSupabase('email_not_confirmed'));
  assert.equal(conhecido, true);
  assert.match(mensagem, /e-mail/i);
  assert.match(mensagem, /link/i);
});

test('limite de envio: mensagem honesta, com um canal que funciona', () => {
  // É o erro que trava o projeto hoje (CLAUDE.md, "O que trava hoje", 1).
  // Mandar "tente de novo" e mais nada seria empurrar a pessoa para uma
  // porta que vai continuar fechada até o SMTP do Brevo entrar.
  for (const codigo of ['over_email_send_rate_limit', 'over_request_rate_limit']) {
    const { mensagem, conhecido } = mensagemDeErroDeAutenticacao(erroDoSupabase(codigo, 429));
    assert.equal(conhecido, true, codigo);
    assert.match(mensagem, /limite/i, codigo);
    assert.match(mensagem, /95396-8344|atelieafro@gmail\.com/, `${codigo}: sem canal alternativo`);
  }
});

test('HTTP 429 sem código conhecido ainda é tratado como limite de envio', () => {
  const { conhecido, mensagem } = mensagemDeErroDeAutenticacao({ status: 429, message: 'rate limit' });
  assert.equal(conhecido, true);
  assert.match(mensagem, /limite/i);
});

test('conta que já existe aponta o campo e oferece as duas saídas', () => {
  const { mensagem, campo } = mensagemDeErroDeAutenticacao(erroDoSupabase('user_already_exists', 422));
  assert.equal(campo, 'email');
  assert.match(mensagem, /já existe/i);
  assert.match(mensagem, /senha/i);
});

test('senha fraca cai no campo da senha', () => {
  const { campo, conhecido } = mensagemDeErroDeAutenticacao(erroDoSupabase('weak_password', 422));
  assert.equal(campo, 'senha');
  assert.equal(conhecido, true);
});

test('código não previsto vira mensagem genérica e fica marcado como desconhecido', () => {
  // `conhecido: false` é o que faz acoes/autenticacao.ts registrar o erro
  // inteiro no log: a tela recebe só a mensagem genérica, então o log passa
  // a ser a única cópia do detalhe.
  const { mensagem, conhecido } = mensagemDeErroDeAutenticacao(erroDoSupabase('algo_que_ninguem_mapeou'));
  assert.equal(conhecido, false);
  assert.ok(mensagem.length > 0);
});

test('erro que nem objeto é (null, string, exceção de rede) não quebra a tradução', () => {
  for (const caso of [null, undefined, 'falhou', new TypeError('fetch failed'), 42]) {
    const { mensagem, conhecido } = mensagemDeErroDeAutenticacao(caso);
    assert.equal(conhecido, false, JSON.stringify(caso));
    assert.ok(mensagem.length > 0);
  }
});

test('nenhuma mensagem de autenticação vaza jargão nem o texto do SDK', () => {
  const casos = [
    'invalid_credentials', 'email_not_confirmed', 'over_email_send_rate_limit',
    'user_already_exists', 'weak_password', 'algo_que_ninguem_mapeou'
  ];
  for (const codigo of casos) {
    const { mensagem } = mensagemDeErroDeAutenticacao(erroDoSupabase(codigo));
    assert.doesNotMatch(mensagem, /_|error|auth|http|4\d\d|supabase|token|inglês do SDK/i, codigo);
    assert.doesNotMatch(mensagem, /desculp|ops|oops|infelizmente/i, codigo);
  }
});
