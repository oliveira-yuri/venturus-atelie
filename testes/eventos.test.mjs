/**
 * RF13 + RF14 — a agenda: a equipe cadastra e publica, /agenda mostra.
 *
 * ===================================================================
 * TZ=UTC ANTES DE QUALQUER `new Date`, E É O PONTO DESTE ARQUIVO
 * ===================================================================
 *
 * `node --test` roda cada arquivo em seu próprio processo, então isto vale
 * só aqui e não contamina o resto da suíte. Node aplica a troca de
 * `process.env.TZ` ao motor de datas (o cache de fuso do V8 é invalidado na
 * atribuição), o que faz este arquivo medir EXATAMENTE o que a Netlify faz:
 * função rodando em UTC.
 *
 * É a mesma abertura de testes/lista-eventos.test.mjs, e pelo mesmo motivo —
 * mas do OUTRO LADO do problema. Lá se mede a LEITURA (um instante do banco
 * virando texto na tela); aqui se mede a ESCRITA (a hora que a equipe digita
 * virando um instante no banco). O defeito do Bloco A foi o primeiro; o
 * segundo é pior, porque grava errado para sempre — consertar a exibição
 * depois não conserta a linha.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE CONTA COM `eh_equipe` neste projeto (CLAUDE.md, "O que trava
 * hoje", itens 2 e 3): existe conta comum utilizável, e ninguém concedeu o
 * papel de equipe a ela. Toda requisição HTTP deste arquivo é ANÔNIMA.
 * Então o caminho de quem É equipe — a lista desenhada, o cadastro gravando,
 * o botão publicando — não é medido aqui, e nenhum teste deste arquivo
 * afirma nada sobre ele.
 *
 * O que sobra são seis coisas:
 *
 *   1. O FUSO, por unidade e sob TZ=UTC: ida, volta, e o caso em que errar
 *      muda o DIA, não só o relógio.
 *   2. A VALIDAÇÃO do formulário, incluindo a regra que o banco também tem
 *      (`termino_depois_do_inicio`) e que aqui vira frase em vez de erro
 *      23514.
 *   3. O OBJETO QUE VAI AO BANCO, alimentado com um FormData HOSTIL: nem
 *      `publicado`, nem `vagas`, nem `exige_cpf` podem aparecer nele.
 *   4. O QUE A LISTA DA EQUIPE DESENHA, por unidade, sem sessão.
 *   5. A VARREDURA DE `acoes/eventos.ts`: `ehEquipe()` em toda Action, e
 *      sem `delete` — a varredura de testes/painel-guarda.test.mjs cobre
 *      `app/admin/**` e NÃO alcança Action, que é endpoint HTTP público
 *      (spec §4.5).
 *   6. A RECUSA, por HTTP: as duas rotas novas respondem 404 para anônimo e
 *      não vazam nada do painel no HTML servido.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhuma linha de
 * `public.eventos` foi escrita por este código, em ambiente nenhum. O
 * `insert`, o `update`, o `.select('id')` que distingue "não achou linha" de
 * "deu certo", o `revalidatePath('/agenda')` e o caminho de sucesso das duas
 * Actions só podem ser exercitados com sessão de equipe.
 */
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerEvento, validarEvento, colunasDoEvento, lerAlternancia,
  ehMomentoLocal, instanteDeSaoPaulo, momentoLocalDe,
  FUSO_DA_ONG, LIMITE_TITULO, LIMITE_LOCAL, LIMITE_FAIXA_ETARIA, LIMITE_DESCRICAO
} from '../compartilhado/validacao.ts';
import { avisoDeEventos } from '../compartilhado/avisos-do-painel.ts';
import { ListaEventosPainel } from '../componentes/ListaEventosPainel.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/** Um uuid de verdade — o formato que `gen_random_uuid()` produz. */
const UUID = '11111111-2222-4333-8444-555555555555';

