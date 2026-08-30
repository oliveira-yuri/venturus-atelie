/**
 * A renovação de sessão no middleware — o que ela faz, e o que ela NÃO pode
 * fazer.
 *
 * POR QUE ELA EXISTE: Server Component não pode escrever cookie (quando ele
 * roda, a resposta já começou), e é por isso que o `setAll` de
 * servidor/supabase.ts tem um `catch` vazio. Sem alguém que possa gravar, o
 * token de acesso vence e a pessoa é deslogada no meio do uso mesmo tendo
 * refresh token válido. O middleware é o único ponto do fluxo de navegação
 * que roda antes da resposta existir.
 *
 * POR QUE ELE É O LUGAR MAIS PERIGOSO DO PROJETO PARA MEXER: o middleware
 * roda em TODAS as rotas, e na Netlify roda como Edge Function, que nunca
 * foi exercitada de verdade (item 0 de "O que trava hoje"). Uma chamada de
 * rede acrescentada ali cobra latência de toda visita e, mal feita,
 * transforma uma queda do Supabase numa queda do site inteiro — inclusive
 * das páginas que hoje degradam sozinhas (servidor/dados/degradacao.ts).
 * Daí as três medições deste arquivo: quem não tem sessão não paga nada,
 * quem tem paga uma chamada, e o Supabase fora do ar não derruba página
 * nenhuma.
 *
 * COMO SE MEDE "não houve chamada" SEM CONTA E SEM SUPABASE: um servidor de
 * mentira em localhost no lugar do Supabase, que CONTA o que chega.
 * `SUPABASE_URL` é lida em execução também no bundle de Edge (MEDIDO — ver o
 * cabeçalho de testes/apoio/servidor-de-teste.mjs), então basta apontar o
 * servidor de teste para ele.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { subirServidor, portaLivre } from './apoio/servidor-de-teste.mjs';
import { temCookieDeSessao } from '../compartilhado/cookies-de-sessao.ts';
import { comPrazo } from '../compartilhado/prazo.ts';

/**
 * O cookie de sessão como o `@supabase/ssr` o grava: `base64-` + base64url
 * do JSON da sessão. `expires_at` no passado é o caso que interessa — é
 * exatamente o momento em que a renovação precisa acontecer, e é o que faz o
 * cliente sair para a rede (POST .../token?grant_type=refresh_token).
 *
 * Nada aqui é credencial de nada: o "token" é texto inventado e o servidor
 * do outro lado é o de mentira, nesta máquina.
 */
function cookieDeSessaoFalsa() {
  const sessao = {
    access_token: 'token-de-mentira-ja-vencido',
    refresh_token: 'refresh-de-mentira',
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: '00000000-0000-0000-0000-000000000000', email: 'ninguem@exemplo.invalid' }
  };
  const base64url = Buffer.from(JSON.stringify(sessao), 'utf8').toString('base64url');
  return `sb-localhost-auth-token=base64-${base64url}`;
}

let stub;
let servidor;
let recebidas = [];

before(async () => {
  const portaDoStub = await portaLivre();

  stub = createServer((requisicao, resposta) => {
    recebidas.push(`${requisicao.method} ${requisicao.url}`);
    // Qualquer resposta de erro serve: o que este arquivo mede é SE a
    // chamada saiu e o que acontece com a página quando a renovação não dá
    // certo — não o caminho feliz, que exigiria um Supabase de verdade.
    resposta.writeHead(400, { 'Content-Type': 'application/json' });
    resposta.end(JSON.stringify({ error: 'invalid_grant', error_description: 'servidor de mentira' }));
  });

  await new Promise((resolve) => stub.listen(portaDoStub, '127.0.0.1', resolve));

  servidor = await subirServidor({
    ambiente: {
      SUPABASE_URL: `http://localhost:${portaDoStub}`,
      // JWT bem formado e sem valor nenhum, pelo mesmo motivo de
      // ferramentas/rodar-testes.mjs: o SDK recusa string que não pareça uma
      // chave antes mesmo de sair da máquina.
      SUPABASE_CHAVE_PUBLICAVEL:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
        + '.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNoYXZlLWRlLW1lbnRpcmEiLCJleHAiOjE5OTk5OTk5OTl9'
        + '.assinatura-invalida-de-proposito'
    }
  });
});

after(async () => {
  servidor?.encerrar();
  stub?.closeAllConnections();
  // Já pode estar fechado pelo último teste: `close` devolve erro nesse
  // caso, e ignorá-lo é o comportamento certo aqui.
  await new Promise((resolve) => stub?.close(resolve));
});

