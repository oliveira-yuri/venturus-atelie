/**
 * componentes/CampoFormulario.ts — porte de site/assets/js/componentes/
 * aac-form-campo.js (custom element) para função pura de apresentação.
 *
 * Sem o componente original, não existe caminho no código para criar um
 * campo sem rótulo vinculado — a mesma garantia estrutural continua
 * valendo aqui, agora testada em unidade com react-dom/server, sem
 * depender do navegador (mesmo padrão de testes/card-atividade.test.mjs e
 * das duas seções de prova social). Nasce junto com o componente, de
 * propósito — lição da Tarefa A3 (componente replicado sem o teste que o
 * acompanha só apareceu na revisão por mutação).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CampoFormulario } from '../componentes/CampoFormulario.ts';

function renderizar(props) {
  return renderToStaticMarkup(createElement(CampoFormulario, props));
}

test('o elemento raiz carrega a classe form-campo, com .campo num filho — nunca no mesmo elemento', () => {
  const html = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email' });
  assert.match(html, /^<div class="form-campo"><div class="campo">/);
});

test('rótulo e input ficam vinculados por id/for', () => {
  const html = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email' });
  assert.match(html, /<label for="campo-email">E-mail<\/label>/);
  assert.match(html, /<input[^>]*id="campo-email"/);
  assert.match(html, /<input[^>]*name="email"/);
  assert.match(html, /<input[^>]*type="email"/);
});

test('campo obrigatório recebe required e a marca visual; opcional não recebe nenhum dos dois', () => {
  const obrigatorio = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true });
  assert.match(obrigatorio, /<input[^>]*required=""/);
  assert.match(obrigatorio, /E-mail <span class="campo__obrigatorio" aria-hidden="true">\*<\/span>/);

  const opcional = renderizar({ nome: 'telefone', rotulo: 'Telefone', tipo: 'tel' });
  assert.doesNotMatch(opcional, /required/);
  assert.doesNotMatch(opcional, /campo__obrigatorio/);
});

test('ajuda vira parágrafo vinculado por aria-describedby; sem ajuda, o parágrafo não aparece', () => {
  const comAjuda = renderizar({
    nome: 'email', rotulo: 'E-mail', tipo: 'email', ajuda: 'Usamos para responder você.'
  });
  assert.match(comAjuda, /<p class="campo__ajuda" id="campo-email-ajuda">Usamos para responder você\.<\/p>/);
  assert.match(comAjuda, /aria-describedby="campo-email-ajuda campo-email-erro"/);

  const semAjuda = renderizar({ nome: 'senha', rotulo: 'Senha', tipo: 'password' });
  assert.doesNotMatch(semAjuda, /campo__ajuda/);
  assert.match(semAjuda, /aria-describedby="campo-senha-erro"/);
});

test('checkbox inverte a ordem — controle antes do rótulo — e usa .campo--caixa', () => {
  const html = renderizar({
    nome: 'maioridade', rotulo: 'Confirmo que tenho 18 anos ou mais', tipo: 'checkbox', obrigatorio: true
  });
  assert.match(html, /<div class="campo campo--caixa">/);
  assert.match(
    html,
    /<div class="campo__linha"><input[^>]*type="checkbox"[^>]*\/><label for="campo-maioridade">Confirmo que tenho 18 anos ou mais/
  );
});

test('campo desabilitado recebe o atributo disabled no controle', () => {
  const habilitado = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email' });
  assert.doesNotMatch(habilitado, /disabled/);

  const desabilitado = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email', desabilitado: true });
  assert.match(desabilitado, /<input[^>]*disabled=""/);
});

test('erro vira classe tem-erro no raiz, aria-invalid no controle e texto no parágrafo de erro', () => {
  const html = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email', erro: 'E-mail inválido' });
  assert.match(html, /^<div class="form-campo tem-erro">/);
  assert.match(html, /<input[^>]*aria-invalid="true"/);
  assert.match(html, /<p class="campo__erro" id="campo-email-erro" role="alert">E-mail inválido<\/p>/);
});

test('sem erro, aria-invalid é false e o parágrafo de erro fica vazio', () => {
  const html = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email' });
  assert.match(html, /^<div class="form-campo">/);
  assert.match(html, /<input[^>]*aria-invalid="false"/);
  assert.match(html, /<p class="campo__erro" id="campo-email-erro" role="alert"><\/p>/);
});

test('textarea usa 5 linhas, como o componente original', () => {
  const html = renderizar({ nome: 'mensagem', rotulo: 'Mensagem', tipo: 'textarea' });
  assert.match(html, /<textarea[^>]*rows="5"/);
});

test('select desenha uma option por item de opcoes', () => {
  const html = renderizar({
    nome: 'tipo',
    rotulo: 'Tipo',
    tipo: 'select',
    opcoes: [{ valor: 'fisica', texto: 'Pessoa física' }, { valor: 'juridica', texto: 'Pessoa jurídica' }]
  });
  assert.match(html, /<option value="fisica">Pessoa física<\/option>/);
  assert.match(html, /<option value="juridica">Pessoa jurídica<\/option>/);
});

// =====================================================================
// valorInicial — Tarefa 3 da autenticação
//
// A prop existe por defeito medido: sem ela, toda recusa de Server Action
// devolvia o formulário em branco (o React 19 reseta o <form> ao fim de uma
// action, e sem JavaScript a página é renderizada do zero). Ela é o que
// permite à Action devolver o que a pessoa escreveu — ver `valores` em
// acoes/autenticacao.ts.
// =====================================================================

test('valorInicial vira defaultValue no campo de texto, sem torná-lo controlado', () => {
  const html = renderizar({
    nome: 'email', rotulo: 'E-mail', tipo: 'email', valorInicial: 'maria@exemplo.com'
  });
  assert.match(html, /<input[^>]*value="maria@exemplo\.com"/);
  // `value` sem `onChange` num input CONTROLADO seria erro de React; aqui é
  // defaultValue, que o SSR escreve como atributo `value` e o navegador
  // trata como valor inicial — o campo continua não controlado.
  assert.doesNotMatch(html, /checked/);
});

test('sem valorInicial o campo não ganha atributo de valor nenhum', () => {
  const html = renderizar({ nome: 'email', rotulo: 'E-mail', tipo: 'email' });
  assert.doesNotMatch(html, /value=/);
});

test('na caixa de marcar, valorInicial vira defaultChecked — e nunca defaultValue', () => {
  const marcada = renderizar({
    nome: 'maioridade', rotulo: 'Confirmo', tipo: 'checkbox', valorInicial: 'on'
  });
  assert.match(marcada, /<input[^>]*checked=""/);
  assert.doesNotMatch(marcada, /value="on"/,
    'defaultValue num checkbox é erro de React — a caixa usa defaultChecked');

  const desmarcada = renderizar({
    nome: 'maioridade', rotulo: 'Confirmo', tipo: 'checkbox', valorInicial: ''
  });
  assert.doesNotMatch(desmarcada, /checked/);
});

test('o texto devolvido é escapado, não interpretado como HTML', () => {
  // O valor vem do corpo de uma requisição — ou seja, de qualquer pessoa.
  const html = renderizar({
    nome: 'nome', rotulo: 'Nome', valorInicial: '"><script>alert(1)</script>'
  });
  assert.doesNotMatch(html, /<script>/);
  // E o valor CHEGA, escapado — sem esta segunda metade o teste passaria
  // também num componente que simplesmente ignorasse `valorInicial`
  // (medido: foi o que aconteceu ao apagar a prop de propósito).
  assert.match(html, /value="[^"]*&lt;script&gt;/);
});
