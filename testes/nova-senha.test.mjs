/**
 * O caminho do link de e-mail: /auth/confirm -> /nova-senha.
 *
 * É o trecho que a Tarefa 2 da autenticação criou, e o que ele resolve está
 * na spec §9: no fluxo implícito o token vem no FRAGMENTO da URL
 * (`#access_token=...`), que o navegador nunca envia ao servidor — num site
 * todo renderizado no servidor, recuperação de senha simplesmente não
 * funcionaria. O fluxo PKCE manda `?token_hash=...&type=...` na query.
 *
 * O QUE ESTE ARQUIVO ALCANÇA, E O QUE NÃO ALCANÇA. Nenhum teste daqui
 * verifica um token VÁLIDO: token de recuperação só nasce de um e-mail
 * enviado a uma caixa real. O que está provado abaixo é o resto, que é a
 * maior parte do que pode dar errado:
 *
 *   - a lista fechada de `type` barra ANTES de qualquer tentativa de falar
 *     com o Supabase (a prova é a diferença de destino entre um tipo
 *     recusado e um aceito, com o mesmo token inventado);
 *   - nenhuma entrada malformada produz 500 nem tela branca;
 *   - /nova-senha sem sessão não mostra o formulário, e explica por quê;
 *   - o token não sobrevive no destino do redirect, nem em log.
 *
 * Roda nos três modos da suíte (ver DESTINO_DE_TOKEN_QUE_NAO_VALE abaixo):
 * no modo com credenciais, o caminho do `verifyOtp` que FALHA é exercitado
 * de verdade, contra o Auth do Supabase de verdade. O que fica fora é só o
 * caminho do sucesso, medido à mão e registrado no relatório da tarefa.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TIPOS_DE_LINK_ACEITOS, ehTipoDeLinkAceito, destinoDepoisDeConfirmar,
  ehMotivoDeFalha, caminhoDeFalha, MOTIVOS_DE_FALHA
} from '../compartilhado/links-de-email.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

/**
 * A suíte roda em três modos (ver ferramentas/rodar-testes.mjs), e o destino
 * de um link com token inventado muda entre eles — não porque o código mude,
 * mas porque a pergunta chega ou não a ser feita:
 *
 *   - offline (`npm test`, o padrão): sem SUPABASE_URL, a rota nem tenta
 *     verificar e manda para `?erro=indisponivel`;
 *   - com credenciais (`npm run test:supabase`) ou com a chave errada
 *     (`test:supabase-degradado`): a rota PERGUNTA de verdade, o Supabase
 *     recusa o token, e o destino é `?erro=expirado`.
 *
 * Cravar um dos dois quebraria os outros modos — que é como a suíte já trata
 * essa diferença em testes/origem-dos-dados.test.mjs.
 */
const COM_SUPABASE = process.env.COM_SUPABASE === '1'
  || process.env.COM_SUPABASE === 'chave-errada';

/** Onde termina um link de `recovery` cujo token não vale, no modo atual. */
const DESTINO_DE_TOKEN_QUE_NAO_VALE = COM_SUPABASE
  ? '/nova-senha?erro=expirado'
  : '/nova-senha?erro=indisponivel';

/** Um token com forma plausível — nenhum teste daqui espera que ele valha. */
const TOKEN_QUALQUER = 'pkce_0123456789abcdef0123456789abcdef';

/** A resposta da rota SEM seguir o redirect: é o Location que interessa. */
async function confirmar(consulta) {
  return fetch(`${BASE}/auth/confirm${consulta}`, { redirect: 'manual' });
}

async function html(caminho) {
  const resposta = await fetch(`${BASE}${caminho}`);
  assert.equal(resposta.status, 200, `${caminho} não respondeu 200`);
  return resposta.text();
}

// =====================================================================
// A lista fechada de tipos (compartilhado/links-de-email.ts)
//
// `type` é entrada de usuário numa URL pública, e o SDK do Supabase aceita
// vários tipos que este site não emite. Estes testes são de unidade porque
// app/auth/confirm/route.ts não pode ser importado pelo `node --test` (ele
// acaba em `cookies()` e em `import 'server-only'`) — a decisão mora num
// módulo puro justamente para poder ser medida aqui.
// =====================================================================

