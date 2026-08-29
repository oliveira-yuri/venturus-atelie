/**
 * Portao de risco da migracao: politica de conteudo (CSP) com nonce e o
 * widget VLibras carregando E FUNCIONANDO de ponta a ponta sob ela.
 *
 * MODELO MENTAL DO WIDGET (corrigido na rodada 2, depois de medir errado na
 * rodada 1): so o AVATAR (a animacao 3D) mora dentro do `<iframe>` Unity,
 * com documento e politica proprios. O PLAYER INTEIRO — cabecalho, menu de
 * opcoes, Dicionario — mora no shadow root de `#vlibras-app-root`, NA
 * PAGINA-MAE, e portanto obedece a NOSSA politica de conteudo. Cada nivel
 * desse player tem seu proprio ponto cego, e cada rodada desta tarefa
 * fechou um:
 *
 *   - rodada 1: o icone fechado carregava, mas o clique que abre o player
 *     nunca tinha sido testado — a traducao de verdade falhava em silencio
 *     (frame-src e as fontes bloqueados).
 *   - rodada 2: abrir o player funcionava, mas Menu -> Dicionario nunca
 *     tinha sido clicado — o Dicionario abria vazio em silencio
 *     (connect-src sem dicionario2.vlibras.gov.br/repositorio.vlibras.gov.br).
 *   - rodada 3: a rodada 2 tinha presumido `traducao2.vlibras.gov.br` "por
 *     referencia no bundle", nunca medido — e por isso nao tinha teste
 *     nenhum o defendendo. Medido de verdade (sessoes isoladas): tanto o
 *     duplo clique quanto Menu -> Tradutor -> Traduzir chamam esse host de
 *     verdade.
 *   - rodada 4: a afirmacao acima ("os dois defendem a entrada") era
 *     falsa NA SEQUENCIA em que o teste do duplo clique estava escrito —
 *     ele clicava soh ~220ms apos o widget assentar em "idle", uma janela
 *     "morta" em que o clique nao chega a chamar o host (a saudacao
 *     automatica do widget, que comeca uns +4,3s depois do idle e nao usa
 *     rede nenhuma, e quem marcava "playing" ali — nao a traducao). Com
 *     `traducao2` fora da politica, so o teste do Tradutor falhava; o do
 *     duplo clique passava — um teste placebo. Corrigido com uma espera de
 *     ~7s apos o idle antes do clique (dentro da janela que sempre produz
 *     traducao real, medida pela arbitragem). Com a correcao, os dois
 *     testes de fato defendem essa entrada da politica — reconfirmado
 *     removendo o host e vendo os dois falharem.
 *
 * A pergunta que guia este arquivo é sempre "o que ainda nao foi clicado?".
 *
 * A API classica `manage().logs().get('browser')` nao existe neste
 * geckodriver para Firefox (responde "HTTP method not allowed" — mesmo
 * achado documentado em testes/hidratacao.test.mjs). Por isso usamos o
 * inspetor de log do WebDriver BiDi, que e o caminho que de fato funciona
 * neste ambiente, para capturar toda mensagem de bloqueio que a politica
 * gerar no console.
 *
 * Este teste tem que falhar fechado: se o inspetor de log nao inicializar,
 * ele nao tem como observar nada, e um teste cego que passa e pior que
 * nenhum teste — o widget podia estar falhando em silencio.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import getLogInspector from 'selenium-webdriver/bidi/logInspector.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * "Refused to" e a frase do Chromium. Este projeto testa em Firefox (mesmo
 * navegador dos outros testes de navegador.test.mjs), que relata bloqueio de
 * CSP com uma frase totalmente diferente — em pt-BR, medido: "As
 * configuracoes da pagina bloquearam o carregamento de um recurso (...)
 * porque viola a seguinte diretiva". Um teste que so procurasse "Refused to"
 * passaria "verde" aqui mesmo com recursos recusados — exatamente o
 * falso-negativo que este filtro existe para evitar.
 */
function contemRecusaDePolitica(texto) {
  return /Refused to/i.test(texto)
    || (/Content-Security-Policy/i.test(texto) && /bloque|blocked/i.test(texto));
}

/** Abre o icone fechado do VLibras — o clique que so acontece na primeira interacao. */
async function abrirWidget(navegador) {
  await navegador.executeScript(`
    document.getElementById('vlibras-access-wrapper').shadowRoot
      .getElementById('vlibras-button')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  `);
}

