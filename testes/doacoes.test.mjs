/**
 * O ciclo de doações (RF19–RF22): `/doar/ofertar`, as três Server Actions
 * de `acoes/doacoes.ts`, a fila da equipe em `/admin/doacoes` e o que a
 * área do usuário passa a mostrar.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR AQUI, E O QUE NÃO DÁ
 * ===================================================================
 *
 * A suíte NÃO TEM SESSÃO — mesma limitação de testes/minha-conta.test.mjs,
 * testes/voluntariado.test.mjs e testes/painel-guarda.test.mjs: toda
 * requisição feita por este arquivo é ANÔNIMA. Então o caminho de quem ESTÁ
 * autenticado (o formulário desenhado, a oferta que grava, a doação
 * aparecendo em /minha-conta) e TODO o caminho de equipe (as três telas do
 * painel por dentro, a resposta que grava, o registro que insere) NÃO são
 * exercidos por teste nenhum deste arquivo. Nenhum teste aqui afirma nada
 * sobre eles.
 *
 * ISSO NÃO É UM BURACO ESCONDIDO: é a mesma fronteira que o projeto inteiro
 * tem desde o painel (CLAUDE.md, "O que trava hoje", itens 1 e 2). O que
 * sobra aqui, e é bastante, são cinco coisas:
 *
 *   1. AS DECISÕES PURAS — o que cada Action aceita (`lerOferta`,
 *      `lerAnalise`, `lerRegistro`), o que recusa (`validarOferta`,
 *      `validarAnalise`, `validarRegistro`), o que manda ao banco
 *      (`colunasDaOferta`, `colunasDaAnalise`, `colunasDoRegistro`) e em
 *      que ordem a fila aparece (`ordenarParaAnalise`). É aqui que mora a
 *      trava do corpo hostil;
 *   2. A LEITURA DE DINHEIRO (`numeroDoValor`), que é a única função deste
 *      requisito capaz de errar por mil sem que nada acuse — o motivo
 *      inteiro está no comentário de `FORMATO_VALOR`;
 *   3. A RECONCILIAÇÃO COM O BANCO: as listas fechadas de
 *      compartilhado/doacoes.ts, a de compartilhado/validacao.ts e o
 *      vocabulário de componentes/MinhaConta.ts, todas contra os `check`
 *      de supabase/migrations/004_pessoas.sql, lidos do arquivo;
 *   4. AS VARREDURAS DAS SERVER ACTIONS — que as duas da equipe chamem
 *      `ehEquipe()` sozinhas, que a pública NÃO exija equipe, que nenhuma
 *      espalhe o FormData, e que não exista `delete` ali;
 *   5. O QUE AS TELAS SERVEM A QUEM NÃO TEM SESSÃO: /doar/ofertar com a
 *      explicação e SEM formulário, /doar com a seção nova, e as três
 *      rotas do painel respondendo 404 sem vazar nada.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerOferta, validarOferta, colunasDaOferta,
  lerAnalise, validarAnalise, colunasDaAnalise,
  lerRegistro, validarRegistro, colunasDoRegistro,
  numeroDoValor, LIMITE_OFERTA, LIMITE_RESPOSTA, LIMITE_VALOR,
  SITUACOES_ACEITAS_NA_ANALISE
} from '../compartilhado/validacao.ts';
import {
  TIPOS_DE_DOACAO, SITUACOES_DA_DOACAO, OPCOES_DE_TIPO, OPCOES_DE_SITUACAO,
  ehTipoDeDoacao, ehSituacaoDeDoacao, rotuloDoTipo, rotuloDaSituacaoDeDoacao,
  ordenarParaAnalise, montarAnalise
} from '../compartilhado/doacoes.ts';
import { avisoDeDoacoes } from '../compartilhado/avisos-do-painel.ts';
import { avisoDaConta } from '../compartilhado/avisos-da-conta.ts';
import { ListaDoacoes } from '../componentes/ListaDoacoes.ts';
import { MinhasDoacoes, SITUACAO_DA_DOACAO, TIPO_DA_DOACAO } from '../componentes/MinhaConta.ts';
import { TELAS_DO_PAINEL } from '../componentes/PainelInicio.ts';
import { PAGINAS_PRONTAS_FORA_DO_MENU, PAGINAS_SO_PARA_EQUIPE } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const ROTA_PUBLICA = '/doar/ofertar';

/** As três rotas do painel que esta tarefa criou. */
const ROTAS_DO_PAINEL = ['/admin/doacoes', '/admin/doacoes/responder', '/admin/doacoes/registrar'];

/** Um uuid de verdade, no formato que `gen_random_uuid()` produz. */
const ID = '7f2c9b13-4a5e-4d62-8c71-0e3f4a5b6c7d';
const OUTRO_ID = '11111111-2222-4333-8444-555555555555';

function formulario(pares) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(pares)) dados.append(nome, valor);
  return dados;
}

function desenhar(elemento) {
  return renderToStaticMarkup(elemento);
}

/**
 * O código sem os comentários — a mesma função de
 * testes/painel-guarda.test.mjs e testes/voluntariado.test.mjs, e pelo
 * mesmo motivo: sem isto, uma varredura lê o que o arquivo EXPLICA sobre um
 * defeito e acusa o defeito. `acoes/doacoes.ts` fala em `delete`, em
 * `perfil_id` e em espalhar o FormData em vários parágrafos, justamente
 * para contar por que NÃO faz nada disso.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

function lerFonte(caminho) {
  return readFile(fileURLToPath(new URL(`../${caminho}`, import.meta.url)), 'utf8');
}

/** Texto visível, sem tags, com espaços normalizados. */
function textoDe(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|section|li|ul|ol|h[1-6]|dt|dd|br|main|form|label|button|summary|details)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uma doação como servidor/dados/doacoes.ts devolve. */
function doacao(campos = {}) {
  return {
    id: ID,
    perfil_id: null,
    doador_nome: 'Dona Nice',
    doador_email: null,
    tipo: 'item',
    descricao: 'Uma caixa de livros infantis',
    valor: null,
    situacao: 'ofertada',
    resposta: null,
    respondida_em: null,
    recebida_em: null,
    criado_em: '2026-09-01T13:00:00.000000+00:00',
    perfil_nome: null,
    perfil_email: null,
    ...campos
  };
}

