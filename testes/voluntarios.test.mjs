/**
 * Gestão de voluntários (RF26) — a tela onde a equipe LÊ as candidaturas que
 * /voluntariado/candidatura grava, e marca em que pé está cada uma.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * Toda requisição HTTP deste arquivo é ANÔNIMA: a suíte não tem sessão de
 * equipe, e não vai ter — não existe porta de diagnóstico para o painel, de
 * propósito (o motivo está no cabeçalho de testes/painel-guarda.test.mjs, e
 * vale em dobro nesta tela, que pendura dado pessoal de TERCEIROS tirado do
 * cadastro de quem tem conta). Então **nenhuma situação de candidatura é
 * gravada por este arquivo**, e nenhum teste daqui afirma nada sobre isso.
 *
 * O que sobra, e é mais do que parece, são cinco coisas:
 *
 *   1. AS DECISÕES PURAS: quais situações existem, em que ordem a fila
 *      aparece, como cada valor de coluna vira palavra, e o que o `?aviso=`
 *      da URL pode dizer de volta. Moram em
 *      compartilhado/triagem-de-voluntarios.ts e
 *      compartilhado/avisos-do-painel.ts justamente para caberem aqui.
 *   2. O QUE A LISTA DA EQUIPE DESENHA, renderizando o componente com
 *      `react-dom/server` sem subir o Next. É a única forma de a tela ter
 *      verificação antes de alguém abri-la autenticado.
 *   3. QUE A SERVER ACTION NÃO ESQUEÇA A GUARDA — e que ela continue sem
 *      `insert`, sem `delete` e gravando UMA coluna só. A varredura de
 *      testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5).
 *   4. A RECUSA, por HTTP: a rota nova responde 404 para anônimo e não vaza
 *      nada da tela no HTML servido — inclusive, no modo com credenciais, o
 *      e-mail e o nome da candidatura real que existe na tabela (CLAUDE.md,
 *      item 0q).
 *   5. QUE A OUTRA METADE CONTINUE DE PÉ: /voluntariado/candidatura segue
 *      respondendo 200, e acoes/voluntariado.ts segue guardado por
 *      `usuarioAtual()` e NÃO por `ehEquipe()`. Ligar a leitura da equipe não
 *      pode ter fechado a porta de quem quer se oferecer.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhuma linha de
 * `public.voluntarios` teve a situação alterada por este código, em ambiente
 * nenhum. O `update`, o `.select('id')` que distingue "não achou linha" de
 * "deu certo" e o caminho de sucesso da Action só podem ser exercitados com
 * uma sessão de equipe, e não existe conta com `eh_equipe` neste projeto
 * (CLAUDE.md, "O que trava hoje", item 2).
 *
 * O QUE FOI MEDIDO CONTRA O BANCO DE PRODUÇÃO, sem gravar nada e sem sessão:
 * que o embed de `servidor/dados/voluntarios.ts` RESOLVE. Ver o teste no fim
 * do bloco 3 e o cabeçalho daquele arquivo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SITUACOES_DE_VOLUNTARIO, ehSituacaoDeVoluntario, rotuloDaSituacaoDeVoluntario,
  proximasSituacoesDeVoluntario, ordenarParaTriagemDeVoluntarios, montarTriagemDeVoluntarios
} from '../compartilhado/triagem-de-voluntarios.ts';
import { SITUACOES_EM_ANDAMENTO } from '../compartilhado/candidatura.ts';
import { SITUACAO_DA_CANDIDATURA } from '../componentes/MinhaConta.ts';
import { lerMudancaDeSituacao } from '../compartilhado/validacao.ts';
import { avisoDeVoluntarios } from '../compartilhado/avisos-do-painel.ts';
import { ListaVoluntarios } from '../componentes/ListaVoluntarios.ts';
import { PAGINAS_SO_PARA_EQUIPE } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/** Um uuid de verdade, no formato que `gen_random_uuid()` produz. */
const ID = '3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99';

/**
 * A candidatura de teste que ficou no banco de PRODUÇÃO quando a RF25 mediu
 * o caminho de sucesso (CLAUDE.md, item 0q). Ela é o único dado real que
 * existe nesta tabela — e aqui serve para uma coisa só: provar que não
 * aparece na resposta anônima.
 */
const EMAIL_DA_LINHA_REAL = 'rf25.teste@exemplo.test';

/**
 * Uma candidatura de exemplo. O TEXTO É FUNCIONAL, de teste — não é conteúdo
 * institucional inventado sobre a ONG (regra 2 do CLAUDE.md), e não é dado
 * de pessoa real: o e-mail usa `.invalid`, que é reservado por norma
 * justamente para isso.
 */
function exemplo(mudancas = {}) {
  return {
    id: ID,
    mensagem: 'Primeira linha.\n\nSegunda linha.',
    situacao: 'novo',
    criado_em: '2026-09-01T12:00:00+00:00',
    nome: 'Fulana de Teste',
    email: 'fulana@exemplo.invalid',
    telefone: '(11) 95396-8344',
    areas: ['Acervo e memória', 'Comunicação'],
    ...mudancas
  };
}

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

