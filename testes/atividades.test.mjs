/**
 * Atividades (RF03/RF33) — a Tarefa P4 do painel: a equipe corrige o texto
 * das 11 atividades reais, que aparecem em /projetos.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE SESSÃO DE EQUIPE UTILIZÁVEL (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2): a conta foi criada no painel do Supabase, ninguém entrou e
 * `eh_equipe` não foi concedido. Então **nenhuma correção é gravada** — aqui
 * nem em lugar nenhum —, e nenhum teste deste arquivo afirma nada sobre
 * isso.
 *
 * O que sobra, e é mais do que parece, são seis coisas:
 *
 *   1. AS DECISÕES PURAS: o que conta como identificador de atividade (que
 *      NÃO é uuid — a coluna é `text`), o que é obrigatório, o que o
 *      `?aviso=` da URL pode dizer de volta. Moram em
 *      compartilhado/validacao.ts e compartilhado/avisos-do-painel.ts
 *      justamente para caberem aqui.
 *   2. O QUE A LISTA DA EQUIPE DESENHA, renderizando o componente com
 *      `react-dom/server` sem subir o Next. É a única forma de a tela ter
 *      verificação antes de alguém conseguir entrar.
 *   3. QUE AS SERVER ACTIONS NÃO ESQUEÇAM A GUARDA — e que elas continuem
 *      sem `insert` e sem `delete`, que é a decisão da tarefa. A varredura
 *      de testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5).
 *   4. QUE A LEITURA DO PAINEL NÃO CAIA PARA O JSON VERSIONADO — a decisão
 *      que separa esta tela de /projetos, e a que o resto da tarefa
 *      pressupõe.
 *   5. A RECUSA, por HTTP: as duas rotas novas respondem 404 para anônimo,
 *      não vazam nada do painel no HTML servido, e um id de atividade REAL
 *      também é 404 (a tela não conta nem o que existe).
 *   6. /projetos INTACTA: continua servindo as 11 atividades do JSON no modo
 *      offline, com o carimbo de procedência. É o que prova que a tarefa não
 *      mexeu na página pública.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhuma linha de
 * `public.atividades` foi alterada por este código, em ambiente nenhum. O
 * `update`, o `.select('id')` que distingue "não achou linha" de "deu
 * certo", o `revalidatePath('/projetos')` e o caminho de sucesso das duas
 * Actions só podem ser exercitados com uma sessão de equipe. E a
 * DIVERGÊNCIA da fonte dupla, que é a armadilha desta tarefa, é por
 * construção impossível de observar sem essa sessão: ela começa a existir no
 * primeiro `update` bem-sucedido.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerAtividade, validarAtividade, ehIdentificadorDeAtividade, lerAlternancia,
  LIMITE_TITULO, LIMITE_RESUMO, LIMITE_DESCRICAO, LIMITE_FICHA
} from '../compartilhado/validacao.ts';
import { avisoDeAtividades } from '../compartilhado/avisos-do-painel.ts';
import { ListaAtividades } from '../componentes/ListaAtividades.ts';

/**
 * As 11 atividades reais, lidas do JSON versionado com readFile e não com
 * `import ... with { type: 'json' }`: o mesmo cuidado dos outros testes
 * deste projeto de não depender de nada além do runtime nativo do Node.
 */
const atividadesReais = JSON.parse(await readFile(
  fileURLToPath(new URL('../dados-iniciais/atividades.json', import.meta.url)), 'utf8'));

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * A suíte roda em três modos (ver ferramentas/rodar-testes.mjs). O único
 * teste deste arquivo que muda de expectativa entre eles é o de /projetos:
 * no modo offline a página cai para o JSON versionado, com credenciais ela
 * lê a tabela. Medir "veio do JSON" sempre daria um teste que quebra no
 * modo que exercita o banco de verdade — e é justamente esse modo que, a
 * partir desta tarefa, pode mostrar um texto DIFERENTE do JSON.
 */
const COM_CREDENCIAIS = process.env.COM_SUPABASE === '1';

