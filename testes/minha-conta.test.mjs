/**
 * A área do usuário (RF11): `/minha-conta`.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR AQUI, E O QUE NÃO DÁ
 * ===================================================================
 *
 * A suíte NÃO TEM SESSÃO. Toda requisição que este arquivo faz é ANÔNIMA,
 * pelo mesmo motivo de testes/painel-guarda.test.mjs: entrar exige uma conta
 * de verdade e uma senha, e este repositório não guarda nem uma nem outra. O
 * caminho de quem ESTÁ autenticado — a ficha desenhada, o formulário
 * preenchido com o que veio do banco, o nome mudando no cabeçalho — foi
 * medido À MÃO, contra o Supabase de produção, com uma conta de teste criada
 * para isso, e está no relatório desta tarefa. Nenhum teste deste arquivo
 * afirma nada sobre ele.
 *
 * O que sobra é bastante, e são cinco coisas diferentes:
 *
 *   1. AS DECISÕES PURAS — o que a Action aceita (`lerMeusDados`), o que ela
 *      manda ao banco (`colunasDoPerfil`), o que ela recusa
 *      (`validarMeusDados`) e as frases da lista fechada de avisos. É aqui
 *      que mora a trava da regra 6 do CLAUDE.md, exercitada com um FormData
 *      HOSTIL — `eh_equipe=true` no corpo, `id` de outra pessoa, papéis
 *      inventados — provando que nada disso chega ao objeto do `update`;
 *   2. O CAMINHO DA RECUSA, por HTTP: anônimo em `/minha-conta` é
 *      REDIRECIONADO para `/entrar`. Não é 404 (o painel é que é) e não é
 *      200;
 *   3. O NÃO-VAZAMENTO: nada da área do usuário aparece na resposta servida
 *      a quem não tem sessão — nem no corpo, nem no payload de hidratação,
 *      que foi por onde o painel vazou na Tarefa P1;
 *   4. QUE A GUARDA NÃO SUMA: varreduras de `app/minha-conta/page.tsx` e de
 *      `acoes/conta.ts`. A do painel (`testes/painel-guarda.test.mjs`) lê
 *      `app/admin/**` e não alcança nenhum dos dois;
 *   5. O QUE A TELA DESENHA, montando os componentes reais com
 *      `react-dom/server`.
 *
 * A ARMADILHA DO NOME NO CABEÇALHO tem teste próprio aqui (seção 4): ele
 * falha se `acoes/conta.ts` parar de gravar o metadata da conta junto com
 * `public.perfis`. É a trava da decisão descrita em servidor/sessao.ts — sem
 * ela, alguém "simplifica" a Action, o cabeçalho passa a mostrar o nome
 * antigo para sempre, e nada acusa.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerMeusDados, validarMeusDados, colunasDoPerfil, ehTipoDePessoa, TIPOS_DE_PESSOA
} from '../compartilhado/validacao.ts';
import { avisoDaConta } from '../compartilhado/avisos-da-conta.ts';
import {
  FichaDaConta, MinhasCandidaturas, MinhasDoacoes,
  SITUACAO_DA_CANDIDATURA, SITUACAO_DA_DOACAO, TIPO_DA_DOACAO
} from '../componentes/MinhaConta.ts';
import {
  PAGINAS_SO_PARA_QUEM_ENTROU, PAGINAS_PRONTAS, PAGINAS_CATALOGADAS
} from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const ROTA = '/minha-conta';

/** Um uuid de verdade, no formato que `gen_random_uuid()` produz. */
const ID = '3c1e6a54-2b7d-4f10-9e83-5a6b7c8d9e0f';

/** Um perfil completo, do jeito que servidor/dados/conta.ts devolve. */
const PERFIL = {
  id: ID,
  nome: 'Rosa Maria',
  email: 'rosa@exemplo.invalid',
  telefone: '11953968344',
  tipo_pessoa: 'fisica',
  eh_voluntario: true,
  eh_doador: false,
  criado_em: '2026-09-01T13:27:54.497005+00:00'
};

function desenhar(elemento) {
  return renderToStaticMarkup(elemento);
}

function formulario(pares) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(pares)) dados.append(nome, valor);
  return dados;
}

/**
 * O código sem os comentários — a mesma função de
 * testes/painel-guarda.test.mjs, e pelo mesmo motivo: sem isto, uma
 * varredura lê o que o arquivo EXPLICA sobre um defeito e acusa o defeito.
 * `acoes/conta.ts` fala de `eh_equipe` e de `ehEquipe()` em quatro
 * parágrafos, justamente para contar por que NÃO os usa.
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

// ---------------------------------------------------------------------
// 1. A trava da regra 6: o que o corpo da requisição NÃO consegue gravar
// ---------------------------------------------------------------------

/**
 * O TESTE QUE A TAREFA EXISTE PARA TER.
 *
 * Ele percorre o caminho inteiro que um corpo de requisição faz até o
 * `update`: `lerMeusDados(FormData)` → `colunasDoPerfil(campos)`. O que sai
 * daí é, literalmente, o objeto que `acoes/conta.ts` passa para
 * `.update(...)` — e a varredura da seção 4 é o que garante que continua
 * sendo.
 *
 * O FormData é HOSTIL de propósito: é o que alguém manda ao chamar a Server
 * Action direto, sem passar pelo formulário (spec §4.5). Se um dia alguém
 * "simplificar" a leitura para um spread, este teste fica vermelho ANTES de
 * o trigger do banco precisar entrar em ação.
 */
