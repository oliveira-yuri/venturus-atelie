/**
 * RF30 — os números da home do painel.
 *
 * ===================================================================
 * DUAS COISAS SÃO GUARDADAS AQUI, E A SEGUNDA NÃO É TÉCNICA
 * ===================================================================
 *
 *  1. ZERO NÃO É TRAÇO. "0 mensagens esperando" é uma resposta — ninguém
 *     está esperando, pode fechar o celular. "Não deu para contar" é outra
 *     coisa, e desenhar zero nesse caso faria a equipe deixar de responder
 *     gente que está do outro lado. É a mesma lição do `degradou` de
 *     componentes/ListaContatos.ts, aplicada a um número;
 *
 *  2. REGRA 1 DO CLAUDE.md. O Ateliê é organização de arte, cultura e
 *     identidade do povo negro — não é ONG assistencialista. Um painel de
 *     indicadores é exatamente onde a estética errada entra sem ninguém
 *     perceber, porque chega vestida de gestão: "vidas impactadas",
 *     "crianças atendidas", um contador que sobe para comover quem olha.
 *     A varredura abaixo usa o mesmo vocabulário que
 *     testes/paginas.test.mjs recusa nas páginas públicas, e mais um pouco.
 *
 * ===================================================================
 * POR QUE ISTO NÃO É MEDIDO CONTRA A TELA SERVIDA
 * ===================================================================
 *
 * A home do painel responde 404 para quem não é equipe, e não existe conta
 * de equipe utilizável neste projeto (CLAUDE.md, "O que trava hoje", itens
 * 1 e 2). Então a seção é montada aqui com `react-dom/server`, como
 * testes/painel-inicio.test.mjs faz com a lista de telas — o componente é
 * `.ts` com `createElement` justamente para caber num teste do Node.
 *
 * O que NÃO se mede: os números de verdade, vindos do banco, com uma sessão
 * de equipe. Nenhum teste deste arquivo afirma nada sobre isso.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INDICADORES } from '../compartilhado/indicadores.ts';
import {
  PainelNumeros, SEM_NUMERO, AVISO_DE_CONTAGEM_FALHA,
  TITULO_DOS_NUMEROS, EXPLICACAO_DOS_NUMEROS
} from '../componentes/PainelNumeros.ts';
import { rotasReaisDoApp } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/** Um indicador de mentira, para os testes de desenho. */
function comNumero(quantidade, extras = {}) {
  return {
    chave: 'mensagens-esperando',
    rotulo: 'Mensagens esperando resposta',
    caminho: '/admin/contatos',
    semTela: null,
    quantidade,
    ...extras
  };
}

function renderizar(indicadores) {
  return renderToStaticMarkup(createElement(PainelNumeros, { indicadores }));
}

/**
 * O que está escrito em cada `.numeros__valor` — o algarismo, e nada mais.
 *
 * Procurar o traço no HTML inteiro daria falso positivo: a explicação da
 * seção tem um travessão dentro ("Contados no banco de dados neste
 * instante — não é total do mês"). Medido: a primeira versão deste arquivo
 * acusava "zero virou traço" por causa daquela frase.
 */
function algarismos(html) {
  return [...html.matchAll(/class="numeros__valor">([^<]*)</g)].map((achado) => achado[1]);
}

// ---------------------------------------------------------------------
// 1. Zero é resposta. Traço não é zero.
// ---------------------------------------------------------------------

test('zero é desenhado como número, não como traço nem como ausência', () => {
  const html = renderizar([comNumero(0)]);

  assert.deepEqual(algarismos(html), ['0'],
    'o zero sumiu da tela. Um `quantidade || "—"` faz exatamente isto, e é o defeito que este '
    + 'teste existe para pegar: "nenhuma mensagem esperando" é informação, não erro');
  assert.ok(!html.includes(AVISO_DE_CONTAGEM_FALHA), 'zero disparou o aviso de falha');
});

test('contagem que falhou vira traço E aviso — nunca um zero tranquilizador', () => {
  const html = renderizar([comNumero(null)]);

  assert.deepEqual(algarismos(html), [SEM_NUMERO],
    'a falha não virou traço — se virou "0", a equipe leria "ninguém está esperando" e '
    + 'fecharia o celular');
  assert.ok(html.includes(AVISO_DE_CONTAGEM_FALHA.slice(0, 40)),
    'o traço apareceu sem explicação nenhuma ao lado');
});