test('só os dois tipos que este site emite são aceitos', () => {
  assert.deepEqual([...TIPOS_DE_LINK_ACEITOS], ['recovery', 'signup']);
  assert.equal(ehTipoDeLinkAceito('recovery'), true);
  assert.equal(ehTipoDeLinkAceito('signup'), true);
});

test('todo outro tipo do SDK do Supabase é recusado', () => {
  // Os que o supabase-js aceitaria se a string crua fosse repassada.
  for (const tipo of ['magiclink', 'invite', 'email_change', 'email', 'sms', 'phone_change']) {
    assert.equal(ehTipoDeLinkAceito(tipo), false, `"${tipo}" passou pela lista`);
  }
});

test('lixo no lugar do tipo é recusado, inclusive as chaves herdadas de Object', () => {
  // A checagem é por igualdade em array, e não por `chave in objeto`, por
  // causa exatamente destes dois: `'__proto__' in {}` é `true`.
  for (const valor of ['__proto__', 'constructor', 'toString', '', ' recovery', 'RECOVERY',
                       null, undefined, 0, {}, ['recovery']]) {
    assert.equal(ehTipoDeLinkAceito(valor), false, `${JSON.stringify(valor)} passou pela lista`);
  }
});

test('cada tipo aceito tem um destino, e são destinos diferentes', () => {
  assert.equal(destinoDepoisDeConfirmar('recovery'), '/nova-senha');
  assert.equal(destinoDepoisDeConfirmar('signup'), '/');
});

test('o motivo da falha viaja na query de /nova-senha', () => {
  assert.equal(caminhoDeFalha(MOTIVOS_DE_FALHA.expirado), '/nova-senha?erro=expirado');
  for (const motivo of Object.values(MOTIVOS_DE_FALHA)) {
    assert.equal(ehMotivoDeFalha(motivo), true, `${motivo} não é reconhecido de volta`);
  }
  for (const valor of ['', 'qualquer-coisa', '__proto__', null, 7]) {
    assert.equal(ehMotivoDeFalha(valor), false);
  }
});

// =====================================================================
// A rota /auth/confirm
// =====================================================================

test('type fora da lista não chega ao SDK: barra antes de tentar verificar', async () => {
  // A PROVA está na diferença entre os dois destinos, com o MESMO token
  // inventado nos dois casos. Um `type` recusado termina em
  // `?erro=invalido` — saiu da rota antes da checagem de ambiente, que já é
  // antes de obterCliente() e de verifyOtp(). Um `type` aceito segue adiante
  // e termina no destino de quem tentou verificar (`indisponivel` offline,
  // `expirado` com o Supabase configurado). Apagando a lista fechada, o
  // primeiro passa a terminar como o segundo e este teste cai.
  const recusado = await confirmar(`?type=magiclink&token_hash=${TOKEN_QUALQUER}`);
  assert.equal(recusado.headers.get('location'), '/nova-senha?erro=invalido');

  const aceito = await confirmar(`?type=recovery&token_hash=${TOKEN_QUALQUER}`);
  assert.equal(aceito.headers.get('location'), DESTINO_DE_TOKEN_QUE_NAO_VALE,
    'um type ACEITO deveria seguir até a tentativa de verificação');
});

test('link sem token_hash não gera 500 — redireciona explicando', async () => {
  for (const consulta of ['?type=recovery', '?type=signup', '?type=recovery&token_hash=']) {
    const resposta = await confirmar(consulta);
    assert.ok(resposta.status >= 300 && resposta.status < 400,
      `${consulta} respondeu ${resposta.status} em vez de um redirect`);
    assert.equal(resposta.headers.get('location'), '/nova-senha?erro=invalido');
  }
});

test('/auth/confirm sem parâmetro nenhum também não quebra', async () => {
  const resposta = await confirmar('');
  assert.equal(resposta.headers.get('location'), '/nova-senha?erro=invalido');
});