// =====================================================================
// 1. A trava do corpo hostil: o que a requisição NÃO consegue gravar
// =====================================================================

test('lerOferta lê DOIS campos por nome e ignora todo o resto do corpo', () => {
  const dados = formulario({
    tipo: 'item',
    descricao: 'Dez livros de literatura negra',
    // Os cinco que uma requisição montada à mão tentaria injetar.
    // `situacao` faria a própria pessoa declarar entregue uma doação que
    // ninguém recebeu; `valor` poria dinheiro num registro que a ONG não
    // conferiu; `perfil_id` decide DE QUEM é a doação; `doador_nome` criaria
    // uma segunda resposta para "quem é esta pessoa"; `eh_equipe` é a regra
    // 6 do CLAUDE.md. Se `lerOferta` espalhasse o FormData num objeto, os
    // cinco chegariam ao insert.
    situacao: 'recebida',
    valor: '99999',
    perfil_id: OUTRO_ID,
    doador_nome: 'Nome Falso',
    eh_equipe: 'true'
  });

  assert.deepEqual(lerOferta(dados), {
    tipo: 'item',
    descricao: 'Dez livros de literatura negra'
  });
});

test('colunasDaOferta não conhece `situacao`, `valor` nem `doador_nome` — nem para escrever o default', () => {
  // Escrever 'ofertada' à mão aqui seria abrir, no código, o único lugar
  // por onde essa coluna poderia passar a vir de fora. Ela nasce do
  // `default` da coluna, no banco.
  const campos = lerOferta(formulario({
    tipo: 'recurso_financeiro', descricao: 'R$ 200 por mês',
    situacao: 'recebida', valor: '200', doador_nome: 'Nome Falso'
  }));

  const linha = colunasDaOferta(campos, 'ID-DA-SESSAO');

  assert.deepEqual(Object.keys(linha).sort(), ['descricao', 'perfil_id', 'tipo']);
  assert.equal(linha.perfil_id, 'ID-DA-SESSAO',
    'o dono da doação vem da sessão verificada, nunca do formulário');
});

test('lerAnalise não lê `descricao`: o texto de quem doou é registro e não tem caminho de volta', () => {
  const dados = formulario({
    id: ID,
    situacao: 'aceita',
    resposta: 'Conseguimos receber!',
    valor: '',
    // O que a tela de análise NÃO edita, e o que uma requisição tentaria.
    descricao: 'TEXTO REESCRITO POR OUTRA PESSOA',
    perfil_id: OUTRO_ID,
    doador_nome: 'Nome Trocado',
    respondida_em: '1999-01-01T00:00:00Z',
    recebida_em: '1999-01-01T00:00:00Z'
  });

  assert.deepEqual(lerAnalise(dados), {
    id: ID, situacao: 'aceita', resposta: 'Conseguimos receber!', valor: ''
  });
});

test('colunasDaAnalise devolve cinco chaves e nenhuma delas é `descricao` ou `perfil_id`', () => {
  const campos = lerAnalise(formulario({
    id: ID, situacao: 'aceita', resposta: 'ok', valor: '',
    descricao: 'reescrito', perfil_id: OUTRO_ID
  }));

  const linha = colunasDaAnalise(
    campos, { respondida_em: null, recebida_em: null }, '2026-09-02T10:00:00.000Z'
  );

  assert.deepEqual(
    Object.keys(linha).sort(),
    ['recebida_em', 'respondida_em', 'resposta', 'situacao', 'valor']
  );
});

test('lerRegistro lê CINCO campos e nunca `perfil_id` nem `situacao`', () => {
  const dados = formulario({
    doador_nome: 'Seu Antônio',
    doador_email: 'antonio@exemplo.invalid',
    tipo: 'recurso_financeiro',
    descricao: 'Entregou em mãos na sede',
    valor: '150,00',
    // Pendurar a doação na conta de outra pessoa é o pior desfecho desta
    // tela: ela apareceria em "Sua conta" de quem não doou nada.
    perfil_id: OUTRO_ID,
    situacao: 'ofertada'
  });

  assert.deepEqual(lerRegistro(dados), {
    doador_nome: 'Seu Antônio',
    doador_email: 'antonio@exemplo.invalid',
    tipo: 'recurso_financeiro',
    descricao: 'Entregou em mãos na sede',
    valor: '150,00'
  });
});

test('colunasDoRegistro não tem `perfil_id`, e a situação é o literal da tela', () => {
  const campos = lerRegistro(formulario({
    doador_nome: 'Seu Antônio', doador_email: '', tipo: 'item',
    descricao: 'Um atabaque', valor: '', perfil_id: OUTRO_ID, situacao: 'ofertada'
  }));

  const linha = colunasDoRegistro(campos, '2026-09-02T10:00:00.000Z');

  assert.ok(!Object.hasOwn(linha, 'perfil_id'),
    'a doação registrada pela equipe NÃO se liga a conta nenhuma');
  assert.equal(linha.situacao, 'recebida');
  assert.equal(linha.recebida_em, '2026-09-02T10:00:00.000Z');
  assert.equal(linha.respondida_em, '2026-09-02T10:00:00.000Z');
  assert.equal(linha.doador_email, null, 'e-mail vazio vira NULL, não string vazia');
});

// =====================================================================
// 2. Dinheiro: a função que pode errar por mil sem nada acusar
// =====================================================================