/**
 * Um id de atividade de verdade. NÃO é conteúdo inventado: "banzo" é uma
 * das 11 atividades da ONG (dados-iniciais/atividades.json).
 */
const ID = 'banzo';

/**
 * Uma atividade de exemplo para renderizar o componente. O TEXTO É
 * FUNCIONAL, de teste — não é conteúdo institucional inventado sobre a ONG
 * (regra 2 do CLAUDE.md): o título é o nome real da atividade e o resto são
 * marcas curtas que só existem para o teste achar.
 */
function exemplo(mudancas = {}) {
  return {
    id: ID,
    titulo: 'Banzo',
    resumo: 'Resumo de teste.',
    descricao: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
    genero: null,
    duracao: null,
    elenco: null,
    classificacao: null,
    local: null,
    rider: null,
    publicado: true,
    ...mudancas
  };
}

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

function renderizarLista(props) {
  return renderToStaticMarkup(createElement(ListaAtividades, {
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/atividades/editar',
    degradou: false,
    ...props
  }));
}

/**
 * O código sem os comentários — mesma função (e mesmo motivo) de
 * testes/publicacoes.test.mjs e testes/painel-guarda.test.mjs: sem isto a
 * varredura lê o que o arquivo EXPLICA e conclui que o código faz.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function fonte(caminho) {
  return semComentarios(await readFile(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8'));
}

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('o formulário é lido campo a campo, e campo que não está na lista não existe', () => {
  const dados = formulario({
    id: ID, titulo: 'Banzo', resumo: 'R', descricao: 'D',
    genero: 'G', duracao: 'Du', elenco: 'E', classificacao: 'C', local: 'L', rider: 'Ri',
    // Os campos que uma requisição montada à mão tentaria injetar. `publicado`
    // aqui é pior que nas notícias: a coluna é `not null default true`, ou
    // seja, um `publicado=false` no corpo TIRARIA DO AR uma atividade que a
    // ONG tem publicada, por dentro do formulário de texto.
    publicado: 'false',
    criado_em: '2020-01-01T00:00:00.000Z'
  });

  assert.deepEqual(lerAtividade(dados), {
    id: ID, titulo: 'Banzo', resumo: 'R', descricao: 'D',
    genero: 'G', duracao: 'Du', elenco: 'E', classificacao: 'C', local: 'L', rider: 'Ri'
  });
});

test('só o nome da atividade é obrigatório — o resto é opcional, como no banco e no conteúdo real', () => {
  // Cinco das 11 não têm resumo, seis não têm sinopse, nove não têm rider.
  // Exigir campo que a ONG não escreveu obrigaria a inventar texto.
  const { valido, erros } = validarAtividade(lerAtividade(formulario({ id: ID, titulo: 'Banzo' })));

  assert.equal(valido, true, `recusou uma atividade só com nome: ${JSON.stringify(erros)}`);
});

test('sem nome a atividade é recusada — e espaço em branco não é nome', () => {
  const semNome = validarAtividade(lerAtividade(formulario({ id: ID })));
  assert.equal(semNome.erros.titulo, 'Escreva o nome da atividade.');

  const soEspaco = validarAtividade(lerAtividade(formulario({ id: ID, titulo: '   ' })));
  assert.equal(soEspaco.erros.titulo, 'Escreva o nome da atividade.');
});

test('esta tela NÃO cria: sem id a Action recusa, em vez de inserir uma atividade nova', () => {
  // A diferença mais importante para `validarPublicacao`, onde id vazio
  // significa "notícia nova". Aqui significa requisição malformada — e se
  // isto deixar de valer, alguém acabou de dar à tela um caminho de criação
  // que a tarefa recusou de propósito.
  const { valido, erros } = validarAtividade(lerAtividade(formulario({ titulo: 'Banzo' })));

  assert.equal(valido, false);
  assert.match(erros.id, /Não foi possível saber qual atividade/);
});

test('id de atividade é apelido de texto, não uuid — os 11 reais passam', () => {
  // A coluna é `text` (002_conteudo.sql), e os valores são "banzo",
  // "catirina-e-nego-dito". Usar o formato de uuid aqui recusaria todas.
  for (const atividade of atividadesReais) {
    assert.equal(ehIdentificadorDeAtividade(atividade.id), true,
      `o id real "${atividade.id}" foi recusado pela validação`);
  }

  for (const invalido of [
    '', ' ', 'Banzo', 'banzo ', '-banzo', 'banzo-', 'banzo--dois', 'banzo/../outro',
    "' or 1=1 --", 'a'.repeat(81), null, undefined, 42, {}, ['banzo']
  ]) {
    assert.equal(ehIdentificadorDeAtividade(invalido), false,
      `${JSON.stringify(invalido)} não pode passar por identificador de atividade`);
  }
});

test('id com lixo dentro é recusado antes de chegar ao Postgres', () => {
  // Aqui isto importa MAIS que nas publicações: `text` não levanta erro de
  // sintaxe como `uuid` levanta (22P02) — um id inventado simplesmente não
  // casa com linha nenhuma, e o update "bem-sucedido com zero linhas"
  // passaria despercebido se nada recusasse antes.
  const { valido, erros } = validarAtividade(
    lerAtividade(formulario({ id: 'NÃO É APELIDO', titulo: 'Banzo' }))
  );

  assert.equal(valido, false);
  assert.match(erros.id, /Não foi possível identificar/);
});

test('cada campo tem teto de tamanho — a Action é endpoint público, e text no Postgres não tem', () => {
  const grande = (n) => 'a'.repeat(n + 1);

  const porTitulo = validarAtividade(
    lerAtividade(formulario({ id: ID, titulo: grande(LIMITE_TITULO) }))
  );
  assert.match(porTitulo.erros.titulo, new RegExp(`passou de ${LIMITE_TITULO} caracteres`));

  const porResumo = validarAtividade(
    lerAtividade(formulario({ id: ID, titulo: 'T', resumo: grande(LIMITE_RESUMO) }))
  );
  assert.match(porResumo.erros.resumo, new RegExp(`passou de ${LIMITE_RESUMO} caracteres`));

  const porDescricao = validarAtividade(
    lerAtividade(formulario({ id: ID, titulo: 'T', descricao: grande(LIMITE_DESCRICAO) }))
  );
  assert.match(porDescricao.erros.descricao, new RegExp(`passou de ${LIMITE_DESCRICAO} caracteres`));

  // Os seis da ficha técnica, um a um: eles são uma LINHA da ficha, não um
  // parágrafo, e cada um precisa da própria mensagem — senão a pessoa recebe
  // "passou do limite" sem saber onde.
  for (const campo of ['genero', 'duracao', 'elenco', 'classificacao', 'local', 'rider']) {
    const { erros } = validarAtividade(lerAtividade(formulario({
      id: ID, titulo: 'T', [campo]: grande(LIMITE_FICHA)
    })));
    assert.match(erros[campo], new RegExp(`passou de ${LIMITE_FICHA} caracteres`),
      `o campo "${campo}" não tem teto de tamanho`);
  }
});

test('os limites da ficha e da sinopse cabem o conteúdo real da ONG, com folga', () => {
  // Um limite que recusa o que já está publicado seria um limite que impede
  // a equipe de salvar a própria atividade sem mudar nada.
  for (const atividade of atividadesReais) {
    const { valido, erros } = validarAtividade(lerAtividade(formulario({
      id: atividade.id,
      titulo: atividade.titulo ?? '',
      resumo: atividade.resumo ?? '',
      descricao: atividade.descricao ?? '',
      genero: atividade.genero ?? '',
      duracao: atividade.duracao ?? '',
      elenco: atividade.elenco ?? '',
      classificacao: atividade.classificacao ?? '',
      local: atividade.local ?? '',
      rider: atividade.rider ?? ''
    })));

    assert.equal(valido, true,
      `a atividade real "${atividade.id}" seria recusada pela validação: ${JSON.stringify(erros)}`);
  }
});

test('as quebras de linha do MEIO da sinopse sobrevivem ao trim — é o que separa os parágrafos', () => {
  const campos = lerAtividade(formulario({
    id: ID, titulo: 'T', descricao: '\n\n  um\n\ndois  \n\n'
  }));
  assert.equal(campos.descricao, 'um\n\ndois');
});

test('um File no lugar de um campo de texto não vira a string "[object File]"', () => {
  const dados = new FormData();
  dados.set('id', ID);
  dados.set('titulo', new File(['x'], 'foto.jpg'));

  assert.equal(lerAtividade(dados).titulo, '');
  assert.equal(validarAtividade(lerAtividade(dados)).erros.titulo, 'Escreva o nome da atividade.');
});

test('o botão de tirar do ar reaproveita a MESMA lista fechada das publicações', () => {
  // Reaproveitar `lerAlternancia` é decisão: é a mesma entrada de usuário
  // (um <input type="hidden">) e a mesma decisão. Duas cópias divergiriam.
  assert.deepEqual(lerAlternancia(formulario({ id: ID, acao: 'despublicar' })),
    { id: ID, acao: 'despublicar' });

  for (const inventada of ['apagar', 'PUBLICAR', '', 'true']) {
    assert.equal(lerAlternancia(formulario({ id: ID, acao: inventada })).acao, null,
      `"${inventada}" não pode virar uma ação`);
  }
});

test('o aviso da URL só escolhe uma frase nossa — nunca traz uma', () => {
  assert.equal(avisoDeAtividades('salva').ok, true);
  assert.equal(avisoDeAtividades('erro').ok, false);

  assert.equal(avisoDeAtividades('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDeAtividades('inventado'), null);
  assert.equal(avisoDeAtividades(undefined), null);
  // Array: é o que o Next entrega quando a URL traz `?aviso=a&aviso=b`.
  assert.equal(avisoDeAtividades(['salva']), null);

  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDeAtividades(herdado), null, `"${herdado}" veio do protótipo`);
  }
});

test('o aviso de TIRAR DO AR conta que existe uma cópia velha do texto no site', () => {
  // A armadilha da tarefa, dita para quem usa a tela — e dita AQUI, e não no
  // aviso de "guardei", por uma decisão tomada olhando a tela pronta (regra
  // 10): a advertência inteira em toda gravação são seis linhas no celular,
  // toda vez, o que treina a equipe a ignorar a caixa de aviso. No "tirar do
  // ar" ela é indispensável — é o único caso em que a cópia velha
  // CONTRADIZ o que a pessoa acabou de fazer (a atividade sai do site e,
  // numa queda do banco, reaparece). O aviso permanente da lista
  // (componentes/ListaAtividades.ts) carrega o resto, sempre à vista.
  assert.match(avisoDeAtividades('retirada').texto, /cópia antiga guardada dentro dele/);
  assert.match(avisoDeAtividades('retirada').texto, /esta atividade ainda aparece/);

  // E o de guardar continua curto, de propósito.
  assert.equal(avisoDeAtividades('salva').texto,
    'Correção guardada. A página de projetos já mostra o texto novo.');
});

// =====================================================================
// 2. O que a lista da equipe desenha
// =====================================================================

test('a lista diz por ESCRITO se cada atividade está no ar — não só por cor', () => {
  const html = renderizarLista({
    atividades: [
      exemplo({ id: 'banzo', titulo: 'Banzo', publicado: true }),
      exemplo({ id: 'eu-griot', titulo: 'Eu, Griot', publicado: false })
    ]
  });

  assert.match(html, />No ar</);
  assert.match(html, />Fora do ar</);
});

test('o botão de cada item pede a ação OPOSTA ao estado atual', () => {
  const noAr = renderizarLista({ atividades: [exemplo({ publicado: true })] });
  assert.match(noAr, /name="acao" value="despublicar"/);
  assert.match(noAr, /Tirar do ar/);

  const foraDoAr = renderizarLista({ atividades: [exemplo({ publicado: false })] });
  assert.match(foraDoAr, /name="acao" value="publicar"/);
  assert.match(foraDoAr, /Pôr de volta/);
});

test('tirar do ar é um <form> com POST, não um botão com onClick — é o que funciona sem JavaScript', () => {
  const html = renderizarLista({ atividades: [exemplo()] });

  assert.match(html, /<form[^>]*action="\/acao-de-teste"/,
    'o botão saiu de dentro de um <form> — sem script ele deixaria de funcionar, em silêncio');
  assert.match(html, /<button type="submit"/);
  assert.match(html, new RegExp(`name="id" value="${ID}"`));
});

test('cada botão da lista carrega o nome da atividade para quem usa leitor de tela', () => {
  const html = renderizarLista({ atividades: [exemplo({ titulo: 'Banzo' })] });

  // "Editar" repetido onze vezes numa lista não diz qual é qual para quem
  // navega saltando de link em link.
  const rotulos = [...html.matchAll(/class="apenas-leitor-de-tela"> ([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(rotulos, ['Banzo', 'Banzo']);
});

test('o link de editar leva o id na URL, escapado', () => {
  const html = renderizarLista({ atividades: [exemplo()] });
  assert.match(html, new RegExp(`href="/admin/atividades/editar\\?id=${ID}"`));
});

test('atividade sem resumo não desenha parágrafo vazio (regra 2 no nível do campo)', () => {
  // Cinco das 11 não têm resumo — é conteúdo real ausente, não erro.
  const html = renderizarLista({ atividades: [exemplo({ resumo: null })] });
  assert.doesNotMatch(html, /atividade-painel__resumo/);
});

test('a lista NÃO oferece criar nem apagar — decisão da tarefa, e dita por escrito', () => {
  const html = renderizarLista({ atividades: [exemplo()] });

  assert.doesNotMatch(html, /value="apagar"/);
  assert.doesNotMatch(html, />Apagar/);
  assert.doesNotMatch(html, /Nova atividade/);
  // Botão que não existe e não é explicado vira busca frustrada.
  assert.match(html, /não dá para criar nem apagar atividade por aqui/);
});

test('a lista AVISA que o site guarda uma cópia do texto — a armadilha da fonte dupla, na tela', () => {
  const html = renderizarLista({ atividades: [exemplo()] });

  assert.match(html, /O site guarda uma cópia do texto destas atividades dentro dele/);
  assert.match(html, /volta a mostrar o texto de antes das suas correções/);

  // Uma vez só: repetir onze vezes é ruído para quem enxerga e onze leituras
  // para quem usa leitor de tela.
  const html11 = renderizarLista({
    atividades: atividadesReais.map((a) => exemplo({ id: a.id, titulo: a.titulo }))
  });
  const ocorrencias = (html11.match(/O site guarda uma cópia/g) || []).length;
  assert.equal(ocorrencias, 1, `o aviso da cópia apareceu ${ocorrencias} vezes`);
});

test('banco fora do ar diz que falhou — nunca "nenhuma atividade encontrada"', () => {
  const html = renderizarLista({ atividades: [], degradou: true });

  assert.match(html, /o banco de dados não respondeu/);
  assert.match(html, /Nada foi perdido/);
  assert.doesNotMatch(html, /Nenhuma atividade encontrada/);
});

test('lista vazia manda falar com quem cuida do site — não procurar um botão de criar', () => {
  const html = renderizarLista({ atividades: [], degradou: false });

  assert.match(html, /Nenhuma atividade encontrada no banco de dados/);
  assert.match(html, /não por esta tela/);
});

test('o texto da atividade é escapado — o painel guarda texto puro, não HTML', () => {
  const html = renderizarLista({
    atividades: [exemplo({ titulo: '<script>alert(1)</script>', resumo: '<b>negrito</b>' })]
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>negrito<\/b>/);
  assert.match(html, /&lt;script&gt;/);
});

// =====================================================================
// 3. A trava das Server Actions
// =====================================================================

async function corpoDasActions() {
  const codigo = await fonte('../acoes/atividades.ts');

  // Uma função exportada de um arquivo 'use server' É uma URL pública.
  const nomes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(nomes.length > 0, 'nenhuma Server Action encontrada — o teste não verificou nada');

  return nomes.map((nome) => {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    return { nome, corpo: codigo.slice(inicio, proxima === -1 ? undefined : proxima) };
  });
}

test('toda Server Action de atividades chama ehEquipe() por conta própria', async () => {
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) problemas.push(`${nome}: não chama ehEquipe()`);
  }

  assert.deepEqual(
    problemas, [],
    'Server Action do painel sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto: uma Action é endpoint HTTP'
    + '\n  público e não passa por página nem por layout. Ver o cabeçalho de acoes/atividades.ts.'
  );
});

test('NÃO EXISTE insert nem delete em acoes/atividades.ts — a tela só edita', async () => {
  // A decisão desta tarefa, transformada em trava. As 11 atividades são
  // conteúdo da ONG; apagar por engano num celular não tem desfazer, e criar
  // sem poder apagar deixaria a equipe sem saída depois de um toque errado.
  // O banco PERMITE as duas (a política é `for all`) — quem recusa é este
  // arquivo, e é isto que o mantém recusando.
  const codigo = await fonte('../acoes/atividades.ts');

  assert.doesNotMatch(codigo, /\.insert\s*\(/,
    'apareceu um insert: esta tela não cria atividade (ver o cabeçalho do arquivo)');
  assert.doesNotMatch(codigo, /\.delete\s*\(/,
    'apareceu um delete: apagar é o único gesto sem desfazer, e a tarefa o recusou');
});

test('a Action que salva texto NUNCA escreve o campo `publicado` — tirar do ar é outro botão', async () => {
  const salvar = (await corpoDasActions()).find(({ nome }) => nome === 'salvarAtividade');
  assert.ok(salvar, 'salvarAtividade sumiu — este teste precisa ser revisto');

  // Aqui o descuido é pior que nas notícias: a coluna é `not null default
  // true`, então um `publicado` que entrasse pelo formulário de texto
  // TIRARIA DO AR conteúdo que a ONG tem publicado.
  assert.doesNotMatch(salvar.corpo, /publicado/,
    'salvarAtividade menciona `publicado`. Se isso virar um valor gravado, uma correção de '
    + 'vírgula passa a poder tirar uma atividade do site.');
});

test('nenhuma Action espalha o que veio da requisição num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

// =====================================================================
// 4. A leitura do painel não cai para o JSON versionado
// =====================================================================

/**
 * A DECISÃO QUE O RESTO DA TAREFA PRESSUPÕE, e que nada mais acusaria.
 *
 * /projetos cai para dados-iniciais/atividades.json quando o banco não
 * responde — é a rede de segurança da página pública, e está certa. O
 * PAINEL não pode cair: desenhar 11 atividades com "Editar" ao lado,
 * sabendo que aqueles textos não são os do banco, é oferecer um gesto que
 * não pode dar certo — a pessoa corrigiria o texto e a Action responderia
 * "esta atividade não está mais no banco".
 *
 * Se alguém "unificar" as duas leituras para reaproveitar código, isto aqui
 * é o que fica vermelho.
 */