test('o aviso de falha aparece uma vez só, mesmo com vários traços', () => {
  const html = renderizar([
    comNumero(null),
    comNumero(null, { chave: 'noticias-rascunho', rotulo: 'Rascunhos', caminho: '/admin/publicacoes' }),
    comNumero(3, { chave: 'fotos-no-ar', rotulo: 'Fotos no ar', caminho: '/admin/galeria' })
  ]);

  const ocorrencias = (html.match(/painel__aviso/g) || []).length;
  assert.equal(ocorrencias, 1, `o aviso apareceu ${ocorrencias} vezes — é ruído repetido`);
});

// ---------------------------------------------------------------------
// 2. O que vira link, e o que não vira
// ---------------------------------------------------------------------

test('número com tela vira link, com o algarismo e o rótulo dentro do mesmo <a>', () => {
  const html = renderizar([comNumero(3)]);

  assert.match(html, /<a[^>]+href="\/admin\/contatos"/, 'o número não virou link para a tela');

  const dentroDoLink = html.match(/<a[^>]*>[\s\S]*?<\/a>/)[0];
  assert.ok(dentroDoLink.includes('3'), 'o algarismo ficou fora do alvo de toque');
  assert.ok(dentroDoLink.includes('Mensagens esperando resposta'),
    'o rótulo ficou fora do alvo — no celular o dedo precisaria acertar o algarismo (regra 4)');
});

test('número SEM tela não vira link, e diz por escrito onde se resolve', () => {
  const html = renderizar([comNumero(2, {
    chave: 'candidaturas-esperando',
    rotulo: 'Candidaturas de voluntariado sem resposta',
    caminho: null,
    semTela: 'Não existe tela para ler as candidaturas ainda.'
  })]);

  assert.doesNotMatch(html, /<a\b/,
    'um número sem tela virou link — é o beco que a home do painel antigo abriu seis vezes');
  assert.doesNotMatch(html, /href=/, 'sobrou um href apontando para tela inexistente');
  assert.ok(html.includes('Não existe tela para ler as candidaturas ainda.'),
    'o número ficou sem saída nenhuma escrita ao lado');
});

