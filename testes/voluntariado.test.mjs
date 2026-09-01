/**
 * Candidatura ao voluntariado (RF25): `/voluntariado/candidatura`, a Server
 * Action `candidatar` e a regra de candidatura duplicada.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR AQUI, E O QUE NÃO DÁ
 * ===================================================================
 *
 * A suíte NÃO TEM SESSÃO — mesma limitação de testes/minha-conta.test.mjs e
 * de testes/painel-guarda.test.mjs: toda requisição feita por este arquivo é
 * ANÔNIMA. Então o caminho de quem ESTÁ autenticado (o formulário desenhado,
 * as cinco caixas, o envio que grava as duas tabelas, a candidatura
 * aparecendo em /minha-conta) foi medido À MÃO, contra o Supabase de
 * produção, com uma conta de teste criada para isso, e está no relatório
 * desta tarefa — inclusive sem JavaScript. Nenhum teste deste arquivo
 * afirma nada sobre ele.
 *
 * ISSO NÃO É UM BURACO ESCONDIDO: é a mesma fronteira que o projeto inteiro
 * tem desde o painel. O que sobra aqui é o que não depende de sessão, e são
 * quatro coisas:
 *
 *   1. AS DECISÕES PURAS — o que a Action aceita (`lerCandidatura`), o que
 *      ela recusa (`validarCandidatura`), o que ela manda ao banco
 *      (`colunasDaCandidatura`, `linhasDasAreas`) e quem já está
 *      candidatado (`candidaturaEmAndamento`). É aqui que mora a trava do
 *      corpo hostil: `situacao=ativo` e `perfil_id=<outra pessoa>` mandados
 *      na requisição não chegam ao objeto do insert;
 *   2. AS DUAS PONTAS QUE PRECISAM CASAR — o prefixo `area:` que a Action
 *      devolve e o formulário lê. Elas são strings escritas em arquivos
 *      diferentes, e quando divergem a recusa devolve o formulário com as
 *      caixas desmarcadas, sem erro nenhum em lugar nenhum;
 *   3. A VARREDURA DA SERVER ACTION — que ela confira a sessão sozinha, que
 *      NÃO exija equipe, que não espalhe o FormData e que grave as duas
 *      tabelas na ordem certa;
 *   4. O QUE A PÁGINA SERVE A QUEM NÃO TEM SESSÃO: a explicação, o caminho
 *      para criar conta, e NENHUM formulário.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  lerCandidatura, validarCandidatura, colunasDaCandidatura, linhasDasAreas, LIMITE_MOTIVO
} from '../compartilhado/validacao.ts';
import {
  candidaturaEmAndamento, SITUACOES_EM_ANDAMENTO
} from '../compartilhado/candidatura.ts';
import { avisoDaConta } from '../compartilhado/avisos-da-conta.ts';
import { PAGINAS_PRONTAS_FORA_DO_MENU } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const ROTA = '/voluntariado/candidatura';

/** Os cinco `id` reais de `public.areas_voluntariado` (supabase/seed.sql). */
const AREAS_REAIS = [
  'apoio-pedagogico', 'comunicacao', 'producao-eventos', 'acervo', 'administrativo'
];

function formulario(campos) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) {
      for (const item of valor) dados.append(nome, item);
    } else {
      dados.set(nome, valor);
    }
  }
  return dados;
}

/** O código sem os comentários — mesma função de testes/minha-conta.test.mjs. */
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

// ---------------------------------------------------------------------
// 1. A trava do corpo hostil: o que a requisição NÃO consegue gravar
// ---------------------------------------------------------------------

