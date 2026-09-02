/**
 * Publicações (RF04/RF33) — a Tarefa P2 do painel: a equipe escreve uma
 * notícia, publica, e ela aparece em /noticias.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE SESSÃO DE EQUIPE UTILIZÁVEL (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2): a conta foi criada no painel do Supabase, ninguém entrou e
 * `eh_equipe` não foi concedido. Então o caminho de quem É equipe — abrir a
 * lista, escrever, publicar de verdade — NÃO RODA, aqui nem em lugar nenhum,
 * e nenhum teste deste arquivo afirma nada sobre ele.
 *
 * O que sobra, e é mais do que parece, são cinco coisas:
 *
 *   1. AS DECISÕES PURAS, por unidade: o que conta como título válido, o que
 *      conta como identificador, o que o `?aviso=` da URL pode dizer de
 *      volta. Elas moram em compartilhado/validacao.ts e
 *      compartilhado/avisos-do-painel.ts justamente para caberem aqui — o
 *      mesmo motivo que fez a Tarefa P1 isolar
 *      compartilhado/permissao-de-equipe.ts.
 *   2. O QUE AS DUAS TELAS DESENHAM, renderizando os componentes com
 *      `react-dom/server` sem subir o Next. É a única forma de a lista do
 *      painel ter verificação antes de alguém conseguir entrar — e a lição
 *      que motiva isso é do próprio projeto: a home do painel antigo
 *      prometia seis telas inexistentes porque ninguém nunca a abriu.
 *   3. QUE AS SERVER ACTIONS NÃO ESQUEÇAM A GUARDA — varredura do
 *      código-fonte de acoes/publicacoes.ts. A varredura de
 *      testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5) e não passam por
 *      página nem por layout.
 *   4. A RECUSA, por HTTP: as duas rotas novas respondem 404 para anônimo e
 *      não vazam nada do painel no HTML servido.
 *   5. /noticias LENDO DO BANCO: no modo offline (`npm test`) a consulta não
 *      sai e a página serve o estado vazio — o mesmo comportamento de antes
 *      da tarefa, que é o que prova que a mudança não quebrou a página
 *      pública.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhuma linha foi gravada em
 * `public.publicacoes` por este código, em ambiente nenhum. A escrita
 * (insert/update), a `revalidatePath` e o caminho de sucesso das Actions só
 * podem ser exercitados com uma sessão de equipe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerPublicacao, validarPublicacao, lerAlternancia, ehIdentificador,
  LIMITE_TITULO, LIMITE_RESUMO, LIMITE_CORPO
} from '../compartilhado/validacao.ts';
import { avisoDaLista } from '../compartilhado/avisos-do-painel.ts';
import { ListaNoticias } from '../componentes/ListaNoticias.ts';
import { ListaPublicacoes } from '../componentes/ListaPublicacoes.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** Uma publicação de exemplo. NÃO é conteúdo da ONG — é dado de teste. */
function exemplo(mudancas = {}) {
  return {
    id: UUID,
    titulo: 'Oficina de percussão',
    resumo: 'Chamada curta.',
    corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
    publicado: false,
    publicado_em: null,
    criado_em: '2026-08-30T15:00:00.000Z',
    ...mudancas
  };
}

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('o formulário é lido campo a campo, e campo que não está na lista não existe', () => {
  const dados = formulario({
    titulo: 'Oficina', corpo: 'Texto', resumo: 'Resumo',
    // Os dois campos que uma requisição montada à mão tentaria injetar. Se
    // `lerPublicacao` espalhasse o FormData num objeto, eles chegariam ao
    // `insert` — e `publicado` no corpo da requisição é literalmente
    // "publicar sem apertar publicar".
    publicado: 'true',
    publicado_em: '2020-01-01T00:00:00.000Z'
  });

  assert.deepEqual(lerPublicacao(dados), {
    id: '', titulo: 'Oficina', resumo: 'Resumo', corpo: 'Texto',
    // Os três campos da imagem (pedido V1). `arquivo` é `null` porque o
    // FormData deste teste não tem o campo — e `FormData.get` devolve
    // null, não undefined. A distinção importa: `imagem_caminho` só é
    // gravado quando há arquivo NOVO ou `imagem_atual`.
    arquivo: null, imagem_alt: '', imagem_atual: ''
  });
});