/**
 * Um evento de exemplo para renderizar o componente. O TEXTO É FUNCIONAL,
 * de teste — não é conteúdo institucional inventado sobre a ONG (regra 2 do
 * CLAUDE.md): são marcas curtas que só existem para o teste achar.
 */
function exemplo(mudancas = {}) {
  return {
    id: UUID,
    titulo: 'EVENTO DE TESTE',
    descricao: null,
    comeca_em: '2026-11-05T22:00:00.000Z',
    termina_em: null,
    local: null,
    faixa_etaria: null,
    publicado: false,
    criado_em: '2026-09-01T12:00:00.000Z',
    ...mudancas
  };
}

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

/** Um formulário válido mínimo, para partir dele e estragar um campo por vez. */
function camposValidos(mudancas = {}) {
  return {
    id: '', titulo: 'EVENTO DE TESTE', descricao: '',
    comeca_em: '2026-11-05T19:00', termina_em: '', local: '', faixa_etaria: '',
    ...mudancas
  };
}

function renderizarLista(props) {
  return renderToStaticMarkup(createElement(ListaEventosPainel, {
    acaoAlternar: '/acao-de-teste',
    caminhoEditar: '/admin/eventos/editar',
    degradou: false,
    ...props
  }));
}

/**
 * O código sem os comentários — mesma função (e mesmo motivo) de
 * testes/publicacoes.test.mjs, testes/atividades.test.mjs e
 * testes/painel-guarda.test.mjs: sem isto a varredura lê o que o arquivo
 * EXPLICA e conclui que o código faz. O cabeçalho de acoes/eventos.ts fala
 * de `delete` justamente para contar por que ele NÃO existe.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function lerArquivo(caminho) {
  return readFile(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8');
}

// =====================================================================
// 1. O fuso — a armadilha desta tarefa
// =====================================================================

test('este arquivo está mesmo rodando em UTC — sem isso os testes de fuso não provam nada', () => {
  // `import` é içado em ESM: os imports acima executam ANTES da linha
  // `process.env.TZ = 'UTC'`. Vale a mesma medição de
  // testes/lista-eventos.test.mjs (o V8 invalida o cache de fuso na
  // atribuição, e o formatador só é criado na hora de formatar) — mas
  // "medido uma vez" não é "verificado a cada rodada": se uma versão futura
  // do Node mudar isso, os testes abaixo passariam por acidente na máquina
  // de quem desenvolve (America/Sao_Paulo) e o defeito voltaria à produção.
  assert.equal(
    Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC',
    'process.env.TZ = "UTC" no topo do arquivo não pegou: os testes de fuso viram tautologia'
  );
});

test('19h de São Paulo vira 22:00Z no banco, e não 19:00Z — o processo está em UTC', () => {
  // O NÚMERO É O DEFEITO REAL DO PROJETO, ao contrário: um evento das 19h
  // saiu como 22:00 na tela porque a leitura ignorava o fuso. Aqui é a
  // escrita: sem `instanteDeSaoPaulo`, um `new Date('2026-11-05T19:00')`
  // neste processo daria 19:00Z, e a agenda (que imprime certo) mostraria
  // 16:00.
  assert.equal(instanteDeSaoPaulo('2026-11-05T19:00'), '2026-11-05T22:00:00.000Z');

  assert.notEqual(
    instanteDeSaoPaulo('2026-11-05T19:00'), '2026-11-05T19:00:00.000Z',
    'a hora foi gravada como se fosse UTC: compartilhado/validacao.ts perdeu o fuso explícito'
  );
});

test('a volta desfaz a ida: o campo reabre com a hora que a pessoa digitou', () => {
  // Sem isto, editar um evento das 19h num servidor em UTC devolveria
  // "22:00" no campo, e quem apertasse "Guardar" sem mexer em nada
  // empurraria o evento três horas para a frente — a cada edição.
  for (const escrito of ['2026-11-05T19:00', '2026-01-01T00:00', '2026-07-15T23:59']) {
    assert.equal(momentoLocalDe(instanteDeSaoPaulo(escrito)), escrito,
      `ida e volta não bateram para ${escrito}`);
  }
});

test('evento de fim de noite: errar o fuso mudaria o DIA, não só o relógio', () => {
  // 22h de São Paulo no dia 5 é 01:00Z do dia 6. Se a conversão fosse feita
  // no fuso do processo, o banco receberia 22:00Z do dia 5 — e a agenda, que
  // imprime em São Paulo, mostraria 19:00 do dia 5. Três horas de erro que
  // viram um dia inteiro quando o evento é depois das 21h.
  assert.equal(instanteDeSaoPaulo('2026-11-05T22:00'), '2026-11-06T01:00:00.000Z');
  assert.equal(momentoLocalDe('2026-11-06T01:00:00.000Z'), '2026-11-05T22:00');
});

test('meia-noite não vira 24:00 nem pula de dia', () => {
  // `hour12: false` produz hora 24 em vez de 0 em alguns runtimes, e é o
  // tipo de coisa que só aparece no primeiro evento marcado para 00:00.
  assert.equal(instanteDeSaoPaulo('2026-03-10T00:00'), '2026-03-10T03:00:00.000Z');
  assert.equal(momentoLocalDe('2026-03-10T03:00:00.000Z'), '2026-03-10T00:00');
});

test('data impossível é recusada, não convertida em outro dia', () => {
  // `Date.UTC(2026, 1, 31)` devolve 3 de março, calado. Uma data assim chega
  // de um corpo montado à mão (o seletor do navegador não a produz), e
  // gravá-la como outro dia seria pior que recusar.
  assert.equal(instanteDeSaoPaulo('2026-02-31T10:00'), null);
  assert.equal(instanteDeSaoPaulo('2026-13-01T10:00'), null);
  assert.equal(instanteDeSaoPaulo('2026-11-05T25:00'), null);
  assert.equal(instanteDeSaoPaulo('05/11/2026 19:00'), null);
  assert.equal(instanteDeSaoPaulo(''), null);
});

test('segundos no corpo são aceitos e ignorados — o campo não os manda, o HTTP pode', () => {
  assert.equal(ehMomentoLocal('2026-11-05T19:00:30'), true);
  assert.equal(instanteDeSaoPaulo('2026-11-05T19:00:30'), '2026-11-05T22:00:30.000Z');
});

test('momentoLocalDe não devolve "Invalid Date" para lixo — devolve vazio', () => {
  // O campo recebe isto como `defaultValue`. "Invalid Date" ali seria texto
  // dentro de um <input type="datetime-local">, que o navegador descarta
  // sem dizer nada — a pessoa veria o campo vazio e não saberia por quê.
  assert.equal(momentoLocalDe('nao-e-data'), '');
});

/**
 * A TRAVA DA DUPLICAÇÃO DO FUSO, estendida.
 *
 * `FUSO_DA_ONG` existe em quatro arquivos (componentes/ListaEventos.ts,
 * ListaNoticias.ts, MinhaConta.ts e agora compartilhado/validacao.ts), mais
 * o literal em ListaPublicacoes.ts, ListaMidia.ts, ListaContatos.ts e
 * ListaEventosPainel.ts — porque esses arquivos são importados pelo runtime
 * nativo do Node, que não resolve o alias `@/...` do tsconfig nem caminho
 * relativo sem extensão. A duplicação é consciente e está escrita nos
 * arquivos; este teste é o que impede as cópias de divergirem em silêncio,
 * que é o único risco real dela.
 *
 * testes/publicacoes.test.mjs tem o irmão deste, com três arquivos. Este
 * cobre os dois que a agenda usa mais o módulo de validação — onde a
 * ESCRITA acontece, e onde a divergência custaria dado gravado errado.
 */
