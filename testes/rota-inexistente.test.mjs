/**
 * A rota que nao existe e um destino de verdade, nao um beco.
 *
 * Ate o restante da fase 2 migrar, clicar num item de menu ainda pendente
 * levava a pessoa ao 404 (ver ROTAS_PENDENTES em
 * testes/apoio/rotas-migracao.mjs — a Tarefa A6 zerou essa lista: o menu
 * principal terminou de migrar). A pagina de erro continua existindo — o
 * Next sempre pode cair nela por um link quebrado, um id de recurso que
 * nao existe mais, digitação errada — so deixou de ser, hoje, um destino
 * batido pelo menu.
 *
 * Medido ao vivo antes da correcao original, num clique real em "Projetos"
 * (sem recarga, quando ainda era rota pendente): document.title continuava
 * "Ateliê Afro Cultural", o foco ficava no BODY, a regiao aria-live vinha
 * vazia, nao havia <main id="conteudo"> (o link "Pular para o conteúdo"
 * apontava para nada), o <h1> era "404" com `style="font-size:24px"` — px
 * inline, imune ao controle A+, que e requisito da ONG —, e o documento
 * declarava lang="pt-BR" servindo texto em ingles, com DOIS <title>. Tudo
 * isso vinha da pagina 404 padrao do Next, que app/not-found.tsx substitui.
 *
 * Este arquivo mede o 404 com o mesmo criterio das outras rotas: as regras
 * de estrutura da pagina (como testes/paginas.test.mjs) e o comportamento na
 * navegacao do roteador (como testes/foco-navegacao.test.mjs).
 *
 * DUAS FONTES DE ROTA INEXISTENTE, PARA DUAS PERGUNTAS DIFERENTES —
 * distincao que faltava antes da Rodada de correção 1 da Tarefa A6, e que
 * apagou os tres primeiros testes deste arquivo em silencio quando
 * ROTAS_PENDENTES esvaziou:
 *
 *   - "o HTML do 404 obedece as regras do projeto?" (os tres primeiros
 *     testes) so precisa de QUALQUER caminho que devolva 404 — nao importa
 *     se esse caminho e um item de menu. ROTA_PARA_404_GENERICO cobre isso:
 *     usa a primeira entrada de ROTAS_PENDENTES enquanto ela existir, e cai
 *     para a constante fixa ROTA_INEXISTENTE quando a lista esvaziar. Estes
 *     tres testes NUNCA pulam.
 *   - "clicar num link real do MENU para uma rota pendente cai no 404 sem
 *     recarga quebrar foco/anuncio?" (o quarto teste) so faz sentido contra
 *     um href que de fato existe dentro de `#menu-principal` — inventar um
 *     href que nao esta no menu faria o `findElement` falhar por elemento
 *     ausente, motivo errado. Sem nenhuma rota pendente de menu, ESTE teste
 *     especifico pula sozinho (semRotaDeMenuPendente()), motivo visivel,
 *     sem arrastar os outros quatro junto — o defeito da versao anterior
 *     era o skip estar no describe() inteiro, quando so um teste dos cinco
 *     de fato dependia de ROTA_PENDENTE ser um link de menu.
 *
 * O quinto teste ("sem main h1...") nunca dependeu de ROTA_PENDENTE — usa
 * um clique fixo em "/quem-somos" para simular ausência de `main h1` — e
 * por isso nunca deveria ter ficado preso ao skip do describe() antigo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { ROTAS_PENDENTES } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const ROTA_PENDENTE = ROTAS_PENDENTES[0];

// Fallback fixo — nunca aponta para uma rota real (o primeiro teste abaixo
// confirma isso a cada rodada). Só serve aos testes que precisam de
// QUALQUER 404, não de um link de menu de verdade.
const ROTA_INEXISTENTE = '/rota-que-nao-existe';

const ROTA_PARA_404_GENERICO = ROTA_PENDENTE || ROTA_INEXISTENTE;

// SÍNCRONO e no topo do módulo, de propósito: o `skip` do test() que usa
// isto é avaliado antes de qualquer before()/teste assíncrono rodar — mesmo
// motivo de testes/pagina-para-escolas.test.mjs e testes/seguranca.test.mjs.
function semRotaDeMenuPendente() {
  return ROTA_PENDENTE
    ? false
    : 'ROTAS_PENDENTES (testes/apoio/rotas-migracao.mjs) esta vazia — nao ha mais link do MENU '
      + 'apontando para rota inexistente, entao nao ha como clicar um link REAL do menu para uma '
      + 'rota pendente (inventar um href que nao esta no menu faria o findElement falhar por '
      + 'elemento ausente, motivo errado). Os outros quatro testes deste arquivo nao dependem '
      + 'disso e continuam rodando — ver ROTA_PARA_404_GENERICO no topo do arquivo.';
}

let navegador;

describe('a rota pendente cai num 404 de verdade, nao num beco', () => {

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

test('a rota escolhida para medir o 404 realmente ainda nao existe', async () => {
  const resposta = await fetch(`${BASE}${ROTA_PARA_404_GENERICO}`);
  assert.equal(
    resposta.status, 404,
    `${ROTA_PARA_404_GENERICO} respondeu ${resposta.status}: se era ROTA_PENDENTE e migrou, `
    + 'ROTAS_PENDENTES ja deveria ter encolhido (ver testes/links.test.mjs); se era '
    + 'ROTA_INEXISTENTE, alguem criou essa rota de verdade — troque a constante'
  );
});

test('o HTML do 404 segue as regras do projeto', async () => {
  const html = await fetch(`${BASE}${ROTA_PARA_404_GENERICO}`).then((r) => r.text());

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
  const html = await fetch(`${BASE}${ROTA_PARA_404_GENERICO}`).then((r) => r.text());
  const dentroDoMain = html.match(/<main[\s\S]*?<\/main>/)?.[0] || '';
  assert.match(dentroDoMain, /href="\/"/,
    'quem cai no 404 precisa de um link de volta dentro do conteudo principal');
});

test('clicar no menu para uma rota pendente entrega o 404 com titulo proprio e a pagina inteira recarregada', { skip: semRotaDeMenuPendente() }, async () => {
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

});