/**
 * Renderiza a lista com `montarTriagemDeVoluntarios` DE VERDADE no meio — é
 * ele que ordena e traduz os valores de coluna em palavra. Passar itens
 * montados à mão aqui faria o teste medir a si mesmo: o componente
 * desenharia rótulos que o teste inventou, e a tela real usaria outros.
 */
function renderizarLista({ candidaturas = [], ...props }) {
  return renderToStaticMarkup(createElement(ListaVoluntarios, {
    acaoSituacao: '/acao-de-teste',
    degradou: false,
    itens: montarTriagemDeVoluntarios(candidaturas),
    ...props
  }));
}

/**
 * O código sem os comentários — mesma função (e mesmo motivo) de
 * testes/contatos.test.mjs, atividades.test.mjs e painel-guarda.test.mjs:
 * sem isto a varredura lê o que o arquivo EXPLICA e conclui que o código faz.
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

async function migracaoDePessoas() {
  return readFile(
    fileURLToPath(new URL('../supabase/migrations/004_pessoas.sql', import.meta.url)), 'utf8');
}

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('as quatro situações são exatamente as do check de public.voluntarios', async () => {
  // Se alguém acrescentar uma quinta situação na tela sem tocar na
  // migration, a Action vai gravar um valor que o Postgres recusa — e o
  // desfecho na tela é "não deu para fazer isso agora", sem dizer por quê.
  const sql = await migracaoDePessoas();

  const trecho = sql.slice(sql.indexOf('create table public.voluntarios'));
  const check = trecho.match(/situacao\s+text[\s\S]*?check \(situacao in \(([^)]*)\)\)/);
  assert.ok(check, 'não achei o check de situacao de public.voluntarios em 004_pessoas.sql');

  const noBanco = check[1].split(',').map((valor) => valor.trim().replace(/'/g, ''));

  assert.deepEqual(
    SITUACOES_DE_VOLUNTARIO.map((situacao) => situacao.valor).sort(), noBanco.sort(),
    'a lista da tela e o check do banco divergiram'
  );
});

test('a lista da equipe e a de /minha-conta falam das MESMAS quatro situações', () => {
  // Dois vocabulários de propósito (lá o sujeito é a pessoa, aqui é a fila),
  // mas eles não podem discordar sobre QUAIS situações existem: uma que só
  // um dos dois conheça aparece como texto cru de coluna para metade dos
  // leitores.
  assert.deepEqual(
    SITUACOES_DE_VOLUNTARIO.map((situacao) => situacao.valor).sort(),
    Object.keys(SITUACAO_DA_CANDIDATURA).sort()
  );
});

test('as situações "em andamento" são três das quatro — e a que falta é inativo', () => {
  // É esta diferença que faz encerrar uma candidatura DEVOLVER à pessoa o
  // direito de se candidatar de novo (compartilhado/candidatura.ts). A tela
  // promete isso por escrito; se a lista mudar, a promessa vira mentira.
  const todas = SITUACOES_DE_VOLUNTARIO.map((situacao) => situacao.valor);

  for (const emAndamento of SITUACOES_EM_ANDAMENTO) {
    assert.ok(todas.includes(emAndamento), `"${emAndamento}" não é situação do banco`);
  }

  assert.deepEqual(
    todas.filter((valor) => !SITUACOES_EM_ANDAMENTO.includes(valor)), ['inativo'],
    'mudou quem fica fora de SITUACOES_EM_ANDAMENTO — a legenda e o aviso de "encerrada" '
    + 'afirmam que é o encerramento que libera uma nova candidatura'
  );
});

test('a lista fechada recusa qualquer coisa fora das quatro', () => {
  for (const valida of ['novo', 'em_contato', 'ativo', 'inativo']) {
    assert.equal(ehSituacaoDeVoluntario(valida), true, `"${valida}" é situação do banco`);
  }

  for (const invalida of [
    '', ' ', 'NOVO', 'ativo ', 'concluido', 'ativa', 'true', null, undefined, 1, {}, ['novo'],
    // Herdados do protótipo de Object: o motivo de `Object.hasOwn` existir
    // nos irmãos deste módulo.
    'toString', 'constructor', '__proto__'
  ]) {
    assert.equal(ehSituacaoDeVoluntario(invalida), false,
      `${JSON.stringify(invalida)} não pode passar por situação`);
  }
});

test('o rótulo é feminino na tela e masculino na coluna — e valor desconhecido volta como veio', () => {
  assert.equal(rotuloDaSituacaoDeVoluntario('novo'), 'Nova');
  assert.equal(rotuloDaSituacaoDeVoluntario('em_contato'), 'Em contato');
  assert.equal(rotuloDaSituacaoDeVoluntario('ativo'), 'Voluntariando');
  assert.equal(rotuloDaSituacaoDeVoluntario('inativo'), 'Encerrada');

  // Uma quinta situação criada direto no painel do Supabase: melhor mostrar
  // o valor cru que inventar um rótulo genérico e esconder que a tela ficou
  // velha.
  assert.equal(rotuloDaSituacaoDeVoluntario('em_analise'), 'em_analise');
});

test('cada candidatura oferece as OUTRAS três situações — inclusive voltar de encerrada', () => {
  // Todas as transições existem em todos os sentidos: a operação acontece
  // num celular, de pé, e um toque errado sem volta é o que faz a equipe
  // parar de usar a tela.
  assert.deepEqual(proximasSituacoesDeVoluntario('novo').map((s) => s.valor),
    ['em_contato', 'ativo', 'inativo']);
  assert.deepEqual(proximasSituacoesDeVoluntario('inativo').map((s) => s.valor),
    ['novo', 'em_contato', 'ativo']);

  // Situação que a tela não conhece não pode deixar a candidatura sem saída.
  assert.equal(proximasSituacoesDeVoluntario('em_analise').length, 4);
});

test('a fila começa por quem não teve resposta, e dentro do grupo pela mais nova', () => {
  const emOrdemDeChegada = [
    exemplo({ id: 'a', situacao: 'inativo', criado_em: '2026-09-01T10:00:00+00:00' }),
    exemplo({ id: 'b', situacao: 'novo', criado_em: '2026-08-01T10:00:00+00:00' }),
    exemplo({ id: 'c', situacao: 'ativo', criado_em: '2026-09-02T10:00:00+00:00' }),
    exemplo({ id: 'd', situacao: 'novo', criado_em: '2026-09-03T10:00:00+00:00' }),
    exemplo({ id: 'e', situacao: 'em_contato', criado_em: '2026-07-01T10:00:00+00:00' })
  ];

  assert.deepEqual(
    ordenarParaTriagemDeVoluntarios(emOrdemDeChegada).map((c) => c.id),
    ['d', 'b', 'e', 'c', 'a'],
    'a ordem não é "sem resposta primeiro, e dentro de cada grupo da mais nova para a mais '
    + 'antiga" — é ela que decide o que aparece no primeiro cartão, o único que se vê a 375px '
    + 'sem rolar'
  );
});

test('encerrada DESCE, nunca some: a candidatura é o registro de que alguém ajudou', () => {
  const lista = [exemplo({ id: 'velha', situacao: 'inativo' })];

  assert.equal(ordenarParaTriagemDeVoluntarios(lista).length, 1,
    'a ordenação virou filtro');
});

test('situação desconhecida vai para o TOPO, não para o fim onde ninguém rola', () => {
  const lista = [
    exemplo({ id: 'nova', situacao: 'novo' }),
    exemplo({ id: 'estranha', situacao: 'em_analise' })
  ];

  assert.deepEqual(
    ordenarParaTriagemDeVoluntarios(lista).map((c) => c.id), ['estranha', 'nova']);
});

test('ordenar devolve uma cópia — o que veio do PostgREST não é mexido no lugar', () => {
  const original = [
    exemplo({ id: 'a', situacao: 'inativo' }),
    exemplo({ id: 'b', situacao: 'novo' })
  ];
  const antes = original.map((c) => c.id);

  ordenarParaTriagemDeVoluntarios(original);

  assert.deepEqual(original.map((c) => c.id), antes,
    'ordenarParaTriagemDeVoluntarios ordenou o array recebido no lugar');
});

test('o botão de triagem manda DOIS campos, e nem a mensagem nem as áreas são um deles', () => {
  const dados = formulario({
    id: ID,
    situacao: 'ativo',
    // O que uma requisição montada à mão tentaria injetar. Nada disto é
    // lido: o texto é registro e as áreas são escolha de quem se candidatou.
    mensagem: 'texto trocado por quem montou a requisição',
    areas: 'producao',
    perfil_id: '00000000-0000-4000-8000-000000000000',
    eh_equipe: 'true'
  });

  assert.deepEqual(lerMudancaDeSituacao(dados), { id: ID, situacao: 'ativo' });
});

test('um File no lugar de um campo de texto não vira a string "[object File]"', () => {
  const dados = new FormData();
  dados.set('id', new File(['x'], 'foto.jpg'));
  dados.set('situacao', 'ativo');

  assert.equal(lerMudancaDeSituacao(dados).id, '');
});

test('o aviso da URL só escolhe uma frase nossa — nunca traz uma', () => {
  assert.equal(avisoDeVoluntarios('nova').ok, true);
  assert.equal(avisoDeVoluntarios('em-contato').ok, true);
  assert.equal(avisoDeVoluntarios('ativa').ok, true);
  assert.equal(avisoDeVoluntarios('encerrada').ok, true);
  assert.equal(avisoDeVoluntarios('erro').ok, false);

  assert.equal(avisoDeVoluntarios('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDeVoluntarios('inventado'), null);
  assert.equal(avisoDeVoluntarios(undefined), null);
  // Array: é o que o Next entrega quando a URL traz `?aviso=a&aviso=b`.
  assert.equal(avisoDeVoluntarios(['nova']), null);

  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDeVoluntarios(herdado), null, `"${herdado}" veio do protótipo`);
  }
});

test('nenhum aviso desta tela promete que a pessoa foi procurada', () => {
  // O painel registra que alguém MARCOU. Falar com quem se candidatou
  // acontece no e-mail ou no WhatsApp, fora daqui — uma frase como "aviso
  // enviado" seria a tela afirmando o que não tem como saber.
  for (const chave of ['nova', 'em-contato', 'ativa', 'encerrada']) {
    const { texto } = avisoDeVoluntarios(chave);
    assert.doesNotMatch(texto, /avisamos|aviso enviado|foi avisad|entramos em contato/i,
      `o aviso "${chave}" promete contato: ${texto}`);
  }
});

test('o aviso de encerrar conta a consequência que acontece FORA desta tela', () => {
  const { texto } = avisoDeVoluntarios('encerrada');

  assert.match(texto, /nada foi apagado/);
  assert.match(texto, /candidatar de novo/,
    'sem esta frase, a segunda candidatura da mesma pessoa aparece na fila parecendo defeito');
});

// =====================================================================
// 2. O que a lista da equipe desenha
// =====================================================================

test('cada candidatura diz por ESCRITO em que pé está — não só por cor', () => {
  const html = renderizarLista({
    candidaturas: [
      exemplo({ id: 'a', situacao: 'novo' }),
      exemplo({ id: 'b', situacao: 'em_contato' }),
      exemplo({ id: 'c', situacao: 'ativo' }),
      exemplo({ id: 'd', situacao: 'inativo' })
    ]
  });

  assert.match(html, />Nova</);
  assert.match(html, />Em contato</);
  assert.match(html, />Voluntariando</);
  assert.match(html, />Encerrada</);
});

test('as ÁREAS aparecem — é a única coisa que a pessoa escolheu', () => {
  const html = renderizarLista({
    candidaturas: [exemplo({ areas: ['Acervo e memória', 'Comunicação'] })]
  });

  assert.match(html, /Áreas/);
  assert.match(html, /Acervo e memória, Comunicação/,
    'sem as áreas a tela não responde "para onde essa ajuda vai?"');
});

test('candidatura SEM áreas diz que elas se perderam — o desfecho parcial não some', () => {
  // acoes/voluntariado.ts grava em duas tabelas sem transação: quando a
  // segunda falha, a candidatura existe e a escolha não. Omitir a linha aqui
  // esconderia da equipe justamente o que ela precisa perguntar.
  const html = renderizarLista({ candidaturas: [exemplo({ areas: [] })] });

  assert.match(html, /não ficaram registradas/);
  assert.match(html, /pergunte à pessoa/);
});

test('o e-mail e o telefone são LINKS de falar, não texto para copiar à mão', () => {
  const html = renderizarLista({ candidaturas: [exemplo()] });

  assert.match(html, /href="mailto:fulana@exemplo\.invalid"/);
  // Só os dígitos no `tel:`, e o que a pessoa cadastrou na tela: um `tel:`
  // com espaço e parêntese é ignorado por parte dos discadores, e o cenário
  // aqui é o celular.
  assert.match(html, /href="tel:11953968344"/);
  assert.match(html, /\(11\) 95396-8344/);
});

test('telefone vazio não desenha rótulo com nada ao lado', () => {
  const html = renderizarLista({ candidaturas: [exemplo({ telefone: null })] });

  assert.doesNotMatch(html, /Telefone/);
  // E o que existe continua lá.
  assert.match(html, /E-mail/);
});

test('a mensagem chega inteira, com as quebras de linha que a pessoa escreveu', () => {
  const html = renderizarLista({
    candidaturas: [exemplo({ mensagem: 'Primeira linha.\n\nSegunda linha.' })]
  });

  assert.match(html, /Primeira linha\.\n\nSegunda linha\./,
    'as quebras de linha sumiram — em texto escrito à mão elas SÃO a estrutura');
  assert.match(html, /class="voluntario__mensagem"/);
});

test('a dobra da mensagem nasce ABERTA no que ainda espera resposta, e fechada no resto', () => {
  const nova = renderizarLista({ candidaturas: [exemplo({ situacao: 'novo' })] });
  assert.match(nova, /<details[^>]*open/);

  const ativa = renderizarLista({ candidaturas: [exemplo({ situacao: 'ativo' })] });
  assert.doesNotMatch(ativa, /<details[^>]*open/);

  // `<details>` nativo: abre e fecha sem uma linha de JavaScript.
  assert.match(nova, /<summary/);
});

test('candidatura sem mensagem não desenha uma dobra que abre para o vazio', () => {
  // O campo é opcional no formulário (`mensagem text`, sem `not null`).
  const html = renderizarLista({ candidaturas: [exemplo({ mensagem: null })] });

  // A asserção ficou ESPECÍFICA desde o pedido V1: agora existe SEMPRE uma
  // dobra, a de "Ver mais", que comprime o cartão inteiro. O que não pode
  // existir é a dobra DA MENSAGEM quando não há mensagem — uma dobra que
  // abre para o vazio. `voluntario__dobra` é a classe só dela.
  assert.doesNotMatch(html, /voluntario__dobra/,
    'desenhou a dobra da mensagem para uma candidatura que não tem mensagem');
  assert.match(html, /painel__dobra--detalhes/,
    'sumiu a dobra "Ver mais" que comprime o cartão');
  assert.match(html, /não escreveu nada além das áreas/);
});

test('os botões de triagem são <form> com POST, não botão com onClick', () => {
  const html = renderizarLista({ candidaturas: [exemplo({ situacao: 'novo' })] });

  assert.match(html, /<form[^>]*action="\/acao-de-teste"/,
    'o botão saiu de dentro de um <form> — sem script ele deixaria de funcionar, em silêncio');
  assert.match(html, new RegExp(`name="id" value="${ID}"`));
  assert.match(html, /name="situacao" value="em_contato"/);
  assert.match(html, /name="situacao" value="ativo"/);
  assert.match(html, /name="situacao" value="inativo"/);
  // A situação atual não vira botão: um botão que não muda nada é um gesto
  // que não faz nada.
  assert.doesNotMatch(html, /name="situacao" value="novo"/);
});

test('nenhum <form> da lista carrega a mensagem, o e-mail ou as áreas num campo escondido', () => {
  // É assim que o dado voltaria a viajar sem motivo — e voltaria PARA o
  // servidor, num corpo de requisição, a cada toque.
  const html = renderizarLista({
    candidaturas: [exemplo({ mensagem: 'MARCA-DO-TEXTO-DA-CANDIDATURA' })]
  });

  const escondidos = [...html.matchAll(/<input type="hidden" name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(escondidos)].sort(), ['id', 'situacao']);
});

test('cada botão carrega o nome de quem se candidatou, para quem usa leitor de tela', () => {
  const html = renderizarLista({ candidaturas: [exemplo({ nome: 'Fulana de Teste' })] });

  // "Falar por e-mail" repetido dez vezes numa lista não diz qual é qual
  // para quem navega saltando de link em link.
  const rotulos = [...html.matchAll(/class="apenas-leitor-de-tela">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(rotulos, [
    ' com Fulana de Teste',
    ' — Fulana de Teste', ' — Fulana de Teste', ' — Fulana de Teste'
  ]);
});

test('linha sem o perfil embutido não derruba a tela nem imprime "null"', () => {
  // Impossível hoje (`perfil_id` é `not null`), e tratado porque uma tela
  // que só sabe desenhar o caso bom afirma o caso bom até quando ele deixa
  // de ser verdade.
  const html = renderizarLista({
    candidaturas: [exemplo({ nome: null, email: null, telefone: null })]
  });

  assert.match(html, /Pessoa sem cadastro ligado/);
  assert.doesNotMatch(html, /mailto:/, 'sem e-mail não pode sobrar um link de falar vazio');
  assert.doesNotMatch(html, /null/);
});

test('a lista NÃO oferece apagar, editar nem mexer nas áreas — e diz por quê', () => {
  const html = renderizarLista({ candidaturas: [exemplo()] });

  assert.doesNotMatch(html, /value="apagar"/);
  assert.doesNotMatch(html, />Apagar/);
  assert.doesNotMatch(html, /<textarea/);
  assert.doesNotMatch(html, /<input type="checkbox"/);
  assert.match(html, /não apaga candidatura, não muda o que a pessoa escreveu/);
  assert.match(html, /não mexe nas áreas/);
  // LGPD: /privacidade promete que a pessoa pode pedir a exclusão dos dados
  // dela, e esta tela não faz isso. A frase diz onde se resolve.
  assert.match(html, /fale com quem cuida do site/);
});

test('a legenda das quatro marcas aparece uma vez só, no fim, e explica o encerramento', () => {
  const html = renderizarLista({
    candidaturas: [exemplo({ id: 'a' }), exemplo({ id: 'b' }), exemplo({ id: 'c' })]
  });

  const ocorrencias = (html.match(/Nova: ninguém falou com a pessoa ainda/g) || []).length;
  assert.equal(ocorrencias, 1,
    `a legenda apareceu ${ocorrencias} vezes — repetir por cartão é uma leitura a mais, por `
    + 'candidatura, para quem usa leitor de tela');

  assert.match(html, /volta a poder se candidatar pelo site/,
    'a única consequência desta tela que acontece fora dela precisa estar escrita nela');
});

test('a tela lembra que está cheia de dado de outras pessoas', () => {
  const html = renderizarLista({ candidaturas: [exemplo()] });

  assert.match(html, /não é para mostrar a ninguém de fora da equipe/,
    'a forma mais provável de esses dados vazarem é a tela aberta na mão de alguém, num evento '
    + '— e nenhuma política de RLS cobre isso');
});

test('banco fora do ar diz que falhou — nunca "nenhuma candidatura ainda"', () => {
  // A indistinção mais cara desta tela: lista vazia diria "ninguém se
  // ofereceu para ajudar", e a equipe fecharia o celular deixando gente sem
  // resposta.
  const html = renderizarLista({ candidaturas: [], degradou: true });

  assert.match(html, /o banco de dados não respondeu/);
  assert.match(html, /as candidaturas continuam guardadas/);
  assert.doesNotMatch(html, /Nenhuma candidatura ainda/);
});

test('lista vazia explica de onde nasce uma candidatura — esta tela não cria conteúdo', () => {
  const html = renderizarLista({ candidaturas: [], degradou: false });

  assert.match(html, /Nenhuma candidatura ainda/);
  assert.match(html, /página de voluntariado do site/);
  // E lembra que os canais diretos continuam existindo fora daqui.
  assert.match(html, /WhatsApp/);
});

test('o que a pessoa escreveu é escapado — o painel guarda texto puro, não HTML', () => {
  const html = renderizarLista({
    candidaturas: [exemplo({
      nome: '<script>alert(1)</script>',
      mensagem: '<img src=x onerror=alert(1)>',
      areas: ['<b>negrito</b>']
    })]
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<b>negrito<\/b>/);
  assert.match(html, /&lt;script&gt;/);
});

test('e-mail com aspas não escapa do atributo do mailto', () => {
  // O e-mail vem de `public.perfis`, gravado pelo Auth do Supabase — mas o
  // dado chega do banco, não de um campo desta tela.
  const html = renderizarLista({
    candidaturas: [exemplo({ email: 'a"onmouseover="alert(1)@exemplo.invalid' })]
  });

  assert.doesNotMatch(html, /onmouseover="alert/);
  assert.match(html, /&quot;/);
});

test('montarTriagemDeVoluntarios entrega a lista pronta: ordenada, com rótulo e com os botões', () => {
  const itens = montarTriagemDeVoluntarios([
    exemplo({ id: 'a', situacao: 'inativo' }),
    exemplo({ id: 'b', situacao: 'novo' })
  ]);

  assert.deepEqual(itens.map((item) => item.candidatura.id), ['b', 'a'],
    'montarTriagemDeVoluntarios devolveu na ordem em que recebeu — a ordem da fila é decisão dele');

  assert.equal(itens[0].situacaoRotulo, 'Nova');
  assert.equal(itens[0].nova, true);
  assert.deepEqual(itens[0].destinos.map((d) => d.valor), ['em_contato', 'ativo', 'inativo']);

  assert.equal(itens[1].situacaoRotulo, 'Encerrada');
  assert.equal(itens[1].nova, false);
});

// =====================================================================
// 3. A trava da Server Action e da leitura
// =====================================================================

async function corpoDasActions() {
  const codigo = await fonte('../acoes/voluntarios.ts');

  // Uma função exportada de um arquivo 'use server' É uma URL pública.
  const nomes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(nomes.length > 0, 'nenhuma Server Action encontrada — o teste não verificou nada');

  return nomes.map((nome) => {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    return { nome, corpo: codigo.slice(inicio, proxima === -1 ? undefined : proxima) };
  });
}

test('toda Server Action de voluntários chama ehEquipe() por conta própria', async () => {
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) problemas.push(`${nome}: não chama ehEquipe()`);
  }

  assert.deepEqual(
    problemas, [],
    'Server Action do painel sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto: uma Action é endpoint HTTP'
    + '\n  público e não passa por página nem por layout. Ver o cabeçalho de acoes/voluntarios.ts.'
  );
});

test('NÃO EXISTE insert nem delete em acoes/voluntarios.ts — esta tela lê e tria', async () => {
  const codigo = await fonte('../acoes/voluntarios.ts');

  assert.doesNotMatch(codigo, /\.insert\s*\(/,
    'apareceu um insert: quem cria candidatura é quem se candidata (acoes/voluntariado.ts)');
  assert.doesNotMatch(codigo, /\.delete\s*\(/,
    'apareceu um delete: apagar não tem desfazer, e apagaria a prova de que houve oferta de ajuda');
});

test('o update grava a coluna situacao e NADA MAIS', async () => {
  const codigo = await fonte('../acoes/voluntarios.ts');

  // A decisão da tarefa, transformada em trava: o texto é registro e as
  // áreas são escolha de quem se candidatou.
  const updates = [...codigo.matchAll(/\.update\(([^)]*)\)/g)].map((m) => m[1].trim());

  assert.deepEqual(updates, ['{ situacao }'],
    'o update desta Action deixou de gravar uma coluna só. Se um dia ele passar a escrever '
    + 'mensagem ou área, esta tela deixa de ser leitura e vira edição do que outra pessoa disse.');
});

test('nenhuma Action espalha o que veio da requisição num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

test('a Action não escreve em public.perfis — a tabela onde mora eh_equipe', async () => {
  const codigo = await fonte('../acoes/voluntarios.ts');

  assert.doesNotMatch(codigo, /from\(['"]perfis['"]\)/,
    'esta tela passou a escrever no cadastro de outra pessoa. `eh_voluntario` é o que ELA '
    + 'marcou, e `perfis` é a tabela que tem a coluna eh_equipe (regra 6 do CLAUDE.md)');
});

test('a leitura do painel DECLARA a falha em vez de servir lista vazia calada', async () => {
  const codigo = await fonte('../servidor/dados/voluntarios.ts');

  // O CORPO da função, e não o arquivo inteiro. MEDIDO na rodada de prova
  // desta tarefa: com `assert.match(codigo, /consultarComEstado/)` a
  // verificação passava mesmo trocando a CHAMADA por outra coisa — o
  // `import` no topo continuava citando o nome, e o teste lia a citação. Um
  // teste que se satisfaz com o import não mede a consulta.
  const inicio = codigo.indexOf('export async function listarCandidaturas');
  assert.notEqual(inicio, -1, 'não achei listarCandidaturas');
  const corpo = codigo.slice(inicio);

  // `consultarComContagem` desde a paginação do pedido V1: é o mesmo
  // `Degradavel`, com o total junto. A exigência não mudou.
  assert.match(corpo, /await\s+consultarCom(Estado|Contagem)</,
    'listarCandidaturas precisa devolver Degradavel, para a tela distinguir "ninguém se '
    + 'candidatou" de "o banco não respondeu" — a indistinção mais cara desta tela');
  assert.match(codigo, /Promise<Degradavel<CandidaturaDaEquipe\[\]>/,
    'a assinatura deixou de devolver Degradavel: a bandeira de falha some do caminho todo');

  // O `count` conta as CANDIDATURAS, não as linhas do embed. Se contasse o
  // embed, uma candidatura com três áreas valeria três e a paginação
  // mentiria sobre quantas pessoas se candidataram.
  assert.match(corpo, /count: 'exact'/,
    'sem count: exact a tela não sabe quantas candidaturas existem, e a paginação vira '
    + 'corte silencioso');
  assert.doesNotMatch(codigo, /dados-iniciais/,
    'apareceu uma cópia versionada de candidatura: seria dado pessoal de terceiro dentro do '
    + 'repositório');
});

test('a leitura da EQUIPE não filtra por perfil_id, e a de /minha-conta continua filtrando', async () => {
  // As duas leem `public.voluntarios`; quem decide o que volta é a RLS. O
  // `.eq('perfil_id', ...)` de conta.ts NÃO é redundância — sem ele, uma
  // pessoa da equipe abriria "Minhas candidaturas" e veria as de todo mundo
  // dentro da própria área de conta (ver o cabeçalho daquele arquivo).
  const doPainel = await fonte('../servidor/dados/voluntarios.ts');
  const daConta = await fonte('../servidor/dados/conta.ts');

  assert.doesNotMatch(doPainel, /\.eq\(['"]perfil_id['"]/,
    'a leitura do painel filtrou por perfil_id: a equipe passaria a ver só as próprias '
    + 'candidaturas, e a tela de gestão de voluntários mostraria uma lista vazia');
  assert.match(daConta, /\.eq\(['"]perfil_id['"]/,
    'a leitura de /minha-conta deixou de filtrar por perfil_id');
});

test('a consulta do painel não traz a coluna eh_equipe junto com o perfil', async () => {
  const codigo = await fonte('../servidor/dados/voluntarios.ts');

  assert.doesNotMatch(codigo, /eh_equipe/,
    'esta tela não desenha nem edita `eh_equipe`; trazê-la seria pendurar no HTML de uma '
    + 'lista de pessoas o dado que decide permissão');
});

test('a rota nova está catalogada como tela só da equipe', () => {
  // Sem isto, a reconciliação de testes/links.test.mjs e
  // sem-javascript.test.mjs quebra — e é ela que impede uma página nova de
  // ficar sem cobertura nenhuma, em silêncio.
  assert.ok(PAGINAS_SO_PARA_EQUIPE.includes('/admin/voluntarios'));
});

/**
 * O EMBED DO POSTGREST, MEDIDO CONTRA O BANCO DE PRODUÇÃO — sem sessão e sem
 * gravar nada.
 *
 * O que este teste protege: `perfis(...)` e
 * `voluntario_areas(areas_voluntariado(...))` só funcionam se o PostgREST
 * achar as chaves estrangeiras. Se um nome mudar, a resposta vira `PGRST200`
 * — e, aqui, isso viraria "não deu para carregar as candidaturas" para a
 * equipe inteira, para sempre, sem nada na tela dizendo que a causa é um
 * nome de tabela.
 *
 * O TRUQUE que torna a medição possível sem sessão de equipe: o PostgREST
 * resolve os embeds ANTES de checar o `grant`. MEDIDO em 01/09/2026 — o
 * `select` real responde `42501 permission denied for table voluntarios`
 * (`anon` não tem grant nesta tabela), enquanto o mesmo endereço com um
 * embed inventado responde `PGRST200`. Ou seja, "42501" é a prova de que os
 * embeds resolveram.
 *
 * Só roda no modo com credenciais (`npm run test:supabase`): no offline não
 * há URL para consultar, e um teste que se pula sozinho em silêncio não
 * prova nada — por isso o `skip` diz por que pulou.
 */