test('as duas funções de leitura do PAINEL não tocam no JSON versionado', async () => {
  const codigo = await fonte('../servidor/dados/conteudo.ts');

  for (const nome of ['listarAtividadesDoPainel', 'buscarAtividadeDoPainel']) {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    assert.notEqual(inicio, -1, `${nome} sumiu de servidor/dados/conteudo.ts`);

    const fim = codigo.indexOf('\n}', inicio);
    const corpo = codigo.slice(inicio, fim === -1 ? undefined : fim);

    assert.doesNotMatch(corpo, /atividadesLocais|doJson|filtrarEOrdenarLocal/,
      `${nome} caiu para o JSON versionado. O painel precisa DECLARAR a falha (Degradavel) em `
      + 'vez de servir um texto que não é o do banco — ver a seção da leitura do painel em '
      + 'servidor/dados/conteudo.ts.');
    assert.match(corpo, /consultarComEstado/,
      `${nome} precisa devolver Degradavel, para a tela distinguir "não existe" de "o banco não `
      + 'respondeu"');
  }
});

/**
 * A OUTRA PONTA DA MESMA ARMADILHA: `npm run seed` regenera
 * supabase/seed.sql a partir do JSON, e o JSON não recebe as correções do
 * painel. O gerador precisa DIZER isso a cada execução — o comentário só é
 * lido por quem abre o arquivo.
 */