test('numeroDoValor lê a forma brasileira, e só ela', () => {
  assert.equal(numeroDoValor('1234'), 1234);
  assert.equal(numeroDoValor('1234,56'), 1234.56);
  assert.equal(numeroDoValor('1.234'), 1234);
  assert.equal(numeroDoValor('1.234,56'), 1234.56);
  assert.equal(numeroDoValor('12.345.678,90'), 12345678.9);
  assert.equal(numeroDoValor('R$ 1.234,56'), 1234.56, 'o "R$" que a pessoa cola junto sai fora');
  assert.equal(numeroDoValor('0,01'), 0.01);
});

test('numeroDoValor RECUSA o ponto como decimal — a ambiguidade que gravaria R$ 1,50 no lugar de R$ 1.500', () => {
  // Este é o teste que este arquivo existe para ter. `1234.56` é
  // perfeitamente legível como "mil duzentos e trinta e quatro e
  // cinquenta e seis" em inglês e como "cento e vinte e três mil
  // quatrocentos e cinquenta e seis" em português. Adivinhar erra por mil
  // e NADA na tela acusa: o número aparece formatado, bonito, errado.
  assert.ok(Number.isNaN(numeroDoValor('1234.56')));
  assert.ok(Number.isNaN(numeroDoValor('1,234.56')));
  assert.ok(Number.isNaN(numeroDoValor('1.2345')), 'grupo de milhar tem que ter 3 dígitos');
  assert.ok(Number.isNaN(numeroDoValor('12.34.56')));
  assert.ok(Number.isNaN(numeroDoValor('mil reais')));
  assert.ok(Number.isNaN(numeroDoValor('1234,567')), 'centavos têm no máximo dois dígitos');
  assert.ok(Number.isNaN(numeroDoValor('-50')));
});

test('numeroDoValor distingue VAZIO de ZERO e de inválido — os três desfechos', () => {
  // Uma função que devolvesse 0 para vazio gravaria "R$ 0,00" onde a
  // resposta certa era "não sei", e a tela de quem doou desenharia isso
  // como se a doação não valesse nada.
  assert.equal(numeroDoValor(''), null);
  assert.equal(numeroDoValor('   '), null);
  assert.equal(numeroDoValor('0'), 0);
  assert.ok(Number.isNaN(numeroDoValor('abc')));
});

// =====================================================================
// 3. O que cada formulário recusa
// =====================================================================

const TIPOS_VALIDOS = TIPOS_DE_DOACAO.map((tipo) => tipo.valor);

test('validarOferta exige tipo e descrição, e devolve os DOIS erros de uma vez', () => {
  const { valido, erros } = validarOferta(lerOferta(formulario({})), TIPOS_VALIDOS);

  assert.equal(valido, false);
  assert.deepEqual(Object.keys(erros).sort(), ['descricao', 'tipo']);
});

test('validarOferta recusa tipo fora da lista fechada', () => {
  const campos = lerOferta(formulario({ tipo: 'imovel', descricao: 'uma casa' }));
  const { valido, erros } = validarOferta(campos, TIPOS_VALIDOS);

  assert.equal(valido, false);
  assert.match(erros.tipo, /não existe/);
});

test('validarOferta recusa descrição acima do teto', () => {
  const campos = lerOferta(formulario({ tipo: 'item', descricao: 'a'.repeat(LIMITE_OFERTA + 1) }));
  const { valido, erros } = validarOferta(campos, TIPOS_VALIDOS);

  assert.equal(valido, false);
  assert.match(erros.descricao, new RegExp(String(LIMITE_OFERTA)));
});

test('validarAnalise EXIGE motivo escrito para recusar — e só para recusar', () => {
  // Uma recusa muda é "A ONG não conseguiu receber" na tela de quem
  // ofereceu, sem dizer se o problema foi o item, o momento ou o espaço.
  const recusaMuda = lerAnalise(formulario({ id: ID, situacao: 'recusada', resposta: '', valor: '' }));
  const recusada = validarAnalise(recusaMuda, 'item');
  assert.equal(recusada.valido, false);
  assert.match(recusada.erros.resposta, /por que não dá para receber/);

  // Nas outras três, a resposta é opcional: aceitar e receber já dizem o
  // essencial sozinhas.
  for (const situacao of ['ofertada', 'aceita', 'recebida']) {
    const campos = lerAnalise(formulario({ id: ID, situacao, resposta: '', valor: '' }));
    assert.equal(validarAnalise(campos, 'item').valido, true, `${situacao} não deveria exigir resposta`);
  }
});

test('validarAnalise recusa valor em doação de ITEM, e aceita em doação de dinheiro', () => {
  const comValor = lerAnalise(formulario({ id: ID, situacao: 'recebida', resposta: '', valor: '300,00' }));

  const emItem = validarAnalise(comValor, 'item');
  assert.equal(emItem.valido, false);
  assert.match(emItem.erros.valor, /ofertada como item/);

  assert.equal(validarAnalise(comValor, 'recurso_financeiro').valido, true);
});

test('validarAnalise recusa valor malformado e valor acima do que a coluna guarda', () => {
  const malformado = lerAnalise(formulario({ id: ID, situacao: 'recebida', resposta: '', valor: '300.00' }));
  assert.match(validarAnalise(malformado, 'recurso_financeiro').erros.valor, /com vírgula/);

  const gigante = lerAnalise(formulario({
    id: ID, situacao: 'recebida', resposta: '',
    valor: String(Math.floor(LIMITE_VALOR) + 1)
  }));
  assert.match(validarAnalise(gigante, 'recurso_financeiro').erros.valor, /maior do que o sistema guarda/);
});