test('título e texto são obrigatórios, e os dois erros voltam de uma vez', () => {
  const { valido, erros } = validarPublicacao(lerPublicacao(formulario({})));

  assert.equal(valido, false);
  assert.equal(erros.titulo, 'Escreva um título para a notícia.');
  assert.equal(erros.corpo, 'Escreva o texto da notícia.');
});

test('resumo é opcional — notícia sem resumo é válida', () => {
  const { valido, erros } = validarPublicacao(
    lerPublicacao(formulario({ titulo: 'Oficina', corpo: 'Texto' }))
  );

  assert.equal(valido, true, `recusou sem resumo: ${JSON.stringify(erros)}`);
});

test('espaço em branco não é título: "   " é recusado como vazio', () => {
  const { erros } = validarPublicacao(lerPublicacao(formulario({ titulo: '   ', corpo: 'x' })));
  assert.equal(erros.titulo, 'Escreva um título para a notícia.');
});

test('as quebras de linha do MEIO do texto sobrevivem ao trim — é o que separa os parágrafos', () => {
  const campos = lerPublicacao(formulario({ titulo: 'T', corpo: '\n\n  um\n\ndois  \n\n' }));
  assert.equal(campos.corpo, 'um\n\ndois');
});

test('cada campo tem teto de tamanho — a Action é endpoint público, e text no Postgres não tem', () => {
  const grande = (n) => 'a'.repeat(n + 1);

  const porTitulo = validarPublicacao(
    lerPublicacao(formulario({ titulo: grande(LIMITE_TITULO), corpo: 'x' }))
  );
  assert.match(porTitulo.erros.titulo, /passou de 160 caracteres/);

  const porResumo = validarPublicacao(
    lerPublicacao(formulario({ titulo: 'T', corpo: 'x', resumo: grande(LIMITE_RESUMO) }))
  );
  assert.match(porResumo.erros.resumo, /passou de 400 caracteres/);

  const porCorpo = validarPublicacao(
    lerPublicacao(formulario({ titulo: 'T', corpo: grande(LIMITE_CORPO) }))
  );
  assert.match(porCorpo.erros.corpo, /passou de 20000 caracteres/);
});

test('um File no lugar de um campo de texto não vira a string "[object File]"', () => {
  // A precaução 1 de compartilhado/validacao.ts, aplicada ao formulário de
  // notícia: `dados.get()` devolve `string | File | null`, e um
  // `String(...)` distraído gravaria "[object File]" no banco como se fosse
  // o texto da notícia.
  const dados = new FormData();
  dados.set('titulo', new File(['x'], 'foto.jpg'));
  dados.set('corpo', 'Texto de verdade.');

  assert.equal(lerPublicacao(dados).titulo, '');
  assert.equal(validarPublicacao(lerPublicacao(dados)).erros.titulo,
    'Escreva um título para a notícia.');
});

test('só uuid conta como identificador de notícia', () => {
  assert.equal(ehIdentificador(UUID), true);
  assert.equal(ehIdentificador(UUID.toUpperCase()), true);

  for (const invalido of ['', '1', 'abc', `${UUID}x`, `' or 1=1 --`, null, undefined, 42, {}]) {
    assert.equal(ehIdentificador(invalido), false,
      `${JSON.stringify(invalido)} não pode passar por identificador`);
  }
});

test('id com lixo dentro é recusado antes de chegar ao Postgres', () => {
  const { valido, erros } = validarPublicacao(
    lerPublicacao(formulario({ id: 'nao-e-uuid', titulo: 'T', corpo: 'x' }))
  );

  assert.equal(valido, false);
  assert.match(erros.id, /Não foi possível identificar/);
});

test('id vazio é notícia nova, não erro', () => {
  const { valido } = validarPublicacao(
    lerPublicacao(formulario({ id: '', titulo: 'T', corpo: 'x' }))
  );
  assert.equal(valido, true);
});

test('o botão de publicar só aceita as duas ações da lista fechada', () => {
  assert.deepEqual(lerAlternancia(formulario({ id: UUID, acao: 'publicar' })),
    { id: UUID, acao: 'publicar' });
  assert.deepEqual(lerAlternancia(formulario({ id: UUID, acao: 'despublicar' })),
    { id: UUID, acao: 'despublicar' });

  // Qualquer outra coisa vira null — e a Action, vendo null, não escreve
  // nada. Sem a lista fechada, um valor inesperado cairia num `else` e
  // viraria uma das duas ações em silêncio.
  for (const inventada of ['apagar', 'PUBLICAR', 'publicar ou nao', '', 'true']) {
    assert.equal(lerAlternancia(formulario({ id: UUID, acao: inventada })).acao, null,
      `"${inventada}" não pode virar uma ação`);
  }
});

