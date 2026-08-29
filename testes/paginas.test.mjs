/**
 * Verificações estruturais em todas as páginas públicas.
 *
 * Roda em Firefox headless contra o servidor da suíte inteira (URL_BASE),
 * como testes/navegador.test.mjs. Cada página nova entra na lista PAGINAS e
 * ganha toda a bateria de graça.
 *
 * Só as rotas já migradas para o Next entram aqui. As demais — projetos,
 * agenda, notícias, galeria, acervo, voluntariado, doar, contato, entrar —
 * ainda não existem no app novo; migram em tarefas futuras e voltam para
 * esta lista quando existirem.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const PAGINAS = [
  { arquivo: 'quem-somos',   chave: 'quem-somos' },
  // Privacidade nao e item do menu principal (o mesmo valia no site antigo:
  // <aac-header pagina-atual=""> em site/privacidade.html) — por isso
  // "cabecalho e rodape montam" nao exige aria-current="page" para ela.
  { arquivo: 'privacidade',  chave: 'privacidade', semItemDeMenu: true },
  { arquivo: 'para-escolas', chave: 'para-escolas' }
];

const BASE = process.env.URL_BASE;

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
        main: Boolean(document.querySelector('main#conteudo')),
        skip: Boolean(document.querySelector('.pular-para-conteudo')),
        idioma: document.documentElement.lang
      };
    `);

    assert.ok(estrutura.titulo.includes('Ateliê Afro Cultural'), 'título sem o nome da organização');
    assert.ok(estrutura.descricao.length > 30, 'meta description ausente ou curta');
    assert.equal(estrutura.h1, 1, 'a página precisa de exatamente um h1');
    assert.ok(estrutura.main, 'falta <main id="conteudo">');
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

// As duas suítes abaixo (catálogo de projetos e prova social) dependem de
// páginas ou de dados que esta tarefa não constrói:
//
// - /projetos ainda não existe no Next — migra na fase 2 (plano próprio,
//   ainda não escrito; ver "Ao terminar" em
//   docs/superpowers/plans/2026-08-28-migracao-nextjs-fundacao.md).
// - A prova social ("Na mídia" na home, "Onde já estivemos" em para-escolas)
//   depende de `listarClipping()`, que a Tarefa 10 cria em
//   `servidor/dados/conteudo.ts` — mas nenhuma página desta tarefa ainda o
//   consome. app/page.tsx segue mínimo (só h1) e o
//   <div id="lista-instituicoes"> de para-escolas fica vazio de propósito,
//   como no HTML de origem antes do script `prova-social.js` rodar.
//
// Reativar quando essas páginas existirem de fato — não antes, para não
// mascarar com um `skip` um teste que hoje falharia pelo motivo certo.
//
// test('projetos.html mostra as onze atividades', async () => {
//   await navegador.manage().window().setRect({ width: 1280, height: 900 });
//   await navegador.get(`${BASE}/projetos`);
//
//   // O catálogo carrega por fetch: espera o primeiro cartão aparecer.
//   await navegador.wait(async () =>
//     (await navegador.findElements(By.css('aac-card-atividade'))).length > 0, 5000);
//
//   const cartoes = await navegador.findElements(By.css('aac-card-atividade'));
//   assert.equal(cartoes.length, 11, 'o escopo lista 11 atividades');
// });
//
// test('as atividades sem sinopse não exibem bloco vazio', async () => {
//   await navegador.get(`${BASE}/projetos`);
//   await navegador.wait(async () =>
//     (await navegador.findElements(By.css('aac-card-atividade'))).length > 0, 5000);
//
//   const vazios = await navegador.executeScript(`
//     return [...document.querySelectorAll('.atividade')]
//       .filter((a) => [...a.querySelectorAll('p')].some((p) => p.textContent.trim() === ''))
//       .map((a) => a.id);
//   `);
//   assert.deepEqual(vazios, [], 'atividades com parágrafo vazio');
// });
//
// test('a prova social carrega na home e em para-escolas', async () => {
//   for (const [rota, seletor] of [['', '#lista-midia'], ['para-escolas', '#lista-instituicoes']]) {
//     await navegador.get(`${BASE}/${rota}`);
//     await navegador.wait(async () =>
//       (await navegador.findElements(By.css(`${seletor} .clipping__item`))).length > 0, 5000,
//       `a prova social não carregou em ${rota || 'home'}`);
//
//     const itens = await navegador.findElements(By.css(`${seletor} .clipping__item`));
//     assert.ok(itens.length >= 3, `${rota || 'home'}: só ${itens.length} registros`);
//   }
// });

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
