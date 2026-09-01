/**
 * A guarda do painel (RF33/RF34/RN05): quem não é equipe recebe 404, e a
 * dúvida também.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE SESSÃO UTILIZÁVEL neste projeto: a conta de equipe foi criada
 * no painel do Supabase em 31/08/2026, ninguém entrou ainda e `eh_equipe`
 * não foi concedido (CLAUDE.md, "O que trava hoje", itens 1 e 2). Toda
 * requisição que este arquivo faz é ANÔNIMA. Então o caminho de quem É
 * equipe — o painel desenhado, a home com os cartões, o cabeçalho com o
 * nome — não é medido aqui, e nenhum teste deste arquivo afirma nada sobre
 * ele.
 *
 * O que sobra é mais do que parece, e são três coisas diferentes:
 *
 *   1. O CAMINHO DA RECUSA, por HTTP: `/admin` responde 404 para anônimo, e
 *      o 404 é o do projeto — com layout inteiro, em português, com caminho
 *      de volta. Isso é medido de verdade, contra o servidor.
 *   2. A FALHA FECHADA, por unidade. Ela NÃO tem como ser medida por HTTP:
 *      sem sessão, `usuarioAtual()` devolve `null` e a consulta a `perfis`
 *      nem chega a sair — o ramo "a consulta falhou" é inalcançável de
 *      fora. Por isso a decisão mora numa função pura
 *      (compartilhado/permissao-de-equipe.ts) e é exercitada aqui desfecho
 *      a desfecho, inclusive o que o mundo real não produz sob demanda:
 *      resposta com `error` E com `data` dizendo `eh_equipe: true`.
 *   3. O NÃO-VAZAMENTO: nada do painel aparece na resposta servida a quem
 *      recebeu 404. Este é o teste que pegou um defeito REAL nesta tarefa,
 *      e por isso ele fica: com a guarda só no layout (a primeira versão),
 *      `/admin` respondia 404 **e** mandava a página inteira do painel
 *      dentro do payload de hidratação, em texto legível. O `notFound()`
 *      de um layout não impede a página filha de rodar nem de ser
 *      serializada — a guarda que vale é a da própria página. Ver o bloco
 *      medido em app/admin/layout.tsx.
 *   4. QUE NENHUMA TELA NOVA ESQUEÇA A GUARDA: uma varredura de
 *      `app/admin/**` exige a chamada a `ehEquipe()` em toda página. É o
 *      que impede o defeito acima de voltar pela mão de P2/P3/P4.
 *
 * POR QUE NÃO EXISTE UMA PORTA DE DIAGNÓSTICO AQUI, no espírito de
 * `DIAGNOSTICO_CABECALHO_COM_SESSAO` (app/layout.tsx, Tarefa 4 da
 * autenticação). Aquela porta muda UMA palavra do cabeçalho e não passa por
 * `usuarioAtual()`. Uma porta equivalente aqui seria de outra natureza: no
 * painel, "o que a tela desenha" É o painel inteiro, e as telas de P2/P3/P4
 * vão pendurar embaixo desta guarda nome, telefone e responsável de
 * crianças a partir de 10 anos. Uma variável de ambiente que abra o painel
 * é uma variável de ambiente que abre o painel — ligada por engano num
 * deploy, a RLS ainda protegeria o DADO (o cliente usa a sessão de quem
 * pede, e não existe chave de serviço neste projeto), mas a tela deixaria
 * de ser 404 para o mundo, que é justamente o que a decisão de responder
 * 404 protege. A Tarefa P1 preferiu ficar sem a medição do caminho feliz e
 * dizer isso em voz alta, aqui e no relatório.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { ehEquipeNaResposta } from '../compartilhado/permissao-de-equipe.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const ROTA_DO_PAINEL = '/admin';

// ---------------------------------------------------------------------
// 1. A decisão pura: falha fechada, desfecho a desfecho
// ---------------------------------------------------------------------

test('só é equipe quem tem a coluna eh_equipe valendo exatamente true', () => {
  assert.equal(ehEquipeNaResposta({ data: { eh_equipe: true }, error: null }), true);
});

test('eh_equipe false é o caso normal de quem tem conta e não é da equipe', () => {
  assert.equal(ehEquipeNaResposta({ data: { eh_equipe: false }, error: null }), false);
});

test('FALHA FECHADA: erro na consulta não é equipe, mesmo com data dizendo que é', () => {
  // O PostgREST pode devolver os dois preenchidos. Confiar no `data` neste
  // caso seria acreditar numa resposta que o próprio servidor marcou como
  // problemática — e o preço do engano, aqui, é abrir o painel.
  const resposta = { data: { eh_equipe: true }, error: { message: 'JWT expired', code: 'PGRST301' } };
  assert.equal(ehEquipeNaResposta(resposta), false);
});

test('FALHA FECHADA: banco fora do ar (erro, sem data) não é equipe', () => {
  assert.equal(
    ehEquipeNaResposta({ data: null, error: { message: 'fetch failed' } }),
    false,
    'esta é a inversão deliberada da política de servidor/dados/degradacao.ts: '
    + 'conteúdo público degrada para continuar no ar, o painel NÃO abre na dúvida'
  );
});

test('pessoa autenticada sem linha em perfis não é equipe (maybeSingle devolve data null, sem erro)', () => {
  // Acontece de verdade: conta criada à mão no painel do Supabase antes de
  // o trigger `criar_perfil()` existir — autenticada, sem perfil.
  assert.equal(ehEquipeNaResposta({ data: null, error: null }), false);
});

test('linha sem a coluna eh_equipe não é equipe', () => {
  assert.equal(ehEquipeNaResposta({ data: {}, error: null }), false);
});

test('valor verdadeiro que não é o booleano true não promove ninguém', () => {
  // 'false' é uma string, e toda string não vazia é verdadeira em
  // JavaScript. Um `if (linha.eh_equipe)` promoveria a pessoa aqui.
  for (const valor of ['true', 'false', 1, 'sim', {}, []]) {
    assert.equal(
      ehEquipeNaResposta({ data: { eh_equipe: valor }, error: null }), false,
      `eh_equipe: ${JSON.stringify(valor)} não pode valer como true`
    );
  }
});

// ---------------------------------------------------------------------
// 2. O caminho da recusa, contra o servidor de verdade
// ---------------------------------------------------------------------

test('anônimo em /admin recebe 404 — e não um "acesso negado", que contaria que o painel existe', async () => {
  const resposta = await fetch(`${BASE}${ROTA_DO_PAINEL}`, { redirect: 'manual' });

  assert.equal(
    resposta.status, 404,
    `/admin respondeu ${resposta.status} para requisição anônima — a guarda de `
    + 'app/admin/layout.tsx deixou de fechar'
  );
});

/**
 * O QUE O 404 DE `notFound()` ENTREGA, MEDIDO — e por que este teste não
 * exige `<main id="conteudo">` no HTML servido, como o de
 * testes/rota-inexistente.test.mjs exige.
 *
 * MEDIDO em 31/08/2026 (Next 16.3.3, `next build` + `next start`), nas
 * TRÊS formas: `notFound()` no layout, `notFound()` na página, e com um
 * `not-found.tsx` local dentro de `app/admin/`. As três respondem 404 com
 * o `<body>` VAZIO — só `<div hidden>` e scripts —, com o conteúdo do 404
 * apenas no payload de hidratação. Cabeçalho, rodapé e `<main>` aparecem
 * DEPOIS de hidratar; sem JavaScript, tela branca.
 *
 * Não é o mesmo caminho de um endereço inexistente: `/rota-que-nao-existe`
 * continua chegando com a página inteira no HTML, porque ali o Next
 * RENDERIZA a rota `/_not-found` em vez de tratar uma exceção no meio da
 * renderização. É a mesma família do defeito que o CLAUDE.md registra no
 * item 0f sobre `app/error.tsx`.
 *
 * Então este arquivo mede o que é verdade: o 404 é o do PROJETO (não o
 * padrão do Next, em inglês) e chega inteiro para quem tem JavaScript. A
 * ausência sem JavaScript está registrada no CLAUDE.md, não escondida
 * atrás de um teste que afirmasse o contrário.
 */