test('lerCandidatura lê DOIS campos por nome e ignora todo o resto do corpo', () => {
  const dados = formulario({
    areas: ['acervo'],
    mensagem: 'Posso às terças.',
    // Os três que uma requisição montada à mão tentaria injetar.
    // `situacao` decide se a pessoa nasce "ativa" sem ninguém da ONG ter
    // falado com ela; `perfil_id` decide DE QUEM é a candidatura;
    // `eh_equipe` é a regra 6 do CLAUDE.md. Se `lerCandidatura`
    // espalhasse o FormData num objeto, os três chegariam ao insert.
    situacao: 'ativo',
    perfil_id: '00000000-0000-0000-0000-000000000000',
    eh_equipe: 'true'
  });

  assert.deepEqual(lerCandidatura(dados), {
    areas: ['acervo'],
    mensagem: 'Posso às terças.'
  });
});

test('colunasDaCandidatura não conhece `situacao` — nem para escrever o default', () => {
  // Escrever 'novo' à mão aqui seria abrir, no código, o único lugar por
  // onde essa coluna poderia passar a vir de fora. Ela nasce do `default`
  // da coluna, no banco.
  const campos = lerCandidatura(formulario({
    areas: ['acervo'], mensagem: 'oi', situacao: 'ativo'
  }));

  const linha = colunasDaCandidatura(campos, 'ID-DA-SESSAO');

  assert.deepEqual(Object.keys(linha).sort(), ['mensagem', 'perfil_id']);
  assert.equal(linha.perfil_id, 'ID-DA-SESSAO',
    'o dono da candidatura precisa vir do ARGUMENTO (a sessão), nunca do formulário');
  assert.ok(!('situacao' in linha));
});

test('mensagem vazia vira NULL, e não string vazia', () => {
  // A coluna aceita nulo, e a tela omite o que é nulo (regra 2 do CLAUDE.md
  // no nível do campo). Guardar '' faria a área do usuário desenhar um
  // parágrafo em branco dentro do cartão.
  const campos = lerCandidatura(formulario({ areas: ['acervo'], mensagem: '   ' }));
  assert.equal(colunasDaCandidatura(campos, 'EU').mensagem, null);
});

test('a mesma área mandada duas vezes não vira duas linhas — a chave primária recusaria', () => {
  // `voluntario_areas` tem `primary key (voluntario_id, area_id)`. Sem a
  // deduplicação, a repetição (trivial numa requisição montada à mão)
  // derrubaria o insert das áreas DEPOIS de a candidatura já estar gravada
  // — ou seja, produziria o desfecho parcial de propósito.
  const campos = lerCandidatura(formulario({ areas: ['acervo', 'acervo', ' acervo '] }));

  assert.deepEqual(campos.areas, ['acervo']);
  assert.deepEqual(linhasDasAreas('V', campos.areas), [{ voluntario_id: 'V', area_id: 'acervo' }]);
});

test('um File no meio das áreas não vira a string "[object File]" gravada como area_id', () => {
  const dados = new FormData();
  dados.append('areas', 'acervo');
  dados.append('areas', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
  dados.set('mensagem', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));

  const campos = lerCandidatura(dados);

  assert.deepEqual(campos.areas, ['acervo']);
  assert.equal(campos.mensagem, '');
});

// ---------------------------------------------------------------------
// 2. O que a validação recusa
// ---------------------------------------------------------------------

test('sem nenhuma área a candidatura é recusada — a área é a coisa toda', () => {
  const { valido, erros } = validarCandidatura(
    lerCandidatura(formulario({ mensagem: 'quero ajudar' })), AREAS_REAIS);

  assert.equal(valido, false);
  assert.match(erros.areas, /pelo menos uma área/);
  assert.match(erros.areas, /mais de uma/, 'a recusa precisa dizer que dá para marcar várias');
});

test('área que não existe no banco é recusada antes de virar erro de chave estrangeira', () => {
  // Quem de fato impede é a FK (`23503`), mas ela responderia DEPOIS de a
  // candidatura já estar gravada — a ordem em que as duas tabelas são
  // escritas. A recusa daqui existe para isso não acontecer.
  const { valido, erros } = validarCandidatura(
    lerCandidatura(formulario({ areas: ['acervo', 'presidencia'] })), AREAS_REAIS);

  assert.equal(valido, false);
  assert.match(erros.areas, /não está mais na lista/);
  assert.doesNotMatch(erros.areas, /23503|constraint|foreign/i, 'jargão de banco vazou para a tela');
});