test('o aviso da URL só escolhe uma frase nossa — nunca traz uma', () => {
  assert.equal(avisoDaLista('publicada').ok, true);
  assert.match(avisoDaLista('publicada').texto, /já aparece na página de notícias/);
  assert.equal(avisoDaLista('erro').ok, false);

  // Texto vindo de fora não pode aparecer dentro do painel da ONG.
  assert.equal(avisoDaLista('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDaLista('inventado'), null);
  assert.equal(avisoDaLista(undefined), null);
  // Array: é o que o Next entrega quando a URL traz `?aviso=a&aviso=b`.
  assert.equal(avisoDaLista(['publicada']), null);

  // Herdado do protótipo de Object — sem `Object.hasOwn`, isto devolveria
  // uma função em vez de null e a tela tentaria desenhá-la.
  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDaLista(herdado), null, `"${herdado}" veio do protótipo`);
  }
});

test('o aviso de "guardada" diz que a notícia AINDA NÃO está no site', () => {
  // A regra da tarefa — `publicado` começa false, nada vai ao ar por
  // acidente — só vale se a pessoa souber. Um "Notícia guardada!" seco faria
  // a equipe achar que publicou.
  assert.match(avisoDaLista('criada').texto, /ainda NÃO está no site/);
});

// =====================================================================
// 2. O que as telas desenham
// =====================================================================

const VAZIO_NOTICIAS = 'Ainda não publicamos nenhuma notícia por aqui.';

test('/noticias sem nada publicado mostra o estado vazio, e não uma lista em branco', () => {
  const html = renderToStaticMarkup(
    createElement(ListaNoticias, { publicacoes: [], mensagemVazio: VAZIO_NOTICIAS })
  );

  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, /Ainda não publicamos nenhuma notícia/);
});

test('uma notícia publicada vira um artigo com título, data e o texto em parágrafos', () => {
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ publicado: true, publicado_em: '2026-09-01T14:00:00.000Z' })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  // O TÍTULO VIROU LINK para a página da notícia (pedido V1: "pequenos
  // blocos, se a pessoa quiser ver a notícia ela clica em saber mais").
  assert.match(html,
    /<h2 class="atividade__titulo"><a class="atividade__link" href="\/noticias\/[^"]+">Oficina de percussão<\/a><\/h2>/);
  assert.match(html, /1 de setembro de 2026/);

  // O CORPO SAIU DA LISTA e foi para `app/noticias/[id]/page.tsx`. O bloco
  // mostra título, data, resumo e o botão — o que se lê para DECIDIR abrir.
  assert.doesNotMatch(html, /<p>Primeiro parágrafo\.<\/p>/,
    'o corpo voltou para a lista: o bloco deixa de ser pequeno e o "Saber mais" perde o sentido');
  assert.match(html, /href="\/noticias\/[^"]+"[^>]*>Saber mais/);

  assert.doesNotMatch(html, /estado--vazio/);
});

test('sem resumo, a lista mostra o PRIMEIRO PARÁGRAFO como chamada', () => {
  // Um bloco só com título e data seria um cartão oco: quem lê a lista não
  // teria como decidir se vale abrir. Com resumo, ele manda; sem resumo, a
  // primeira frase do texto faz o papel.
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ resumo: null, corpo: 'Primeiro parágrafo.\n\nSegundo parágrafo.' })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  assert.match(html, /<p class="noticia__previa">Primeiro parágrafo\.<\/p>/);
  assert.doesNotMatch(html, /Segundo parágrafo/,
    'a prévia trouxe o texto inteiro — ela é o PRIMEIRO parágrafo, não o corpo todo');
});