test('o 404 do painel é o do projeto, em português — não a página padrão do Next', async () => {
  const resposta = await fetch(`${BASE}${ROTA_DO_PAINEL}`);
  const html = await resposta.text();

  // O `<title>` do documento, e NÃO "a resposta contém o texto do 404":
  // MEDIDO na rodada de prova desta tarefa (quebrando a guarda de
  // propósito), o conteúdo de app/not-found.tsx viaja no payload de
  // TODA página, como slot do roteador — um teste que procurasse a frase
  // no corpo passaria até com o painel aberto, ou seja, não mediria nada.
  assert.match(
    html, /<title>Página não encontrada/,
    'o documento não é o 404 do projeto (app/not-found.tsx)'
  );
  assert.doesNotMatch(html, /could not be found|This page/i,
    'página de erro em inglês dentro de um documento lang="pt-BR"');
});

test('nada do painel vaza no HTML de quem não é equipe', async () => {
  const html = await fetch(`${BASE}${ROTA_DO_PAINEL}`).then((resposta) => resposta.text());

  // O `notFound()` do layout acontece ANTES de a página existir, então
  // hoje nada disto poderia aparecer. O teste vale para amanhã: se alguém
  // trocar a guarda por uma que renderiza e esconde (um `hidden`, um
  // `display: none`, um "desabilite os botões"), o conteúdo passaria a
  // viajar no HTML e este teste é o que acusa. É a mesma lição de
  // componentes/MenuMovel.tsx e AbasEntrar.tsx, do outro lado: o que o
  // servidor manda, a pessoa tem.
  for (const marca of [
    'Painel da equipe', 'O que você quer fazer?',
    '/admin/publicacoes', '/admin/galeria', '/admin/atividades',
    'painel__telas'
  ]) {
    assert.ok(
      !html.includes(marca),
      `a resposta servida a quem não é equipe contém "${marca}".\n`
      + '  Foi exatamente isto que aconteceu na primeira versão desta tarefa, com a guarda\n'
      + '  só em app/admin/layout.tsx: 404 na frente e a página inteira do painel no payload\n'
      + '  de hidratação, atrás. A guarda que vale é a da própria página — ver o bloco\n'
      + '  medido no comentário do layout.'
    );
  }
});

