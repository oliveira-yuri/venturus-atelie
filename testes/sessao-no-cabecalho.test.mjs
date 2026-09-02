/**
 * O cabeçalho de quem ENTROU — e o "Sair", que até a Tarefa 4 não existia.
 *
 * O DEFEITO QUE ESTE ARQUIVO GUARDA: dava para entrar, e o cabeçalho
 * continuava dizendo "Entrar", para sempre, sem nenhum caminho de saída.
 * Quem entrava não tinha como saber que tinha entrado, e num celular
 * compartilhado pela equipe da ONG (regra 4 do CLAUDE.md) a sessão de uma
 * pessoa ficava aberta na mão da seguinte.
 *
 * COMO SE MEDE ISSO SEM CONTA. Não existe conta utilizável neste projeto
 * Supabase — a confirmação de e-mail está ligada e o envio nativo estoura a
 * cota (itens 1 e 2 de "O que trava hoje"). Sem alguma porta, o cabeçalho
 * autenticado seria a única tela do site sem uma única medição, e toda
 * afirmação sobre ela valeria só até alguém abrir a página. A porta é
 * `DIAGNOSTICO_CABECALHO_COM_SESSAO` (app/layout.tsx): variável de ambiente
 * do servidor, fechada por padrão, que só muda o que o cabeçalho DESENHA —
 * não cria sessão, não grava cookie e não passa por `usuarioAtual()`, que
 * continua sendo o único que autoriza qualquer coisa.
 *
 * O QUE ESTES TESTES NÃO PROVAM, e é preciso dizer: que entrar de verdade
 * faz o nome aparecer. O caminho `signInWithPassword` -> cookie -> `getUser`
 * -> nome no cabeçalho nunca foi percorrido inteiro por ninguém, porque não
 * há conta. O que fica provado é a metade de cá: DADA uma sessão, o
 * cabeçalho muda, o "Sair" é um form com Server Action, funciona sem
 * JavaScript e não estoura a tela a 375px.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { subirServidor } from './apoio/servidor-de-teste.mjs';

const BASE_DA_SUITE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * Comprido de propósito e SEM PONTO, HÍFEN OU ESPAÇO — 43 letras corridas.
 *
 * A primeira versão deste arquivo usava um e-mail
 * (`nome.muito.comprido@exemplo.com.br`) achando que era o pior caso, e o
 * teste de 375px passou até com a regra de CSS removida: MEDIDO, o
 * navegador quebra sozinho depois dos pontos e do arroba. Sem nenhuma
 * oportunidade de quebra, a mesma medição dá 402px de página numa janela de
 * 375 — aí sim o cabeçalho sai da tela.
 *
 * Nome corrido não é hipótese de laboratório: é como chega um nome digitado
 * sem espaço no cadastro, e é para isso que `.af-control--nome` tem
 * `overflow-wrap: anywhere`.
 */
const NOME_LONGO = 'NomeDeTesteMuitoCompridoSemEspacoNenhumAqui';

let servidor;
let navegador;

before(async () => {
  servidor = await subirServidor({
    ambiente: { DIAGNOSTICO_CABECALHO_COM_SESSAO: NOME_LONGO }
  });
});

after(async () => {
  servidor?.encerrar();
  await navegador?.quit();
});

/** Só o <header>: o rodapé e o miolo das páginas têm links próprios. */
function cabecalhoDe(html) {
  const bloco = html.match(/<header[\s\S]*?<\/header>/);
  assert.ok(bloco, 'não foi possível isolar o <header> no HTML entregue pelo servidor');
  return bloco[0];
}

test('sem sessão o cabeçalho continua exatamente o de antes: "Entrar", e nada de "Sair"', async () => {
  // Contra o servidor DA SUÍTE, que não tem a porta de diagnóstico ligada —
  // ou seja, o cabeçalho que todo mundo vê hoje.
  const html = await fetch(`${BASE_DA_SUITE}/`).then((r) => r.text());
  const cabecalho = cabecalhoDe(html);

  assert.match(cabecalho, /<a[^>]+class="af-control cabecalho__entrar"[^>]+href="\/entrar"/,
    'o link "Entrar" sumiu do cabeçalho de visitante');
  assert.doesNotMatch(cabecalho, />\s*Sair\s*</,
    'apareceu um "Sair" para quem não está autenticado');
  assert.doesNotMatch(cabecalho, /<form/,
    'apareceu um formulário no cabeçalho de visitante');
});