test('validarAnalise recusa situação fora da lista fechada e resposta acima do teto', () => {
  const inventada = lerAnalise(formulario({ id: ID, situacao: 'arquivada', resposta: 'x', valor: '' }));
  assert.match(validarAnalise(inventada, 'item').erros.situacao, /não existe/);

  const longa = lerAnalise(formulario({
    id: ID, situacao: 'aceita', resposta: 'a'.repeat(LIMITE_RESPOSTA + 1), valor: ''
  }));
  assert.match(validarAnalise(longa, 'item').erros.resposta, new RegExp(String(LIMITE_RESPOSTA)));
});

test('validarRegistro exige nome e descrição e tipo — o `check identificacao_obrigatoria` na tela', () => {
  const { valido, erros } = validarRegistro(lerRegistro(formulario({})), TIPOS_VALIDOS);

  assert.equal(valido, false);
  assert.deepEqual(Object.keys(erros).sort(), ['descricao', 'doador_nome', 'tipo']);
  assert.match(erros.doador_nome, /não tem conta no site/);
});

test('validarRegistro deixa o e-mail em branco passar, e recusa e-mail malformado', () => {
  const semEmail = lerRegistro(formulario({
    doador_nome: 'Nice', doador_email: '', tipo: 'item', descricao: 'livros', valor: ''
  }));
  assert.equal(validarRegistro(semEmail, TIPOS_VALIDOS).valido, true);

  const emailTorto = lerRegistro(formulario({
    doador_nome: 'Nice', doador_email: 'nice@', tipo: 'item', descricao: 'livros', valor: ''
  }));
  assert.match(validarRegistro(emailTorto, TIPOS_VALIDOS).erros.doador_email, /Confira o e-mail/);
});

// =====================================================================
// 4. Os dois carimbos: eles nascem uma vez e não são apagados
// =====================================================================

test('respondida_em é carimbado na PRIMEIRA saída de "ofertada", e não é recarimbado depois', () => {
  const aceitar = lerAnalise(formulario({ id: ID, situacao: 'aceita', resposta: 'ok', valor: '' }));

  const primeira = colunasDaAnalise(aceitar, { respondida_em: null, recebida_em: null }, 'AGORA');
  assert.equal(primeira.respondida_em, 'AGORA');

  // Corrigir a resposta depois NÃO é responder de novo: recarimbar apagaria
  // quando a ONG de fato respondeu.
  const segunda = colunasDaAnalise(aceitar, { respondida_em: 'ONTEM', recebida_em: null }, 'AGORA');
  assert.equal(segunda.respondida_em, 'ONTEM');
});

test('respondida_em fica nulo enquanto a doação continua "ofertada"', () => {
  const semResponder = lerAnalise(formulario({ id: ID, situacao: 'ofertada', resposta: '', valor: '' }));
  const linha = colunasDaAnalise(semResponder, { respondida_em: null, recebida_em: null }, 'AGORA');

  assert.equal(linha.respondida_em, null);
});

test('recebida_em nasce ao marcar "recebida" e NUNCA é apagado ao voltar atrás', () => {
  const receber = lerAnalise(formulario({ id: ID, situacao: 'recebida', resposta: '', valor: '' }));
  assert.equal(
    colunasDaAnalise(receber, { respondida_em: 'ONTEM', recebida_em: null }, 'AGORA').recebida_em,
    'AGORA'
  );

  // A equipe voltou a situação para "aceita" por engano, num celular, de pé.
  // A data FICA: aquela doação chegou naquele dia, e apagar seria destruir
  // informação num gesto sem desfazer.
  const voltar = lerAnalise(formulario({ id: ID, situacao: 'aceita', resposta: '', valor: '' }));
  assert.equal(
    colunasDaAnalise(voltar, { respondida_em: 'ONTEM', recebida_em: 'ANTEONTEM' }, 'AGORA').recebida_em,
    'ANTEONTEM'
  );
});

test('colunasDaAnalise apaga o valor quando o campo volta vazio — a correção de um erro de digitação', () => {
  const semValor = lerAnalise(formulario({ id: ID, situacao: 'recebida', resposta: '', valor: '' }));
  assert.equal(colunasDaAnalise(semValor, { respondida_em: null, recebida_em: null }, 'AGORA').valor, null);

  const comValor = lerAnalise(formulario({ id: ID, situacao: 'recebida', resposta: '', valor: '1.500,00' }));
  assert.equal(colunasDaAnalise(comValor, { respondida_em: null, recebida_em: null }, 'AGORA').valor, 1500);
});

// =====================================================================
// 5. Reconciliação com o banco: TRÊS listas em código, um `check` no SQL
// =====================================================================