test('todo arquivo que conhece o fuso declara o MESMO fuso', async () => {
  const fusoDe = async (arquivo) => {
    const codigo = await lerArquivo(arquivo);
    const achados = [...codigo.matchAll(/'(America\/[A-Za-z_]+)'/g)].map((m) => m[1]);
    assert.ok(achados.length > 0, `${arquivo} não declara fuso nenhum`);
    return [...new Set(achados)];
  };

  for (const arquivo of [
    '../compartilhado/validacao.ts',
    '../componentes/ListaEventos.ts',
    '../componentes/ListaEventosPainel.ts'
  ]) {
    assert.deepEqual(await fusoDe(arquivo), ['America/Sao_Paulo'],
      `${arquivo} usa mais de um fuso, ou um fuso diferente dos outros`);
  }

  // E a constante exportada precisa dizer o mesmo, senão o valor certo nos
  // arquivos conviveria com um errado na função que converte.
  assert.equal(FUSO_DA_ONG, 'America/Sao_Paulo');
});

// =====================================================================
// 2. A validação do formulário
// =====================================================================

test('um evento mínimo válido é aceito: nome e começo bastam', () => {
  const { valido, erros } = validarEvento(lerEvento(formulario(camposValidos())));
  assert.equal(valido, true, `recusou um formulário válido: ${JSON.stringify(erros)}`);
});