test('quem clica no link cai numa página que responde 200, nunca num erro do framework', async () => {
  // Seguindo o redirect até o fim, como o navegador faz.
  const resposta = await fetch(`${BASE}/auth/confirm?type=recovery&token_hash=${TOKEN_QUALQUER}`);
  assert.equal(resposta.status, 200);

  const pagina = await resposta.text();
  assert.match(pagina, /<main[^>]*id="conteudo"/, 'a tela de destino veio sem o layout');
  assert.match(pagina, /<h1[^>]*>/);
});

test('o token não sobrevive ao redirect — nada dele vai parar na URL de destino', async () => {
  // Se o Location carregasse o token, ele iria embutido no histórico do
  // navegador e no cabeçalho Referer de tudo que a página seguinte
  // carregasse. É credencial de uso único.
  const resposta = await confirmar(`?type=recovery&token_hash=${TOKEN_QUALQUER}`);
  const destino = resposta.headers.get('location') ?? '';
  assert.doesNotMatch(destino, /token/i);
  assert.equal(destino.includes(TOKEN_QUALQUER), false);
});

test('nenhum console de app/auth/confirm/route.ts registra o token nem a URL inteira', async () => {
  // Não dá para ler o log do servidor a partir daqui; dá para provar que
  // nenhuma chamada de log MENCIONA o token. `token_hash` é credencial de
  // uso único, e o log da Netlify não é da ONG sozinha.
  const codigo = await readFile(new URL('../app/auth/confirm/route.ts', import.meta.url), 'utf8');
  const chamadasDeLog = codigo.match(/console\.(warn|error|log|info)\([\s\S]*?\);/g) ?? [];

  assert.ok(chamadasDeLog.length > 0, 'nenhum console encontrado — o teste não verificou nada');

  for (const chamada of chamadasDeLog) {
    // O que interessa é o CÓDIGO dentro da chamada, não a prosa da
    // mensagem: escrever "chegou sem token_hash" em português é correto e
    // não vaza nada; interpolar `${tokenHash}` vaza. Por isso as
    // interpolações são extraídas e o texto literal, descartado — sem esta
    // distinção o teste proibiria a mensagem que EXPLICA o problema.
    const interpolacoes = [...chamada.matchAll(/\$\{([^}]*)\}/g)].map((achado) => achado[1]);
    const semLiterais = chamada
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const codigo = [...interpolacoes, semLiterais].join(' ');

    for (const proibido of ['tokenHash', 'token_hash', 'requisicao', 'nextUrl', 'parametros']) {
      assert.equal(codigo.includes(proibido), false,
        `um log de /auth/confirm carrega "${proibido}" para dentro da mensagem:\n${chamada}`);
    }
  }
});

// =====================================================================
// A página /nova-senha
// =====================================================================

test('/nova-senha sem sessão NÃO mostra o formulário', async () => {
  const pagina = await html('/nova-senha');

  assert.doesNotMatch(pagina, /<form[^>]*id="form-nova-senha"/,
    'o formulário apareceu para quem não tem sessão — a Action recusaria, '
    + 'e a pessoa digitaria duas senhas para descobrir isso');
  assert.doesNotMatch(pagina, /type="password"/, 'sobrou campo de senha na tela sem sessão');
});

test('/nova-senha sem sessão explica o que fazer e oferece o caminho de volta', async () => {
  const pagina = await html('/nova-senha');

  assert.match(pagina, /<main[^>]*id="conteudo"/);
  assert.match(pagina, /<h1[^>]*>/);
  assert.match(pagina, /Esta página abre pelo link do e-mail/);
  assert.match(pagina, /<a href="\/recuperar-acesso">Pedir um link novo<\/a>/);
  assert.match(pagina, /<a href="\/entrar">Voltar para entrar<\/a>/);
});

