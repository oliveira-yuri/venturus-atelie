/**
 * Para onde a pessoa vai depois de entrar (compartilhado/destino-apos-entrar.ts).
 *
 * O destino vem de `?voltar=` na URL e de um campo escondido do formulário:
 * é ENTRADA DE USUÁRIO. O risco que estes testes guardam é o redirect aberto
 * — a tela de entrar da ONG levando a pessoa, já autenticada, para um
 * endereço de terceiro. A lista abaixo é o que se sabe que escapa de um
 * domínio: cada item foi pensado como um jeito de fazer o navegador
 * interpretar o valor como outro host.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caminhoInternoSeguro, destinoDepoisDeEntrar, destinoDepoisDeCriarConta, enderecoDeEntrar
} from '../compartilhado/destino-apos-entrar.ts';

test('caminhos do próprio site passam', () => {
  for (const ok of ['/voluntariado/candidatura', '/doar/ofertar', '/minha-conta', '/avisos', '/admin']) {
    assert.equal(caminhoInternoSeguro(ok), ok);
  }
});

test('REDIRECT ABERTO: nada que aponte para fora do site passa', () => {
  const ataques = [
    'https://site-falso.example', 'http://site-falso.example/entrar', '//site-falso.example',
    '///site-falso.example', '/\\site-falso.example', '\\\\site-falso.example', '/\\/site-falso.example',
    'javascript:alert(1)', 'data:text/html,x', 'site-falso.example', '/@site-falso.example',
    '/%2f%2fsite-falso.example', '/%5csite-falso.example', '/a:b', '/a?b=1', '/a#b',
    '/voluntariado/../../etc', '/./a', '/a//b', ' /doar/ofertar', '/doar/ofertar ', '/doar\n/ofertar',
    '/DOAR', '/a b', '/a_b', '/', '', '/-a', '/a-', '/' + 'a'.repeat(200)
  ];
  for (const ataque of ataques) {
    assert.equal(caminhoInternoSeguro(ataque), null, `deixou passar: ${JSON.stringify(ataque)}`);
  }
});

test('o que não é texto não passa', () => {
  for (const v of [null, undefined, 42, {}, [], ['/doar'], true]) {
    assert.equal(caminhoInternoSeguro(v), null);
  }
});

test('as telas de conta ficam de fora: voltar para /entrar seria um laço', () => {
  for (const rota of ['/entrar', '/recuperar-acesso', '/nova-senha', '/auth/confirm', '/auth']) {
    assert.equal(caminhoInternoSeguro(rota), null, rota);
  }
});

test('depois de ENTRAR: o que a pessoa fazia vence; senão equipe→painel, senão home', () => {
  assert.equal(destinoDepoisDeEntrar('/doar/ofertar', false), '/doar/ofertar');
  assert.equal(destinoDepoisDeEntrar('/doar/ofertar', true), '/doar/ofertar',
    'quem é da equipe e veio de uma doação quer a doação, não o painel');
  assert.equal(destinoDepoisDeEntrar(undefined, true), '/admin');
  assert.equal(destinoDepoisDeEntrar('', false), '/');
  assert.equal(destinoDepoisDeEntrar('https://site-falso.example', true), '/admin',
    'um destino perigoso é ignorado, não obedecido nem convertido em erro');
  assert.equal(destinoDepoisDeEntrar('https://site-falso.example', false), '/');
});

test('depois de CRIAR a conta: nunca /admin, porque conta nova nunca é da equipe', () => {
  assert.equal(destinoDepoisDeCriarConta('/voluntariado/candidatura'), '/voluntariado/candidatura');
  assert.equal(destinoDepoisDeCriarConta(undefined), '/?aviso=conta-criada');
  assert.equal(destinoDepoisDeCriarConta('/admin') , '/admin',
    'o destino é do painel, e a guarda dele é 404 para quem não é equipe: não há o que proteger aqui');
  assert.equal(destinoDepoisDeCriarConta('//x.example'), '/?aviso=conta-criada');
});

test('enderecoDeEntrar só monta link com caminho seguro', () => {
  assert.equal(enderecoDeEntrar('/voluntariado/candidatura'), '/entrar?voltar=/voluntariado/candidatura');
  assert.equal(enderecoDeEntrar('//x.example'), '/entrar');
});

test('as Actions nunca redirecionam para o valor cru do formulário', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../acoes/autenticacao.ts', import.meta.url), 'utf8');
  const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // O único redirect que usa `voltar` passa pelas funções que validam.
  assert.match(semComentarios, /redirect\(destinoDepoisDeEntrar\(textoDoCampo\(dados, 'voltar'\), daEquipe\)\)/);
  assert.match(semComentarios, /redirect\(destinoDepoisDeCriarConta\(textoDoCampo\(dados, 'voltar'\)\)\)/);
  assert.doesNotMatch(semComentarios, /redirect\(\s*textoDoCampo/,
    'um redirect() com o texto cru do campo é um redirect aberto');
});