test('a linha em branco separa parágrafos — e só ela; uma quebra simples não parte o texto', () => {
  // A REGRA CONTINUA A MESMA, mas o que ela governa mudou de lugar: o
  // corpo saiu da lista. Ela é medida aqui pela PRÉVIA — que é o primeiro
  // parágrafo, e só existe se a divisão por linha em branco estiver certa.
  //
  // O corpo inteiro em parágrafos é medido em `app/noticias/[id]`, contra a
  // página renderizada, em testes/paginas.test.mjs.
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ resumo: null, corpo: 'uma linha\nainda a mesma\n\noutra' })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  assert.match(html, /<p class="noticia__previa">uma linha\nainda a mesma<\/p>/,
    'a quebra simples partiu o parágrafo: `\\n` sozinho não separa, só a linha em branco');
  assert.doesNotMatch(html, /<p class="noticia__previa">outra<\/p>/,
    'a prévia trouxe o segundo parágrafo — ela é só o primeiro');
});

test('o texto da notícia é escapado — o painel guarda texto puro, não HTML', () => {
  // Sem editor de texto rico (regra 7), o <textarea> aceita qualquer coisa.
  // Se isto virasse marcação, a página de notícias seria um jeito de injetar
  // HTML no site da ONG a partir do painel.
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ titulo: '<script>alert(1)</script>', corpo: '<b>negrito</b>' })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>negrito<\/b>/);
  assert.match(html, /&lt;script&gt;/);
});

test('notícia sem resumo não desenha parágrafo vazio; sem data não desenha <time> vazio', () => {
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ resumo: null, publicado_em: null })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  assert.doesNotMatch(html, /atividade__resumo/, 'desenhou a chamada sem ter chamada');
  assert.doesNotMatch(html, /<time/, 'desenhou a data sem ter data');
  assert.doesNotMatch(html, /Invalid Date/);
});

test('a data usa o fuso de São Paulo, não o do processo — foi defeito real do Bloco A', async () => {
  // Um evento das 21h de São Paulo é 00h do dia seguinte em UTC. Função da
  // Netlify roda em UTC: sem o fuso preso, a data impressa seria a de amanhã.
  const html = renderToStaticMarkup(createElement(ListaNoticias, {
    publicacoes: [exemplo({ publicado_em: '2026-09-02T00:30:00.000Z' })],
    mensagemVazio: VAZIO_NOTICIAS
  }));

  assert.match(html, /1 de setembro de 2026/,
    'a data saiu no fuso do processo — em UTC este instante já é dia 2');
});

/**
 * A TRAVA DA DUPLICAÇÃO DO FUSO.
 *
 * `FUSO_DA_ONG` existe duas vezes (componentes/ListaEventos.ts e
 * componentes/ListaNoticias.ts) porque esses arquivos são importados pelo
 * runtime nativo do Node, que não resolve o alias `@/...` do tsconfig nem
 * caminho relativo sem extensão — um módulo compartilhado quebraria os
 * testes que os medem. A duplicação é consciente e está escrita nos dois
 * arquivos; este teste é o que impede as duas cópias de divergirem em
 * silêncio, que é o único risco real dela.
 */
test('os dois componentes que imprimem data usam o MESMO fuso', async () => {
  const fusoDe = async (arquivo) => {
    const codigo = await readFile(fileURLToPath(new URL(arquivo, import.meta.url)), 'utf8');
    const achados = [...codigo.matchAll(/'(America\/[A-Za-z_]+)'/g)].map((m) => m[1]);
    assert.ok(achados.length > 0, `${arquivo} não declara fuso nenhum`);
    return new Set(achados);
  };

  const noticias = await fusoDe('../componentes/ListaNoticias.ts');
  const eventos = await fusoDe('../componentes/ListaEventos.ts');
  const painel = await fusoDe('../componentes/ListaPublicacoes.ts');

  for (const conjunto of [noticias, eventos, painel]) {
    assert.deepEqual([...conjunto], ['America/Sao_Paulo'],
      'um dos componentes usa mais de um fuso, ou um fuso diferente dos outros');
  }
});

test('a lista do painel diz por ESCRITO se cada notícia está no ar — não só por cor', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo({ id: UUID, titulo: 'Rascunho' }),
      exemplo({ id: '00000000-0000-4000-8000-000000000001', titulo: 'No site', publicado: true })],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  // Quem usa leitor de tela precisa OUVIR o estado; um contorno mais claro
  // não é anunciado.
  assert.match(html, />Rascunho</);
  assert.match(html, />No ar</);
});

test('o botão de cada item pede a ação OPOSTA ao estado atual', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo({ publicado: false })],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.match(html, /name="acao" value="publicar"/);
  assert.match(html, /Publicar/);

  const publicada = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo({ publicado: true })],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.match(publicada, /name="acao" value="despublicar"/);
  assert.match(publicada, /Tirar do ar/);
});

