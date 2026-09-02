/**
 * Verificações estruturais em todas as páginas públicas.
 *
 * Roda em Firefox headless contra o servidor da suíte inteira (URL_BASE),
 * como testes/navegador.test.mjs. Cada página nova entra na lista PAGINAS e
 * ganha toda a bateria de graça.
 *
 * Só as rotas já migradas para o Next entram aqui: a home (`/`), as três da
 * Tarefa A1, /projetos (Tarefa A3), agenda/notícias/galeria/acervo (Tarefa
 * A4), voluntariado/doar (Tarefa A5) e contato/entrar/recuperar-acesso
 * (Tarefa A6) — a fase 2 esgota o menu principal com esta tarefa.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  { arquivo: '',             chave: 'inicio' },
  { arquivo: 'quem-somos',   chave: 'quem-somos' },
  // Privacidade nao e item do menu principal (o mesmo valia no site antigo:
  // <aac-header pagina-atual=""> em site/privacidade.html) — por isso
  // "cabecalho e rodape montam" nao exige aria-current="page" para ela.
  { arquivo: 'privacidade',  chave: 'privacidade', semItemDeMenu: true },
  { arquivo: 'para-escolas', chave: 'para-escolas' },
  { arquivo: 'projetos',     chave: 'projetos' },
  // As quatro da Tarefa A4: conteúdo do estado vazio é provado à parte, de
  // verdade, em testes/paginas-vazias-a4.test.mjs — aqui elas só ganham a
  // bateria estrutural genérica (200, h1 único dentro do main, cabeçalho e
  // rodapé, alt em imagem, sem rolagem horizontal, sem linguagem
  // assistencialista) igual a qualquer página pronta.
  { arquivo: 'agenda',   chave: 'agenda' },
  { arquivo: 'noticias', chave: 'noticias' },
  { arquivo: 'galeria',  chave: 'galeria' },
  { arquivo: 'acervo',   chave: 'acervo' },
  // Tarefa A5: o conteúdo específico de cada uma (as cinco áreas reais em
  // voluntariado, a ausência de chave Pix em doar) é provado à parte, em
  // testes/pagina-voluntariado.test.mjs e testes/pagina-doar.test.mjs —
  // aqui elas só ganham a bateria estrutural genérica, igual às outras.
  { arquivo: 'voluntariado', chave: 'voluntariado' },
  { arquivo: 'doar',         chave: 'doar' },
  // Tarefa A6: contato (sem formulário — RF07 continua "falta", ver o
  // comentário de app/contato/page.tsx) e entrar (RF08–RF10, abas e campos
  // desabilitados, envio desligado até o Bloco B). Recuperar-acesso não é
  // item do menu (nunca foi, nem no site antigo) — não entra nesta lista,
  // mesma situação de privacidade abaixo.
  { arquivo: 'contato', chave: 'contato' },
  { arquivo: 'entrar',  chave: 'entrar' },
  // Recuperar-acesso não é item de menu (nunca foi, nem no site antigo —
  // só o link "Esqueci minha senha" de /entrar leva até ela), mas marca
  // "Entrar" como página atual, igual a /entrar — ver o `itemAtualEsperado`
  // no teste "cabeçalho e rodapé montam" abaixo.
  { arquivo: 'recuperar-acesso', chave: 'recuperar-acesso', semItemDeMenu: true, itemAtualEsperado: 'Entrar' }
];

// As 11 atividades reais (dados-iniciais/atividades.json, mesmo conteúdo
// que alimenta o seed do Supabase). "brasil-negreiro" é usada abaixo como
// atividade real sem `resumo` nem `descricao` — medido no arquivo, não
// suposto.
const ATIVIDADES_SEM_SINOPSE = ['brasil-negreiro', 'a-cabaca-e-o-canto-ancestral', 'eu-griot',
  'memoria-negra', 'batuque-na-cozinha'];

const BASE = process.env.URL_BASE || 'http://localhost:3123';

let navegador;

before(async () => {
  navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => {
  await navegador?.quit();
});

for (const pagina of PAGINAS) {
  test(`${pagina.chave}: estrutura semântica completa`, async () => {
    await navegador.manage().window().setRect({ width: 1280, height: 900 });
    await navegador.get(`${BASE}/${pagina.arquivo}`);

    const estrutura = await navegador.executeScript(`
      return {
        titulo: document.title,
        descricao: document.querySelector('meta[name="description"]')?.content || '',
        h1: document.querySelectorAll('h1').length,
        h1DentroDoMain: document.querySelectorAll('main#conteudo h1').length,
        main: Boolean(document.querySelector('main#conteudo')),
        skip: Boolean(document.querySelector('.pular-para-conteudo')),
        idioma: document.documentElement.lang
      };
    `);

    assert.ok(estrutura.titulo.includes('Ateliê Afro Cultural'), 'título sem o nome da organização');
    assert.ok(estrutura.descricao.length > 30, 'meta description ausente ou curta');
    assert.equal(estrutura.h1, 1, 'a página precisa de exatamente um h1');
    assert.ok(estrutura.main, 'falta <main id="conteudo">');
    // As duas asserções acima, isoladas, não pegam um h1 fora do <main>: um
    // h1 solto no <body> e um <main> sem h1 nenhum passariam nas duas juntas
    // (achado da rodada de correção 1 da Tarefa 7 — FocoNaNavegacao.tsx
    // procura "main h1", e um h1 fora do main faz o foco na navegação
    // quebrar em silêncio, sem que este teste percebesse). Por isso a
    // asserção junta os dois seletores num só.
    assert.equal(estrutura.h1DentroDoMain, 1, 'o h1 precisa estar dentro de <main id="conteudo">');
    assert.ok(estrutura.skip, 'falta o link de pular para o conteúdo');
    assert.equal(estrutura.idioma, 'pt-BR');
  });

  test(`${pagina.chave}: cabeçalho e rodapé montam`, async () => {
    await navegador.get(`${BASE}/${pagina.arquivo}`);

    const montou = await navegador.executeScript(`
      return {
        menu: Boolean(document.querySelector('#menu-principal')),
        atual: document.querySelector('[aria-current="page"]')?.textContent.trim() || null,
        contatos: document.querySelectorAll('.af-footer__links a').length,
        acessibilidade: document.querySelectorAll('.af-a11y button').length
      };
    `);

    assert.ok(montou.menu, 'o menu não montou');
    if (!pagina.semItemDeMenu) {
      assert.ok(montou.atual, 'nenhum item marcado como página atual');
    } else if (pagina.itemAtualEsperado) {
      // Tarefa A6: /recuperar-acesso não é item de menu, mas marca "Entrar"
      // como atual — mesmo comportamento de site/assets/js/componentes/
      // aac-header.js, que tratava entrar.html e recuperar-acesso.html como
      // a mesma "página atual" (ver o comentário de componentes/
      // Cabecalho.tsx). Sem este ramo, o `else` abaixo (herdado da Tarefa
      // A1, escrito só pensando em /privacidade) acusaria falso positivo
      // aqui.
      assert.equal(montou.atual, pagina.itemAtualEsperado,
        `${pagina.chave}: esperava "${pagina.itemAtualEsperado}" marcado como página atual`);
    } else {
      assert.equal(montou.atual, null, `${pagina.chave} não deveria ter item de menu marcado como atual`);
    }
    assert.ok(montou.contatos >= 5, 'o rodapé precisa dos cinco contatos do RF06');
    assert.equal(montou.acessibilidade, 4, 'faltam controles de acessibilidade');
  });

  test(`${pagina.chave}: toda imagem tem alt`, async () => {
    await navegador.get(`${BASE}/${pagina.arquivo}`);
    const semAlt = await navegador.executeScript(`
      return [...document.querySelectorAll('img')]
        .filter((i) => !i.hasAttribute('alt'))
        .map((i) => i.src);
    `);
    assert.deepEqual(semAlt, [], 'imagens sem alt');
  });

  test(`${pagina.chave}: sem rolagem horizontal em 375px`, async () => {
    await navegador.manage().window().setRect({ width: 375, height: 720 });
    await navegador.get(`${BASE}/${pagina.arquivo}`);
    const excesso = await navegador.executeScript(
      'return document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );
    assert.ok(excesso <= 0, `vaza ${excesso}px na horizontal`);
  });
}

// Os dois `test.todo` da Tarefa 9 (histórico no git) reativados pela
// Tarefa A3, agora que /projetos existe de verdade. O corpo abaixo não é
// o mesmo daquele commit: aquela versão falava com o site estático antigo
// (aac-card-atividade.js, custom element); esta fala com a página Next
// renderizada no servidor (componentes/CardAtividade.ts), sem esperar
// nenhum fetch no navegador — o servidor já entrega os cartões prontos.
test('projetos: mostra as onze atividades do catálogo', async () => {
  await navegador.get(`${BASE}/projetos`);
  const cartoes = await navegador.findElements(By.css('#lista-atividades .atividade'));
  assert.equal(cartoes.length, 11, `catálogo veio com ${cartoes.length} atividades, esperado 11`);
});

test('projetos: atividade sem sinopse não exibe parágrafo vazio (regra 2 do CLAUDE.md por campo)', async () => {
  await navegador.get(`${BASE}/projetos`);

  for (const id of ATIVIDADES_SEM_SINOPSE) {
    const artigo = await navegador.findElement(By.css(`#${id}`));

    const semResumo = await artigo.findElements(By.css('.atividade__resumo'));
    assert.equal(semResumo.length, 0,
      `${id}: não tem resumo no JSON, mas renderizou .atividade__resumo (vazio ou não)`);

    // Nenhum <p> vazio deveria sobrar no lugar da sinopse ausente — nem com
    // classe, nem solto.
    const paragrafosVazios = await artigo.findElements(By.xpath(".//p[not(normalize-space())]"));
    assert.equal(paragrafosVazios.length, 0, `${id}: sobrou parágrafo vazio dentro do cartão`);
  }
});

// A terceira suíte prometida pelo bloco de todo acima (Tarefa 9) era "a
// prova social carrega na HOME e em para-escolas". A metade de
// /para-escolas já tinha teste próprio antes desta tarefa
// (testes/pagina-para-escolas.test.mjs); a Tarefa A2 fecha a outra metade —
// a home passa a consumir listarClipping() para "Na mídia"
// (componentes/SecaoNaMidia.ts) — e reativa este teste em vez de deixá-lo
// como `todo`.
//
// Diferença do corpo original (histórico do git, commit da Tarefa 9): a
// versão antiga usava navegador.wait() porque o site estático antigo
// preenchia #lista-midia no CLIENTE, depois da carga
// (assets/js/paginas/prova-social.js). Desde a Tarefa A2 o servidor já
// entrega os itens prontos no HTML — não há fetch nenhum no navegador para
// esperar, então basta ler o DOM assim que a página carrega.
test('a prova social ("Na mídia") carrega na home, com pelo menos 3 registros reais', async () => {
  await navegador.get(`${BASE}/`);
  const itens = await navegador.findElements(By.css('#na-midia .af-media__item'));
  assert.ok(itens.length >= 3, `home: só ${itens.length} registros de mídia (esperado >= 3)`);
});

test('nenhum texto escapa da caixa que o contém', async () => {
  // O CSS pode ser escrito para uma estrutura de HTML que não é a que existe.
  // Foi o que aconteceu com os cartões da home: o preenchimento ficou no link
  // do título, e o parágrafo encostou na borda, saindo do cartão.
  const escapando = [];

  for (const pagina of PAGINAS) {
    await navegador.manage().window().setRect({ width: 1280, height: 900 });
    await navegador.get(`${BASE}/${pagina.arquivo}`);
    await navegador.sleep(400);

    const fugitivos = await navegador.executeScript(`
      const caixas = document.querySelectorAll(
        '.caminho, .setor, .setor__corpo, .atividade, .clipping__item, .af-media__item, ' +
        '.aviso, .af-card--hero, .estado');
      const falhas = [];

      for (const caixa of caixas) {
        const limite = caixa.getBoundingClientRect();
        for (const filho of caixa.querySelectorAll('p, h2, h3, dl, ul')) {
          const c = filho.getBoundingClientRect();
          if (c.width === 0) continue;
          // Meio pixel de folga para arredondamento do navegador.
          if (c.left < limite.left - 0.5 || c.right > limite.right + 0.5) {
            falhas.push(
              (caixa.className || caixa.tagName) + ' > ' + filho.tagName +
              ': ' + (filho.textContent || '').trim().slice(0, 30));
          }
        }
      }
      return falhas;
    `);

    fugitivos.forEach((f) => escapando.push(`${pagina.chave}: ${f}`));
  }

  assert.deepEqual(escapando, [], 'conteúdo saindo da caixa');
});

test('nenhuma página pública usa linguagem assistencialista', async () => {
  // Seção 3.1 do escopo: o Ateliê é organização de arte, cultura e identidade,
  // não de assistência social. Linguagem de caridade invalida a entrega.
  const proibidos = /crianças carentes|ajude uma criança|doe um sorriso|vidas salvas|apadrinhe|carência|coitad/i;

  for (const pagina of PAGINAS) {
    await navegador.get(`${BASE}/${pagina.arquivo}`);
    const texto = await navegador.executeScript('return document.body.innerText');
    assert.doesNotMatch(texto, proibidos, `linguagem assistencialista em ${pagina.chave}`);
  }
});
