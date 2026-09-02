/**
 * Mensagens recebidas (RF29) — a tela onde a equipe LÊ o que o formulário
 * público de /contato grava, e marca o andamento do atendimento.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * Toda requisição HTTP deste arquivo é ANÔNIMA: a suíte não tem sessão de
 * equipe, e não vai ter — não existe porta de diagnóstico para o painel, de
 * propósito (o motivo está no cabeçalho de testes/painel-guarda.test.mjs, e
 * vale em dobro nesta tela, que é a primeira do projeto a pendurar dado
 * pessoal de TERCEIROS). Então **nenhuma mudança de situação é gravada por
 * este arquivo**, e nenhum teste daqui afirma nada sobre isso.
 *
 * O que sobra, e é mais do que parece, são cinco coisas:
 *
 *   1. AS DECISÕES PURAS: quais situações existem, em que ordem a fila
 *      aparece, como cada valor de coluna vira palavra, e o que o `?aviso=`
 *      da URL pode dizer de volta. Moram em
 *      compartilhado/triagem-de-contatos.ts e
 *      compartilhado/avisos-do-painel.ts justamente para caberem aqui.
 *   2. O QUE A LISTA DA EQUIPE DESENHA, renderizando o componente com
 *      `react-dom/server` sem subir o Next. É a única forma de a tela ter
 *      verificação antes de alguém abri-la autenticado.
 *   3. QUE A SERVER ACTION NÃO ESQUEÇA A GUARDA — e que ela continue sem
 *      `insert`, sem `delete` e gravando UMA coluna só. A varredura de
 *      testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5).
 *   4. A RECUSA, por HTTP: a rota nova responde 404 para anônimo e não
 *      vaza nada da tela no HTML servido — inclusive, no modo com
 *      credenciais, o e-mail da linha real que existe na tabela.
 *   5. QUE A OUTRA METADE CONTINUE PÚBLICA: /contato segue respondendo 200
 *      com o formulário, e acoes/contato.ts segue sem `ehEquipe()`. Ligar a
 *      leitura da equipe não pode ter fechado a escrita de quem vem de
 *      fora.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhuma linha de
 * `public.contatos` teve a situação alterada por este código, em ambiente
 * nenhum. O `update`, o `.select('id')` que distingue "não achou linha" de
 * "deu certo" e o caminho de sucesso da Action só podem ser exercitados com
 * uma sessão de equipe. O que se conseguiu exercitar do lado do BANCO está
 * em testes/rls.test.mjs (bloco RF29), contra um Postgres de verdade: a
 * equipe muda a situação, `anon` não, e o `check` recusa situação
 * inventada.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SITUACOES, ehSituacaoDeContato, rotuloDaSituacao, rotuloDaOrigem,
  proximasSituacoes, ordenarParaTriagem, montarTriagem
} from '../compartilhado/triagem-de-contatos.ts';
import { lerMudancaDeSituacao } from '../compartilhado/validacao.ts';
import { avisoDeContatos } from '../compartilhado/avisos-do-painel.ts';
import { ListaContatos } from '../componentes/ListaContatos.ts';
import { PAGINAS_SO_PARA_EQUIPE } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/** Um uuid de verdade, no formato que `gen_random_uuid()` produz. */
const ID = '9f8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/**
 * A linha de teste que ficou no banco de PRODUÇÃO quando o RF07 mediu o
 * caminho de sucesso (CLAUDE.md, "O que trava hoje", item 0m). Ela é o
 * único dado real que existe nesta tabela — e aqui serve para uma coisa só:
 * provar que o e-mail dela NÃO aparece na resposta anônima.
 */
const EMAIL_DA_LINHA_REAL = 'teste-rf07@exemplo.invalid';

/**
 * Uma mensagem de exemplo. O TEXTO É FUNCIONAL, de teste — não é conteúdo
 * institucional inventado sobre a ONG (regra 2 do CLAUDE.md), e não é dado
 * de pessoa real: o e-mail usa `.invalid`, que é reservado por norma
 * justamente para isso.
 */
function exemplo(mudancas = {}) {
  return {
    id: ID,
    origem: 'contato',
    nome: 'Fulana de Teste',
    email: 'fulana@exemplo.invalid',
    telefone: '(11) 95396-8344',
    instituicao: 'Escola de Teste',
    mensagem: 'Primeira linha.\n\nSegunda linha.',
    situacao: 'novo',
    consentimento_dados: true,
    criado_em: '2026-09-01T12:00:00+00:00',
    ...mudancas
  };
}

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