test('cada motivo de falha tem a sua explicação, e não a genérica', async () => {
  const esperado = [
    ['expirado', /Este link não vale mais/],
    ['confirmacao', /Não deu para confirmar seu cadastro/],
    ['indisponivel', /As contas ainda não estão disponíveis neste endereço/],
    ['invalido', /Esta página abre pelo link do e-mail/]
  ];

  for (const [motivo, frase] of esperado) {
    const pagina = await html(`/nova-senha?erro=${motivo}`);
    assert.match(pagina, frase, `?erro=${motivo} não trouxe o texto próprio`);
    // O caminho de volta continua oferecido em todos eles.
    assert.match(pagina, /<a href="\/recuperar-acesso">/);
  }
});

test('?erro= inventado cai na explicação genérica, sem quebrar a página', async () => {
  for (const consulta of ['?erro=coisa-que-nao-existe', '?erro=', '?erro=<script>alert(1)</script>',
                          '?erro=expirado&erro=confirmacao']) {
    const pagina = await html(`/nova-senha${consulta}`);
    assert.match(pagina, /<main[^>]*id="conteudo"/, `${consulta} não renderizou a página`);
    assert.doesNotMatch(pagina, /<script>alert/, 'o valor da query saiu como HTML');
  }
});

// =====================================================================
// A guarda de sessão da Action
//
// TESTE DE TEXTO, e a limitação está dita em voz alta: `definirNovaSenha` é
// uma Server Action, alcançável por HTTP só com o identificador que o Next
// gera no build e embute no formulário — e o formulário só existe para quem
// TEM sessão. Não há, na suíte offline, como fazer a chamada sem sessão que
// este teste queria fazer de verdade.
//
// O que ele garante, então, é o que dá para garantir sem rede: que a guarda
// não pode ser apagada em silêncio. Medido: removendo o `if (!usuario)`,
// este teste falha; trocando a ordem (updateUser antes da checagem), também.
// É a mesma escolha de testes/noindex.test.mjs, que lê netlify.toml como
// texto porque o efeito dele só existe num deploy real.
// =====================================================================

test('definirNovaSenha confere a sessão ANTES de trocar a senha', async () => {
  const codigo = await readFile(new URL('../acoes/autenticacao.ts', import.meta.url), 'utf8');

  const inicio = codigo.indexOf('export async function definirNovaSenha');
  assert.notEqual(inicio, -1, 'definirNovaSenha sumiu de acoes/autenticacao.ts');

  // Até o começo da próxima função exportada: é o corpo desta.
  const proxima = codigo.indexOf('export async function', inicio + 1);
  const corpo = codigo.slice(inicio, proxima === -1 ? undefined : proxima);

  const guarda = corpo.indexOf('usuarioAtual()');
  const recusa = corpo.indexOf('SEM_SESSAO_PARA_TROCAR_SENHA');
  const troca = corpo.indexOf('updateUser(');

  assert.notEqual(guarda, -1,
    'definirNovaSenha não pergunta mais quem está autenticado (servidor/sessao.ts). '
    + 'Server Action é endpoint HTTP público: sem esta guarda, qualquer pessoa troca senha.');
  assert.notEqual(recusa, -1, 'a recusa por falta de sessão sumiu');
  assert.notEqual(troca, -1, 'definirNovaSenha não troca mais a senha — teste desatualizado?');

  assert.ok(guarda < recusa && recusa < troca,
    'a checagem de sessão precisa vir antes do updateUser, e a recusa entre as duas');
});

test('a checagem de sessão pergunta ao Supabase, não ao cookie', async () => {
  // getSession() lê o cookie e devolve o que estiver escrito nele, sem
  // verificar assinatura — e cookie é dado do navegador. getUser() pergunta
  // ao servidor de autenticação. A diferença entre os dois é a diferença
  // entre autorizar e fingir que autorizou.
  const codigo = await readFile(new URL('../servidor/sessao.ts', import.meta.url), 'utf8');
  assert.match(codigo, /auth\.getUser\(\)/);
  assert.doesNotMatch(codigo, /auth\.getSession\(\)/,
    'servidor/sessao.ts passou a confiar no cookie sem verificar');
});