/** Le data-status do player (#vlibras-app-root), na pagina-mae — null se ele ainda nao existe. */
async function statusDoPlayer(navegador) {
  return navegador.executeScript(`
    const raiz = document.getElementById('vlibras-app-root');
    return raiz ? raiz.dataset.status : null;
  `);
}

test('a resposta traz nonce e a politica cobre o VLibras', async () => {
  const resposta = await fetch(`${BASE}/`);
  const politica = resposta.headers.get('content-security-policy');
  assert.ok(politica, 'sem CSP');
  assert.match(politica, /script-src[^;]*'nonce-/, 'script-src sem nonce');
  assert.match(politica, /connect-src[^;]*vlibras\.gov\.br/, 'connect-src sem o VLibras');
  assert.match(politica, /img-src[^;]*vlibras\.gov\.br/, 'img-src sem o VLibras');
  // A traducao de verdade precisa do iframe Unity: sem frame-src, ele cai em
  // default-src 'self' e e bloqueado assim que alguem clica no icone.
  assert.match(politica, /frame-src[^;]*vlibras\.gov\.br/, 'frame-src sem o VLibras — o iframe de traducao seria bloqueado');
  // O Dicionario roda no shadow root da pagina-mae (nao no iframe) e busca
  // categorias nesses dois hosts — achado da rodada 2 desta tarefa.
  assert.match(politica, /connect-src[^;]*dicionario2\.vlibras\.gov\.br/, 'connect-src sem dicionario2 — o Dicionario abriria vazio');
  assert.match(politica, /connect-src[^;]*repositorio\.vlibras\.gov\.br/, 'connect-src sem repositorio — o Dicionario abriria vazio');
});

let navegador;
let erroInspetor;
let mensagensConsole;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless').enableBidi())
    .build();

  mensagensConsole = [];
  try {
    const inspetor = await getLogInspector(navegador);
    await inspetor.onConsoleEntry((entrada) => { mensagensConsole.push(entrada.text); });
    await inspetor.onJavascriptException((entrada) => { mensagensConsole.push(entrada.text); });
  } catch (erro) {
    erroInspetor = erro;
  }
});

after(async () => { await navegador?.quit(); });

test('nenhum recurso e recusado pela politica com o widget fechado', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o VLibras se monta num setTimeout

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [], `a politica recusou algo: ${JSON.stringify(recusas)}`);
});

test('o widget VLibras monta e recebe a correcao de acessibilidade', async () => {
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000);

  const estado = await navegador.executeScript(`
    const area = document.getElementById('vlibras-access-wrapper');
    if (!area) return { existe: false };
    return {
      existe: true,
      role: area.getAttribute('role'),
      label: area.getAttribute('aria-label'),
      imagensSemAlt: area.shadowRoot
        ? area.shadowRoot.querySelectorAll('img:not([alt])').length
        : null
    };
  `);

  assert.ok(estado.existe, 'o widget VLibras nao montou — vlibras-access-wrapper nao existe');
  assert.equal(estado.role, 'complementary', 'o wrapper do VLibras deveria ter role complementary');
  assert.equal(estado.label, 'Tradução para Libras');
  assert.equal(estado.imagensSemAlt, 0, 'ainda ha imagem sem alt dentro do shadow root do VLibras');
});