test('o gerador de seed avisa, em execução, que o JSON pode estar atrás do banco', async () => {
  const codigo = await readFile(
    fileURLToPath(new URL('../ferramentas/gerar-seed.mjs', import.meta.url)), 'utf8');

  const impressos = [...codigo.matchAll(/console\.(warn|error)\(([\s\S]*?)\n\);/g)]
    .map((m) => m[0]).join('\n');

  assert.match(impressos, /admin\/atividades/,
    'o gerador não avisa, ao rodar, que a equipe corrige o texto pelo painel');
  assert.match(impressos, /NÃO volta para o JSON/,
    'o aviso impresso não diz que a correção do painel não volta para dados-iniciais/');
});

// =====================================================================
// 5. A recusa, contra o servidor de verdade
// =====================================================================

const ROTAS_NOVAS = ['/admin/atividades', '/admin/atividades/editar'];

test('as duas telas novas do painel respondem 404 para anônimo', async () => {
  for (const rota of ROTAS_NOVAS) {
    const resposta = await fetch(`${BASE}${rota}`, { redirect: 'manual' });
    assert.equal(resposta.status, 404,
      `${rota} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
  }
});

test('nada das telas de atividades vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tarefa.
  for (const rota of ROTAS_NOVAS) {
    const html = await fetch(`${BASE}${rota}`).then((resposta) => resposta.text());

    for (const marca of [
      'painel da equipe', 'atividade-painel', 'atividades-painel',
      'Guardar correção', 'Tirar do ar', 'Ficha técnica',
      'Nenhuma atividade encontrada', 'O site guarda uma cópia'
    ]) {
      assert.ok(!html.includes(marca),
        `a resposta de ${rota} servida a quem não é equipe contém "${marca}"`);
    }

    assert.match(html, /<title>Página não encontrada/, `${rota} não devolveu o 404 do projeto`);
  }
});

test('a tela de edição não conta nem quais atividades existem: um id REAL também é 404', async () => {
  const resposta = await fetch(`${BASE}/admin/atividades/editar?id=${ID}`);
  assert.equal(resposta.status, 404);

  const html = await resposta.text();
  assert.ok(!html.includes('Banzo'),
    'a resposta anônima traz o nome de uma atividade real vinda da tela de edição');
});

// =====================================================================
// 6. /projetos intacta
// =====================================================================

test('/projetos continua servindo as 11 atividades, com o carimbo de procedência', async () => {
  // No modo offline da suíte não há Supabase configurado: a página cai para
  // o JSON versionado, como antes desta tarefa. É o que prova que ligar o
  // painel à tabela não mexeu na página pública — o texto de /projetos é
  // comparado com o HTML original congelado em
  // testes/paridade-texto.test.mjs, e o conteúdo dos cartões, no navegador,
  // em testes/paginas.test.mjs.
  const resposta = await fetch(`${BASE}/projetos`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  const carimbo = COM_CREDENCIAIS ? /data-origem-atividades="banco"/ : /data-origem-atividades="json"/;

  assert.match(html, carimbo,
    'sumiu (ou mudou) o carimbo de procedência do <main> — é ele que distingue "veio do banco" '
    + 'de "veio da cópia versionada", e essa distinção passou a valer CONTEÚDO nesta tarefa');

  // A contagem só vale com o JSON: o banco é editável pela equipe desde esta
  // tarefa, e uma atividade tirada do ar pelo painel some daqui — o que
  // seria o comportamento CERTO, não um defeito.
  if (!COM_CREDENCIAIS) {
    assert.equal((html.match(/class="atividade"/g) || []).length, 11);
  }
});