test('sem nome e sem data, os DOIS erros voltam de uma vez', () => {
  const { valido, erros } = validarEvento(
    lerEvento(formulario(camposValidos({ titulo: '', comeca_em: '' }))));

  assert.equal(valido, false);
  assert.ok(erros.titulo, 'não acusou a falta do nome');
  assert.ok(erros.comeca_em, 'não acusou a falta da data');
});

test('terminar antes de começar é recusado AQUI, com frase — o banco recusaria com 23514', () => {
  const { valido, erros } = validarEvento(lerEvento(formulario(camposValidos({
    comeca_em: '2026-11-05T19:00', termina_em: '2026-11-05T18:00'
  }))));

  assert.equal(valido, false);
  assert.match(erros.termina_em, /terminar antes de começar/);
});

test('terminar no MESMO minuto também é recusado — o `check` do banco é `>`, não `>=`', () => {
  const { valido } = validarEvento(lerEvento(formulario(camposValidos({
    comeca_em: '2026-11-05T19:00', termina_em: '2026-11-05T19:00'
  }))));

  assert.equal(valido, false);
});

test('terminar depois de começar passa, inclusive virando o dia', () => {
  const { valido, erros } = validarEvento(lerEvento(formulario(camposValidos({
    comeca_em: '2026-11-05T22:00', termina_em: '2026-11-06T01:00'
  }))));

  assert.equal(valido, true, JSON.stringify(erros));
});

test('hora de terminar em branco é válida — a maior parte do que a ONG marca não tem', () => {
  const { valido } = validarEvento(lerEvento(formulario(camposValidos({ termina_em: '' }))));
  assert.equal(valido, true);
});

test('cada campo longo demais acusa o próprio campo, com o número no texto', () => {
  const casos = [
    ['titulo', LIMITE_TITULO],
    ['local', LIMITE_LOCAL],
    ['faixa_etaria', LIMITE_FAIXA_ETARIA],
    ['descricao', LIMITE_DESCRICAO]
  ];

  for (const [campo, limite] of casos) {
    const { valido, erros } = validarEvento(
      lerEvento(formulario(camposValidos({ [campo]: 'x'.repeat(limite + 1) }))));

    assert.equal(valido, false, `${campo} passou do limite e foi aceito`);
    assert.ok(erros[campo], `o erro de ${campo} não ficou pendurado no campo ${campo}`);
    assert.match(erros[campo], new RegExp(String(limite)),
      `o erro de ${campo} não diz qual é o limite`);
  }
});