test('abrir o VLibras e traduzir um texto real da pagina chega a "playing", sem bloqueio de politica', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000); // o widget fechado se monta num setTimeout

  // O botao mora dentro do shadow root aberto de #vlibras-access-wrapper —
  // um seletor comum, de fora, nao alcanca. Dispara um clique de verdade
  // (MouseEvent), nao so chama .click() num proxy: e o mesmo caminho que o
  // handler do widget escuta.
  await abrirWidget(navegador);

  // So esperar o <iframe> existir NAO prova que a traducao funciona — a
  // rodada 1 desta tarefa provou isso: sob a politica antiga, com
  // frame-src bloqueado, o elemento <iframe> continuava no DOM mesmo
  // com o carregamento recusado. A prova de verdade e o avatar
  // efetivamente tocando uma animacao: data-status virando "playing".
  //
  // Espera primeiro assentar em "idle" — logo apos abrir, o player passa
  // por "idle" quase de imediato (~200ms). CORRECAO DA RODADA 4: o
  // comentario anterior dizia que esperava "idle" porque a animacao de
  // boas-vindas TAMBEM marca "playing", dando a entender que a saudacao
  // vinha ANTES do idle — invertido. Medido pela arbitragem da rodada 4: a
  // saudacao comeca DEPOIS do idle, em torno de +4,3s, sem nenhuma
  // requisicao de rede, e clicar demasiado cedo apos o idle cai numa
  // janela "morta" em que o duplo clique nao chega a chamar
  // traducao2.vlibras.gov.br — o teste antigo (sem a espera abaixo)
  // clicava ~220ms apos o idle, caia nessa janela, e o "playing" que ele
  // detectava era so a saudacao automatica, sem chamada de rede nenhuma:
  // um teste placebo, que passava mesmo com traducao2 fora da politica.
  await navegador.wait(
    async () => (await statusDoPlayer(navegador)) === 'idle',
    20000,
    'o VLibras nao assentou em "idle" apos abrir, em 20s'
  );

  // Espera adicional de ~7s DEPOIS do idle — e o conserto real desta
  // rodada. Tabela medida pela arbitragem (espera apos o idle x status no
  // clique x chamadas a /translate observadas): 1000ms e 3000ms -> idle,
  // 0 chamadas (janela morta); 5000/8000/12000/20000/25000ms -> playing,
  // 2 chamadas (traducao de verdade). 7s fica dentro da faixa que sempre
  // produziu traducao real nas medicoes.
  await navegador.sleep(7000);

  // Duplo clique de verdade (Actions do WebDriver, nao dispatchEvent
  // isolado) num texto real da pagina — seleciona a palavra sob o cursor,
  // e este widget trata selecao de texto como pedido de traducao. Com a
  // espera de 7s acima, este clique cai fora da janela morta: MEDIDO em
  // sessao isolada (pagina nova, performance.getEntriesByType('resource'),
  // linha de base tirada 25s apos abrir o widget, clique so entao) que
  // este duplo clique de fato chama traducao2.vlibras.gov.br/translate
  // (+2 chamadas). O teste 'Menu > Tradutor', logo abaixo, mede o outro
  // caminho que chama o mesmo host — com a espera de 7s, os dois defendem
  // essa entrada da politica de verdade (confirmado removendo o host da
  // politica e vendo os dois testes falharem — ver relatorio da Tarefa 6,
  // rodada 4).
  const h1 = await navegador.findElement(By.css('h1'));
  await navegador.actions({ bridge: true }).doubleClick(h1).perform();

  await navegador.wait(
    async () => (await statusDoPlayer(navegador)) === 'playing',
    10000,
    'o VLibras nao chegou a "playing" apos o duplo clique — a traducao nao foi acionada de verdade'
  );

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [],
    `a politica recusou algo ao traduzir um texto de verdade: ${JSON.stringify(recusas)}`);
});