test('o embed de perfis e áreas resolve contra o schema real (só com credenciais)', async (t) => {
  const { lerEnvLocal } = await import('./apoio/env-local.mjs');
  const env = lerEnvLocal();

  if (process.env.COM_SUPABASE !== '1' || !env.SUPABASE_URL) {
    t.skip('modo offline: não há PostgREST para perguntar. Rodar com `npm run test:supabase`.');
    return;
  }

  const selecao = await (async () => {
    // A seleção sai do PRÓPRIO arquivo de dados, e não de uma cópia escrita
    // aqui: uma cópia mediria a si mesma e continuaria verde no dia em que a
    // consulta de verdade mudasse.
    const codigo = await fonte('../servidor/dados/voluntarios.ts');
    const trecho = codigo.match(/\.select\(([\s\S]*?)\)\s*\n\s*\.order/);
    assert.ok(trecho, 'não achei o .select() de listarCandidaturas');
    return [...trecho[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('').replace(/\s+/g, '');
  })();

  const url = `${env.SUPABASE_URL}/rest/v1/voluntarios?select=${encodeURIComponent(selecao)}`;
  const resposta = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_CHAVE_PUBLICAVEL,
      Authorization: `Bearer ${env.SUPABASE_CHAVE_PUBLICAVEL}`
    }
  });
  const corpo = await resposta.json();

  assert.notEqual(
    corpo.code, 'PGRST200',
    `o PostgREST não achou uma das relações do select: ${JSON.stringify(corpo)}`
  );

  // E, de quebra, a outra metade da mesma medição: `anon` não lê esta tabela.
  assert.equal(corpo.code, '42501',
    `esperava "permission denied" para anônimo e veio ${JSON.stringify(corpo)} — se `
    + '`anon` passou a ler public.voluntarios, isso é vazamento de dado pessoal');
});