/** Extrai os valores de um `check (<coluna> in ('a', 'b'))` da migration. */
function valoresDoCheck(sql, tabela, coluna) {
  // A tabela é recortada primeiro porque `situacao` existe também em
  // `voluntarios` e em `contatos`, com valores diferentes — sem o recorte,
  // este teste reconciliaria a lista errada e passaria pelo motivo errado.
  const inicio = sql.indexOf(`create table public.${tabela}`);
  assert.notEqual(inicio, -1, `não achei create table public.${tabela}`);
  const fim = sql.indexOf('\n);', inicio);
  const corpo = sql.slice(inicio, fim);

  const casou = corpo.match(new RegExp(`${coluna}[\\s\\S]{0,200}?check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`));
  assert.ok(casou, `não achei o check de ${tabela}.${coluna}`);

  return [...casou[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('as listas de situação em CÓDIGO batem com o `check` de public.doacoes — três fontes, uma verdade', async () => {
  const sql = await lerFonte('supabase/migrations/004_pessoas.sql');
  const doBanco = valoresDoCheck(sql, 'doacoes', 'situacao').sort();

  assert.deepEqual(SITUACOES_DA_DOACAO.map((s) => s.valor).sort(), doBanco,
    'compartilhado/doacoes.ts (o vocabulário da equipe e a ordem da fila)');
  assert.deepEqual([...SITUACOES_ACEITAS_NA_ANALISE].sort(), doBanco,
    'compartilhado/validacao.ts (o que a Action aceita) — a duplicata que só existe porque '
    + 'aquele arquivo não importa nada');
  assert.deepEqual(Object.keys(SITUACAO_DA_DOACAO).sort(), doBanco,
    'componentes/MinhaConta.ts (o vocabulário de quem doou)');
});

test('as listas de tipo em CÓDIGO batem com o `check` de public.doacoes', async () => {
  const sql = await lerFonte('supabase/migrations/004_pessoas.sql');
  const doBanco = valoresDoCheck(sql, 'doacoes', 'tipo').sort();

  assert.deepEqual(TIPOS_DE_DOACAO.map((t) => t.valor).sort(), doBanco);
  assert.deepEqual(Object.keys(TIPO_DA_DOACAO).sort(), doBanco);
});

test('os dois vocabulários (equipe e quem doou) são DIFERENTES de propósito, e nenhum some', () => {
  // O teste acima garante que as CHAVES são as mesmas. Este garante que as
  // frases não foram unificadas por engano: quem lê "a ONG" é quem está de
  // fora, e para quem trabalha na ONG, "a ONG" é ela mesma.
  assert.match(SITUACAO_DA_DOACAO.recusada, /A ONG não conseguiu receber/);
  assert.equal(rotuloDaSituacaoDeDoacao('recusada'), 'Recusada');
  assert.notEqual(SITUACAO_DA_DOACAO.recusada, rotuloDaSituacaoDeDoacao('recusada'));
});

test('as guardas de tipo aceitam só o que está na lista', () => {
  for (const tipo of TIPOS_DE_DOACAO) assert.equal(ehTipoDeDoacao(tipo.valor), true);
  for (const situacao of SITUACOES_DA_DOACAO) assert.equal(ehSituacaoDeDoacao(situacao.valor), true);

  for (const lixo of ['', 'ITEM', 'item ', 'imovel', null, undefined, 0, {}, ['item']]) {
    assert.equal(ehTipoDeDoacao(lixo), false, `ehTipoDeDoacao(${JSON.stringify(lixo)})`);
    assert.equal(ehSituacaoDeDoacao(lixo), false, `ehSituacaoDeDoacao(${JSON.stringify(lixo)})`);
  }
});

test('rótulo de valor desconhecido volta COMO VEIO, em vez de virar um genérico', () => {
  // Mostrar o valor cru é honesto: a próxima pessoa que abrir a tela vê
  // `em_analise` e sabe onde mexer. "Outra" esconderia que a tela ficou
  // velha.
  assert.equal(rotuloDoTipo('imovel'), 'imovel');
  assert.equal(rotuloDaSituacaoDeDoacao('arquivada'), 'arquivada');
});

test('o `<select>` de tipo nasce VAZIO e o de situação não — as duas decisões', () => {
  // Sem a opção vazia, o navegador já vem com "Um item" selecionado e quem
  // quer doar dinheiro envia "item" sem perceber que havia escolha.
  assert.equal(OPCOES_DE_TIPO[0].valor, '');
  assert.equal(OPCOES_DE_TIPO.length, TIPOS_DE_DOACAO.length + 1);

  // A doação SEMPRE tem situação (`not null default 'ofertada'`): uma opção
  // vazia seria oferecer à equipe apagar um estado que não pode ficar vazio.
  assert.ok(OPCOES_DE_SITUACAO.every((opcao) => opcao.valor !== ''));
  assert.equal(OPCOES_DE_SITUACAO.length, SITUACOES_DA_DOACAO.length);

  // O texto do select é a `escolha` (que explica), não o `rotulo` (que
  // nomeia): um select de quatro substantivos soltos, num celular, é
  // adivinhação.
  assert.equal(OPCOES_DE_SITUACAO[0].texto, SITUACOES_DA_DOACAO[0].escolha);
});

// =====================================================================
// 6. A ordem da fila
// =====================================================================

test('a fila põe o que espera resposta primeiro, e o que acabou por último', () => {
  const linhas = [
    doacao({ id: 'a', situacao: 'recebida', criado_em: '2026-09-01T10:00:00Z' }),
    doacao({ id: 'b', situacao: 'ofertada', criado_em: '2026-08-01T10:00:00Z' }),
    doacao({ id: 'c', situacao: 'recusada', criado_em: '2026-09-02T10:00:00Z' }),
    doacao({ id: 'd', situacao: 'aceita', criado_em: '2026-08-02T10:00:00Z' })
  ];

  assert.deepEqual(ordenarParaAnalise(linhas).map((l) => l.id), ['b', 'd', 'a', 'c']);
});

test('dentro do mesmo grupo, da mais nova para a mais antiga', () => {
  const linhas = [
    doacao({ id: 'velha', situacao: 'ofertada', criado_em: '2026-07-01T10:00:00Z' }),
    doacao({ id: 'nova', situacao: 'ofertada', criado_em: '2026-09-01T10:00:00Z' })
  ];

  assert.deepEqual(ordenarParaAnalise(linhas).map((l) => l.id), ['nova', 'velha']);
});

test('situação desconhecida vai para o FIM, não para o começo', () => {
  // Uma linha que a tela não entende não deve ocupar o lugar da que espera
  // resposta.
  const linhas = [
    doacao({ id: 'estranha', situacao: 'arquivada', criado_em: '2026-09-09T10:00:00Z' }),
    doacao({ id: 'normal', situacao: 'recusada', criado_em: '2026-01-01T10:00:00Z' })
  ];

  assert.deepEqual(ordenarParaAnalise(linhas).map((l) => l.id), ['normal', 'estranha']);
});

test('ordenarParaAnalise não mexe na lista que recebeu', () => {
  const linhas = [doacao({ id: 'a', situacao: 'recebida' }), doacao({ id: 'b', situacao: 'ofertada' })];
  const copia = [...linhas];
  ordenarParaAnalise(linhas);
  assert.deepEqual(linhas.map((l) => l.id), copia.map((l) => l.id));
});

test('montarAnalise resolve os rótulos e marca o que está em aberto', () => {
  const [aberta, fechada] = montarAnalise([
    doacao({ id: 'a', situacao: 'ofertada', tipo: 'recurso_financeiro' }),
    doacao({ id: 'b', situacao: 'recebida', tipo: 'item' })
  ]);

  assert.equal(aberta.situacaoRotulo, 'Ofertada');
  assert.equal(aberta.tipoRotulo, 'Dinheiro');
  assert.equal(aberta.emAberto, true);

  assert.equal(fechada.emAberto, false, '"recebida" não espera mais nada da equipe');
});

// =====================================================================
// 7. As varreduras das Server Actions
// =====================================================================

test('as duas Actions da EQUIPE chamam ehEquipe() sozinhas — a varredura do painel não alcança este arquivo', async () => {
  const fonte = semComentarios(await lerFonte('acoes/doacoes.ts'));

  // Uma entrada por Action exportada: o corpo de cada uma, até a próxima.
  const blocos = fonte.split(/export async function /).slice(1);
  const porNome = Object.fromEntries(blocos.map((bloco) => [bloco.split(/[(\s]/)[0], bloco]));

  assert.deepEqual(Object.keys(porNome).sort(), ['ofertar', 'registrarDoacao', 'responderDoacao']);

  for (const nome of ['responderDoacao', 'registrarDoacao']) {
    assert.match(porNome[nome], /await ehEquipe\(\)/,
      `${nome} precisa conferir a permissão por conta própria: Server Action é endpoint HTTP `
      + 'público (spec §4.5) e não passa por página nem por layout');
  }
});

test('a Action PÚBLICA confere a sessão e NÃO exige equipe — a assimetria é a decisão', async () => {
  const fonte = semComentarios(await lerFonte('acoes/doacoes.ts'));
  const ofertar = fonte.split('export async function ofertar')[1].split('export async function')[0];

  assert.match(ofertar, /await usuarioAtual\(\)/,
    'ofertar pergunta quem está autenticado com a MESMA função que a página usa');
  assert.doesNotMatch(ofertar, /ehEquipe\s*\(/,
    'exigir equipe aqui trancaria justamente o público desta tela');
});

test('nenhuma Action de doações espalha o FormData num objeto', async () => {
  const fonte = semComentarios(await lerFonte('acoes/doacoes.ts'));

  // `{ ...campos }` num insert/update é o caminho pelo qual `situacao`,
  // `perfil_id` e `descricao` mandados no corpo chegariam ao banco.
  assert.doesNotMatch(fonte, /\.\.\.\s*campos/);
  assert.doesNotMatch(fonte, /\.\.\.\s*dados/);
});

test('não existe `delete` em acoes/doacoes.ts — o banco permite, este arquivo é quem recusa', async () => {
  const fonte = semComentarios(await lerFonte('acoes/doacoes.ts'));

  // A política é `for all` e `authenticated` tem `grant delete`. Uma doação
  // registrada é prestação de contas, e apagar não tem desfazer num
  // celular, de pé (regra 4). O que a equipe quer quando quer apagar é
  // "recusada" com o motivo escrito, e esse caminho existe.
  assert.doesNotMatch(fonte, /\.delete\s*\(/);
});

test('a Action de análise LÊ a linha antes de escrever — sem isso os dois carimbos se perdem', async () => {
  const fonte = semComentarios(await lerFonte('acoes/doacoes.ts'));
  const responder = fonte.split('export async function responderDoacao')[1];

  assert.match(responder, /buscarDoacaoDoPainel\(/,
    'o PostgREST não tem `coalesce` no update: "já tem data?" e "qual é o tipo?" são decididos aqui');
  assert.match(responder, /\.select\('id'\)/,
    'sem o retorno, um update que não casa linha nenhuma é sucesso com zero linhas no PostgREST');
});

test('a leitura do painel não cai para JSON versionado nenhum, porque não existe nem pode existir', async () => {
  // `semComentarios` porque o cabeçalho daquele arquivo EXPLICA por que não
  // há JSON irmão, citando `dados-iniciais/` — sem isto a varredura leria a
  // explicação e acusaria o defeito que ela descreve. Mesma armadilha que
  // testes/painel-guarda.test.mjs documenta.
  const fonte = semComentarios(await lerFonte('servidor/dados/doacoes.ts'));

  // Não há, e não pode haver, cópia versionada de doação de pessoa real em
  // dados-iniciais/ — seria dado pessoal de terceiro dentro do repositório.
  assert.doesNotMatch(fonte, /dados-iniciais/);
  assert.match(fonte, /Degradavel/, 'a tela precisa poder DIZER que a consulta falhou');
});

// =====================================================================
// 8. O que a fila da equipe DESENHA (sem sessão, montando o componente)
// =====================================================================

test('a fila diz que não deu para consultar, em vez de fingir que não há doação', () => {
  const html = desenhar(createElement(ListaDoacoes, { itens: [], degradou: true }));

  assert.match(html, /estado--erro/);
  assert.match(textoDe(html), /o banco de dados não respondeu/);
});

test('a fila vazia diz ONDE nasce uma doação — as duas portas', () => {
  const html = desenhar(createElement(ListaDoacoes, { itens: [], degradou: false }));
  const texto = textoDe(html);

  assert.match(texto, /Nenhuma doação registrada ainda/);
  assert.match(texto, /oferecer uma doação pelo site/);
  assert.match(texto, /Registrar doação recebida/);
});

test('o cartão desenha situação, tipo, quem doou, a descrição e o caminho para responder', () => {
  const itens = montarAnalise([doacao({
    doador_nome: 'Dona Nice',
    doador_email: 'nice@exemplo.invalid',
    descricao: 'Uma caixa de livros infantis'
  })]);

  const html = desenhar(createElement(ListaDoacoes, { itens, degradou: false }));
  const texto = textoDe(html);

  assert.match(texto, /Ofertada/);
  assert.match(texto, /Um item/);
  assert.match(texto, /Dona Nice/);
  assert.match(texto, /Uma caixa de livros infantis/);
  assert.match(html, new RegExp(`href="/admin/doacoes/responder\\?id=${ID}"`));
  assert.match(html, /mailto:nice@exemplo\.invalid/);
});

test('a dobra nasce ABERTA no que ainda espera a equipe, e fechada no que acabou', () => {
  const emAberto = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({ situacao: 'aceita' })]), degradou: false
  }));
  assert.match(emAberto, /<details[^>]*\sopen/);

  const encerrada = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({ situacao: 'recusada' })]), degradou: false
  }));
  assert.doesNotMatch(encerrada, /<details[^>]*\sopen/);
});

