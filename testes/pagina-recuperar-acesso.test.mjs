/**
 * Prova que /recuperar-acesso diz a verdade sobre si mesma — teste irmão de
 * testes/pagina-entrar.test.mjs, reescrito pelo mesmo motivo: até a Tarefa 3
 * da autenticação o campo e o botão vinham desabilitados e um aviso fixo
 * dizia que o envio não estava ativo; agora o formulário chama a Server
 * Action `solicitarRecuperacao`, aquele texto saiu, e o que se mede é o
 * contrário.
 *
 * O envio de verdade (inclusive sem JavaScript) é medido em
 * testes/formularios-conta.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/recuperar-acesso`);
  assert.equal(resposta.status, 200, '/recuperar-acesso não respondeu 200');
  return resposta.text();
}

function formulario(paginaHtml) {
  const bloco = paginaHtml.match(/<form id="form-recuperar"[\s\S]*?<\/form>/);
  assert.ok(bloco, 'não achei <form id="form-recuperar"> em /recuperar-acesso');
  return bloco[0];
}

test('/recuperar-acesso: o formulário chega pronto, com o link de volta para /entrar', async () => {
  const pagina = await html();
  assert.match(pagina, /<form id="form-recuperar"/);
  assert.match(pagina, /<a href="\/entrar">Voltar para entrar<\/a>/);
});

test('/recuperar-acesso: a caixa de aviso nasce vazia e escondida', async () => {
  const pagina = await html();
  const bloco = pagina.match(/<div id="aviso"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(bloco, 'não achei <div id="aviso"> em /recuperar-acesso');

  assert.match(bloco[0], /\bhidden(=|>|\s)/,
    'o aviso chegou visível sem ninguém ter enviado nada');
  assert.match(bloco[0], /role="alert"/,
    'sem role="alert" o resultado do envio não é anunciado por leitor de tela');

  const texto = bloco[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(texto, '',
    `o aviso chegou com texto ("${texto}") — ele só pode falar depois de uma tentativa de envio`);
});

test('/recuperar-acesso: o campo de e-mail e o botão de enviar vêm habilitados', async () => {
  const pagina = await html();
  const forma = formulario(pagina);

  const controles = [...forma.matchAll(/<(input|button)\b[^>]*>/g)]
    .map((m) => m[0])
    // Os campos escondidos da Server Action não são controle de ninguém.
    .filter((c) => !/type="hidden"/.test(c));

  const desabilitados = controles.filter((c) => /\bdisabled(=|>|\s)/.test(c));
  assert.deepEqual(desabilitados, [],
    `controle desabilitado — o envio está ligado desde a Tarefa 3: ${desabilitados.join(', ')}`);

  const campoEmail = forma.match(/<input\b(?![^>]*type="hidden")[^>]*>/)?.[0] || '';
  // Atributos de <input> não saem na ordem em que o JSX os declara (React
  // reordena alguns para o SSR de formulário) — checar presença, não
  // sequência.
  assert.match(campoEmail, /\bname="email"/, 'não achei o campo de e-mail em form-recuperar');
  assert.match(pagina, /<button type="submit"[^>]*>Enviar link<\/button>/);
});

test('/recuperar-acesso: o formulário envia sem JavaScript — method POST e a referência da Server Action no HTML', async () => {
  const forma = formulario(await html());

  assert.match(forma, /method="POST"/i, 'o formulário não chega com method POST');
  assert.match(forma, /<input type="hidden" name="\$ACTION_(REF|ID)/,
    'o formulário não carrega a referência da Server Action — o envio deixou de funcionar sem JavaScript');
});
