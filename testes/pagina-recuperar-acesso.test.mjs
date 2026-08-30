/**
 * Prova que /recuperar-acesso diz a verdade sobre si mesma: o campo de
 * e-mail e o botão "Enviar link" vêm desabilitados, e um aviso visível
 * explica que o envio ainda não está ativo — mesma decisão de /entrar
 * (testes/pagina-entrar.test.mjs), mesmo padrão de extração/comparação por
 * igualdade de testes/pagina-doar.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/recuperar-acesso`);
  assert.equal(resposta.status, 200, '/recuperar-acesso não respondeu 200');
  return resposta.text();
}

function textoDoAviso(paginaHtml) {
  const bloco = paginaHtml.match(/<div id="aviso" class="aviso">([\s\S]*?)<\/div>/);
  assert.ok(bloco, 'não achei <div id="aviso" class="aviso"> em /recuperar-acesso');
  return bloco[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?p[^>]*>/g, ' ')
    .replace(/&#x27;|&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

test('/recuperar-acesso: o formulário chega pronto, com o link de volta para /entrar', async () => {
  const pagina = await html();
  assert.match(pagina, /<form id="form-recuperar"/);
  assert.match(pagina, /<a href="\/entrar">Voltar para entrar<\/a>/);
});

test('/recuperar-acesso: o aviso de envio desligado é a frase inteira, sem espaço comido pelo JSX', async () => {
  const pagina = await html();
  assert.equal(
    textoDoAviso(pagina),
    'O envio do link de recuperação ainda não está ativo. Fale com a gente pelo WhatsApp '
    + '(11) 95396-8344 ou pelo e-mail atelieafro@gmail.com.'
  );
});

test('/recuperar-acesso: o campo de e-mail e o botão de enviar vêm desabilitados — nada aqui promete envio', async () => {
  const pagina = await html();
  const forma = pagina.match(/<form id="form-recuperar"[\s\S]*?<\/form>/)?.[0] || '';
  const campoEmail = forma.match(/<input\b[^>]*>/)?.[0] || '';
  // Atributos de <input> não saem na ordem em que o JSX os declara (React
  // reordena alguns para o SSR de formulário) — checar presença, não
  // sequência.
  assert.match(campoEmail, /\bname="email"/, 'não achei o campo de e-mail em form-recuperar');
  assert.match(campoEmail, /\bdisabled=""/, 'o campo de e-mail não veio desabilitado');
  assert.match(pagina, /<button type="submit" disabled="">Enviar link<\/button>/);
});