test('publicar/tirar do ar é um <form> com POST, não um botão com onClick — é o que funciona sem JavaScript', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo()],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.match(html, /<form[^>]*action="\/acao-de-teste"/,
    'o botão saiu de dentro de um <form> — sem script ele deixaria de funcionar, em silêncio');
  assert.match(html, /<button type="submit"/);
  assert.match(html, new RegExp(`name="id" value="${UUID}"`));
});

test('cada botão da lista carrega o nome da notícia para quem usa leitor de tela', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo({ titulo: 'Oficina de percussão' })],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  // "Editar", "Publicar" repetidos cinco vezes numa lista não dizem qual é
  // qual para quem navega saltando de link em link.
  const rotulos = [...html.matchAll(/class="apenas-leitor-de-tela"> ([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(rotulos, ['Oficina de percussão', 'Oficina de percussão']);
});

test('o link de editar leva o id na URL, escapado', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo()],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.match(html, new RegExp(`href="/admin/publicacoes/editar\\?id=${UUID}"`));
});

test('a lista do painel NÃO oferece apagar — decisão desta tarefa, e dita por escrito', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [exemplo()],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.doesNotMatch(html, /value="apagar"/);
  assert.doesNotMatch(html, />Apagar/);
  // Um botão que não existe e não é explicado vira busca frustrada.
  assert.match(html, /Não dá para apagar uma notícia por aqui/);
});

test('banco fora do ar no PAINEL diz que falhou — nunca "nenhuma notícia escrita ainda"', () => {
  // A diferença entre as duas telas, e o motivo de a camada de dados
  // devolver `Degradavel` aqui: em /noticias a lista vazia não machuca
  // ninguém; no painel, ela diria a quem acabou de escrever que o texto se
  // perdeu — e a reação natural é escrever tudo de novo.
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: true
  }));

  assert.match(html, /o banco de dados não respondeu/);
  assert.match(html, /Nada foi perdido/);
  assert.doesNotMatch(html, /Nenhuma notícia escrita ainda/);
});

test('painel sem nenhuma notícia escrita mostra o estado vazio, com o caminho para a primeira', () => {
  const html = renderToStaticMarkup(createElement(ListaPublicacoes, {
    publicacoes: [],
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/publicacoes/editar',
    degradou: false
  }));

  assert.match(html, /Nenhuma notícia escrita ainda/);
  assert.match(html, /nasce como rascunho/);
});

// =====================================================================
// 3. A trava das Server Actions: nenhuma sem guarda
// =====================================================================

/**
 * O código sem os comentários — mesma função (e mesmo motivo) de
 * testes/painel-guarda.test.mjs: sem isto a varredura lê o que o arquivo
 * EXPLICA sobre a guarda e conclui que ela existe.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function corpoDasActions() {
  const caminho = fileURLToPath(new URL('../acoes/publicacoes.ts', import.meta.url));
  const codigo = semComentarios(await readFile(caminho, 'utf8'));

  // Uma função exportada de um arquivo 'use server' É uma URL pública.
  const nomes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(nomes.length > 0, 'nenhuma Server Action encontrada — o teste não verificou nada');

  return nomes.map((nome) => {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    return { nome, corpo: codigo.slice(inicio, proxima === -1 ? undefined : proxima) };
  });
}

/**
 * A lição que a Tarefa P1 deixou escrita e que a varredura dela NÃO cobre.
 *
 * `testes/painel-guarda.test.mjs` exige `ehEquipe()` em toda página sob
 * `app/admin/`. Server Action não é página: o Next a publica numa URL
 * própria (spec §4.5), e qualquer pessoa pode chamá-la com qualquer corpo,
 * sem passar pela tela, sem navegador e sem JavaScript. Uma Action nova sem
 * guarda não quebraria teste nenhum antes deste.
 *
 * A verificação é sobre o CÓDIGO-FONTE, não sobre o comportamento, porque
 * sem sessão de equipe não há como chamar a Action autenticada e conferir de
 * fora. É uma trava grosseira — vê a chamada, não prova que ela decide
 * alguma coisa —, e mesmo grosseira é o que impede o esquecimento.
 */