test('id preenchido que não é uuid é recusado antes de o Postgres ver (22P02)', () => {
  const { valido, erros } = validarEvento(
    lerEvento(formulario(camposValidos({ id: 'nao-e-uuid' }))));

  assert.equal(valido, false);
  assert.ok(erros.id);
});

test('id vazio é evento NOVO, não erro', () => {
  const { valido, erros } = validarEvento(lerEvento(formulario(camposValidos({ id: '' }))));
  assert.equal(valido, true, JSON.stringify(erros));
});

test('um File no campo de texto não vira "[object File]" gravado no banco', () => {
  // Precaução 1 do bloco "Leitura do FormData": `dados.get()` devolve
  // `string | File | null`. A Action é endpoint HTTP público.
  const dados = formulario(camposValidos());
  dados.set('titulo', new File(['x'], 'foto.jpg'));

  const campos = lerEvento(dados);
  assert.equal(campos.titulo, '');
  assert.equal(validarEvento(campos).valido, false, 'aceitou um File como nome do evento');
});

// =====================================================================
// 3. O objeto que vai ao banco, com FormData hostil
// =====================================================================

test('colunasDoEvento converte o fuso e transforma texto vazio em NULL', () => {
  const linha = colunasDoEvento(lerEvento(formulario(camposValidos({
    comeca_em: '2026-11-05T19:00', local: '', descricao: '', faixa_etaria: ''
  }))));

  assert.equal(linha.comeca_em, '2026-11-05T22:00:00.000Z');
  assert.equal(linha.local, null, 'gravaria string vazia, e a agenda desenharia um " · " solto');
  assert.equal(linha.descricao, null);
  assert.equal(linha.faixa_etaria, null);
  assert.equal(linha.termina_em, null);
});

test('CORPO HOSTIL: publicado, vagas e exige_cpf NÃO chegam ao objeto do insert', () => {
  // A disciplina da regra 6 do CLAUDE.md aplicada a outros campos. Um
  // `...campos` no lugar das chaves escritas à mão faria `publicado=true`
  // pôr um evento na agenda pelo formulário de texto, sem passar pelo botão.
  const dados = formulario(camposValidos());
  dados.set('publicado', 'true');
  dados.set('vagas', '999');
  dados.set('exige_cpf', 'true');
  dados.set('criado_em', '1999-01-01T00:00:00.000Z');
  dados.set('imagem_caminho', 'qualquer/coisa.jpg');

  const linha = colunasDoEvento(lerEvento(dados));

  assert.deepEqual(
    Object.keys(linha).sort(),
    ['comeca_em', 'descricao', 'faixa_etaria', 'local', 'termina_em', 'titulo'],
    'o objeto que vai ao banco ganhou (ou perdeu) uma chave'
  );
});

test('colunasDoEvento devolve null quando a data não converte, em vez de gravar nulo', () => {
  // A coluna `comeca_em` é `not null`. Sem esta saída, um `null` ali viraria
  // erro de banco cru na tela.
  assert.equal(colunasDoEvento(lerEvento(formulario(camposValidos({ comeca_em: 'x' })))), null);
});

test('o botão de publicar é lista fechada: valor inesperado vira null, não "despublicar"', () => {
  assert.deepEqual(lerAlternancia(formulario({ id: UUID, acao: 'publicar' })),
    { id: UUID, acao: 'publicar' });
  assert.deepEqual(lerAlternancia(formulario({ id: UUID, acao: 'apagar' })),
    { id: UUID, acao: null });
});

// =====================================================================
// 4. O que a lista da equipe desenha
// =====================================================================

test('a lista diz por ESCRITO se cada evento está na agenda — não só por cor', () => {
  const html = renderizarLista({
    eventos: [
      exemplo({ titulo: 'RASCUNHO DE TESTE', publicado: false }),
      exemplo({ id: '00000000-0000-4000-8000-000000000001', titulo: 'NO AR DE TESTE', publicado: true })
    ]
  });

  // Quem usa leitor de tela precisa OUVIR o estado; um contorno mais claro
  // não é anunciado.
  assert.match(html, />Rascunho</);
  assert.match(html, />Na agenda</);
});