test('eh_equipe mandado no corpo da Action NÃO chega ao objeto que vai ao banco', () => {
  const hostil = formulario({
    nome: 'Pessoa Comum',
    telefone: '(11) 95396-8344',
    tipo_pessoa: 'fisica',
    // O ataque, nas quatro formas que já se viu neste projeto:
    eh_equipe: 'true',
    ehEquipe: 'true',
    eh_voluntario: 'true',
    eh_doador: 'true',
    // e a tentativa de escolher OUTRA linha para atualizar:
    id: '00000000-0000-4000-8000-000000000000',
    email: 'invasor@exemplo.invalid',
    maioridade_confirmada: 'true'
  });

  const campos = lerMeusDados(hostil);
  const linha = colunasDoPerfil(campos);

  assert.deepEqual(
    Object.keys(linha).sort(), ['nome', 'telefone', 'tipo_pessoa'],
    'o objeto que vai para o `.update()` de public.perfis ganhou (ou perdeu) uma chave.\n'
    + '  A regra 6 do CLAUDE.md depende de esta lista ser exatamente estas três: `eh_equipe`\n'
    + '  mora na MESMA LINHA da mesma tabela, e esta é a única tela do site em que uma pessoa\n'
    + '  comum edita `public.perfis`. Já houve uma escalada de privilégio real neste projeto.'
  );

  for (const proibida of ['eh_equipe', 'ehEquipe', 'eh_voluntario', 'eh_doador', 'id', 'email']) {
    assert.ok(
      !Object.hasOwn(linha, proibida),
      `"${proibida}" veio do corpo da requisição e chegou ao objeto do update`
    );
  }
});

test('lerMeusDados lê TRÊS campos por nome e ignora todo o resto do corpo', () => {
  const campos = lerMeusDados(formulario({
    nome: '  Rosa Maria  ', telefone: '(11) 95396-8344', tipo_pessoa: 'juridica',
    eh_equipe: 'true', situacao: 'ativo', publicado: 'true'
  }));

  assert.deepEqual(campos, {
    nome: 'Rosa Maria', telefone: '(11) 95396-8344', tipo_pessoa: 'juridica'
  });
});

test('campo ausente vira string vazia, nunca undefined nem "undefined"', () => {
  const campos = lerMeusDados(new FormData());
  assert.deepEqual(campos, { nome: '', telefone: '', tipo_pessoa: '' });
});