test('com sessão o cabeçalho traz o nome e troca "Entrar" por "Sair"', async () => {
  const html = await fetch(`${servidor.base}/`).then((r) => r.text());
  const cabecalho = cabecalhoDe(html);

  assert.match(cabecalho, new RegExp(NOME_LONGO.replace(/[.@]/g, '\\$&')),
    'o nome de quem está autenticado não apareceu no cabeçalho');
  assert.match(cabecalho, />\s*Sair\s*</, 'não há "Sair" no cabeçalho de quem entrou');
  assert.doesNotMatch(cabecalho, /href="\/entrar"/,
    'o cabeçalho de quem já entrou continua oferecendo "Entrar"');
});

test('"Sair" é um <form> com Server Action, não um botão de JavaScript', async () => {
  // O que faz o "Sair" funcionar sem script é isto e só isto: o <form> chega
  // no HTML com method="post" e o campo escondido que identifica a Action,
  // do mesmo jeito que os formulários de /entrar (medido em
  // testes/formularios-conta.test.mjs). Um `onClick` não deixaria marca
  // nenhuma aqui — e prenderia na sessão justamente quem está sem script.
  const html = await fetch(`${servidor.base}/`).then((r) => r.text());
  const cabecalho = cabecalhoDe(html);

  const form = cabecalho.match(/<form[\s\S]*?<\/form>/);
  assert.ok(form, 'não há <form> no cabeçalho de quem está autenticado');
  assert.match(form[0], /method="post"/i, 'o form do "Sair" não chega com method="post"');
  assert.match(form[0], /\$ACTION_ID_/,
    'o form do "Sair" não carrega a referência da Server Action — sem ela, sem script nada acontece');
  assert.match(form[0], /<button[^>]*type="submit"[^>]*>\s*Sair\s*<\/button>/,
    'o "Sair" deveria ser um <button type="submit"> dentro do form');

  // aria-current marca "este link leva à página em que você está". "Sair"
  // não leva a página nenhuma: marcá-lo seria mentir para quem navega por
  // leitor de tela.
  assert.doesNotMatch(form[0], /aria-current/, '"Sair" não pode carregar aria-current');
});

test('em /entrar com sessão, nada no cabeçalho fica marcado como página atual', async () => {
  // Coerência do aria-current depois da troca (requisito 3 da tarefa): o
  // link "Entrar", que era o único marcado nesta rota, não existe mais para
  // quem está autenticado — então não sobra nada apontando para cá, e é isso
  // que está certo.
  const html = await fetch(`${servidor.base}/entrar`).then((r) => r.text());
  const cabecalho = cabecalhoDe(html);

  assert.doesNotMatch(cabecalho, /aria-current="page"/,
    'algo no cabeçalho ficou marcado como página atual em /entrar sem haver link para /entrar');
});

test('o POST do "Sair", sem navegador nenhum, executa a Action e redireciona', async () => {
  // O TESTE MAIS PRECISO DOS TRÊS sobre "funciona sem JavaScript", e ele
  // nasceu de uma falha de medição: quebrando o form de propósito e pondo um
  // <a href="/">Sair</a> no lugar, o teste de Selenium abaixo CONTINUOU
  // VERDE — clicar no link também leva para `/`. Ele não distingue link de
  // formulário; este distingue, porque reproduz exatamente o que o navegador
  // sem script faz: um POST multipart para a própria URL, levando o campo
  // escondido que identifica a Server Action.
  //
  // A resposta esperada é 303 com Location `/`, que é o `redirect('/')` do
  // fim de `sair()` (acoes/autenticacao.ts). Um link não produziria isso.
  const html = await fetch(`${servidor.base}/quem-somos`).then((r) => r.text());
  const form = cabecalhoDe(html).match(/<form[\s\S]*?<\/form>/);
  assert.ok(form, 'não há <form> no cabeçalho: não há o que enviar');

  const campo = form[0].match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(campo, 'o form não traz o campo escondido da Server Action');

  const corpo = new FormData();
  corpo.set(campo[1], '');

  const resposta = await fetch(`${servidor.base}/quem-somos`, {
    method: 'POST',
    redirect: 'manual',
    // Origin igual ao host: as Server Actions do Next recusam requisição de
    // outra origem, e é o que um navegador manda ao enviar o form.
    headers: { origin: servidor.base },
    body: corpo
  });

  assert.equal(resposta.status, 303,
    `o POST do "Sair" respondeu ${resposta.status} em vez de 303 — a Action não redirecionou`);
  assert.equal(
    new URL(resposta.headers.get('location'), servidor.base).pathname, '/',
    'o "Sair" deveria terminar na home'
  );
});

