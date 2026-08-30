/**
 * Prova que /entrar diz a verdade sobre si mesma: as abas trocam de painel
 * (a única interação que não depende de backend nenhum), mas nenhum dos
 * dois formulários promete enviar — todo campo e os dois botões de
 * "type=submit" vêm desabilitados, e um aviso visível explica por quê.
 *
 * `textoDoAviso()` e a comparação por igualdade seguem o mesmo padrão de
 * testes/pagina-doar.test.mjs (Rodada de correção 1 da Tarefa A5): um
 * `assert.match` de trecho isolado passaria mesmo com um `{' '}` esquecido
 * no meio da frase (a armadilha do JSX come espaços, restrição global #3)
 * — só a igualdade da frase inteira, tags fora, pega isso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/entrar`);
  assert.equal(resposta.status, 200, '/entrar não respondeu 200');
  return resposta.text();
}

/** Mesmo extrator de testes/pagina-doar.test.mjs, aplicado a `<div id="aviso">`. */
function textoDoAviso(paginaHtml) {
  const bloco = paginaHtml.match(/<div id="aviso" class="aviso">([\s\S]*?)<\/div>/);
  assert.ok(bloco, 'não achei <div id="aviso" class="aviso"> em /entrar');
  return bloco[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?p[^>]*>/g, ' ')
    .replace(/&#x27;|&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

test('/entrar: as duas abas e os dois formulários chegam prontos', async () => {
  const pagina = await html();
  assert.match(pagina, /<button[^>]*id="aba-entrar"[^>]*role="tab"/);
  assert.match(pagina, /<button[^>]*id="aba-criar"[^>]*role="tab"/);
  assert.match(pagina, /<form id="form-entrar"/);
  assert.match(pagina, /<form id="form-criar"/);
});

test('/entrar: o aviso de envio desligado é a frase inteira, sem espaço comido pelo JSX', async () => {
  const pagina = await html();
  assert.equal(
    textoDoAviso(pagina),
    'Criar conta e entrar ainda não estão ativos neste site. Para se candidatar ao voluntariado '
    + 'ou fazer uma doação, fale com a gente pelo WhatsApp (11) 95396-8344 ou pelo e-mail '
    + 'atelieafro@gmail.com.'
  );
});

test('/entrar: nenhum dos dois botões de enviar promete envio — os dois vêm desabilitados', async () => {
  const pagina = await html();
  assert.match(pagina, /<button type="submit" disabled="">Entrar<\/button>/);
  assert.match(pagina, /<button type="submit" disabled="">Criar conta<\/button>/);
});

test('/entrar: todo input, textarea e select dos dois formulários vem desabilitado', async () => {
  const pagina = await html();
  const formEntrar = pagina.match(/<form id="form-entrar"[\s\S]*?<\/form>/)?.[0] || '';
  const formCriar = pagina.match(/<form id="form-criar"[\s\S]*?<\/form>/)?.[0] || '';

  for (const [nomeForm, form] of [['form-entrar', formEntrar], ['form-criar', formCriar]]) {
    assert.ok(form, `${nomeForm} não encontrado`);
    const controles = [...form.matchAll(/<(input|textarea|select)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(controles.length > 0, `${nomeForm} não tem controle nenhum`);
    const semDisabled = controles.filter((c) => !/\bdisabled(=|>|\s)/.test(c));
    assert.deepEqual(semDisabled, [], `${nomeForm}: controle sem disabled — ${semDisabled.join(', ')}`);
  }
});

// Rodada de correção 1 da Tarefa A6 — achado da revisão: "painel-entrar" e
// "painel-criar" saem inteiros de testes/paridade-texto.test.mjs (a
// expansão de CampoFormulario introduz rótulo/ajuda que não existiam como
// texto no HTML estático original — restrição global #3). Mas dentro
// dessas duas <section> há DOIS textos que são literais dos dois lados,
// não vêm de CampoFormulario nenhum, e por isso não têm cobertura em lugar
// algum: o link "Esqueci minha senha" e a <legend> do grupo de papéis.
// Provado: trocar os dois de propósito e rodar `npm test` inteiro (364
// testes) não acusava nada antes desta rodada — mesma classe de achado que
// a Tarefa A5 fechou para "dados-pix".
test('/entrar: os dois textos literais que sobrevivem à expansão de CampoFormulario continuam exatos', async () => {
  const pagina = await html();
  assert.match(pagina, /<a[^>]*href="\/recuperar-acesso"[^>]*>Esqueci minha senha<\/a>/,
    '"Esqueci minha senha" sumiu, mudou de texto ou perdeu o link — não vem de CampoFormulario, '
    + 'nada mais cobre esta frase');
  assert.match(pagina, /<legend>Como você quer participar\?<\/legend>/,
    'a legenda "Como você quer participar?" sumiu ou mudou de texto — não vem de CampoFormulario, '
    + 'nada mais cobre esta frase');
});