/**
 * Só as chamadas de AUTENTICAÇÃO.
 *
 * O servidor de mentira recebe mais coisa: com `SUPABASE_URL` definida, as
 * PÁGINAS também consultam o banco (a home lista o clipping, via
 * servidor/dados/conteudo.ts) e batem no mesmo endereço. Essas chamadas são
 * legítimas e não têm nada a ver com a renovação — a primeira rodada destes
 * testes falhou justamente por contá-las, o que teria escondido o que
 * importa aqui.
 */
function chamadasDeAutenticacao() {
  return recebidas.filter((chamada) => chamada.includes('/auth/v1/'));
}

/** O layout inteiro chegou no HTML? É o que separa "degradou" de "caiu". */
function temOLayoutInteiro(html) {
  return /<header class="cabecalho"/.test(html)
    && /id="conteudo"/.test(html)
    && /<footer/.test(html);
}


/* =====================================================================
   Primeiro as duas peças puras — são elas que quebram quando a REGRA muda.
   Os testes contra o servidor, mais abaixo, medem a ponta do fluxo; estes
   medem a decisão.
   ===================================================================== */

test('temCookieDeSessao reconhece a sessão e recusa o que só parece sessão', () => {
  // O nome vem do `@supabase/ssr` (`sb-<ref>-auth-token`, partido em
  // `.0`/`.1` quando não cabe). O que NÃO pode entrar é o cookie do PKCE:
  // ele existe no meio do fluxo do link de e-mail, antes de haver sessão, e
  // tratá-lo como sessão faria o middleware montar cliente e perguntar ao
  // Supabase por quem ainda não entrou.
  assert.equal(temCookieDeSessao(['sb-abcdef-auth-token']), true);
  assert.equal(temCookieDeSessao(['sb-abcdef-auth-token.0', 'sb-abcdef-auth-token.1']), true);
  assert.equal(temCookieDeSessao(['aac-preferencias', 'sb-abcdef-auth-token']), true);

  assert.equal(temCookieDeSessao([]), false);
  assert.equal(temCookieDeSessao(['aac-preferencias']), false);
  assert.equal(temCookieDeSessao(['sb-abcdef-auth-token-code-verifier']), false,
    'o cookie do PKCE não é sessão');
  assert.equal(temCookieDeSessao(['sb-abcdef-auth-token-flows-code-verifier']), false,
    'o índice de fluxos do PKCE não é sessão');
  assert.equal(temCookieDeSessao(['sb-abcdef-auth-token-user']), false);
});

test('comPrazo devolve null quando estoura, e o valor quando dá tempo', async () => {
  // A peça que corta a espera ACUMULADA. O `AbortSignal` de cada tentativa
  // não faz este serviço: o @supabase/auth-js repete a renovação com espera
  // exponencial, e o abort só faz a tentativa seguinte começar — foi assim
  // que uma página chegou a 50,9s. Ver compartilhado/prazo.ts.
  const rapida = comPrazo(Promise.resolve('valor'), 1_000);
  assert.equal(await rapida, 'valor');

  const lenta = new Promise((resolve) => { setTimeout(() => resolve('tarde demais'), 5_000); });
  const comecou = Date.now();
  assert.equal(await comPrazo(lenta, 100), null);
  assert.ok(Date.now() - comecou < 1_000, 'o prazo não cortou a espera');
});

test('comPrazo não derruba o processo quando a promessa rejeita depois do prazo', async () => {
  // Rejeição sem tratamento derruba o Node. Como o prazo abandona a
  // promessa original, ela pode rejeitar quando ninguém mais espera por ela
  // — que é exatamente o que acontece quando o Supabase está fora do ar.
  const quebra = new Promise((_, rejeita) => {
    setTimeout(() => rejeita(new Error('falhou tarde')), 100);
  });

  assert.equal(await comPrazo(quebra, 10), null);
  // Tempo para a rejeição tardia acontecer: se ela não estivesse tratada,
  // o processo do teste morreria aqui.
  await new Promise((resolve) => { setTimeout(resolve, 300); });
});

test('visita anônima não gera uma única chamada de autenticação', async () => {
  // O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA — dito porque a primeira
  // versão dele afirmava demais. Ele prova a PROPRIEDADE: quem visita sem
  // sessão não paga nenhuma ida ao Supabase para autenticar. Ele NÃO prova
  // a guarda de compartilhado/cookies-de-sessao.ts: MEDIDO removendo a
  // guarda do middleware, este teste continuou verde, porque o
  // `@supabase/auth-js` devolve AuthSessionMissingError sem sair para a
  // rede quando não há sessão no armazenamento.
  //
  // Os dois valem: a guarda tem teste próprio (o de unidade lá em cima), e
  // este aqui é a rede que pega o dia em que alguém trocar `getUser()` por
  // algo que fale com a rede de qualquer jeito — uma consulta a `perfis`
  // no layout, por exemplo.
  recebidas = [];

  const resposta = await fetch(`${servidor.base}/`);
  const html = await resposta.text();

  assert.equal(resposta.status, 200);
  assert.ok(temOLayoutInteiro(html), 'a página não veio inteira');
  assert.deepEqual(chamadasDeAutenticacao(), [],
    `houve chamada de autenticação numa visita sem cookie de sessão (tudo que chegou: ${recebidas.join(', ') || 'nada'})`);
});