test('duas ou três áreas juntas são válidas — "muita gente atua em duas"', () => {
  const { valido, erros } = validarCandidatura(
    lerCandidatura(formulario({ areas: ['acervo', 'comunicacao'] })), AREAS_REAIS);

  assert.equal(valido, true, `recusou candidatura completa: ${JSON.stringify(erros)}`);
});

test('a mensagem é opcional, e tem teto — a Action é endpoint público e `text` não tem limite', () => {
  const semTexto = validarCandidatura(
    lerCandidatura(formulario({ areas: ['acervo'] })), AREAS_REAIS);
  assert.equal(semTexto.valido, true, 'a mensagem virou obrigatória');

  const gigante = validarCandidatura(
    lerCandidatura(formulario({ areas: ['acervo'], mensagem: 'a'.repeat(LIMITE_MOTIVO + 1) })),
    AREAS_REAIS);
  assert.match(gigante.erros.mensagem, /passou de 2000 caracteres/);
});

test('a validação devolve TODOS os erros de uma vez', () => {
  const { erros } = validarCandidatura(
    lerCandidatura(formulario({ mensagem: 'a'.repeat(LIMITE_MOTIVO + 1) })), AREAS_REAIS);

  assert.ok(erros.areas, 'faltou o erro das áreas');
  assert.ok(erros.mensagem, 'faltou o erro da mensagem');
});

// ---------------------------------------------------------------------
// 3. A regra de candidatura duplicada
// ---------------------------------------------------------------------

