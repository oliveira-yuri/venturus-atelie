/**
 * A rota que nao existe e um destino de verdade, nao um beco.
 *
 * Nove dos onze itens do menu principal ainda nao migraram (ver
 * ROTAS_PENDENTES em testes/links-menu.test.mjs): ate a fase 2, clicar em
 * "Projetos", "Agenda", "Notícias", "Galeria", "Acervo", "Voluntariado",
 * "Doar", "Contato" ou "Entrar" leva a pessoa ao 404. Ou seja: a pagina de
 * erro e, hoje, o segundo destino mais visitado do site.
 *
 * Medido ao vivo antes desta correcao, num clique real em "Projetos" (sem
 * recarga): document.title continuava "Ateliê Afro Cultural", o foco ficava
 * no BODY, a regiao aria-live vinha vazia, nao havia <main id="conteudo">
 * (o link "Pular para o conteúdo" apontava para nada), o <h1> era "404" com
 * `style="font-size:24px"` — px inline, imune ao controle A+, que e
 * requisito da ONG —, e o documento declarava lang="pt-BR" servindo texto em
 * ingles, com DOIS <title>. Tudo isso vinha da pagina 404 padrao do Next,
 * que app/not-found.tsx substitui.
 *
 * Este arquivo mede o 404 com o mesmo criterio das outras rotas: as regras
 * de estrutura da pagina (como testes/paginas.test.mjs) e o comportamento na
 * navegacao do roteador (como testes/foco-navegacao.test.mjs).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Uma rota do menu que ainda nao migrou. Se /projetos migrar na fase 2,
// trocar por outra de ROTAS_PENDENTES (testes/links-menu.test.mjs) — o
// primeiro teste abaixo falha alto se esta rota passar a responder 200,
// justamente para ninguem descobrir tarde que este arquivo parou de medir
// o 404.
const ROTA_PENDENTE = '/projetos';

let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

test('a rota escolhida para medir o 404 realmente ainda nao existe', async () => {
  const resposta = await fetch(`${BASE}${ROTA_PENDENTE}`);
  assert.equal(
    resposta.status, 404,
    `${ROTA_PENDENTE} respondeu ${resposta.status}: se migrou, apontar este arquivo para outra rota pendente`
  );
});

test('o HTML do 404 segue as regras do projeto', async () => {
  const html = await fetch(`${BASE}${ROTA_PENDENTE}`).then((r) => r.text());

  assert.match(html, /<main[^>]+id="conteudo"/,
    'sem <main id="conteudo">, o link "Pular para o conteúdo" do layout aponta para lugar nenhum');
  assert.match(html, /<h1[^>]*>/, 'a pagina de erro precisa de um <h1> de verdade');

  const titulos = html.match(/<title[^>]*>/g) || [];
  assert.equal(titulos.length, 1, `o documento entregou ${titulos.length} <title>`);

  assert.doesNotMatch(html, /font-size:\s*\d+px/i,
    'font-size inline em px ignora o controle A+ (regra 8 do CLAUDE.md)');

  // lang="pt-BR" vem do layout raiz e nao muda: o conteudo e que precisa
  // acompanhar. "could not be found" e a frase da pagina padrao do Next.
  assert.doesNotMatch(html, /could not be found|This page/i,
    'a pagina de erro esta em ingles dentro de um documento lang="pt-BR"');
});

test('o 404 oferece um caminho de volta', async () => {
  const html = await fetch(`${BASE}${ROTA_PENDENTE}`).then((r) => r.text());
  const dentroDoMain = html.match(/<main[\s\S]*?<\/main>/)?.[0] || '';
  assert.match(dentroDoMain, /href="\/"/,
    'quem cai no 404 precisa de um link de volta dentro do conteudo principal');
});

test('clicar no menu para uma rota pendente entrega o 404 com titulo proprio e a pagina inteira recarregada', async () => {
  // MEDIDO, nao suposto: o roteador do Next NAO renderiza no cliente uma rota
  // que nao existe no app — ele cai para navegacao de documento inteiro
  // (comprovado abaixo pela marca que some do window). Isso muda o que se
  // pode exigir aqui, e a mudanca e a favor da acessibilidade: numa carga de
  // pagina inteira o proprio navegador reposiciona o foco no topo do
  // documento e o leitor de tela anuncia o titulo novo — que e exatamente o
  // comportamento que componentes/FocoNaNavegacao.tsx existe para IMITAR nas
  // navegacoes parciais. Exigir foco no h1 e regiao aria-live preenchida aqui
  // seria exigir que a correcao de um problema que nao existe neste caminho.
  //
  // O que sobrou de defeito real, e que este teste guarda:
  //   - o titulo precisa MUDAR. Antes nao mudava: a pagina 404 padrao do Next
  //     acrescentava um SEGUNDO <title> depois do titulo do layout raiz, e o
  //     navegador usa o primeiro — document.title continuava "Ateliê Afro
  //     Cultural". app/not-found.tsx tem `metadata` proprio e um <title> so.
  //   - `recarregou` e afirmado de proposito: se um Next futuro passar a
  //     renderizar o 404 pelo roteador, sem recarga, este assert quebra e
  //     obriga a revisitar foco e anuncio neste caminho — em vez de a
  //     regressao passar despercebida.
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);
  const tituloAntes = await navegador.getTitle();
  await navegador.executeScript('window.__marcaDaPaginaAnterior = 1;');

  await navegador.findElement(By.css(`#menu-principal a[href="${ROTA_PENDENTE}"]`)).click();
  await navegador.sleep(900);

  const depois = await navegador.executeScript(`return {
    recarregou: typeof window.__marcaDaPaginaAnterior === 'undefined',
    titulo: document.title,
    temMain: Boolean(document.querySelector('main#conteudo')),
    h1: document.querySelector('main h1')?.textContent?.trim() ?? null,
    foco: document.activeElement.tagName
  }`);

  assert.ok(depois.temMain, 'a rota pendente nao entregou <main id="conteudo">');
  assert.equal(depois.h1, 'Página não encontrada', `o h1 do 404 veio como "${depois.h1}"`);
  assert.notEqual(depois.titulo, tituloAntes,
    'o titulo do documento nao mudou ao cair no 404 — era assim com os dois <title> da pagina padrao do Next');
  assert.equal(depois.recarregou, true,
    'o Next passou a resolver a rota inexistente pelo roteador, sem recarga: '
    + 'agora foco e anuncio dependem de FocoNaNavegacao tambem neste caminho — revisar');
  assert.equal(depois.foco, 'BODY',
    'numa carga de pagina inteira o foco deveria estar no topo do documento');
});

test('sem `main h1` na pagina nova, a regiao aria-live ainda anuncia — usando o titulo do documento', async () => {
  // Este e o furo que a revisao final apontou em componentes/
  // FocoNaNavegacao.tsx: o comentario dizia que a regiao aria-live "serve de
  // rede quando a pagina nao tiver main h1", e o codigo fazia `if (!titulo)
  // return;` ANTES de preencher a regiao — os dois mecanismos morriam juntos
  // exatamente no caso nomeado.
  //
  // Provar isso exige uma rota SEM `main h1` alcancada por navegacao PARCIAL
  // do roteador. A rota inexistente nao serve (recarrega a pagina inteira,
  // teste acima) e toda pagina migrada tem h1 — de proposito. Entao a
  // ausencia e simulada no ponto exato onde o componente olha: Document
  // .prototype.querySelector devolve null so para 'main h1'. Nao e um mock do
  // componente; e o codigo de producao rodando de verdade, num DOM onde o
  // elemento que ele procura nao aparece — que e o que acontecera na fase 2
  // assim que uma rota renderizar sem h1 (um error.tsx, um notFound() de
  // dentro de um segmento existente).
  await navegador.get(`${BASE}/`);
  await navegador.sleep(500);

  await navegador.executeScript(`
    const original = Document.prototype.querySelector;
    Document.prototype.querySelector = function (seletor) {
      return seletor === 'main h1' ? null : original.call(this, seletor);
    };
    window.__pegarAriaLive = () => original.call(document, '[aria-live="polite"]');
  `);

  await navegador.findElement(By.css('#menu-principal a[href="/quem-somos"]')).click();
  await navegador.sleep(900);

  const depois = await navegador.executeScript(`return {
    foco: document.activeElement.tagName,
    anuncio: (window.__pegarAriaLive()?.textContent || '').trim(),
    titulo: document.title
  }`);

  assert.notEqual(depois.foco, 'H1',
    'a simulacao nao pegou: o componente ainda encontrou um main h1 para focar');
  assert.match(depois.anuncio, /Navegou para:/,
    `sem main h1 a regiao aria-live ficou muda, veio "${depois.anuncio}"`);
  assert.ok(depois.anuncio.includes(depois.titulo),
    `sem main h1 o anuncio deveria usar document.title ("${depois.titulo}"), veio "${depois.anuncio}"`);
});