test('valor nulo NÃO desenha "R$ 0,00" — isso diria que a doação não vale nada', () => {
  const semValor = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({ valor: null })]), degradou: false
  }));
  assert.doesNotMatch(textoDe(semValor), /R\$/);

  // `numeric(12,2)` chega do PostgREST como STRING.
  const comValor = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({ tipo: 'recurso_financeiro', valor: '150.00' })]), degradou: false
  }));
  assert.match(textoDe(comValor), /R\$\s*150,00/);
});

test('a doação ofertada pelo site mostra o NOME da conta, e diz quando ele não carregou', () => {
  const comNome = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({
      doador_nome: null, doador_email: null,
      perfil_id: OUTRO_ID, perfil_nome: 'Rosa Maria', perfil_email: 'rosa@exemplo.invalid'
    })]),
    degradou: false
  }));
  assert.match(textoDe(comNome), /Rosa Maria/);
  assert.match(textoDe(comNome), /Ofertada pelo site, por quem tem conta/);

  // A segunda consulta de servidor/dados/doacoes.ts é independente
  // justamente para a lista continuar de pé quando ela falha — e a tela diz
  // isso em vez de mostrar um branco.
  const semNome = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao({ doador_nome: null, perfil_id: OUTRO_ID, perfil_nome: null })]),
    degradou: false
  }));
  assert.match(textoDe(semNome), /o nome não carregou/);
});