test('toda Server Action de publicações chama ehEquipe() por conta própria', async () => {
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) {
      problemas.push(`${nome}: não chama ehEquipe()`);
    }
  }

  assert.deepEqual(
    problemas, [],
    'Server Action do painel sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto: uma Action é endpoint HTTP'
    + '\n  público e não passa por página nem por layout. Ver o cabeçalho de acoes/publicacoes.ts.'
  );
});

test('a Action que salva texto NUNCA escreve o campo `publicado` — publicar é outro botão', async () => {
  const actions = await corpoDasActions();
  const salvar = actions.find(({ nome }) => nome === 'salvarPublicacao');
  assert.ok(salvar, 'salvarPublicacao sumiu — este teste precisa ser revisto');

  // A regra da tarefa: `publicado` começa false e nada vai ao ar por
  // acidente. Ela vale porque a Action de texto não conhece a coluna — nem
  // para escrever `false`, que seria a porta para alguém "parametrizar"
  // depois.
  assert.doesNotMatch(salvar.corpo, /publicado/,
    'salvarPublicacao menciona `publicado`. Se isso virar um valor gravado, uma correção de '
    + 'vírgula passa a poder publicar uma notícia.');
});

test('nenhuma Action espalha o FormData num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

// =====================================================================
// 4. A recusa, contra o servidor de verdade
// =====================================================================

const ROTAS_NOVAS = ['/admin/publicacoes', '/admin/publicacoes/editar'];

test('as duas telas novas do painel respondem 404 para anônimo', async () => {
  for (const rota of ROTAS_NOVAS) {
    const resposta = await fetch(`${BASE}${rota}`, { redirect: 'manual' });
    assert.equal(resposta.status, 404,
      `${rota} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
  }
});

test('nada das telas de publicações vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tarefa.
  for (const rota of ROTAS_NOVAS) {
    const html = await fetch(`${BASE}${rota}`).then((resposta) => resposta.text());

    for (const marca of [
      'Escrever notícia', 'painel da equipe', 'publicacoes__', 'publicacao__titulo',
      'Guardar rascunho', 'Nenhuma notícia escrita ainda', 'Tirar do ar'
    ]) {
      assert.ok(!html.includes(marca),
        `a resposta de ${rota} servida a quem não é equipe contém "${marca}"`);
    }

    assert.match(html, /<title>Página não encontrada/,
      `${rota} não devolveu o 404 do projeto`);
  }
});

test('a tela de edição não conta nem se uma notícia existe: id inventado também é 404', async () => {
  const resposta = await fetch(`${BASE}/admin/publicacoes/editar?id=${UUID}`);
  assert.equal(resposta.status, 404);
});

// =====================================================================
// 5. /noticias lendo do banco
// =====================================================================

test('/noticias continua respondendo 200 e servindo o estado vazio (a tabela está vazia)', async () => {
  // No modo offline da suíte não há Supabase configurado: a consulta não sai,
  // `listarPublicadas()` devolve lista vazia e a página mostra o mesmo texto
  // de antes desta tarefa. É o que prova que ligar a página ao banco não
  // quebrou a página pública — o texto exato das duas frases é medido em
  // testes/paginas-vazias-a4.test.mjs, e o de paridade com o HTML original
  // em testes/paridade-texto.test.mjs.
  const resposta = await fetch(`${BASE}/noticias`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  assert.match(html, /<div id="lista-noticias">/,
    'o <div id="lista-noticias"> sumiu — é o id que testes/paridade-texto.test.mjs exclui da '
    + 'comparação com o HTML original; sem ele, cada notícia publicada quebraria aquele teste');
    // A PÁGINA PODE ESTAR CHEIA, e a partir de 02/09/2026 ela está: a equipe
  // percorreu o painel e publicou. O estado vazio só é cobrável quando a
  // lista de fato está vazia — o invariante das duas pontas ("ou vazio com
  // texto real, ou itens, nunca os dois") mora em
  // testes/paginas-vazias-a4.test.mjs, que é o lugar dele.
  //
  // O QUE ESTE TESTE MEDE CONTINUA VALENDO SEMPRE: a rota responde 200 e o
  // `<div id="lista-...">` continua no HTML — é ele que
  // testes/paridade-texto.test.mjs exclui da comparação com o original, e
  // sem ele cada item publicado quebraria aquele teste.
  if (!/class="estado estado--vazio"/.test(html)) return;
  assert.match(html, /class="estado estado--vazio"/);
});