test('a hora na lista da equipe é a de São Paulo, com o processo em UTC', () => {
  // 22:00Z é 19:00 em São Paulo. Sem o `timeZone` explícito sairia "22:00" —
  // e a equipe conferiria a agenda contra uma hora que não é a que ela
  // marcou.
  const html = renderizarLista({ eventos: [exemplo({ comeca_em: '2026-11-05T22:00:00.000Z' })] });

  assert.match(html, /05\/11\/2026, às 19:00/);
  assert.doesNotMatch(html, /às 22:00/,
    'a hora saiu em UTC: componentes/ListaEventosPainel.ts perdeu o timeZone explícito');
});

test('o botão de cada item manda id e ação, e o rótulo é o oposto do estado', () => {
  const html = renderizarLista({ eventos: [exemplo({ publicado: true })] });

  assert.match(html, new RegExp(`name="id" value="${UUID}"`));
  assert.match(html, /name="acao" value="despublicar"/);
  assert.match(html, />Tirar do ar</);
});

test('cada botão e cada link carregam o nome do evento para quem navega por links', () => {
  const html = renderizarLista({ eventos: [exemplo()] });
  const marcas = html.match(/apenas-leitor-de-tela">[^<]*/g) ?? [];

  assert.ok(marcas.length >= 2,
    '"Editar" e "Publicar" repetidos numa lista não dizem qual item é qual');
  for (const marca of marcas) assert.match(marca, /EVENTO DE TESTE/);
});

test('publicar/tirar do ar é um <form> de verdade, não um onClick', () => {
  // Um handler de clique quebraria o painel para quem está sem script, em
  // silêncio.
  const html = renderizarLista({ eventos: [exemplo()] });

  // `<form ...>` com o `action` no meio dos atributos: react-dom/server emite
  // `class` antes de `action`, e prender o teste à ORDEM dos atributos o
  // faria quebrar numa atualização do React sem nada ter piorado.
  assert.match(html, /<form[^>]*action="\/acao-de-teste"/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /onclick/i);
});

test('NÃO existe botão de apagar, e a tela diz por quê — inclusive as inscrições', () => {
  const html = renderizarLista({ eventos: [exemplo()] });

  assert.doesNotMatch(html, />Apagar</, 'apareceu um botão de apagar: ver acoes/eventos.ts');
  assert.match(html, /apagaria junto a lista de quem se inscreveu/,
    'a lista não explica por que não dá para apagar — botão ausente e não explicado vira busca');
});

test('a lista avisa que o site NÃO tem inscrição — /agenda promete um formulário que não existe', () => {
  // RF15 é fora do escopo desta tarefa, e a página pública, desde o site
  // antigo, diz "basta preencher o formulário do evento". A partir do
  // primeiro evento publicado, alguém vai procurar esse botão.
  for (const eventos of [[], [exemplo()]]) {
    const html = renderizarLista({ eventos });
    assert.match(html, /ainda não tem formulário de inscrição/,
      'a equipe publicaria o primeiro evento sem saber que ninguém consegue se inscrever');
  }
});

test('lista vazia é o estado vazio escrito, não o aviso de falha', () => {
  const html = renderizarLista({ eventos: [] });

  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, /Nenhum evento cadastrado ainda/);
  assert.doesNotMatch(html, /estado--erro/);
});

test('consulta que falhou NÃO vira lista vazia no painel — diria que o cadastro se perdeu', () => {
  // A diferença que existe aqui e não existe em /agenda: quem está nesta
  // tela acabou de cadastrar. Uma lista vazia a faria cadastrar de novo, e
  // não há tela que apague o duplicado.
  const html = renderizarLista({ eventos: [], degradou: true });

  assert.match(html, /class="estado estado--erro"/);
  assert.match(html, /o banco de dados não respondeu/);
  assert.doesNotMatch(html, /Nenhum evento cadastrado ainda/);
});