/*
 * O QUE FICOU SEM TESTE AQUI, e por que não se inventou um:
 *
 *  · o `noindex` da PÁGINA do painel (o `robots` do metadata em
 *    app/admin/layout.tsx). Ele só sai no HTML quando a página é
 *    renderizada de verdade — para quem não é equipe o que responde é
 *    app/not-found.tsx, com o metadata do 404, não o do painel. Medir a
 *    resposta anônima aqui daria um teste que passa hoje pelo cabeçalho
 *    `X-Robots-Tag` da PRÉVIA (middleware.ts) e ficaria vermelho no dia do
 *    lançamento, quando aquele cabeçalho sair — falso alarme no pior dia
 *    possível. O que dá para medir sem sessão é o /robots.txt, e está
 *    medido em testes/noindex.test.mjs. O `test.todo` "o painel pede
 *    noindex na página real", em testes/painel.test.mjs, continua sendo o
 *    lugar dessa verificação;
 *  · toda a bateria de RNF08 (alvo de 44px, sem rolagem horizontal,
 *    navegação na zona do polegar) do mesmo arquivo: ela precisa da tela
 *    renderizada num navegador, e a tela exige sessão de equipe.
 */

// ---------------------------------------------------------------------
// 3. A trava para P2/P3/P4: nenhuma tela nova sem guarda
// ---------------------------------------------------------------------

const DIRETORIO_ADMIN = fileURLToPath(new URL('../app/admin/', import.meta.url));

/**
 * O código sem os comentários.
 *
 * Sem isto a varredura abaixo lê o que o arquivo EXPLICA sobre o defeito e
 * acusa o defeito — foi o que aconteceu na primeira rodada: o comentário de
 * app/admin/page.tsx cita `export const metadata` para contar por que ele
 * NÃO é usado, e o teste apontou justamente a página que está certa.
 *
 * Só bloco de comentário e linha que COMEÇA com duas barras: duas barras no
 * meio da linha podem ser o "https://" de uma URL dentro de uma string.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function paginasDoPainel(diretorio = DIRETORIO_ADMIN, prefixo = 'app/admin') {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  let encontradas = [];

  for (const entrada of entradas) {
    if (entrada.isDirectory()) {
      encontradas = encontradas.concat(
        await paginasDoPainel(join(diretorio, entrada.name), `${prefixo}/${entrada.name}`)
      );
    } else if (entrada.name === 'page.tsx') {
      encontradas.push({
        rotulo: `${prefixo}/page.tsx`,
        codigo: semComentarios(await readFile(join(diretorio, entrada.name), 'utf8'))
      });
    }
  }

  return encontradas;
}

/**
 * A LIÇÃO DESTA TAREFA, transformada em teste — e são DUAS medições
 * diferentes, por isso o teste cobra duas coisas de cada página.
 *
 * MEDIDO em 31/08/2026, requisição anônima a `/admin`, com `next build` +
 * `next start`:
 *
 *   · guarda SÓ no layout → 404, e a página inteira do painel no payload
 *     de hidratação, em texto legível. `notFound()` num layout não impede
 *     a página filha de rodar nem de ser serializada;
 *   · guarda SÓ no `generateMetadata` → 404, e o mesmo vazamento do corpo;
 *   · `export const metadata = { title: 'Painel da equipe — ...' }` com o
 *     corpo já protegido → 404 e corpo limpo, MAS a string "Painel da
 *     equipe" viajando no payload: o Next resolve o metadata por um
 *     caminho que não é a renderização do componente. Um título que
 *     escapa conta que o painel existe, que é o que a decisão de responder
 *     404 (em vez de "acesso negado") recusa contar.
 *
 * Daí as duas exigências: a guarda dentro do COMPONENTE (o que impede o
 * corpo de vazar) e o título vindo de um `generateMetadata` guardado — ou
 * de nenhum metadata, herdando o do layout.
 *
 * A verificação é sobre o CÓDIGO-FONTE, e não sobre o comportamento,
 * porque sem sessão de equipe não há como pedir a página autenticada e
 * conferir de fora. É uma trava grosseira — vê a chamada, não prova que
 * ela decide alguma coisa —, e mesmo grosseira pega os três casos acima,
 * que são os que de fato aconteceram nesta tarefa.
 */
