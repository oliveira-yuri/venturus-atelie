/**
 * Verificações estruturais em todas as páginas públicas.
 *
 * Roda em Firefox headless contra o servidor da suíte inteira (URL_BASE),
 * como testes/navegador.test.mjs. Cada página nova entra na lista PAGINAS e
 * ganha toda a bateria de graça.
 *
 * Só as rotas já migradas para o Next entram aqui: a home (`/`) e as três
 * desta tarefa. As outras nove do menu — projetos, agenda, notícias,
 * galeria, acervo, voluntariado, doar, contato, entrar — ainda não existem
 * no app novo; migram na fase 2 e voltam para esta lista quando existirem.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  { arquivo: '',             chave: 'inicio' },
  { arquivo: 'quem-somos',   chave: 'quem-somos' },
  // Privacidade nao e item do menu principal (o mesmo valia no site antigo:
  // <aac-header pagina-atual=""> em site/privacidade.html) — por isso
  // "cabecalho e rodape montam" nao exige aria-current="page" para ela.
  { arquivo: 'privacidade',  chave: 'privacidade', semItemDeMenu: true },
  { arquivo: 'para-escolas', chave: 'para-escolas' }
];

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
        contatos: document.querySelectorAll('.rodape__lista a').length,
        acessibilidade: document.querySelectorAll('.acessibilidade button').length
      };
    `);

    assert.ok(montou.menu, 'o menu não montou');
    if (!pagina.semItemDeMenu) {
      assert.ok(montou.atual, 'nenhum item marcado como página atual');
    } else {
      assert.equal(montou.atual, null, 'privacidade não deveria ter item de menu marcado como atual');
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

// As três suítes abaixo (catálogo de projetos e prova social) dependem de
// páginas ou de dados que esta tarefa não constrói:
//
// - /projetos ainda não existe no Next — migra na fase 2 (plano próprio,
//   ainda não escrito; ver "Ao terminar" em
//   docs/superpowers/plans/2026-08-28-migracao-nextjs-fundacao.md).
// - A prova social depende de `listarClipping()`
//   (`servidor/dados/conteudo.ts`). METADE disto já existe: "Onde já
//   estivemos" em /para-escolas consome a função de verdade e tem teste
//   próprio (testes/pagina-para-escolas.test.mjs, mais a procedência do dado
//   em testes/origem-dos-dados.test.mjs). O que falta é "Na mídia" na home:
//   app/page.tsx segue mínimo (só h1). O texto do `todo` abaixo diz
//   exatamente isso — na revisão final ele ainda prometia as duas metades, e
//   prometer o que já existe faz o relatório de `todo` valer menos.
//
// `test.todo` em vez de comentar o código: assim os três casos continuam
// contados (aparecem como `ℹ todo 3` em toda rodada) em vez de somem do
// relatório. O corpo de cada um — asserções e seletores — está no histórico
// do git (commit da Tarefa 9). Reativar quando as páginas existirem de
// fato — não antes, para não mascarar um teste que hoje falharia pelo
// motivo certo.
test.todo('projetos.html mostra as onze atividades — falta /projetos (fase 2, plano ainda não escrito)');
test.todo('as atividades sem sinopse não exibem bloco vazio — falta /projetos (fase 2)');
test.todo('a prova social carrega na HOME — /para-escolas já está coberta por testes/pagina-para-escolas.test.mjs; falta a home consumir listarClipping() para "Na mídia" (fase 2)');

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
        '.caminho, .setor, .atividade, .clipping__item, .aviso, .abertura__peca, .estado');
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
