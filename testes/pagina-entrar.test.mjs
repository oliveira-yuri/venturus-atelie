/**
 * Prova que /entrar diz a verdade sobre si mesma.
 *
 * ATÉ A TAREFA 3 DA AUTENTICAÇÃO ela dizia "não envio nada": todo campo
 * vinha `desabilitado`, os dois botões também, e um aviso fixo explicava
 * por quê. Este arquivo media exatamente isso. Agora os dois formulários
 * chamam Server Actions de verdade (`entrar` e `criarConta`), e o que
 * precisa ser medido virou o contrário — daí a reescrita:
 *
 *   - nenhum controle desabilitado, nos dois formulários;
 *   - a caixa de aviso NASCE VAZIA e escondida (o texto fixo saiu; ela só
 *     mostra resultado de envio). O texto dela, quando aparece, é medido em
 *     testes/formularios-conta.test.mjs, contra um envio de verdade;
 *   - cada <form> chega com o que faz o envio funcionar SEM JavaScript: o
 *     `method="POST"` e o campo escondido que carrega a referência da Server
 *     Action. É a prova estática do aprimoramento progressivo — quem trocar
 *     isto por `onSubmit` + fetch derruba este teste em vez de quebrar a
 *     página em silêncio para quem está sem script;
 *   - os dois painéis chegam SEM `hidden` do servidor (o recolhimento é da
 *     hidratação — ver componentes/AbasEntrar.tsx): sem isso, quem está sem
 *     JavaScript não teria como alcançar o formulário de criar conta.
 *
 * O envio de verdade (com e sem JavaScript) é medido em
 * testes/formularios-conta.test.mjs; aqui é só o HTML que o servidor
 * entrega.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html() {
  const resposta = await fetch(`${BASE}/entrar`);
  assert.equal(resposta.status, 200, '/entrar não respondeu 200');
  return resposta.text();
}

/** O <form> inteiro, pelo id. */
function formulario(paginaHtml, id) {
  const bloco = paginaHtml.match(new RegExp(`<form id="${id}"[\\s\\S]*?</form>`));
  assert.ok(bloco, `não achei <form id="${id}"> em /entrar`);
  return bloco[0];
}

test('/entrar: as duas abas e os dois formulários chegam prontos', async () => {
  const pagina = await html();
  assert.match(pagina, /<button[^>]*id="aba-entrar"[^>]*role="tab"/);
  assert.match(pagina, /<button[^>]*id="aba-criar"[^>]*role="tab"/);
  assert.match(pagina, /<form id="form-entrar"/);
  assert.match(pagina, /<form id="form-criar"/);
});

test('/entrar: a caixa de aviso nasce vazia e escondida — nada de texto fixo prometendo ou negando envio', async () => {
  const pagina = await html();
  const bloco = pagina.match(/<div id="aviso"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(bloco, 'não achei <div id="aviso"> em /entrar');

  assert.match(bloco[0], /\bhidden(=|>|\s)/,
    'o aviso chegou visível sem ninguém ter enviado nada');
  assert.match(bloco[0], /role="alert"/,
    'sem role="alert" o resultado do envio não é anunciado por leitor de tela');

  const texto = bloco[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(texto, '',
    `o aviso chegou com texto ("${texto}") — ele só pode falar depois de uma tentativa de envio`);
});

test('/entrar: nenhum controle dos dois formulários vem desabilitado', async () => {
  const pagina = await html();

  for (const id of ['form-entrar', 'form-criar']) {
    const forma = formulario(pagina, id);
    const controles = [...forma.matchAll(/<(input|textarea|select|button)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(controles.length > 0, `${id} não tem controle nenhum`);

    const desabilitados = controles.filter((c) => /\bdisabled(=|>|\s)/.test(c));
    assert.deepEqual(desabilitados, [],
      `${id}: controle desabilitado — o envio está ligado desde a Tarefa 3: ${desabilitados.join(', ')}`);
  }

  assert.match(pagina, /<button type="submit"[^>]*>Entrar<\/button>/);
  assert.match(pagina, /<button type="submit"[^>]*>Criar conta<\/button>/);
});

test('/entrar: os dois formulários enviam sem JavaScript — method POST e a referência da Server Action no HTML', async () => {
  const pagina = await html();

  for (const id of ['form-entrar', 'form-criar']) {
    const forma = formulario(pagina, id);

    // O <form action={acao}> de uma Server Action é serializado pelo Next
    // como POST para a própria URL, com a referência da Action num campo
    // escondido. Sem os dois, o envio só existiria para quem roda script.
    assert.match(forma, /method="POST"/i, `${id} não chega com method POST`);
    assert.match(forma, /<input type="hidden" name="\$ACTION_(REF|ID)/,
      `${id} não carrega a referência da Server Action — o envio deixou de funcionar sem JavaScript`);
  }
});

test('/entrar: os dois painéis chegam abertos do servidor — sem JavaScript, criar conta continua alcançável', async () => {
  const pagina = await html();

  for (const id of ['painel-entrar', 'painel-criar']) {
    const abertura = pagina.match(new RegExp(`<section id="${id}"[^>]*>`));
    assert.ok(abertura, `não achei <section id="${id}">`);
    assert.doesNotMatch(abertura[0], /\shidden(\s|=|>)/,
      `${id} chegou com hidden: sem JavaScript ninguém abre esse painel `
      + '(mesma lição de componentes/MenuMovel.tsx)');
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