test('o item sem tela é marcado como largo, e o CSS conhece essa marca', async () => {
  // DEFEITO VISTO NA BANCADA (regra 10), com a suíte inteira verde: o item
  // sem tela ocupa a linha inteira da grade, então empurra o vizinho para a
  // linha seguinte e deixa um BURACO ao lado do item anterior — uma célula
  // vazia a 375px, duas a 1280px.
  //
  // A correção é a classe `--largo` no <li>, que o CSS usa duas vezes: nele
  // e no vizinho de antes. Ela NÃO pôde ser deduzida no CSS a partir do
  // conteúdo porque `:has()` não pode ser aninhado dentro de `:has()` — o
  // seletor fica inválido e não aplica nada, sem erro nenhum.
  const html = renderizar([
    comNumero(1),
    comNumero(2, { chave: 'candidaturas-esperando', caminho: null, semTela: 'Não há tela.' })
  ]);

  assert.match(html, /class="numeros__item numeros__item--largo"/,
    'o item sem tela perdeu a marca `--largo`: a grade volta a abrir um buraco');

  // SEM OS COMENTÁRIOS — a primeira versão deste teste acusava o próprio
  // comentário do CSS, que CITA o seletor inválido para contar por que ele
  // não é usado. É a mesma armadilha, e a mesma correção, de
  // testes/painel-guarda.test.mjs (`semComentarios`).
  const css = (await readFile(new URL('../estilos/admin.css', import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '');

  assert.match(css, /\.numeros__item--largo/, 'o CSS não conhece a marca `--largo`');
  assert.match(css, /\.numeros__item:has\(\+ \.numeros__item--largo\)/,
    'a regra do VIZINHO sumiu — é ela que fecha o buraco ao lado do item anterior');
  assert.doesNotMatch(css, /:has\([^)]*:has\(/,
    '`:has()` aninhado dentro de `:has()` é seletor inválido: não aplica nada e não avisa');
});

test('a seção diz o que os números são, e que são de AGORA', () => {
  const html = renderizar([comNumero(1)]);

  assert.ok(html.includes(TITULO_DOS_NUMEROS));
  assert.ok(html.includes(EXPLICACAO_DOS_NUMEROS.slice(0, 40)),
    'sem a explicação, a leitura natural é que o painel mostra o total do mês');
  // O título da seção é <h2>: a página já tem um <h1> ("Painel da equipe"),
  // e dois h1 quebram a estrutura de cabeçalhos para quem navega por eles.
  assert.match(html, /<h2[^>]*>/);
});

test('sem indicador nenhum a seção não é desenhada', () => {
  assert.equal(renderizar([]), '');
});

test('cada indicador vira um item da lista, na ordem em que veio', () => {
  const html = renderizar([
    comNumero(1),
    comNumero(2, { chave: 'fotos-no-ar', rotulo: 'Fotos no ar agora', caminho: '/admin/galeria' })
  ]);

  assert.equal((html.match(/<li[^>]*class="numeros__item"/g) || []).length, 2);
  assert.ok(html.indexOf('Mensagens esperando') < html.indexOf('Fotos no ar agora'),
    'a ordem foi perdida — ela é a decisão de quem vê o quê sem rolar, num celular');
});

// ---------------------------------------------------------------------
// 3. Regra 1: nenhum número conta pessoa como resultado
// ---------------------------------------------------------------------

test('nenhum rótulo usa linguagem assistencialista nem contador de "vidas"', () => {
  // A primeira metade é o mesmo padrão de testes/paginas.test.mjs (seção 3.1
  // do escopo). A segunda é o que um painel de ONG atrai de específico: o
  // número que existe para comover quem olha, não para a equipe trabalhar.
  const proibidos =
    /crianças carentes|ajude uma criança|doe um sorriso|vidas salvas|apadrinhe|carência|coitad/i;
  const contadorDeComover =
    /vidas (impactad|transformad|alcançad)|pessoas (impactad|beneficiad)|impacto social|sorris/i;

  for (const indicador of INDICADORES) {
    const texto = `${indicador.rotulo} ${indicador.semTela ?? ''}`;

    assert.doesNotMatch(texto, proibidos,
      `linguagem assistencialista no indicador "${indicador.chave}": ${indicador.rotulo}`);
    assert.doesNotMatch(texto, contadorDeComover,
      `o indicador "${indicador.chave}" conta pessoa como resultado. Regra 1 do CLAUDE.md: `
      + 'os números do painel servem para a equipe operar, não para comover doador');
  }
});

// ---------------------------------------------------------------------
// 4. As definições dizem a verdade sobre o que existe
// ---------------------------------------------------------------------

test('todo caminho de indicador aponta para uma rota que existe de verdade em app/', async () => {
  // A trava é a mesma de TELAS_DO_PAINEL, e pelo mesmo motivo: um link que
  // devolve 404 DENTRO do painel foi o defeito da home do site antigo.
  const reais = await rotasReaisDoApp();

  const quebrados = INDICADORES
    .filter((indicador) => indicador.caminho !== null && !reais.includes(indicador.caminho))
    .map((indicador) => `${indicador.chave} → ${indicador.caminho}`);

  assert.deepEqual(quebrados, [],
    'indicador apontando para rota que não existe:\n  ' + quebrados.join('\n  '));
});

test('quem não tem caminho tem explicação, e quem tem caminho não tem as duas coisas', () => {
  for (const indicador of INDICADORES) {
    if (indicador.caminho === null) {
      assert.ok(
        indicador.semTela && indicador.semTela.length > 0,
        `"${indicador.chave}" não tem tela e não diz o que fazer — um número sem saída é ruído`
      );
    } else {
      assert.equal(
        indicador.semTela, null,
        `"${indicador.chave}" tem tela E frase de "não existe tela": uma das duas está velha`
      );
    }
  }
});

/**
 * O TESTE QUE FALTAVA, e ele nasce de um defeito real.
 *
 * MEDIDO em 03/09/2026, ao capturar a home do painel com uma sessão de
 * equipe de verdade pela primeira vez: o indicador de candidaturas dizia
 * "não existe tela para ler as candidaturas ainda" — e a tela
 * (/admin/voluntarios, RF26) estava listada na MESMA PÁGINA, três cartões
 * acima.
 *
 * O teste vizinho ("quem não tem caminho tem explicação") não pegava
 * isso: ele exige que `caminho` e `semTela` não coexistam, e o estado
 * errado tinha `caminho: null` com `semTela` preenchido — combinação
 * legítima. O que envelheceu foi a AFIRMAÇÃO dentro da frase.
 *
 * É o item 0x do CLAUDE.md numa forma nova: afirmação sobre o que existe
 * HOJE envelhece. Aqui o invariante que não envelhece é mais simples —
 * todo número da home tem uma tela que o resolve.
 *
 * ESTE TESTE QUEBRA DE PROPÓSITO no dia em que alguém acrescentar um
 * indicador sem tela. Quebrar é o ponto: quem acrescentar precisa
 * escrever, no mesmo commit, por que aquele número é um beco aceitável —
 * e a home do painel antigo abriu seis becos desses.
 */
test('todo indicador tem uma tela que o resolve — nenhum número é beco', () => {
  const becos = INDICADORES
    .filter((indicador) => indicador.caminho === null)
    .map((indicador) => `${indicador.chave}: "${indicador.semTela}"`);

  assert.deepEqual(becos, [],
    'indicador sem tela que o resolva:\n  ' + becos.join('\n  ')
    + '\n  Se a tela realmente não existe, a frase de `semTela` precisa ser conferida CONTRA'
    + '\n  o que existe em app/ — foi assim que "não existe tela para ler as candidaturas"'
    + '\n  sobreviveu um dia depois de /admin/voluntarios entrar no ar.');
});

test('nenhuma chave de indicador se repete', () => {
  const chaves = INDICADORES.map((indicador) => indicador.chave);
  assert.equal(new Set(chaves).size, chaves.length, 'chave repetida em INDICADORES');
});

test('todo indicador declarado tem uma consulta do lado do servidor', async () => {
  // Sem esta reconciliação, uma chave nova aqui sairia na tela com um traço
  // permanente — e um traço é lido como "o banco não respondeu", não como
  // "ninguém escreveu a consulta".
  const codigo = await readFile(
    new URL('../servidor/dados/indicadores.ts', import.meta.url), 'utf8');

  for (const indicador of INDICADORES) {
    assert.match(
      codigo, new RegExp(`'${indicador.chave}'\\s*:`),
      `"${indicador.chave}" está em compartilhado/indicadores.ts e não tem consulta em `
      + 'servidor/dados/indicadores.ts'
    );
  }
});

test('a contagem usa `count` com `head`, e nunca traz linha para contar', async () => {
  const codigo = await readFile(
    new URL('../servidor/dados/indicadores.ts', import.meta.url), 'utf8');

  const consultas = codigo.match(/\.select\([^)]*\)/g) || [];
  assert.ok(consultas.length >= INDICADORES.length,
    'faltou consulta: uma por indicador');

  for (const consulta of consultas) {
    assert.match(consulta, /count:\s*'exact'/, `consulta sem count: ${consulta}`);
    assert.match(
      consulta, /head:\s*true/,
      `consulta sem head: ${consulta}\n`
      + '  Sem head:true o PostgREST manda as LINHAS — nome, telefone e texto de terceiro\n'
      + '  atravessando a rede para desenhar um algarismo, na página que a equipe abre do\n'
      + '  celular no meio de um evento.'
    );
  }
});

// ---------------------------------------------------------------------
// 5. Nada disso vaza para quem não é equipe
// ---------------------------------------------------------------------

test('nenhum número, rótulo ou marca da seção aparece no HTML servido a um anônimo', async () => {
  const html = await fetch(`${BASE}/admin`).then((resposta) => resposta.text());

  const marcas = [
    TITULO_DOS_NUMEROS, 'numeros__valor', 'painel__numeros', 'exportacoes__alvo',
    ...INDICADORES.map((indicador) => indicador.rotulo)
  ];

  for (const marca of marcas) {
    assert.ok(
      !html.includes(marca),
      `a resposta servida a quem não é equipe contém "${marca}".\n`
      + '  A guarda que vale é a da própria página: `notFound()` num layout não impede a\n'
      + '  página filha de renderizar e ser serializada no payload de hidratação (medido na\n'
      + '  Tarefa P1 — ver o comentário de app/admin/layout.tsx).'
    );
  }
});