// =====================================================================
// 4. A recusa, contra o servidor de verdade
// =====================================================================

const ROTA = '/admin/voluntarios';

test('a tela de voluntários responde 404 para anônimo', async () => {
  const resposta = await fetch(`${BASE}${ROTA}`, { redirect: 'manual' });

  assert.equal(resposta.status, 404,
    `${ROTA} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
});

test('nada da tela de voluntários vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tela — e o que
  // vazaria não é um título de notícia, é o cadastro de gente.
  const html = await fetch(`${BASE}${ROTA}`).then((resposta) => resposta.text());

  for (const marca of [
    'Voluntários — painel', 'voluntario__ficha', 'voluntario__mensagem', 'voluntario__botoes',
    'Falar por e-mail', 'Nenhuma candidatura ainda', 'Voluntariando',
    'Por que quer ajudar',
    // E, com credenciais, o dado real que existe na tabela (CLAUDE.md, 0q).
    EMAIL_DA_LINHA_REAL, 'TESTE AUTOMATIZADO'
  ]) {
    assert.ok(!html.includes(marca),
      `a resposta de ${ROTA} servida a quem não é equipe contém "${marca}"`);
  }

  assert.match(html, /<title>Página não encontrada/, `${ROTA} não devolveu o 404 do projeto`);
});

// =====================================================================
// 5. A outra metade continua de pé
// =====================================================================

test('/voluntariado/candidatura continua respondendo 200 — ler não fechou candidatar-se', async () => {
  const resposta = await fetch(`${BASE}/voluntariado/candidatura`);
  assert.equal(resposta.status, 200);
});

test('acoes/voluntariado.ts continua guardado por usuarioAtual(), NÃO por ehEquipe()', async () => {
  // Os dois arquivos têm nomes quase iguais e guardas opostas. Esta trava é
  // irmã da que já existe em testes/voluntariado.test.mjs, e fica aqui
  // também porque quem acabou de escrever a guarda de acoes/voluntarios.ts é
  // exatamente quem vai achar que faltou uma no vizinho.
  const codigo = await fonte('../acoes/voluntariado.ts');

  assert.match(codigo, /usuarioAtual\s*\(\s*\)/,
    'a Action de candidatar-se perdeu a guarda de sessão');
  assert.doesNotMatch(codigo, /ehEquipe/,
    'candidatar-se passou a exigir sessão de EQUIPE: isso trancaria justamente o público '
    + 'daquela tela — quem se oferece para ajudar não trabalha na ONG');
});