test('um File no campo de texto não vira a string "[object File]" no banco', () => {
  // A precaução 1 do bloco "Leitura do FormData": `dados.get()` devolve
  // `string | File | null`, e um arquivo mandado no campo `nome` seria
  // gravado como "[object File]" por um `String(...)` desavisado.
  const dados = new FormData();
  dados.append('nome', new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
  assert.equal(lerMeusDados(dados).nome, '');
});

test('colunasDoPerfil guarda só os dígitos do telefone, e vazio vira NULL', () => {
  assert.deepEqual(
    colunasDoPerfil({ nome: 'Rosa', telefone: '(11) 95396-8344', tipo_pessoa: 'fisica' }),
    { nome: 'Rosa', telefone: '11953968344', tipo_pessoa: 'fisica' }
  );

  // NULL e não '': as duas colunas aceitam nulo, e a tela OMITE o que é
  // nulo. Guardar '' faria a ficha desenhar um rótulo sem valor — e ''
  // nem passaria pelo `check` de `tipo_pessoa`.
  assert.deepEqual(
    colunasDoPerfil({ nome: 'Rosa', telefone: '', tipo_pessoa: '' }),
    { nome: 'Rosa', telefone: null, tipo_pessoa: null }
  );
});

// ---------------------------------------------------------------------
// 2. A validação
// ---------------------------------------------------------------------

test('nome é obrigatório — é o que aparece no cabeçalho', () => {
  const { valido, erros } = validarMeusDados({ nome: '', telefone: '', tipo_pessoa: '' });
  assert.equal(valido, false);
  assert.match(erros.nome, /nome/i);
});

test('telefone é opcional, mas se vier, vem com DDD — a MESMA regra do cadastro e do contato', () => {
  assert.equal(
    validarMeusDados({ nome: 'Rosa', telefone: '', tipo_pessoa: '' }).valido, true,
    'telefone vazio precisa ser aceito: coleta mínima (RNF09)'
  );

  const { valido, erros } = validarMeusDados({ nome: 'Rosa', telefone: '95396', tipo_pessoa: '' });
  assert.equal(valido, false);
  assert.match(erros.telefone, /DDD/);
});

test('tipo_pessoa fora da lista fechada é recusado antes de chegar ao check do Postgres', () => {
  const { valido, erros } = validarMeusDados({
    nome: 'Rosa', telefone: '', tipo_pessoa: 'equipe'
  });
  assert.equal(valido, false);
  assert.ok(erros.tipo_pessoa);

  assert.equal(ehTipoDePessoa('fisica'), true);
  assert.equal(ehTipoDePessoa('juridica'), true);
  assert.equal(ehTipoDePessoa(''), true, "'' é 'prefiro não dizer', e vira NULL na coluna");
  assert.equal(ehTipoDePessoa('equipe'), false);
  assert.equal(ehTipoDePessoa(null), false);
});

test('a validação devolve TODOS os erros de uma vez', () => {
  const { erros } = validarMeusDados({ nome: '', telefone: '123', tipo_pessoa: 'x' });
  assert.deepEqual(Object.keys(erros).sort(), ['nome', 'telefone', 'tipo_pessoa']);
});

/**
 * A reconciliação com o BANCO. Sem ela, a lista da tela e o `check` da
 * coluna podem divergir em silêncio — e a divergência aparece como um erro
 * de Postgres cru na cara de quem estava só corrigindo o próprio telefone.
 */
test('TIPOS_DE_PESSOA bate com o check de tipo_pessoa em 001_base.sql', async () => {
  const sql = await lerFonte('supabase/migrations/001_base.sql');
  const trecho = sql.match(/tipo_pessoa\s+text\s+check\s*\(tipo_pessoa in \(([^)]*)\)\)/i);

  assert.ok(trecho, 'o check de tipo_pessoa mudou de forma em 001_base.sql — reveja este teste');

  const doBanco = trecho[1].split(',').map((parte) => parte.trim().replace(/'/g, '')).sort();
  const daTela = TIPOS_DE_PESSOA.map((opcao) => opcao.valor).filter(Boolean).sort();

  assert.deepEqual(
    daTela, doBanco,
    'as opções que /minha-conta oferece e os valores que a coluna aceita divergiram'
  );
  assert.ok(
    TIPOS_DE_PESSOA.some((opcao) => opcao.valor === ''),
    'falta a opção vazia: a coluna aceita nulo, e não oferecer isso obrigaria a pessoa a se '
    + 'declarar física ou jurídica para poder salvar o telefone'
  );
});

// ---------------------------------------------------------------------
// 3. Os avisos que voltam pela URL
// ---------------------------------------------------------------------

test('?aviso= só escolhe frase nossa, nunca traz uma', () => {
  assert.equal(avisoDaConta('salvo').ok, true);
  assert.equal(avisoDaConta('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDaConta(''), null);
  assert.equal(avisoDaConta(undefined), null);
  assert.equal(avisoDaConta(['salvo']), null, 'array (?aviso=a&aviso=b) não pode virar frase');
});

test('?aviso=toString e ?aviso=__proto__ não desenham nada herdado do protótipo', () => {
  for (const valor of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(avisoDaConta(valor), null, `?aviso=${valor} devolveu algo`);
  }
});

/**
 * O DESFECHO PARCIAL PRECISA EXISTIR E PRECISA DIZER A VERDADE.
 *
 * Ele é a metade visível da decisão de gravar o nome em dois lugares: se a
 * segunda gravação falhar, os dados ESTÃO salvos e o cabeçalho continua com
 * o nome antigo. Um "salvo" liso nesse caso mentiria justamente sobre a
 * única coisa que a pessoa vai conferir olhando.
 */
test('existe um aviso para "gravou, mas o cabeçalho ficou com o nome antigo"', () => {
  const parcial = avisoDaConta('salvo-cabecalho-velho');

  assert.ok(parcial, 'o aviso do desfecho parcial sumiu da lista fechada');
  assert.equal(parcial.ok, true, 'os dados FORAM gravados: não é uma falha');
  assert.match(
    parcial.texto, /nome/i,
    'o aviso precisa falar do nome — é ele que ficou divergente'
  );
  assert.notEqual(parcial.texto, avisoDaConta('salvo').texto,
    'o desfecho parcial não pode dizer a mesma coisa que o sucesso completo');
});

// ---------------------------------------------------------------------
// 4. As varreduras: a guarda e a armadilha do nome
// ---------------------------------------------------------------------

/**
 * A varredura irmã da de testes/painel-guarda.test.mjs, e ela cobra o
 * CONTRÁRIO em um ponto.
 *
 * Toda Action do painel chama `ehEquipe()`. Esta não pode: a área do usuário
 * é de QUALQUER pessoa autenticada, e exigir equipe aqui trancaria todo
 * mundo fora dos próprios dados. As duas varreduras existem para que ninguém
 * "conserte" uma copiando a outra.
 */
test('toda Server Action de acoes/conta.ts confere a sessão sozinha — e NÃO exige equipe', async () => {
  const codigo = semComentarios(await lerFonte('acoes/conta.ts'));

  const funcoes = [...codigo.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
  assert.ok(funcoes.length > 0, 'nenhuma Action encontrada — o teste não verificou nada');

  for (const nome of funcoes) {
    const inicio = codigo.indexOf(`export async function ${nome}`);
    const proxima = codigo.indexOf('export async function ', inicio + 1);
    const corpo = codigo.slice(inicio, proxima === -1 ? undefined : proxima);

    assert.match(
      corpo, /usuarioAtual\s*\(\s*\)/,
      `${nome} não chama usuarioAtual().\n`
      + '  Server Action é endpoint HTTP público (spec §4.5): não passa por página nem por\n'
      + '  layout, e a varredura de testes/painel-guarda.test.mjs lê app/admin/** — não\n'
      + '  alcança este arquivo.'
    );
  }

  assert.doesNotMatch(
    codigo, /ehEquipe\s*\(/,
    'acoes/conta.ts chamou ehEquipe(). A área do usuário é de QUALQUER pessoa autenticada — '
    + 'exigir equipe aqui tranca voluntárias e doadoras fora dos próprios dados.'
  );
});

test('a Action grava sempre na linha da SESSÃO, e o id nunca vem do corpo da requisição', async () => {
  const codigo = semComentarios(await lerFonte('acoes/conta.ts'));

  assert.match(
    codigo, /\.eq\(\s*'id'\s*,\s*usuario\.id\s*\)/,
    'o update precisa filtrar por `usuario.id`, que veio de usuarioAtual() — nunca por um id '
    + 'lido do FormData'
  );
  assert.doesNotMatch(
    codigo, /textoDoCampo\s*\(\s*dados\s*,\s*'id'\s*\)/,
    'a Action passou a ler um campo `id` do corpo: qual linha é atualizada deixaria de ser '
    + 'decidido pela sessão'
  );
  assert.doesNotMatch(
    codigo, /\.\.\.campos/,
    'espalhar o que veio da requisição no objeto do update é exatamente como `eh_equipe` '
    + 'voltaria a entrar pela porta da frente (regra 6 do CLAUDE.md)'
  );
});

test('a Action de conta não cria nem apaga perfil — ela só corrige o que já existe', async () => {
  const codigo = semComentarios(await lerFonte('acoes/conta.ts'));

  // `perfis` nasce de um TRIGGER em auth.users (public.criar_perfil, em
  // 001_base.sql). Um insert aqui criaria uma segunda forma de a linha
  // nascer, e um delete apagaria o cadastro sem apagar a conta — a pessoa
  // continuaria conseguindo entrar, num site que não sabe mais quem ela é.
  assert.doesNotMatch(codigo, /\.insert\s*\(/, 'apareceu um insert em acoes/conta.ts');
  assert.doesNotMatch(codigo, /\.delete\s*\(/, 'apareceu um delete em acoes/conta.ts');
});

/**
 * A ARMADILHA QUE `servidor/sessao.ts` PREVIU POR ESCRITO.
 *
 * O cabeçalho lê o nome do METADATA da conta, não de `public.perfis`. Uma
 * Action que gravasse só na tabela deixaria a pessoa trocar o nome, ver
 * "salvo", e o topo da tela mostrar o nome antigo para sempre — sem erro
 * nenhum, que é o padrão de defeito deste projeto.
 *
 * Este teste é a trava da saída escolhida (gravar nos dois lugares). Ele
 * falha se alguém apagar a segunda gravação — e no dia em que RF26 criar um
 * SEGUNDO escritor de `perfis.nome`, é ele que vai obrigar a decisão a ser
 * tomada de novo.
 */
test('quem grava o nome em public.perfis grava também no metadata — senão o cabeçalho fica velho', async () => {
  const codigo = semComentarios(await lerFonte('acoes/conta.ts'));

  assert.match(
    codigo, /auth\.updateUser\s*\(\s*\{\s*\n?\s*data:\s*\{\s*nome:/,
    'acoes/conta.ts parou de gravar o `nome` no metadata da conta.\n'
    + '  servidor/sessao.ts lê o nome do CABEÇALHO de lá, não da tabela — é a decisão dessa\n'
    + '  tarefa, e está escrita nos dois arquivos. Sem esta gravação a pessoa troca o nome,\n'
    + '  vê "salvo", e o topo da tela continua com o antigo para sempre, sem erro nenhum.\n'
    + '  A outra saída válida é trocar a leitura de servidor/sessao.ts por uma consulta a\n'
    + '  `perfis` — se for essa a decisão, é ESTE teste que muda, de propósito.'
  );

  assert.match(
    codigo, /salvo-cabecalho-velho/,
    'sumiu o desfecho parcial: se a gravação do metadata falhar depois de a tabela ter sido '
    + 'gravada, a pessoa precisa saber que só o nome do topo ficou antigo'
  );
});

test('servidor/sessao.ts continua sendo o único a decidir quem está autenticado', async () => {
  const codigo = semComentarios(await lerFonte('app/minha-conta/page.tsx'));

  // A página e a Action usam a MESMA função, de propósito: duas respostas
  // diferentes para a mesma pergunta seriam exatamente o buraco.
  assert.match(codigo, /usuarioAtual/, 'a página não pergunta quem está autenticado');
  assert.doesNotMatch(
    codigo, /getSession\s*\(/,
    'getSession() devolve o que estiver escrito no cookie, que é dado do navegador'
  );
});

/**
 * A MESMA REGRA DA TAREFA P1, APLICADA A OUTRA ROTA: guarda no corpo E no
 * `generateMetadata`.
 *
 * MEDIDO lá — com a guarda só no layout, a página filha renderiza do mesmo
 * jeito e o conteúdo vai na resposta atrás do status; e um `export const
 * metadata` vaza o título por um caminho que não é a renderização do
 * componente. Aqui não há nem layout próprio: se a guarda sair de um dos
 * dois lugares, não sobra nada.
 */
test('/minha-conta guarda o corpo E o título, e recusa com redirect — não com 404', async () => {
  const codigo = semComentarios(await lerFonte('app/minha-conta/page.tsx'));

  const corte = codigo.indexOf('export default');
  assert.notEqual(corte, -1, 'app/minha-conta/page.tsx não tem `export default`');

  const antesDoComponente = codigo.slice(0, corte);
  const componente = codigo.slice(corte);

  const guardado = (trecho) =>
    /usuarioAtual\s*\(\s*\)/.test(trecho) && /redirect\(\s*'\/entrar'\s*\)/.test(trecho);

  assert.ok(guardado(componente),
    'o COMPONENTE não recusa quem não tem sessão com `redirect(\'/entrar\')`');
  assert.ok(/generateMetadata/.test(antesDoComponente) && guardado(antesDoComponente),
    'o `generateMetadata` não passa pela mesma guarda — o título viaja mesmo com o corpo '
    + 'protegido (medido na Tarefa P1)');
  assert.doesNotMatch(antesDoComponente, /export\s+const\s+metadata\s*=/,
    'usa `export const metadata`: trocar por `generateMetadata` com a guarda');

  assert.doesNotMatch(
    componente, /notFound\s*\(/,
    'a área do usuário NÃO responde 404: 404 é do painel, e serve para esconder que ele '
    + 'existe. Aqui a existência não é segredo — o que falta é sessão, e a resposta certa '
    + 'para isso é a tela de entrar. Ver o cabeçalho de app/minha-conta/page.tsx.'
  );
});

/**
 * UMA CAIXA DE AVISO SÓ — a trava de um defeito VISTO ABRINDO A TELA.
 *
 * MEDIDO no Firefox, com sessão de verdade: com uma caixa na página (a do
 * `?aviso=` que a Action deixa na URL) e outra dentro do formulário (a do
 * `estado`), salvar e em seguida enviar algo inválido punha as duas na tela
 * ao mesmo tempo — "Seus dados foram atualizados" logo acima de "Confira o
 * que está marcado abaixo e envie de novo". Duas frases que se contradizem,
 * e a errada em cima.
 *
 * O teste é sobre o CÓDIGO-FONTE porque o formulário é Client Component
 * (`useActionState`) e o `node --test` não transforma JSX. É uma trava
 * grosseira — vê a passagem da prop, não prova que a decisão é a certa —, e
 * mesmo grosseira pega o caso que de fato aconteceu: alguém devolver a caixa
 * para a página.
 */
test('a área do usuário desenha UMA caixa de aviso, e é o formulário que decide qual mensagem', async () => {
  const pagina = semComentarios(await lerFonte('app/minha-conta/page.tsx'));
  const form = semComentarios(await lerFonte('componentes/FormularioMeusDados.tsx'));

  assert.match(
    pagina, /avisoDaUrl=\{aviso\}/,
    'a página não passa mais o `?aviso=` para o formulário — quem decide qual mensagem vale '
    + 'precisa ser quem conhece as duas'
  );
  assert.doesNotMatch(
    pagina, /className=\{aviso\.ok/,
    'a página voltou a desenhar a própria caixa de aviso. Com a do formulário na tela ao mesmo '
    + 'tempo, as duas se contradizem depois de um salvamento seguido de um envio inválido '
    + '(medido).'
  );
  assert.match(
    form, /estado\.mensagem[\s\S]{0,80}avisoDaUrl/,
    'o formulário precisa preferir a mensagem do envio que acabou de acontecer à que veio na URL'
  );
});

/**
 * O `.eq()` de servidor/dados/conta.ts NÃO É REDUNDANTE, e este teste existe
 * porque parece que é.
 *
 * As políticas de `voluntarios` e `doacoes` são
 * `perfil_id = auth.uid() OR public.eh_equipe()`. Sem o filtro à mão, uma
 * pessoa DA EQUIPE abriria "Minhas doações" e veria as doações de todo
 * mundo — não é vazamento para fora (a RLS está certa), é a tela mentindo
 * sobre de quem é aquilo, no mesmo celular que a equipe usa para as duas
 * coisas.
 */
test('toda consulta da área do usuário filtra pela própria pessoa, além da RLS', async () => {
  const codigo = semComentarios(await lerFonte('servidor/dados/conta.ts'));

  const consultas = [...codigo.matchAll(/\.from\('(\w+)'\)([\s\S]*?)(?=\n\s*\[\]|\n\s*null\)|;)/g)];
  assert.ok(consultas.length >= 3, 'esperava ao menos três consultas em servidor/dados/conta.ts');

  for (const [, tabela, corpo] of consultas) {
    assert.match(
      corpo, /\.eq\('(id|perfil_id)',\s*perfilId\)/,
      `a consulta a "${tabela}" não filtra por perfilId. As políticas de voluntarios e doacoes `
      + 'terminam em `or eh_equipe()`: sem o filtro, quem é da equipe vê o de todo mundo '
      + 'dentro da própria área de conta.'
    );
  }

  assert.doesNotMatch(
    codigo, /from\('inscricoes'\)/,
    'apareceu uma consulta a `inscricoes`. Ela NÃO tem política de select para a própria '
    + 'pessoa e não tem coluna ligando a inscrição a uma conta (decisão D4) — a consulta '
    + 'volta `[]` sem erro, e o bloco diria "você não tem inscrição" para quem tem três. '
    + 'O motivo inteiro está no fim de servidor/dados/conta.ts.'
  );
});

// ---------------------------------------------------------------------
// 5. O que a tela desenha
// ---------------------------------------------------------------------

test('a ficha da conta mostra o e-mail, o tipo de pessoa e desde quando a conta existe', () => {
  const html = desenhar(createElement(FichaDaConta, { perfil: PERFIL }));

  assert.match(html, /rosa@exemplo\.invalid/);
  assert.match(html, /Pessoa física/);
  assert.match(html, /voluntariado/);
  assert.doesNotMatch(html, /doações/, 'eh_doador é false: não pode aparecer como escolha dela');
  assert.match(html, /1 de setembro de 2026/);
});

test('tipo_pessoa nulo some da ficha em vez de virar rótulo sem valor', () => {
  const html = desenhar(createElement(FichaDaConta, {
    perfil: { ...PERFIL, tipo_pessoa: null }
  }));

  assert.doesNotMatch(html, /Você fala por/);
  assert.match(html, /rosa@exemplo\.invalid/, 'o resto da ficha continua desenhado');
});

test('quem não marcou papel nenhum lê uma frase, não um espaço em branco', () => {
  const html = desenhar(createElement(FichaDaConta, {
    perfil: { ...PERFIL, eh_voluntario: false, eh_doador: false }
  }));
  assert.match(html, /não marcou nenhuma opção/i);
});

test('a ficha NÃO desenha eh_equipe em lugar nenhum', () => {
  // A coluna nem é lida por servidor/dados/conta.ts. Este teste é a segunda
  // trava: se alguém trocar o `select` por `*`, o dado ainda não pode
  // aparecer aqui.
  const html = desenhar(createElement(FichaDaConta, {
    perfil: { ...PERFIL, eh_equipe: true }
  }));
  assert.doesNotMatch(html, /equipe/i);
});

test('sem candidatura, a tela manda para o caminho que EXISTE hoje', () => {
  // MUDOU NA RF25, e a mudança é o ponto. Este estado vazio dizia
  // "candidatar-se pelo site ainda não existe" e mandava direto para o
  // WhatsApp — era verdade, e virou mentira no dia em que
  // /voluntariado/candidatura passou a existir. Um estado vazio que
  // descreve o site de ontem DESVIA a pessoa do caminho que funciona.
  const html = desenhar(createElement(MinhasCandidaturas, { candidaturas: [], degradou: false }));

  assert.match(html, /estado--vazio/);
  assert.match(html, /página de voluntariado/,
    'o estado vazio precisa apontar para onde a pessoa se candidata de verdade');
  assert.doesNotMatch(html, /ainda não existe/,
    'o estado vazio continua dizendo que candidatar-se pelo site não existe — existe desde a '
    + 'RF25 (app/voluntariado/candidatura/page.tsx)');
  assert.match(html, /\(11\) 95396-8344/,
    'quem prefere conversar antes precisa continuar tendo um canal real');
});

test('a candidatura mostra as áreas escolhidas — é a única coisa que a pessoa escolheu', () => {
  const html = desenhar(createElement(MinhasCandidaturas, {
    degradou: false,
    candidaturas: [{
      id: ID,
      mensagem: 'Posso às terças à tarde.',
      situacao: 'novo',
      criado_em: '2026-09-01T13:00:00.000Z',
      areas: ['Organização do acervo', 'Comunicação']
    }]
  }));

  assert.match(html, /Organização do acervo, Comunicação/);
  assert.match(html, /Posso às terças à tarde\./);
  assert.match(html, /Recebida, ainda sem resposta/);
});

test('candidatura SEM área não fica calada — é o desfecho parcial das duas tabelas', () => {
  // `acoes/voluntariado.ts` grava em `voluntarios` e `voluntario_areas` sem
  // transação. Quando a segunda falha, a candidatura existe e a escolha se
  // perdeu — e é aqui, na tela da própria pessoa, que isso precisa
  // aparecer. Omitir a linha esconderia justamente o que ela precisa saber
  // para completar por outro canal.
  const html = desenhar(createElement(MinhasCandidaturas, {
    degradou: false,
    candidaturas: [{
      id: ID, mensagem: null, situacao: 'novo', criado_em: '2026-09-01T13:00:00.000Z', areas: []
    }]
  }));

  assert.match(html, /não ficaram registradas/);
  assert.match(html, /\(11\) 95396-8344/, 'sem canal real, a pessoa fica sabendo do defeito e sem saída');
});

test('banco fora do ar NÃO vira "você não tem nada" — a lista diz que não deu para perguntar', () => {
  const semNada = desenhar(createElement(MinhasDoacoes, { doacoes: [], degradou: false }));
  const semResposta = desenhar(createElement(MinhasDoacoes, { doacoes: [], degradou: true }));

  assert.match(semResposta, /estado--erro/);
  assert.match(semResposta, /não respondeu/);
  assert.notEqual(
    semNada, semResposta,
    'as duas telas ficaram iguais: quem fez uma doação e vê "nenhuma doação registrada" '
    + 'durante uma queda do banco fecha o site achando que a ONG não registrou'
  );

  const candidaturas = desenhar(createElement(MinhasCandidaturas, {
    candidaturas: [], degradou: true
  }));
  assert.match(candidaturas, /não respondeu/);
});

test('uma doação desenha situação, descrição, valor e a resposta da ONG', () => {
  const html = desenhar(createElement(MinhasDoacoes, {
    degradou: false,
    doacoes: [{
      id: ID,
      tipo: 'recurso_financeiro',
      descricao: 'Contribuição mensal',
      valor: '150.00',
      situacao: 'recebida',
      resposta: 'Recebemos, muito obrigada!',
      criado_em: '2026-09-01T13:00:00.000Z',
      recebida_em: '2026-09-02T13:00:00.000Z'
    }]
  }));

  assert.match(html, /Recebida/);
  assert.match(html, /Contribuição mensal/);
  assert.match(html, /R\$&nbsp;150,00|R\$\s150,00/, 'o valor não saiu em reais');
  assert.match(html, /Recebemos, muito obrigada!/);
  assert.match(html, /Dinheiro/);
});

test('doação de item, sem valor, não desenha R$ 0,00', () => {
  const html = desenhar(createElement(MinhasDoacoes, {
    degradou: false,
    doacoes: [{
      id: ID, tipo: 'item', descricao: 'Duas caixas de tinta', valor: null,
      situacao: 'ofertada', resposta: null,
      criado_em: '2026-09-01T13:00:00.000Z', recebida_em: null
    }]
  }));

  assert.doesNotMatch(html, /0,00/, 'valor nulo virou zero — dizer que a doação não vale nada');
  assert.match(html, /Duas caixas de tinta/);
});

test('valor de coluna que a lista não conhece aparece cru, em vez de sumir', () => {
  // Um valor novo no `check` do banco é defeito de manutenção. Escondê-lo
  // faria a tela mentir em silêncio; mostrando o texto cru, quem abrir a
  // tela vê onde mexer.
  const html = desenhar(createElement(MinhasCandidaturas, {
    degradou: false,
    candidaturas: [{
      id: ID, mensagem: null, situacao: 'em_analise', criado_em: '2026-09-01T13:00:00.000Z'
    }]
  }));
  assert.match(html, /em_analise/);
});

/**
 * A reconciliação com os `check` do banco — a mesma que
 * testes/contatos.test.mjs faz com as situações de contato.
 *
 * Sem ela, uma quinta situação criada no banco apareceria na tela como o
 * texto cru da coluna (`em_contato`), e ninguém descobriria até alguém ver.
 */
test('as palavras da tela cobrem todos os valores que as colunas aceitam (004_pessoas.sql)', async () => {
  const sql = await lerFonte('supabase/migrations/004_pessoas.sql');

  const doCheck = (coluna) => {
    const trecho = sql.match(new RegExp(`${coluna}[\\s\\S]{0,120}?check\\s*\\(${coluna} in \\(([^)]*)\\)\\)`, 'i'));
    assert.ok(trecho, `não achei o check de ${coluna} em 004_pessoas.sql`);
    return trecho[1].split(',').map((parte) => parte.trim().replace(/'/g, '')).sort();
  };

  assert.deepEqual(
    Object.keys(SITUACAO_DA_CANDIDATURA).sort(), doCheck('situacao'),
    'SITUACAO_DA_CANDIDATURA divergiu do check de public.voluntarios'
  );

  // `doacoes` tem DOIS checks de lista fechada: `tipo` e `situacao`. O de
  // `situacao` é o segundo do arquivo, então é lido a partir do bloco da
  // tabela, não do arquivo inteiro.
  const blocoDoacoes = sql.slice(sql.indexOf('create table public.doacoes'));
  const listaDe = (coluna) => {
    const trecho = blocoDoacoes.match(new RegExp(`check\\s*\\(${coluna} in \\(([^)]*)\\)\\)`, 'i'));
    assert.ok(trecho, `não achei o check de ${coluna} em public.doacoes`);
    return trecho[1].split(',').map((parte) => parte.trim().replace(/'/g, '')).sort();
  };

  assert.deepEqual(Object.keys(SITUACAO_DA_DOACAO).sort(), listaDe('situacao'),
    'SITUACAO_DA_DOACAO divergiu do check de public.doacoes');
  assert.deepEqual(Object.keys(TIPO_DA_DOACAO).sort(), listaDe('tipo'),
    'TIPO_DA_DOACAO divergiu do check de public.doacoes');
});

// ---------------------------------------------------------------------
// 6. Contra o servidor: a recusa e o não-vazamento
// ---------------------------------------------------------------------

test('anônimo em /minha-conta é mandado para /entrar — e não recebe 404 nem a página', async () => {
  const resposta = await fetch(`${BASE}${ROTA}`, { redirect: 'manual' });

  assert.ok(
    [303, 307, 308].includes(resposta.status),
    `/minha-conta respondeu ${resposta.status} para requisição anônima, e devia redirecionar.\n`
    + '  404 é a resposta do PAINEL, e serve para esconder que ele existe. Aqui a existência\n'
    + '  não é segredo — o que falta é sessão.'
  );
  assert.equal(
    resposta.headers.get('location')?.replace(/^https?:\/\/[^/]+/, ''), '/entrar',
    'o redirect não aponta para /entrar'
  );
});

test('nada da área do usuário vaza no HTML servido a quem não tem sessão', async () => {
  // Seguindo o redirect: é a página que a pessoa de fato recebe.
  const html = await fetch(`${BASE}${ROTA}`).then((resposta) => resposta.text());

  for (const marca of [
    'Minhas doações', 'Minhas candidaturas', 'Meus dados',
    'form-meus-dados', 'conta__lista', 'Trocar minha senha'
  ]) {
    assert.ok(
      !html.includes(marca),
      `a resposta servida a quem não tem sessão contém "${marca}".\n`
      + '  Foi exatamente isto que aconteceu na Tarefa P1 do painel, com a guarda só no\n'
      + '  layout: o status certo na frente e a página inteira no payload de hidratação,\n'
      + '  atrás. Aqui o que vazaria é nome, e-mail, telefone e histórico de doação.'
    );
  }
});

test('/minha-conta está catalogada como rota de quem entrou — e fora das listas de página pública', () => {
  assert.ok(PAGINAS_SO_PARA_QUEM_ENTROU.includes(ROTA));
  assert.ok(PAGINAS_CATALOGADAS.includes(ROTA),
    'a reconciliação de testes/links.test.mjs compara esta lista com o que existe em app/');
  assert.ok(
    !PAGINAS_PRONTAS.includes(ROTA),
    'PAGINAS_PRONTAS é usada por testes que afirmam coisas sobre o conteúdo da página. '
    + '/minha-conta redireciona para /entrar, que tem <main id="conteudo">, <h1> e o menu '
    + 'inteiro: a suíte ficaria verde medindo a tela de entrar e dizendo que mediu esta.'
  );
});

test('o cabeçalho de quem entrou aponta para a área do usuário — é o único caminho até ela', async () => {
  const codigo = await lerFonte('componentes/Cabecalho.tsx');

  assert.match(
    codigo, /href="\/minha-conta"/,
    'o nome de quem entrou deixou de linkar para /minha-conta.\n'
    + '  A área do usuário não é item de menu (o menu é o mesmo para toda visita, e para a\n'
    + '  maioria anônima aquele item só redirecionaria). Sem este link, a única forma de\n'
    + '  chegar lá é saber o endereço de cor.'
  );
});