test('evento sem local não deixa " · " solto na linha da data', () => {
  const html = renderizarLista({ eventos: [exemplo({ local: null })] });
  const linha = html.match(/<p class="evento-painel__quando">[\s\S]*?<\/p>/)[0];

  assert.doesNotMatch(linha, / · /);
});

// =====================================================================
// 5. Os avisos, por lista fechada
// =====================================================================

test('?aviso= escolhe uma frase nossa e nunca traz uma', () => {
  assert.equal(avisoDeEventos('criado').ok, true);
  assert.equal(avisoDeEventos('erro').ok, false);
  assert.equal(avisoDeEventos('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDeEventos(undefined), null);

  // `Object.hasOwn`, e não `AVISOS[valor]` direto: sem isto, `?aviso=toString`
  // devolveria algo herdado do protótipo de Object.
  assert.equal(avisoDeEventos('toString'), null);
  assert.equal(avisoDeEventos('constructor'), null);
});

test('nenhum aviso de evento promete inscrição — RF15 não existe', () => {
  for (const chave of ['criado', 'salvo', 'publicado', 'retirado', 'erro']) {
    assert.doesNotMatch(avisoDeEventos(chave).texto, /inscri/i,
      `o aviso "${chave}" promete à ONG um gesto que o site não tem`);
  }
});

test('o aviso de "criado" diz que o evento NÃO está na agenda ainda', () => {
  // Publicar é ato separado. Um "guardado" liso faria a equipe achar que a
  // data já está no ar — e ninguém apareceria, ou apareceria no dia errado.
  assert.match(avisoDeEventos('criado').texto, /ainda NÃO aparece na agenda/);
});

// =====================================================================
// 6. A varredura de acoes/eventos.ts
//
// A varredura de testes/painel-guarda.test.mjs lê `app/admin/**` e NÃO
// alcança Server Action, que é endpoint HTTP público (spec §4.5) e não passa
// por página nem por layout.
// =====================================================================

test('TODA Server Action de eventos chama ehEquipe() por conta própria', async () => {
  const codigo = semComentarios(await lerArquivo('../acoes/eventos.ts'));

  const exportadas = [...codigo.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.ok(exportadas.length >= 2,
    `a varredura encontrou ${exportadas.length} Actions em acoes/eventos.ts — ela não verificou nada`);

  for (const nome of exportadas) {
    const corpo = codigo.slice(codigo.indexOf(`export async function ${nome}`));
    const ateAProxima = corpo.slice(0, corpo.indexOf('\nexport async function', 1) + 1 || undefined);

    assert.match(ateAProxima, /await ehEquipe\(\)/,
      `${nome} não chama ehEquipe(): Action é endpoint HTTP público e não passa pela guarda da página`);
  }
});

test('acoes/eventos.ts NÃO tem delete — apagar um evento apagaria as inscrições em cascata', () => {
  // `inscricoes.evento_id ... on delete cascade` (003_eventos.sql). Hoje a
  // tabela está vazia; no dia em que a RF15 existir, um toque errado
  // destruiria a lista de presença de um evento que já aconteceu.
  return lerArquivo('../acoes/eventos.ts').then((bruto) => {
    const codigo = semComentarios(bruto);
    assert.doesNotMatch(codigo, /\.delete\(/,
      'apareceu um delete em acoes/eventos.ts — ver o cabeçalho daquele arquivo');
  });
});

test('salvarEvento não conhece a coluna `publicado` — nem para escrever false', async () => {
  const codigo = semComentarios(await lerArquivo('../acoes/eventos.ts'));
  const salvar = codigo.slice(codigo.indexOf('export async function salvarEvento'),
    codigo.indexOf('export async function alternarEvento'));

  assert.doesNotMatch(salvar, /publicado/,
    'salvarEvento menciona `publicado`: um formulário de texto que também publica é como uma '
    + 'data errada vai para a agenda por acidente');
});

test('a conversão de fuso NÃO mora na Action: ela é a função pura, medível sob TZ=UTC', async () => {
  const codigo = semComentarios(await lerArquivo('../acoes/eventos.ts'));

  assert.doesNotMatch(codigo, /America\/Sao_Paulo/,
    'a Action passou a converter fuso por conta própria — ela não entra num node --test, e é '
    + 'exatamente por isso que a conversão vive em compartilhado/validacao.ts');
  assert.match(codigo, /colunasDoEvento/);
});

test('as duas páginas novas guardam o corpo E o título', async () => {
  // A varredura de painel-guarda.test.mjs já faz isto para `app/admin/**`
  // inteiro. Aqui é a mesma cobrança, escrita no arquivo da tarefa, para que
  // uma quebra aponte para cá em vez de para um teste de outra tarefa.
  for (const arquivo of ['../app/admin/eventos/page.tsx', '../app/admin/eventos/editar/page.tsx']) {
    const codigo = semComentarios(await lerArquivo(arquivo));

    assert.match(codigo, /export async function generateMetadata/,
      `${arquivo} usa metadata estático: o TÍTULO vaza no payload mesmo com a página protegida`);

    const chamadas = [...codigo.matchAll(/if \(!await ehEquipe\(\)\) notFound\(\);/g)];
    assert.ok(chamadas.length >= 2,
      `${arquivo} tem ${chamadas.length} guarda(s): precisa de uma no componente e outra no metadata`);
  }
});

// =====================================================================
// 7. A recusa, contra o servidor de verdade
// =====================================================================

const ROTAS_NOVAS = ['/admin/eventos', '/admin/eventos/editar'];

test('as duas telas novas do painel respondem 404 para anônimo', async () => {
  for (const rota of ROTAS_NOVAS) {
    const resposta = await fetch(`${BASE}${rota}`, { redirect: 'manual' });
    assert.equal(resposta.status, 404,
      `${rota} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
  }
});

test('nada das telas de agenda vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tarefa.
  for (const rota of ROTAS_NOVAS) {
    const html = await fetch(`${BASE}${rota}`).then((resposta) => resposta.text());

    for (const marca of [
      'painel da equipe', 'evento-painel', 'eventos-painel',
      'Cadastrar evento', 'Guardar rascunho', 'Nenhum evento cadastrado',
      'Escreva a hora normal'
    ]) {
      assert.ok(!html.includes(marca),
        `a resposta de ${rota} servida a quem não é equipe contém "${marca}"`);
    }

    assert.match(html, /<title>Página não encontrada/, `${rota} não devolveu o 404 do projeto`);
  }
});

test('a tela de edição com um id qualquer também é 404 — não conta o que existe', async () => {
  const resposta = await fetch(`${BASE}/admin/eventos/editar?id=${UUID}`);
  assert.equal(resposta.status, 404);
});

// =====================================================================
// 8. /agenda intacta
// =====================================================================

test('/agenda continua no ar, com as duas seções e o estado vazio escrito', async () => {
  // A tabela `eventos` está vazia (e no modo offline não há Supabase
  // nenhum), então a página continua mostrando o estado vazio da Tarefa A4.
  // É o que prova que ligar o painel à tabela não mexeu na página pública —
  // cujo texto é comparado palavra por palavra com o HTML original em
  // testes/paridade-texto.test.mjs.
  const resposta = await fetch(`${BASE}/agenda`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  assert.match(html, /id="titulo-proximos"/);
  assert.match(html, /id="titulo-passados"/);
  assert.match(html, /Nenhuma atividade marcada por enquanto/);

  // E nada do painel encostou na página pública.
  assert.ok(!html.includes('evento-painel'), '/agenda serve marcação da tela da equipe');
});