test('sem JavaScript, clicar em "Sair" executa a Action de verdade', async () => {
  // `javascript.enabled=false` no Firefox: é o mesmo instrumento de
  // testes/formularios-conta.test.mjs. SOZINHO ELE NÃO DISTINGUE um form de
  // um link (medido — ver o teste acima); o que ele acrescenta é a ponta de
  // verdade: um navegador sem script, clicando no botão, chega onde deve. Sem Supabase configurado neste
  // servidor, `sair()` (acoes/autenticacao.ts) não tem sessão para encerrar
  // e vai direto ao `redirect('/')` — então a prova de que a Action rodou é
  // sair de /quem-somos e chegar em /. Um `onClick` não faria nada aqui.
  const opcoes = new Options().addArguments('-headless');
  opcoes.setPreference('javascript.enabled', false);
  navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();

  await navegador.get(`${servidor.base}/quem-somos`);
  const botao = await navegador.findElement(By.css('.af-control--sair'));
  await botao.click();

  await navegador.wait(async () => {
    const url = await navegador.getCurrentUrl();
    return new URL(url).pathname === '/';
  }, 10_000, 'o POST do "Sair" não levou para / — a Action não rodou sem JavaScript');
});

test('na largura de celular o cabeçalho com nome longo não empurra a página para fora da tela', async () => {
  // Regra 4 do CLAUDE.md: a operação da ONG acontece no celular, muitas
  // vezes de pé. Um nome corrido, sem nenhuma oportunidade de quebra, é o
  // que estoura a largura se ninguém disser à caixa que ela pode quebrar no
  // meio da palavra — ver `.af-control--nome` em
  // estilos/componentes.css, e o comentário de NOME_LONGO aqui em cima.
  // 375px NÃO É ALCANÇÁVEL NESTE NAVEGADOR, e é melhor dizer isso do que
  // escrever 375 no nome do teste e medir outra coisa. MEDIDO de três
  // formas: `setRect({ width: 375 })`, `--width=375` na linha de comando e
  // `layout.css.devPixelsPerPx` — as três param em 450 CSS px de janela
  // (438 de área útil, descontada a barra de rolagem). O Firefox headless
  // tem um mínimo e não passa dele.
  //
  // O que dá para medir é a janela mais estreita que ele aceita, que ainda
  // é largura de celular e ainda está bem abaixo do ponto em que o menu
  // vira sanduíche (62rem). E ela BASTA para pegar o defeito: com a regra
  // de CSS removida, esta mesma medida acusou 451px de página numa janela
  // de 438. A 375 seria pior, nunca melhor.
  await navegador.quit();
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless')).build();

  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${servidor.base}/`);

  const medida = await navegador.executeScript(`
    var sair = document.querySelector('.af-control--sair');
    var caixa = sair.getBoundingClientRect();
    return {
      larguraDaPagina: document.documentElement.scrollWidth,
      larguraDaJanela: document.documentElement.clientWidth,
      sairVisivel: caixa.width > 0 && caixa.height > 0,
      alturaDoAlvo: caixa.height,
      focavel: (function () { sair.focus(); return document.activeElement === sair; })()
    };
  `);

  assert.ok(
    medida.larguraDaJanela <= 460,
    `a janela ficou com ${medida.larguraDaJanela}px: este teste precisa de largura de `
    + 'celular para valer alguma coisa'
  );
  assert.ok(
    medida.larguraDaPagina <= medida.larguraDaJanela,
    `a página ficou com ${medida.larguraDaPagina}px de largura numa janela de `
    + `${medida.larguraDaJanela}px: o nome no cabeçalho estourou a tela`
  );
  assert.ok(medida.sairVisivel, 'o "Sair" não está visível na largura de celular');
  assert.ok(medida.focavel, 'o "Sair" não recebe foco de teclado');
  assert.ok(medida.alturaDoAlvo >= 44,
    `o alvo de toque do "Sair" ficou com ${medida.alturaDoAlvo}px de altura (mínimo 44)`);
});