test('Menu > Dicionario carrega as categorias, sem bloqueio de politica', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000);

  await abrirWidget(navegador);
  await navegador.sleep(5000); // da tempo do player montar antes de procurar o menu dentro dele

  // O menu de opcoes ("Menu de opções", #header-menu-button) e o botao
  // "Dicionário" moram no shadow root de #vlibras-app-root, NA PAGINA-MAE
  // — nao no iframe Unity (o erro de modelo mental corrigido nesta rodada).
  const abriuMenu = await navegador.executeScript(`
    const sr = document.getElementById('vlibras-app-root')?.shadowRoot;
    if (!sr) return false;
    const botaoMenu = sr.getElementById('header-menu-button');
    if (!botaoMenu) return false;
    botaoMenu.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  `);
  assert.ok(abriuMenu, 'nao encontrou #header-menu-button no shadow root de #vlibras-app-root');

  await navegador.sleep(500);

  const clicouDicionario = await navegador.executeScript(`
    const sr = document.getElementById('vlibras-app-root').shadowRoot;
    const botaoDicionario = sr.querySelector('button[aria-label="Dicionário"]');
    if (!botaoDicionario) return false;
    botaoDicionario.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  `);
  assert.ok(clicouDicionario, 'nao encontrou o botao "Dicionário" no menu do VLibras');

  // As categorias vem de dicionario2.vlibras.gov.br (e o repositorio de
  // tags de repositorio.vlibras.gov.br). Sem esses hosts em connect-src, o
  // painel abre e fica vazio, em silencio — exatamente o Critico desta
  // rodada. Espera a lista de categorias renderizar de verdade, nao so o
  // painel aparecer.
  //
  // 'li button' generico NAO SERVE: medido — o proprio player mantem uma
  // barra de botoes persistente (Dicionario, Configuracoes etc, cada um
  // dentro do seu <li>) que fica em 21 elementos o tempo todo, carregando
  // ou nao a lista de categorias. O container que so existe quando as
  // categorias de fato renderizam e 'ul.flex.flex-col li' — confirmado
  // medindo contra a politica sem dicionario2/repositorio (fica em 0 os
  // 10s inteiros) e contra a politica corrigida (vai a 27).
  await navegador.wait(async () => {
    const quantidade = await navegador.executeScript(`
      const sr = document.getElementById('vlibras-app-root').shadowRoot;
      return sr.querySelectorAll('ul.flex.flex-col li').length;
    `);
    return quantidade > 0;
  }, 10000, 'o Dicionario nao chegou a mostrar nenhuma categoria em 10s — abriu vazio');

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [],
    `a politica recusou algo ao abrir o Dicionario: ${JSON.stringify(recusas)}`);
});

test('Menu > Tradutor > digitar texto > Traduzir chega a "playing", sem bloqueio de politica', async () => {
  if (erroInspetor) {
    assert.fail(
      `captura de log indisponivel: este teste nao pode verificar nada (${erroInspetor.message})`
    );
  }

  mensagensConsole.length = 0;
  await navegador.get(`${BASE}/`);
  await navegador.sleep(3000);

  // Ate a rodada 2, traducao2.vlibras.gov.br so tinha o duplo clique
  // defendendo sua entrada na politica. Este e o caminho mais direto e
  // deliberado para o mesmo host — digitar um texto de verdade e pedir a
  // traducao pelo painel, em vez de depender de selecionar uma palavra que
  // ja esteja na pagina.
  //
  // Usa getShadowRoot()/findElement/sendKeys do proprio WebDriver (Selenium
  // 4.47+ atravessa shadow root aberto nativamente) em vez de
  // executeScript com dispatchEvent — mais fiel ao que uma pessoa de
  // verdade faz: clicar, ver o campo, digitar de verdade.
  const wrapper = await navegador.findElement(By.css('#vlibras-access-wrapper'));
  const srAcesso = await wrapper.getShadowRoot();
  await (await srAcesso.findElement(By.css('#vlibras-button'))).click();
  await navegador.sleep(5000);

  const appRoot = await navegador.findElement(By.css('#vlibras-app-root'));
  const srApp = await appRoot.getShadowRoot();

  await (await srApp.findElement(By.css('#header-menu-button'))).click();
  await navegador.sleep(500);
  await (await srApp.findElement(By.css('button[aria-label="Tradutor"]'))).click();
  await navegador.sleep(1500);

  const campoTexto = await srApp.findElement(By.css('#translator-text'));
  await campoTexto.sendKeys('CASA VERDE');
  await navegador.sleep(500);

  // O botao "Traduzir" nao tem aria-label proprio nem id — so o texto
  // visivel o identifica (medido no HTML do painel). Fica desabilitado
  // (disabled) ate o campo ter conteudo.
  const botoes = await srApp.findElements(By.css('button'));
  let botaoTraduzir = null;
  for (const botao of botoes) {
    if ((await botao.getText()).trim() === 'Traduzir') { botaoTraduzir = botao; break; }
  }
  assert.ok(botaoTraduzir, 'nao encontrou o botao "Traduzir" no painel do Tradutor');
  await botaoTraduzir.click();

  await navegador.wait(
    async () => (await statusDoPlayer(navegador)) === 'playing',
    10000,
    'o VLibras nao chegou a "playing" apos Menu > Tradutor > Traduzir — a traducao nao foi acionada'
  );

  const recusas = mensagensConsole.filter(contemRecusaDePolitica);
  assert.deepEqual(recusas, [],
    `a politica recusou algo ao usar o painel Tradutor: ${JSON.stringify(recusas)}`);
});