test('toda página sob app/admin/ guarda o corpo E o título — o layout sozinho não protege (medido)', async () => {
  const paginas = await paginasDoPainel();

  assert.ok(paginas.length > 0, 'nenhuma page.tsx encontrada em app/admin/ — o teste não verificou nada');

  const guardado = (trecho) => /ehEquipe\s*\(\s*\)/.test(trecho) && /notFound\s*\(\s*\)/.test(trecho);

  const problemas = [];

  for (const { rotulo, codigo } of paginas) {
    const corte = codigo.indexOf('export default');
    assert.notEqual(corte, -1, `${rotulo} não tem \`export default\` — não é uma página`);

    const antesDoComponente = codigo.slice(0, corte);
    const componente = codigo.slice(corte);

    if (!guardado(componente)) {
      problemas.push(`${rotulo}: o COMPONENTE não começa com \`if (!await ehEquipe()) notFound();\``);
    }

    if (/export\s+const\s+metadata\s*=/.test(antesDoComponente)) {
      problemas.push(`${rotulo}: usa \`export const metadata\` — o título vaza no payload mesmo com o `
        + 'corpo protegido (medido). Trocar por `generateMetadata` com a mesma guarda');
    } else if (/generateMetadata/.test(antesDoComponente) && !guardado(antesDoComponente)) {
      problemas.push(`${rotulo}: o \`generateMetadata\` não passa por ehEquipe()/notFound()`);
    }
  }

  assert.deepEqual(
    problemas, [],
    'página do painel desprotegida:\n  ' + problemas.join('\n  ')
    + '\n  O layout NÃO cobre isto: com a guarda só lá, MEDIDO, a página filha renderiza do'
    + '\n  mesmo jeito e o conteúdo dela vai na resposta, atrás de um 404. Ver o comentário'
    + '\n  de app/admin/layout.tsx.'
  );
});

// ---------------------------------------------------------------------
// 4. O que a pessoa de fato vê ao cair no 404 do painel
// ---------------------------------------------------------------------

let navegador;

before(async () => {
  navegador = await new Builder().forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();
});

after(async () => { await navegador?.quit(); });

/**
 * COM JavaScript — e o "com" é a parte importante.
 *
 * O HTML servido vem com o `<body>` vazio (ver a medição acima): quem
 * enxerga a página de 404 do projeto é quem hidratou. Este teste mede
 * isso no navegador de verdade, que é o único lugar onde a diferença
 * aparece.
 *
 * O caso SEM JavaScript está declarado, não testado — testá-lo aqui seria
 * escrever um teste que exige tela branca, ou seja, um teste que passa a
 * defender o defeito. Ele está no CLAUDE.md, junto do item 0f, que
 * descreve a mesma família em app/error.tsx.
 */
test('quem cai no 404 do painel com JavaScript vê a página inteira do projeto', async () => {
  await navegador.manage().window().setRect({ width: 375, height: 720 });
  await navegador.get(`${BASE}${ROTA_DO_PAINEL}`);
  await navegador.wait(async () =>
    (await navegador.findElements(By.css('main#conteudo'))).length > 0, 8000);

  const tela = await navegador.executeScript(`return {
    h1: document.querySelector('main h1')?.textContent?.trim() ?? null,
    temMenu: Boolean(document.querySelector('#menu-principal')),
    temRodape: Boolean(document.querySelector('.rodape')),
    voltar: Boolean(document.querySelector('main a[href="/"]')),
    vazaPainel: document.body.textContent.includes('O que você quer fazer?')
  }`);

  assert.equal(tela.h1, 'Página não encontrada', `o h1 veio como "${tela.h1}"`);
  assert.ok(tela.temMenu, 'o cabeçalho não apareceu');
  assert.ok(tela.temRodape, 'o rodapé não apareceu');
  assert.ok(tela.voltar, 'sem caminho de volta dentro do conteúdo');
  assert.ok(!tela.vazaPainel, 'o painel apareceu na tela de quem não é equipe');
});