test('a fila não oferece apagar, e diz por escrito que não apaga', () => {
  const html = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao()]), degradou: false
  }));

  // A busca é por ELEMENTO CLICÁVEL, e não pela palavra no HTML inteiro: a
  // própria tela explica que não apaga, e uma varredura pelo texto acusaria
  // a explicação. O que não pode existir é um `<button>` ou um `<a>` que
  // apague — e é isso que se procura, com o conteúdo de cada um.
  const clicaveis = [...html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
    .map((casou) => textoDe(casou[1]));

  for (const rotulo of clicaveis) {
    assert.doesNotMatch(rotulo, /apagar|excluir|remover/i,
      `a fila desenhou um botão "${rotulo}" — esta tela não apaga (ver acoes/doacoes.ts)`);
  }

  assert.match(textoDe(html), /não apaga doação/);
  // A promessa de /privacidade que esta tela NÃO cumpre sozinha, dita nela.
  assert.match(textoDe(html), /fale com quem cuida do site/);
});

test('a fila diz que o site não cobra, não recebe pagamento e não emite recibo (RN08)', () => {
  const html = desenhar(createElement(ListaDoacoes, {
    itens: montarAnalise([doacao()]), degradou: false
  }));

  assert.match(textoDe(html), /não cobra, não recebe pagamento e não emite recibo/);
});

// =====================================================================
// 9. O que a ÁREA DO USUÁRIO passa a dizer
// =====================================================================

test('o estado vazio de "Minhas doações" aponta para o formulário, e não só para o WhatsApp', () => {
  // Ele dizia "para doar, fale com a gente pelo WhatsApp" e mandava para
  // fora do site. Era verdade até esta tarefa, e virou meia-verdade quando
  // /doar/ofertar passou a existir — um estado vazio que descreve o site de
  // ontem DESVIA a pessoa do caminho que funciona.
  const html = desenhar(createElement(MinhasDoacoes, { doacoes: [], degradou: false }));
  const texto = textoDe(html);

  assert.match(texto, /conte o que você quer doar na página de apoio/);
  assert.match(texto, /não processa pagamentos/, 'RN08 continua dito nesta tela');
  assert.match(texto, /\(11\) 95396-8344/, 'quem prefere conversar antes continua tendo por onde');
});

test('a confirmação da oferta existe na lista fechada de avisos da conta, e não promete aceite', () => {
  const aviso = avisoDaConta('doacao');

  assert.ok(aviso, '?aviso=doacao precisa escolher uma frase nossa');
  assert.equal(aviso.ok, true);
  // A /doar deixa claro que a resposta pode ser "não conseguimos receber".
  // "Obrigado pela sua doação" agradeceria por algo que ainda não chegou.
  assert.doesNotMatch(aviso.texto, /obrigad/i);
  assert.doesNotMatch(aviso.texto, /recibo|pagamento/i);
});

// =====================================================================
// 10. Os avisos do painel
// =====================================================================