test('cookie de PKCE, no caminho de verdade, também não gera chamada', async () => {
  // Mesma ressalva do teste acima: o que quebra quando a regra do nome do
  // cookie afrouxa é o teste de unidade, não este. Este mede a ponta: uma
  // requisição no meio do fluxo do link de e-mail, que ainda não tem sessão,
  // atravessa o middleware sem custo de autenticação.
  recebidas = [];

  const resposta = await fetch(`${servidor.base}/`, {
    headers: { cookie: 'sb-localhost-auth-token-code-verifier=verificador-de-mentira' }
  });
  await resposta.text();

  assert.equal(resposta.status, 200);
  assert.deepEqual(chamadasDeAutenticacao(), [],
    'o cookie do PKCE foi tratado como sessão e disparou chamada de autenticação');
});

test('com cookie de sessão o middleware tenta renovar — e a falha não quebra a página', async () => {
  recebidas = [];

  const resposta = await fetch(`${servidor.base}/`, {
    headers: { cookie: cookieDeSessaoFalsa() }
  });
  const html = await resposta.text();

  assert.ok(chamadasDeAutenticacao().length > 0,
    'com cookie de sessão o middleware não falou com o Supabase — a renovação não está acontecendo');
  assert.ok(recebidas.some((chamada) => /token\?grant_type=refresh_token/.test(chamada)),
    `esperava uma tentativa de renovação; o servidor de mentira recebeu: ${recebidas.join(', ')}`);

  // O ponto: o Supabase respondeu ERRO, e a página veio inteira mesmo assim.
  assert.equal(resposta.status, 200, 'a falha na renovação virou erro de página');
  assert.ok(temOLayoutInteiro(html),
    'a página perdeu o layout depois de uma renovação que falhou');
  // Sem sessão válida, o cabeçalho é o de visitante — o desfecho seguro.
  assert.match(html, /href="\/entrar"/, 'o cabeçalho deveria voltar ao de visitante');
});

test('Supabase fora do ar não derruba a página — nem as que não dependem dele', async () => {
  // O modo de falha que este teste existe para impedir: middleware que lança
  // derruba TODAS as rotas de uma vez, inclusive as que hoje degradam
  // sozinhas. Aqui o servidor de mentira é DESLIGADO antes da requisição, o
  // que produz uma exceção de conexão — o caminho do `catch`, diferente do
  // teste acima, que exercita a resposta de erro.
  // closeAllConnections() antes do close(): o cliente do Supabase mantém a
  // conexão viva, e sem isto o `close` só resolve quando o keep-alive
  // expira. MEDIDO: 50 SEGUNDOS de espera parada, dentro do teste, antes de
  // a requisição sequer começar.
  stub.closeAllConnections();
  await new Promise((resolve) => stub.close(resolve));

  const comecou = Date.now();
  const resposta = await fetch(`${servidor.base}/quem-somos`, {
    headers: { cookie: cookieDeSessaoFalsa() }
  });
  const html = await resposta.text();
  const demorou = Date.now() - comecou;

  assert.equal(resposta.status, 200,
    'com o Supabase fora do ar a página respondeu erro em vez de seguir como visitante');
  assert.ok(temOLayoutInteiro(html),
    'a página veio sem o layout — o middleware deixou o erro escapar');

  // O NÚMERO É O TESTE. A primeira versão desta tarefa punha um
  // `AbortSignal.timeout(3s)` em cada fetch e mais nada, e ESTA MEDIÇÃO
  // devolveu 50,9 s: o @supabase/auth-js repete a renovação com espera
  // exponencial por até 30 s, e o abort só faz a tentativa seguinte começar
  // (ver compartilhado/prazo.ts). Uma resposta que chega em 50 s com o
  // conteúdo certo passa em todas as outras asserções deste arquivo — e é,
  // na prática, o site fora do ar para quem tem cookie de sessão.
  assert.ok(demorou < 15_000,
    `a página levou ${(demorou / 1000).toFixed(1)}s com o Supabase fora do ar. `
    + 'O prazo total da renovação sumiu ou parou de valer — ver compartilhado/prazo.ts.');
});
