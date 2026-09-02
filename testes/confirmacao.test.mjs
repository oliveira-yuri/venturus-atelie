import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, until } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');
const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * =====================================================================
 * A CONFIRMAÇÃO DAS AÇÕES (pedido V1)
 * =====================================================================
 *
 * "Popup para confirmar todas as ações do admin" e "confirmação dupla para
 * ações perigosas/destrutivas".
 *
 * O desenho está no cabeçalho de `componentes/ConfirmacaoDeAcoes.tsx`: um
 * componente só, montado uma vez no layout do painel, que intercepta o
 * `submit` de qualquer `<form data-confirmar>`. As listas do painel só
 * acrescentam o atributo.
 *
 * Isto cria uma armadilha nova, e é dela que o primeiro teste cuida: uma
 * lista que ganhe um `<form>` de ação e ESQUEÇA o atributo passa a agir sem
 * confirmar, em silêncio — o diálogo não reclama do que não conhece. A
 * varredura reconcilia as duas listas.
 *
 * O caminho AUTENTICADO do painel continua sem poder ser exercitado por
 * teste (não há sessão de equipe na suíte — CLAUDE.md, "O que trava hoje",
 * itens 2 e 3). O que dá para medir sem sessão é a FORMA: que todo
 * formulário de ação declara a confirmação, que as duas telas destrutivas
 * exigem palavra digitada, e que o aviso da home degrada sem JavaScript.
 * O diálogo em si foi conferido com o navegador, com o remendo local que o
 * relatório da tarefa descreve.
 */

// ---------------------------------------------------------------------
// Varredura: nenhum formulário de ação do painel sem confirmação
// ---------------------------------------------------------------------

function fontes(diretorio, sufixos) {
  return readdirSync(path.join(RAIZ, diretorio))
    .filter((nome) => sufixos.some((s) => nome.endsWith(s)))
    .map((nome) => ({
      nome,
      fonte: readFileSync(path.join(RAIZ, diretorio, nome), 'utf-8')
    }));
}

/**
 * As listas do painel montam os formulários com `createElement('form', {...})`
 * e um `action:` que é a Server Action. É essa assinatura que se procura —
 * e não `<form`, que não existe nestes arquivos.
 */
const LISTAS_DO_PAINEL = [
  'ListaPublicacoes.ts', 'ListaEventosPainel.ts', 'ListaMidia.ts',
  'ListaAtividades.ts', 'ListaMateriaisDoPainel.ts', 'ListaContatos.ts',
  'ListaVoluntarios.ts'
];