test('avisoDeDoacoes só escolhe frases nossas — nunca traz uma da URL', () => {
  assert.ok(avisoDeDoacoes('respondida'));
  assert.ok(avisoDeDoacoes('registrada'));
  assert.equal(avisoDeDoacoes('erro').ok, false);

  assert.equal(avisoDeDoacoes('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDeDoacoes(''), null);
  assert.equal(avisoDeDoacoes(undefined), null);
  assert.equal(avisoDeDoacoes(['respondida']), null);
});

test('avisoDeDoacoes não devolve nada herdado do protótipo de Object', () => {
  for (const chave of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDeDoacoes(chave), null, `?aviso=${chave}`);
  }
});

// =====================================================================
// 11. As rotas: o que responde, e o que NÃO vaza
// =====================================================================

test('as três rotas do painel estão cadastradas em PAGINAS_SO_PARA_EQUIPE', () => {
  // A reconciliação de testes/links.test.mjs e sem-javascript.test.mjs
  // compara essa lista com o sistema de arquivos: esquecer uma rota nova
  // quebra os dois.
  for (const rota of ROTAS_DO_PAINEL) {
    assert.ok(PAGINAS_SO_PARA_EQUIPE.includes(rota), `${rota} fora da lista`);
  }
});

test('/doar/ofertar é página pública fora do menu, e está cadastrada', () => {
  assert.ok(PAGINAS_PRONTAS_FORA_DO_MENU.includes(ROTA_PUBLICA));
});

test('a home do painel lista Doações como PRONTA, com a rota que existe', () => {
  const tela = TELAS_DO_PAINEL.find((t) => t.caminho === '/admin/doacoes');

  assert.ok(tela, 'a tela nova precisa aparecer na home do painel');
  assert.equal(tela.pronta, true);
  // RN08 também no texto da home: "registrar o que o Ateliê recebeu"
  // significa escrever o que chegou, não movimentar conta nenhuma.
  assert.doesNotMatch(tela.descricao, /recibo|pagamento|Pix/i);
});

test('as três rotas do painel respondem 404 para quem não é equipe', async () => {
  for (const rota of ROTAS_DO_PAINEL) {
    const resposta = await fetch(`${BASE}${rota}`);
    assert.equal(resposta.status, 404, `${rota} deveria responder 404 para anônimo`);
  }
});

test('a resposta anônima das rotas do painel não vaza NADA da tela de doações', async () => {
  // O achado da Tarefa P1: com a guarda só no layout, o servidor respondia
  // 404 E mandava a página inteira do painel no payload de hidratação. Aqui
  // o que vazaria é nome, e-mail e o valor em dinheiro que a ONG recebeu.
  const marcas = [
    'Registrar doação recebida',
    'Responder doação',
    'Doações — painel da equipe',
    'Quanto entrou, em reais',
    'Resposta para quem ofereceu',
    'não cobra, não recebe pagamento'
  ];

  for (const rota of ROTAS_DO_PAINEL) {
    const html = await (await fetch(`${BASE}${rota}`)).text();
    for (const marca of marcas) {
      assert.ok(!html.includes(marca), `${rota} vazou "${marca}" na resposta anônima`);
    }
  }
});

test('/admin/doacoes/responder sem `?id=` é 404, como qualquer endereço que não existe', async () => {
  // Não existe "responder nova": quem cria doação é quem oferta ou a tela
  // de registro. A guarda de equipe já responde 404 antes disso para o
  // anônimo — este teste vale como trava da FORMA da rota, e o caminho
  // autenticado continua sem sessão para ser medido.
  const resposta = await fetch(`${BASE}/admin/doacoes/responder`);
  assert.equal(resposta.status, 404);
});

test('/doar/ofertar responde 200 a quem não tem sessão, explica a exigência de conta e NÃO desenha formulário', async () => {
  const resposta = await fetch(`${BASE}${ROTA_PUBLICA}`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  const texto = textoDe(html);

  assert.match(texto, /Para oferecer por aqui é preciso ter uma conta/);
  assert.match(texto, /Criar conta ou entrar/);

  // O PREÇO DA DECISÃO, dito à pessoa que o paga: sem conta ela não oferta
  // por aqui, mas a doação não se perde — a equipe registra o que chegou
  // por fora.
  assert.match(texto, /Se preferir não criar conta/);
  assert.match(texto, /registra a doação por aqui/);

  // Nenhum campo de formulário para quem não tem sessão: um <form> que
  // sempre recusa é um gesto que não pode dar certo.
  assert.doesNotMatch(html, /<form[^>]*id="form-oferta"/);
  assert.doesNotMatch(html, /name="descricao"/);
});

test('/doar/ofertar não inventa meio de pagamento nenhum (RN08 e a decisão D7)', async () => {
  const html = await (await fetch(`${BASE}${ROTA_PUBLICA}`)).text();
  const texto = textoDe(html);

  assert.doesNotMatch(texto, /chave Pix|Pix:|cartão de crédito|boleto|recibo/i);
  assert.match(texto, /não processa pagamentos/);
});

test('a seção nova de /doar leva ao formulário de oferta, com o texto inteiro', async () => {
  // COBERTURA DECLARADA em testes/paridade-texto.test.mjs
  // (COBERTURA_DAS_EXCLUSOES['titulo-oferecer']): a seção sai daquela
  // comparação por `idsAcrescentados`, e é este teste que a observa. Por
  // IGUALDADE, e não por fragmento: é o único jeito de um espaço comido
  // pelo JSX doer (o achado da Rodada de correção 1 da Tarefa A5).
  const html = await (await fetch(`${BASE}/doar`)).text();

  const abre = html.indexOf('<section aria-labelledby="titulo-oferecer"');
  assert.notEqual(abre, -1, 'a seção nova sumiu de /doar');
  const fecha = html.indexOf('</section>', abre);

  assert.equal(
    textoDe(html.slice(abre, fecha)),
    'Registrar sua oferta pelo site Se você tem conta aqui, dá para contar por escrito o que '
    + 'pretende doar e acompanhar a nossa resposta em “Sua conta” — sem depender de lembrar em '
    + 'que conversa ficou. Oferecer uma doação'
  );

  assert.match(html.slice(abre, fecha), /href="\/doar\/ofertar"/);
});