test('as situações "em andamento" existem todas no check de public.voluntarios', async () => {
  // Sem esta reconciliação, um erro de digitação aqui ('em-contato') faria
  // a regra passar a valer para nenhuma linha — e a pessoa poderia se
  // candidatar por cima de uma candidatura viva, criando uma linha repetida
  // que só a equipe consegue apagar.
  const sql = await lerFonte('supabase/migrations/004_pessoas.sql');
  const trecho = sql.match(/situacao[\s\S]{0,120}?check \(situacao in \(([^)]*)\)\)/i);
  assert.ok(trecho, 'não achei o check de situacao em public.voluntarios');

  const doBanco = trecho[1].split(',').map((parte) => parte.trim().replace(/'/g, ''));

  for (const situacao of SITUACOES_EM_ANDAMENTO) {
    assert.ok(doBanco.includes(situacao),
      `"${situacao}" não é um valor que public.voluntarios.situacao aceita`);
  }

  assert.ok(!SITUACOES_EM_ANDAMENTO.includes('inativo'),
    'quem encerrou o voluntariado precisa poder se candidatar de novo — "inativo" não pode '
    + 'contar como candidatura em andamento');

  assert.deepEqual(
    doBanco.filter((s) => !SITUACOES_EM_ANDAMENTO.includes(s)), ['inativo'],
    'apareceu uma situação nova no banco que ninguém classificou: ela caiu em silêncio na '
    + 'categoria "pode se candidatar de novo"'
  );
});

test('candidaturaEmAndamento devolve a linha viva, e null quando só há encerrada', () => {
  assert.equal(candidaturaEmAndamento([]), null);
  assert.equal(candidaturaEmAndamento([{ situacao: 'inativo' }]), null);

  const viva = { situacao: 'em_contato', id: 'x' };
  assert.equal(candidaturaEmAndamento([{ situacao: 'inativo' }, viva]), viva,
    'precisa devolver a LINHA: a tela desenha a situação e a data dela');
});

// ---------------------------------------------------------------------
// 4. As duas pontas que precisam casar: o prefixo `area:`
// ---------------------------------------------------------------------

test('a Action devolve as caixas marcadas como `area:<id>`, e o formulário lê a mesma chave', async () => {
  // São strings escritas em arquivos diferentes. Quando divergem, a recusa
  // devolve o formulário com as caixas DESMARCADAS — sem erro em lugar
  // nenhum, e a pessoa remarca tudo achando que ela é que errou.
  const acao = semComentarios(await lerFonte('acoes/voluntariado.ts'));
  const forma = semComentarios(await lerFonte('componentes/FormularioCandidatura.tsx'));

  assert.match(acao, /valores\[`area:\$\{area\}`\]/,
    'a Action parou de devolver as áreas escolhidas com o prefixo `area:`');
  assert.match(forma, /valor\(`area:\$\{area\.id\}`\)/,
    'o formulário parou de ler as caixas marcadas pelo prefixo `area:`');
});

test('cada caixa de área tem `valor` e `prefixo` — sem os dois o formulário mente', async () => {
  // `valor`: sem ele o navegador manda "on" para qualquer caixa marcada, e
  // as cinco áreas ficam indistinguíveis no FormData.
  // `prefixo`: sem ele as cinco geram o mesmo `id` e todo `label[for=]`
  // aponta para a primeira — defeito medido no navegador na Rodada de
  // correção 1 da Tarefa A6.
  const forma = semComentarios(await lerFonte('componentes/FormularioCandidatura.tsx'));

  assert.match(forma, /valor=\{area\.id\}/, 'as caixas de área perderam o `value`');
  assert.match(forma, /prefixo=\{area\.id\}/, 'as caixas de área perderam o `prefixo` de id');
  assert.match(forma, /nome="areas"/, 'as caixas de área precisam compartilhar o mesmo `name`');
});

test('o formulário envia pela Action, e não por um onSubmit com fetch', async () => {
  // É o que faz o envio funcionar sem JavaScript: a função devolvida por
  // `useActionState` vai direto no `action` do <form>. Trocar por
  // `onSubmit` + fetch quebraria a tela para quem está sem script, em
  // silêncio.
  const forma = semComentarios(await lerFonte('componentes/FormularioCandidatura.tsx'));

  assert.match(forma, /action=\{enviar\}/);
  assert.doesNotMatch(forma, /onSubmit/,
    'o formulário passou a enviar por JavaScript: quem está sem script deixa de conseguir '
    + 'se candidatar, e nada na tela acusa');
});

// ---------------------------------------------------------------------
// 5. A varredura da Server Action
// ---------------------------------------------------------------------

test('toda Server Action de acoes/voluntariado.ts confere a sessão sozinha — e NÃO exige equipe', async () => {
  // A varredura de testes/painel-guarda.test.mjs cobre `app/admin/**` e não
  // alcança Action nenhuma; a de acoes/contato.ts cobra o CONTRÁRIO (que
  // não haja guarda, porque aquele formulário é anônimo). Esta fica no
  // meio, como a de acoes/conta.ts: exige sessão, não exige equipe.
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  const funcoes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(funcoes.length > 0, 'nenhuma Action encontrada — o teste não verificou nada');

  for (const nome of funcoes) {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    const corpo = codigo.slice(inicio, proxima === -1 ? undefined : proxima);

    assert.match(corpo, /usuarioAtual\s*\(\s*\)/,
      `a Action "${nome}" não pergunta quem está autenticado. Server Action é endpoint HTTP `
      + 'público (spec §4.5): a guarda da página não protege nada aqui');
  }

  assert.doesNotMatch(codigo, /ehEquipe/,
    'acoes/voluntariado.ts passou a exigir sessão de equipe — isso trancaria justamente o '
    + 'público desta tela, que é quem está de fora da ONG');
});

test('a Action não espalha o FormData num objeto', async () => {
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  assert.doesNotMatch(codigo, /\.\.\.\s*campos/,
    'é assim que um campo inventado no corpo da requisição chega inteiro ao banco '
    + '(regra 6 do CLAUDE.md)');
});

test('a Action nunca menciona `situacao` — o fluxo de atendimento é da equipe', async () => {
  // Sem isto, um `situacao=ativo` no corpo faria alguém nascer voluntário
  // ativo sem ninguém da ONG ter falado com a pessoa.
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  assert.doesNotMatch(codigo, /situacao/,
    'acoes/voluntariado.ts menciona `situacao`. Se isso virar um valor gravado, uma '
    + 'candidatura pode nascer "ativa" — e a ONG não teria falado com ninguém');
});

test('a candidatura é gravada ANTES das áreas — é a ordem que a chave estrangeira obriga', async () => {
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  const voluntarios = codigo.indexOf(".from('voluntarios')");
  const areas = codigo.indexOf(".from('voluntario_areas')");

  assert.ok(voluntarios > 0 && areas > 0, 'uma das duas gravações sumiu da Action');
  assert.ok(voluntarios < areas,
    'as áreas passaram a ser gravadas antes da candidatura — elas referenciam o id dela');
});

test('o insert da candidatura PEDE a linha de volta — o contrário de acoes/contato.ts', async () => {
  // A assimetria convida a "corrigir" o lado errado, por isso está escrita
  // nos dois arquivos. Em `contatos` a leitura é negada e pedir a linha faz
  // a inserção parecer que falhou; aqui a pessoa lê a própria candidatura,
  // e o id que volta é o que a segunda tabela precisa referenciar.
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  assert.match(codigo, /\.select\(\s*'id'\s*\)/,
    'sem `.select("id")` não há como saber o id da candidatura, e as áreas se perdem');
});

test('a Action termina em redirect para a área do usuário, e ele fica FORA do try', async () => {
  const codigo = semComentarios(await lerFonte('acoes/voluntariado.ts'));

  assert.match(codigo, /redirect\(`\$\{MINHA_CONTA\}\?aviso=/,
    'a confirmação precisa levar para onde a candidatura APARECE');

  // `redirect()` sinaliza por exceção: um catch em volta o transformaria em
  // "não deu para enviar" logo depois de uma gravação bem-sucedida.
  const doTry = codigo.indexOf('try {');
  const doCatch = codigo.indexOf('} catch');
  const doRedirect = codigo.lastIndexOf('redirect(');

  assert.ok(doTry > 0 && doCatch > doTry, 'não achei o bloco try/catch da Action');
  assert.ok(doRedirect > doCatch, 'o redirect voltou para dentro do try');
});

// ---------------------------------------------------------------------
// 6. Os avisos da confirmação
// ---------------------------------------------------------------------

test('a confirmação diz que a candidatura ficou registrada, e NÃO promete prazo de resposta', () => {
  // Regra 2 do CLAUDE.md aplicada a uma confirmação: a tela de gestão de
  // voluntários (RF26) não existe, e a ONG é uma equipe pequena —
  // "responderemos em até X" seria promessa que ninguém fez.
  const aviso = avisoDaConta('candidatura');

  assert.equal(aviso.ok, true);
  assert.match(aviso.texto, /registrada/);
  assert.doesNotMatch(aviso.texto, /\d+\s*(horas|dias|úteis)/,
    'a confirmação promete um prazo de resposta que ninguém prometeu');
});

test('existe um aviso para "candidatura gravada, áreas não" — o desfecho parcial das duas tabelas', () => {
  // Sem ele, a segunda gravação falhando produziria "candidatura
  // registrada" liso: a pessoa acharia que escolheu as áreas, e a ONG
  // receberia uma candidatura sem saber para quê.
  const parcial = avisoDaConta('candidatura-sem-areas');

  assert.ok(parcial, 'o aviso do desfecho parcial sumiu da lista fechada');
  assert.match(parcial.texto, /áreas/);
  assert.match(parcial.texto, /\(11\) 95396-8344/, 'sem canal real, a pessoa fica sem saída');
  assert.notEqual(parcial.texto, avisoDaConta('candidatura').texto,
    'o desfecho parcial não pode dizer a mesma coisa que o sucesso completo');
});

// ---------------------------------------------------------------------
// 7. O que a página serve a quem NÃO tem sessão
// ---------------------------------------------------------------------

/** O <main> da resposta, e só ele — mesma função de testes/contato.test.mjs. */
function main(html) {
  const abre = html.match(/<main\b[^>]*id="conteudo"[^>]*>/i);
  assert.ok(abre, 'não achou <main id="conteudo"> na resposta');
  const inicio = abre.index + abre[0].length;
  const fim = html.indexOf('</main>', inicio);
  assert.ok(fim !== -1, 'não achou </main> na resposta');
  return html.slice(inicio, fim);
}

test('a rota está catalogada como página pública fora do menu', () => {
  // A reconciliação de PAGINAS_CATALOGADAS contra o sistema de arquivos
  // (testes/links.test.mjs) já quebraria se ninguém a cadastrasse; esta
  // linha diz em QUAL lista ela precisa estar, e por quê.
  assert.ok(PAGINAS_PRONTAS_FORA_DO_MENU.includes(ROTA),
    'a candidatura é página PÚBLICA: quem não tem sessão lê por que candidatar-se exige '
    + 'conta, em vez de ser redirecionado. Se ela virar redirect, muda de lista');
});

test('anônimo recebe 200 e a explicação — não um 404 nem um redirect para /entrar', async () => {
  const resposta = await fetch(`${BASE}${ROTA}`, { redirect: 'manual' });

  assert.equal(resposta.status, 200,
    'a página deixou de responder a quem não tem sessão. /minha-conta redireciona porque lá '
    + 'não há nada a dizer sem sessão; aqui há, e é o principal: por que precisa de conta');

  const conteudo = main(await resposta.text());

  assert.match(conteudo, /é preciso ter uma conta/i);
  assert.match(conteudo, /href="\/entrar"/, 'faltou o caminho para criar conta ou entrar');
  assert.match(conteudo, /\(11\) 95396-8344/,
    'quem não quer criar conta precisa sair daqui com um canal que funciona');
});

test('sem sessão NÃO existe formulário na página — nem escondido no HTML', async () => {
  // Um <form> desenhado para quem não pode enviar é um botão que sempre
  // recusa. E ele apareceria no HTML servido, não só na tela.
  const html = await fetch(`${BASE}${ROTA}`).then((r) => r.text());

  assert.doesNotMatch(html, /id="form-candidatura"/);
  assert.doesNotMatch(html, /name="areas"/);
  assert.doesNotMatch(html, /Enviar minha candidatura/);
});

test('/voluntariado manda "Quero me candidatar" para cá, e não mais para /entrar', async () => {
  const conteudo = main(await fetch(`${BASE}/voluntariado`).then((r) => r.text()));

  assert.match(conteudo, new RegExp(`<a[^>]+href="${ROTA}"[^>]*>Quero me candidatar</a>`),
    'o botão da página de voluntariado deixou de apontar para a tela de candidatura');
});

test('o texto do botão não mudou — é o que mantém testes/paridade-texto.test.mjs honesto', async () => {
  // O <main> de /voluntariado é comparado palavra por palavra com o do HTML
  // original congelado. O DESTINO do link mudou nesta tarefa; o TEXTO não
  // podia mudar, senão aquela comparação exigiria mais uma exclusão.
  const conteudo = main(await fetch(`${BASE}/voluntariado`).then((r) => r.text()));

  assert.match(conteudo, />Quero me candidatar</);
  assert.match(conteudo, />Tenho uma dúvida</);
});