test('toda lista do painel que tem formulário de ação declara a confirmação', () => {
  const semConfirmacao = [];

  for (const { nome, fonte } of fontes('componentes', ['.ts', '.tsx'])) {
    if (!LISTAS_DO_PAINEL.includes(nome)) continue;

    const temFormulario = /createElement\(\s*'form'/.test(fonte);
    const temConfirmacao = /'data-confirmar'/.test(fonte);

    if (temFormulario && !temConfirmacao) semConfirmacao.push(nome);
  }

  assert.deepEqual(semConfirmacao, [],
    `estas listas do painel montam <form> de ação e NÃO declaram data-confirmar: `
    + `${semConfirmacao.join(', ')}. Sem o atributo, o botão age direto — e o diálogo `
    + 'de componentes/ConfirmacaoDeAcoes.tsx não reclama do que não conhece.');
});

test('a lista de listas do painel não envelheceu: todas existem', () => {
  // Sem isto, renomear um arquivo esvaziaria a varredura acima em silêncio.
  const existentes = fontes('componentes', ['.ts']).map(({ nome }) => nome);
  const sumidas = LISTAS_DO_PAINEL.filter((nome) => !existentes.includes(nome));
  assert.deepEqual(sumidas, [],
    `LISTAS_DO_PAINEL cita arquivos que não existem mais: ${sumidas.join(', ')}`);
});

test('as duas telas destrutivas exigem palavra digitada', () => {
  // Apagar foto e apagar material são os únicos gestos do painel sem volta.
  // A página em si já é a primeira confirmação (e funciona sem JavaScript);
  // a palavra é a segunda.
  for (const rota of ['app/admin/galeria/apagar/page.tsx', 'app/admin/acervo/apagar/page.tsx']) {
    const fonte = readFileSync(path.join(RAIZ, rota), 'utf-8');
    assert.match(fonte, /data-confirmar-palavra="APAGAR"/,
      `${rota} não exige palavra digitada: dois cliques seguidos, num celular, são um gesto só`);
    assert.match(fonte, /data-confirmar=/, `${rota} não declara o texto da confirmação`);
  }
});

test('o diálogo é montado UMA vez, no layout do painel — não nas páginas públicas', () => {
  const layoutPainel = readFileSync(path.join(RAIZ, 'app/admin/layout.tsx'), 'utf-8');
  assert.match(layoutPainel, /<ConfirmacaoDeAcoes \/>/,
    'o layout do painel não monta ConfirmacaoDeAcoes — nenhuma confirmação aparece');

  const layoutRaiz = readFileSync(path.join(RAIZ, 'app/layout.tsx'), 'utf-8');
  assert.doesNotMatch(layoutRaiz, /ConfirmacaoDeAcoes/,
    'ConfirmacaoDeAcoes foi montado no layout RAIZ: isso manda JavaScript de painel para '
    + 'toda página pública, que não tem ação a confirmar');
});

// ---------------------------------------------------------------------
// O aviso da home: popup com JavaScript, caixa comum sem ele
// ---------------------------------------------------------------------

test('sem JavaScript o aviso da home é uma caixa visível, não um diálogo fechado', async () => {
  // É a razão de o componente existir do jeito que existe. Um "popup" que só
  // existe com script deixaria quem está sem ele sem NENHUMA confirmação de
  // que a candidatura foi registrada.
  const opcoes = new Options().addArguments('-headless');
  opcoes.setPreference('javascript.enabled', false);
  const navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();

  try {
    await navegador.get(`${BASE}/?aviso=candidatura`);
    const caixa = await navegador.wait(until.elementLocated(By.css('.aviso')), 10000);

    assert.equal(await caixa.isDisplayed(), true,
      'a caixa de aviso não está visível sem JavaScript');
    assert.match(await caixa.getText(), /Candidatura registrada/);

    const html = await navegador.getPageSource();
    assert.doesNotMatch(html, /<dialog[^>]*\bopen\b/,
      'sem JavaScript não pode haver <dialog> aberto — o servidor entrega a caixa comum');
  } finally {
    await navegador.quit();
  }
});

test('com JavaScript o aviso da home vira diálogo modal, e some do fluxo da página', async () => {
  const opcoes = new Options().addArguments('-headless');
  const navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();

  try {
    await navegador.get(`${BASE}/?aviso=candidatura`);
    const dialogo = await navegador.wait(until.elementLocated(By.css('dialog.af-dialogo')), 10000);
    await navegador.wait(
      async () => navegador.executeScript('return document.querySelector("dialog.af-dialogo")?.open === true'),
      5000, 'o diálogo não abriu depois de hidratar');

    assert.match(await dialogo.getText(), /Candidatura registrada/);

    // Fechar limpa a URL: sem isso, um F5 reabriria "candidatura registrada"
    // e a pessoa não saberia se registrou duas.
    await navegador.findElement(By.css('.af-dialogo__cancelar')).click();
    await new Promise((pronto) => setTimeout(pronto, 400));

    const url = await navegador.getCurrentUrl();
    assert.doesNotMatch(url, /aviso=/,
      `fechar o aviso deveria limpar o ?aviso= da URL; ficou ${url}`);
  } finally {
    await navegador.quit();
  }
});

test('?aviso= inventado não desenha nada — a lista é fechada', async () => {
  // `?aviso=` é escrito por quem quiser. O parâmetro ESCOLHE uma frase
  // nossa; ele nunca TRAZ uma.
  const html = await fetch(`${BASE}/?aviso=<script>alert(1)</script>`).then((r) => r.text());

  assert.doesNotMatch(html, /class="aviso/,
    'um ?aviso= fora da lista fechada desenhou caixa de aviso');

  // A ASSERÇÃO É SOBRE MARCAÇÃO EXECUTÁVEL, não sobre a string aparecer.
  //
  // MEDIDO: o texto `alert(1)` APARECE no HTML — dentro do payload de
  // hidratação do Next, que serializa a URL da requisição como string JSON
  // com `<` e `/` já escapados (`%3C`, `%2F`). Não é o nosso código, e não
  // é executável: nenhuma tag se forma. Uma asserção contra a string
  // `alert(1)` mediria a serialização do framework, não a nossa lista
  // fechada — e ficaria vermelha para sempre, ensinando a ignorá-la.
  //
  // O que precisa ser verdade é que a marcação não se forma, e é isso que
  // se cobra abaixo.
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/,
    'o ?aviso= virou <script> de verdade no HTML — a lista fechada falhou');
});