/**
 * Renderiza a lista com `montarTriagem` DE VERDADE no meio — é ele que
 * ordena e traduz os valores de coluna em palavra. Passar itens montados à
 * mão aqui faria o teste medir a si mesmo: o componente desenharia rótulos
 * que o teste inventou, e a tela real usaria outros.
 */
function renderizarLista({ contatos = [], ...props }) {
  return renderToStaticMarkup(createElement(ListaContatos, {
    acaoSituacao: '/acao-de-teste',
    degradou: false,
    itens: montarTriagem(contatos),
    ...props
  }));
}

/**
 * O código sem os comentários — mesma função (e mesmo motivo) de
 * testes/atividades.test.mjs, publicacoes.test.mjs e painel-guarda.test.mjs:
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

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('as três situações são exatamente as do check do banco', async () => {
  // Se alguém acrescentar uma quarta situação na tela sem tocar na
  // migration, a Action vai gravar um valor que o Postgres recusa — e o
  // desfecho na tela é "não deu para fazer isso agora", sem dizer por quê.
  const sql = await readFile(
    fileURLToPath(new URL('../supabase/migrations/004_pessoas.sql', import.meta.url)), 'utf8');

  const trecho = sql.slice(sql.indexOf('create table public.contatos'));
  const check = trecho.match(/situacao\s+text[\s\S]*?check \(situacao in \(([^)]*)\)\)/);
  assert.ok(check, 'não achei o check de situacao em 004_pessoas.sql');

  const noBanco = check[1].split(',').map((valor) => valor.trim().replace(/'/g, ''));

  assert.deepEqual(SITUACOES.map((situacao) => situacao.valor).sort(), noBanco.sort());
});

test('a lista fechada recusa qualquer coisa fora das três', () => {
  for (const valida of ['novo', 'em_contato', 'concluido']) {
    assert.equal(ehSituacaoDeContato(valida), true, `"${valida}" é situação do banco`);
  }

  for (const invalida of [
    '', ' ', 'NOVO', 'novo ', 'apagado', 'concluída', 'true', null, undefined, 1, {}, ['novo'],
    // Herdados do protótipo de Object: o motivo de `Object.hasOwn` existir
    // nos irmãos deste módulo.
    'toString', 'constructor', '__proto__'
  ]) {
    assert.equal(ehSituacaoDeContato(invalida), false,
      `${JSON.stringify(invalida)} não pode passar por situação`);
  }
});

test('o rótulo é feminino na tela e masculino na coluna — e valor desconhecido volta como veio', () => {
  assert.equal(rotuloDaSituacao('novo'), 'Nova');
  assert.equal(rotuloDaSituacao('em_contato'), 'Em contato');
  assert.equal(rotuloDaSituacao('concluido'), 'Concluída');

  // Uma quarta situação criada direto no painel do Supabase: melhor mostrar
  // o valor cru que inventar um rótulo genérico e esconder que a tela ficou
  // velha.
  assert.equal(rotuloDaSituacao('arquivado'), 'arquivado');
});

test('a origem vira palavra, e as quatro do check estão cobertas', () => {
  assert.equal(rotuloDaOrigem('contato'), 'Formulário de contato');
  assert.equal(rotuloDaOrigem('escola'), 'Escola');
  assert.equal(rotuloDaOrigem('doacao'), 'Doação');
  assert.equal(rotuloDaOrigem('voluntariado'), 'Voluntariado');

  assert.equal(rotuloDaOrigem('inventada'), 'inventada');

  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(rotuloDaOrigem(herdado), herdado, `"${herdado}" veio do protótipo`);
  }
});

test('cada mensagem oferece as OUTRAS duas situações — inclusive voltar de concluída', () => {
  // Todas as transições existem nos dois sentidos: a operação acontece num
  // celular, de pé, e um toque errado sem volta é o que faz a equipe parar
  // de usar a tela.
  assert.deepEqual(proximasSituacoes('novo').map((s) => s.valor), ['em_contato', 'concluido']);
  assert.deepEqual(proximasSituacoes('em_contato').map((s) => s.valor), ['novo', 'concluido']);
  assert.deepEqual(proximasSituacoes('concluido').map((s) => s.valor), ['novo', 'em_contato']);

  // Situação que a tela não conhece não pode deixar a mensagem sem saída.
  assert.equal(proximasSituacoes('arquivado').length, 3);
});

test('a fila começa pelo que ainda espera resposta, e dentro do grupo pela mais nova', () => {
  const emOrdemDeChegada = [
    exemplo({ id: 'a', situacao: 'concluido', criado_em: '2026-09-01T10:00:00+00:00' }),
    exemplo({ id: 'b', situacao: 'novo', criado_em: '2026-08-01T10:00:00+00:00' }),
    exemplo({ id: 'c', situacao: 'em_contato', criado_em: '2026-09-02T10:00:00+00:00' }),
    exemplo({ id: 'd', situacao: 'novo', criado_em: '2026-09-03T10:00:00+00:00' })
  ];

  assert.deepEqual(
    ordenarParaTriagem(emOrdemDeChegada).map((contato) => contato.id),
    ['d', 'b', 'c', 'a'],
    'a ordem não é "não respondidas primeiro, e dentro de cada grupo da mais nova para a mais '
    + 'antiga" — é ela que decide o que aparece no primeiro cartão, o único que se vê a 375px '
    + 'sem rolar'
  );
});

test('concluída DESCE, nunca some: a lista continua sendo o registro central', () => {
  const lista = [exemplo({ id: 'velha', situacao: 'concluido' })];

  assert.equal(ordenarParaTriagem(lista).length, 1,
    'a ordenação virou filtro — e /privacidade promete guardar a mensagem "um tempo depois '
    + 'como histórico do contato"');
});

test('situação desconhecida vai para o TOPO, não para o fim onde ninguém rola', () => {
  const lista = [
    exemplo({ id: 'nova', situacao: 'novo' }),
    exemplo({ id: 'estranha', situacao: 'arquivado' })
  ];

  assert.deepEqual(ordenarParaTriagem(lista).map((c) => c.id), ['estranha', 'nova']);
});

test('ordenar devolve uma cópia — o que veio do PostgREST não é mexido no lugar', () => {
  const original = [
    exemplo({ id: 'a', situacao: 'concluido' }),
    exemplo({ id: 'b', situacao: 'novo' })
  ];
  const antes = original.map((contato) => contato.id);

  ordenarParaTriagem(original);

  assert.deepEqual(original.map((contato) => contato.id), antes,
    'ordenarParaTriagem ordenou o array recebido no lugar');
});

test('o botão de triagem manda DOIS campos, e o texto da mensagem não é um deles', () => {
  const dados = formulario({
    id: ID,
    situacao: 'concluido',
    // O que uma requisição montada à mão tentaria injetar. Nada disto é
    // lido: o texto que a pessoa escreveu é registro, e esta tela não edita
    // registro.
    mensagem: 'texto trocado por quem montou a requisição',
    nome: 'Outro Nome',
    email: 'outro@exemplo.invalid',
    origem: 'doacao',
    consentimento_dados: 'false'
  });

  assert.deepEqual(lerMudancaDeSituacao(dados), { id: ID, situacao: 'concluido' });
});

test('um File no lugar de um campo de texto não vira a string "[object File]"', () => {
  const dados = new FormData();
  dados.set('id', new File(['x'], 'foto.jpg'));
  dados.set('situacao', 'concluido');

  assert.equal(lerMudancaDeSituacao(dados).id, '');
});

test('o aviso da URL só escolhe uma frase nossa — nunca traz uma', () => {
  assert.equal(avisoDeContatos('nova').ok, true);
  assert.equal(avisoDeContatos('em-contato').ok, true);
  assert.equal(avisoDeContatos('concluida').ok, true);
  assert.equal(avisoDeContatos('erro').ok, false);

  assert.equal(avisoDeContatos('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDeContatos('inventado'), null);
  assert.equal(avisoDeContatos(undefined), null);
  // Array: é o que o Next entrega quando a URL traz `?aviso=a&aviso=b`.
  assert.equal(avisoDeContatos(['nova']), null);

  for (const herdado of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDeContatos(herdado), null, `"${herdado}" veio do protótipo`);
  }
});

test('nenhum aviso desta tela promete que a pessoa foi respondida', () => {
  // O painel registra que alguém MARCOU. Responder acontece no e-mail ou no
  // WhatsApp, fora daqui — uma frase como "resposta enviada" seria a tela
  // afirmando o que não tem como saber.
  for (const chave of ['nova', 'em-contato', 'concluida']) {
    const texto = avisoDeContatos(chave).texto;
    assert.doesNotMatch(texto, /respond(i|e)mos|resposta enviada|foi respondid/i,
      `o aviso "${chave}" promete resposta: ${texto}`);
  }

  // E "concluída" diz que nada foi apagado, porque é a palavra que mais
  // parece "sumiu".
  assert.match(avisoDeContatos('concluida').texto, /nada foi apagado/);
});

// =====================================================================
// 2. O que a lista da equipe desenha
// =====================================================================

test('cada mensagem diz por ESCRITO em que pé está — não só por cor', () => {
  const html = renderizarLista({
    contatos: [
      exemplo({ id: 'a', situacao: 'novo' }),
      exemplo({ id: 'b', situacao: 'em_contato' }),
      exemplo({ id: 'c', situacao: 'concluido' })
    ]
  });

  assert.match(html, />Nova</);
  assert.match(html, />Em contato</);
  assert.match(html, />Concluída</);
});

test('a origem aparece na tela — hoje só chega uma, e amanhã não', () => {
  const html = renderizarLista({ contatos: [exemplo({ origem: 'contato' })] });
  assert.match(html, /Formulário de contato/);

  const voluntariado = renderizarLista({ contatos: [exemplo({ origem: 'voluntariado' })] });
  assert.match(voluntariado, />Voluntariado</,
    'a mesma tabela vai receber candidatura de voluntariado e doação (RF25/RF19), e a equipe '
    + 'precisa distinguir "quer se voluntariar" de "quer agendar uma apresentação"');
});

test('o e-mail e o telefone são LINKS de responder, não texto para copiar à mão', () => {
  const html = renderizarLista({ contatos: [exemplo()] });

  assert.match(html, /href="mailto:fulana@exemplo\.invalid"/);
  // Só os dígitos no `tel:`, e o que a pessoa digitou na tela: um `tel:` com
  // espaço e parêntese é ignorado por parte dos discadores, e o cenário aqui
  // é o celular.
  assert.match(html, /href="tel:11953968344"/);
  assert.match(html, /\(11\) 95396-8344/);
});

test('campo opcional vazio não desenha rótulo com nada ao lado', () => {
  const html = renderizarLista({
    contatos: [exemplo({ telefone: null, instituicao: null })]
  });

  assert.doesNotMatch(html, /Telefone/);
  assert.doesNotMatch(html, /Instituição/);
  // E o que é obrigatório continua lá.
  assert.match(html, /E-mail/);
});

test('a mensagem chega inteira, com as quebras de linha que a pessoa escreveu', () => {
  const html = renderizarLista({
    contatos: [exemplo({ mensagem: 'Primeira linha.\n\nSegunda linha.' })]
  });

  assert.match(html, /Primeira linha\.\n\nSegunda linha\./,
    'as quebras de linha sumiram — em texto de recado elas SÃO a estrutura');
  assert.match(html, /class="contato__mensagem"/);
});

test('a dobra da mensagem nasce ABERTA no que ainda espera resposta, e fechada no resto', () => {
  // A 375px, dez mensagens abertas viram uma parede; dez fechadas escondem
  // justamente o que a pessoa veio ler.
  const nova = renderizarLista({ contatos: [exemplo({ situacao: 'novo' })] });
  assert.match(nova, /<details[^>]*open/);

  const concluida = renderizarLista({ contatos: [exemplo({ situacao: 'concluido' })] });
  assert.doesNotMatch(concluida, /<details[^>]*open/);

  // `<details>` nativo: abre e fecha sem uma linha de JavaScript.
  assert.match(nova, /<summary/);
});

test('a tela diz que a pessoa autorizou o uso dos dados — a equipe precisa saber que pode responder', () => {
  const html = renderizarLista({ contatos: [exemplo({ consentimento_dados: true })] });

  assert.match(html, /autorizou o uso destes dados para responder/);
  assert.match(html, /não grava sem essa autorização/);
});

test('linha sem autorização — impossível pelo check do banco — ainda assim avisa, e não some', () => {
  // Uma tela que só sabe desenhar o caso bom afirma o caso bom até quando
  // ele deixa de ser verdade.
  const html = renderizarLista({ contatos: [exemplo({ consentimento_dados: false })] });

  assert.match(html, /SEM autorização de uso dos dados/);
  assert.match(html, /Não responda por ela antes de falar com quem cuida do site/);
});

test('os botões de triagem são <form> com POST, não botão com onClick', () => {
  const html = renderizarLista({ contatos: [exemplo({ situacao: 'novo' })] });

  assert.match(html, /<form[^>]*action="\/acao-de-teste"/,
    'o botão saiu de dentro de um <form> — sem script ele deixaria de funcionar, em silêncio');
  assert.match(html, new RegExp(`name="id" value="${ID}"`));
  assert.match(html, /name="situacao" value="em_contato"/);
  assert.match(html, /name="situacao" value="concluido"/);
  // A situação atual não vira botão: um botão que não muda nada é um gesto
  // que não faz nada.
  assert.doesNotMatch(html, /name="situacao" value="novo"/);
});

test('nenhum <form> da lista carrega o texto da mensagem num campo escondido', () => {
  // É assim que o dado voltaria a viajar sem motivo — e voltaria PARA o
  // servidor, num corpo de requisição, a cada toque.
  const html = renderizarLista({
    contatos: [exemplo({ mensagem: 'MARCA-DO-TEXTO-DA-MENSAGEM' })]
  });

  const escondidos = [...html.matchAll(/<input type="hidden" name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(escondidos)].sort(), ['id', 'situacao']);
});

test('cada botão carrega o nome de quem escreveu, para quem usa leitor de tela', () => {
  const html = renderizarLista({ contatos: [exemplo({ nome: 'Fulana de Teste' })] });

  // "Responder por e-mail" repetido dez vezes numa lista não diz qual é
  // qual para quem navega saltando de link em link.
  const rotulos = [...html.matchAll(/class="apenas-leitor-de-tela">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(rotulos, [
    ' a Fulana de Teste', ' — Fulana de Teste', ' — Fulana de Teste'
  ]);
});

test('a lista NÃO oferece apagar nem editar a mensagem — e diz por quê', () => {
  const html = renderizarLista({ contatos: [exemplo()] });

  assert.doesNotMatch(html, /value="apagar"/);
  assert.doesNotMatch(html, />Apagar/);
  assert.doesNotMatch(html, /<textarea/);
  assert.match(html, /não apaga mensagem e não muda o que a pessoa escreveu/);
  // LGPD: /privacidade promete que a pessoa pode pedir a exclusão dos dados
  // dela, e esta tela não faz isso. A frase diz onde se resolve.
  assert.match(html, /fale com quem cuida do site/);
});

test('a legenda das três marcas aparece uma vez só, no fim', () => {
  const html = renderizarLista({
    contatos: [exemplo({ id: 'a' }), exemplo({ id: 'b' }), exemplo({ id: 'c' })]
  });

  const ocorrencias = (html.match(/Nova: ninguém respondeu ainda/g) || []).length;
  assert.equal(ocorrencias, 1,
    `a legenda apareceu ${ocorrencias} vezes — repetir por cartão é uma leitura a mais, por `
    + 'mensagem, para quem usa leitor de tela');

  // E ela usa as palavras de /privacidade para "concluída".
  assert.match(html, /histórico do contato/);
});

test('a tela lembra que está cheia de dado de outras pessoas', () => {
  const html = renderizarLista({ contatos: [exemplo()] });

  assert.match(html, /não é para mostrar a ninguém de fora da equipe/,
    'a forma mais provável de esses dados vazarem é a tela aberta na mão de alguém, num evento '
    + '— e nenhuma política de RLS cobre isso');
});

test('banco fora do ar diz que falhou — nunca "nenhuma mensagem recebida"', () => {
  // A indistinção mais cara desta tela: lista vazia diria "ninguém escreveu
  // para a ONG", e a equipe fecharia o celular deixando gente sem resposta.
  const html = renderizarLista({ contatos: [], degradou: true });

  assert.match(html, /o banco de dados não respondeu/);
  assert.match(html, /as mensagens continuam guardadas/);
  assert.doesNotMatch(html, /Nenhuma mensagem recebida ainda/);
});

test('lista vazia explica de onde nasce uma mensagem — esta tela não cria conteúdo', () => {
  const html = renderizarLista({ contatos: [], degradou: false });

  assert.match(html, /Nenhuma mensagem recebida ainda/);
  assert.match(html, /formulário da página de contato do site/);
  // E lembra que os canais diretos continuam existindo fora daqui.
  assert.match(html, /WhatsApp/);
});

test('o que a pessoa escreveu é escapado — o painel guarda texto puro, não HTML', () => {
  const html = renderizarLista({
    contatos: [exemplo({
      nome: '<script>alert(1)</script>',
      mensagem: '<img src=x onerror=alert(1)>',
      instituicao: '<b>negrito</b>'
    })]
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<b>negrito<\/b>/);
  assert.match(html, /&lt;script&gt;/);
});

test('e-mail com aspas não escapa do atributo do mailto', () => {
  // A validação de acoes/contato.ts recusaria isto hoje, mas a linha pode
  // ser mais velha que a validação — e o dado vem do banco, não do
  // formulário desta tela.
  const html = renderizarLista({
    contatos: [exemplo({ email: 'a"onmouseover="alert(1)@exemplo.invalid' })]
  });

  assert.doesNotMatch(html, /onmouseover="alert/);
  assert.match(html, /&quot;/);
});

// =====================================================================
// 3. A trava da Server Action e da leitura
// =====================================================================

async function corpoDasActions() {
  const codigo = await fonte('../acoes/contatos.ts');

  // Uma função exportada de um arquivo 'use server' É uma URL pública.
  const nomes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(nomes.length > 0, 'nenhuma Server Action encontrada — o teste não verificou nada');

  return nomes.map((nome) => {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    return { nome, corpo: codigo.slice(inicio, proxima === -1 ? undefined : proxima) };
  });
}

test('toda Server Action de contatos chama ehEquipe() por conta própria', async () => {
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) problemas.push(`${nome}: não chama ehEquipe()`);
  }

  assert.deepEqual(
    problemas, [],
    'Server Action do painel sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto: uma Action é endpoint HTTP'
    + '\n  público e não passa por página nem por layout. Ver o cabeçalho de acoes/contatos.ts.'
  );
});

test('NÃO EXISTE insert nem delete em acoes/contatos.ts — esta tela lê e tria', async () => {
  const codigo = await fonte('../acoes/contatos.ts');

  assert.doesNotMatch(codigo, /\.insert\s*\(/,
    'apareceu um insert: quem escreve nesta tabela é o formulário público (acoes/contato.ts)');
  assert.doesNotMatch(codigo, /\.delete\s*\(/,
    'apareceu um delete: apagar não tem desfazer, e apagaria a prova de que houve contato');
});

test('o update grava a coluna situacao e NADA MAIS', async () => {
  const codigo = await fonte('../acoes/contatos.ts');

  // A decisão da tarefa, transformada em trava: o texto que a pessoa
  // escreveu é registro, e editá-lo seria falsificar o que alguém disse à
  // ONG.
  const updates = [...codigo.matchAll(/\.update\(([^)]*)\)/g)].map((m) => m[1].trim());

  assert.deepEqual(updates, ['{ situacao }'],
    'o update desta Action deixou de gravar uma coluna só. Se um dia ele passar a escrever '
    + 'nome, e-mail ou mensagem, esta tela deixa de ser leitura e vira edição de registro.');
});

test('nenhuma Action espalha o que veio da requisição num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

test('a leitura do painel DECLARA a falha em vez de servir lista vazia calada', async () => {
  const codigo = await fonte('../servidor/dados/contatos.ts');

  // `consultarComContagem` desde a paginação do pedido V1: é o mesmo
  // `Degradavel`, com o TOTAL junto. A exigência não mudou — a tela precisa
  // distinguir "ninguém escreveu" de "o banco não respondeu", que é a
  // indistinção mais cara desta tela.
  assert.match(codigo, /consultarCom(Estado|Contagem)/,
    'listarContatos precisa devolver Degradavel, para a tela distinguir "ninguém escreveu" de '
    + '"o banco não respondeu" — a indistinção mais cara desta tela');

  // E O TOTAL DEGRADADO PRECISA SER NULO, nunca zero: `0` seria a tela
  // afirmando "não há mensagem nenhuma" quando a verdade é "não deu para
  // contar". É a mesma regra dos indicadores da home do painel — zero é
  // número, contagem que falhou é traço.
  const helper = await fonte('../servidor/dados/degradacao.ts');
  assert.match(helper, /total: null, degradou: true/,
    'consultarComContagem devolve um total numérico quando a consulta falha — a paginação '
    + 'passaria a afirmar uma contagem que não existe');
  assert.doesNotMatch(codigo, /dados-iniciais/,
    'apareceu uma cópia versionada de mensagem: seria dado pessoal de terceiro dentro do '
    + 'repositório');
});

test('a rota nova está catalogada como tela só da equipe', () => {
  // Sem isto, a reconciliação de testes/links.test.mjs e
  // sem-javascript.test.mjs quebra — e é ela que impede uma página nova de
  // ficar sem cobertura nenhuma, em silêncio.
  assert.ok(PAGINAS_SO_PARA_EQUIPE.includes('/admin/contatos'));
});

// =====================================================================
// 4. A recusa, contra o servidor de verdade
// =====================================================================

const ROTA = '/admin/contatos';

test('a tela de mensagens responde 404 para anônimo', async () => {
  const resposta = await fetch(`${BASE}${ROTA}`, { redirect: 'manual' });

  assert.equal(resposta.status, 404,
    `${ROTA} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
});

test('nada da tela de mensagens vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tela — e o que
  // vazaria não é um título de notícia, é gente.
  const html = await fetch(`${BASE}${ROTA}`).then((resposta) => resposta.text());

  for (const marca of [
    'Mensagens — painel', 'contato__ficha', 'contato__mensagem', 'contato__consentimento',
    'Responder por e-mail', 'Nenhuma mensagem recebida ainda',
    'Formulário de contato', 'autorizou o uso destes dados',
    // E, com credenciais, o dado real que existe na tabela.
    EMAIL_DA_LINHA_REAL, 'TESTE AUTOMATIZADO'
  ]) {
    assert.ok(!html.includes(marca),
      `a resposta de ${ROTA} servida a quem não é equipe contém "${marca}"`);
  }

  assert.match(html, /<title>Página não encontrada/, `${ROTA} não devolveu o 404 do projeto`);
});

// =====================================================================
// 5. A outra metade continua pública
// =====================================================================

test('/contato continua respondendo 200 com o formulário — ler não fechou escrever', async () => {
  const resposta = await fetch(`${BASE}/contato`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  assert.match(html, /id="form-contato"/,
    'o formulário público sumiu de /contato — a tela da equipe não pode ter fechado o único '
    + 'canal que qualquer pessoa pode usar');
});

test('acoes/contato.ts (singular) continua SEM ehEquipe() — a assimetria é o desenho', async () => {
  // Os dois arquivos têm nomes quase iguais e políticas opostas. Esta trava
  // é irmã da que já existe em testes/contato.test.mjs, e fica aqui também
  // porque quem acabou de escrever a guarda de acoes/contatos.ts é
  // exatamente quem vai achar que faltou uma no vizinho.
  const codigo = await fonte('../acoes/contato.ts');

  assert.doesNotMatch(codigo, /ehEquipe/,
    'o formulário público de /contato passou a exigir sessão de equipe: quem escreve para a '
    + 'ONG não tem conta, e a política do banco é `for insert with check (true)`');
});

test('montarTriagem entrega a lista pronta: ordenada, com rótulo e com os botões de cada item', () => {
  // A função que a PÁGINA chama. Ela existe porque o componente é `.ts`
  // para caber num teste do Node, e o Node não resolve o alias `@/...` num
  // import de valor — as duas medições que fecharam as outras saídas estão
  // no cabeçalho dela.
  const itens = montarTriagem([
    exemplo({ id: 'a', situacao: 'concluido', origem: 'doacao' }),
    exemplo({ id: 'b', situacao: 'novo', origem: 'contato' })
  ]);

  assert.deepEqual(itens.map((item) => item.contato.id), ['b', 'a'],
    'montarTriagem devolveu na ordem em que recebeu — a ordem da fila é decisão dele');

  assert.equal(itens[0].situacaoRotulo, 'Nova');
  assert.equal(itens[0].origemRotulo, 'Formulário de contato');
  assert.equal(itens[0].nova, true);
  assert.deepEqual(itens[0].destinos.map((d) => d.valor), ['em_contato', 'concluido']);

  assert.equal(itens[1].situacaoRotulo, 'Concluída');
  assert.equal(itens[1].origemRotulo, 'Doação');
  assert.equal(itens[1].nova, false);
});
