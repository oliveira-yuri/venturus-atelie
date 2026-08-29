/**
 * Constroi o site uma vez, sobe um servidor e roda a suite (inteira, ou so
 * os arquivos passados em argv) contra ele.
 *
 * Os testes de navegador leem a URL de URL_BASE. Sem esta orquestracao, cada
 * arquivo de teste subiria o proprio Next — cinco builds por rodada.
 *
 * `npm run verificar` usa isto para rodar so testes/navegador.test.mjs sem
 * duplicar a orquestracao do servidor.
 *
 * =====================================================================
 * TRES MODOS. O padrao continua sendo o offline.
 * =====================================================================
 *
 * MODO OFFLINE (`npm test`) — build e servidor com NODE_ENV=test e SEM
 * nenhuma variavel do Supabase. O Next IGNORA .env.local quando
 * NODE_ENV=test, de proposito, por design documentado do proprio framework;
 * alem disso este arquivo APAGA SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL do
 * ambiente do filho, para que um shell com essas variaveis exportadas nao
 * torne o modo offline offline "por acaso". Assim temSupabase()
 * (servidor/dados/conteudo.ts) devolve false e a suite inteira — paridade de
 * texto, vazamento, renderizacao — roda contra o JSON versionado,
 * deterministica e sem rede, que e exatamente pra isso que a fonte dupla foi
 * desenhada. testes/seguranca.test.mjs nao depende disto: ele le .env.local
 * por conta propria (ver testes/apoio/env-local.mjs), entao continua
 * verificando contra o banco real mesmo com o servidor principal da suite
 * rodando sem essas variaveis.
 *
 * MODO COM CREDENCIAIS (`npm run test:supabase`, ou COM_SUPABASE=1 antes de
 * qualquer invocacao) — build e servidor COM .env.local carregado
 * explicitamente por este arquivo (nao pelo carregador do Next, que a essa
 * altura ja e uma dependencia a menos em que confiar). Serve para o que o
 * modo offline, por construcao, nao pode provar:
 *
 *   - as consultas remotas de listarAtividades/listarClipping rodam de
 *     verdade, contra o Postgres de verdade, com a RLS de verdade;
 *   - servidor/supabase.ts — obterCliente(), o AbortSignal.any, o
 *     db.retry:false, o bloco setAll — sai de zero cobertura;
 *   - testes/vazamento.test.mjs varre um build feito COM as variaveis
 *     presentes, que e o unico build parecido com o que a Netlify produz.
 *     No modo offline ele varria um build onde as variaveis nem existiam:
 *     um NEXT_PUBLIC_* configurado no painel da Netlify seria embutido num
 *     bundle que aquele teste nunca examinava.
 *
 * Este modo tambem liga DIAGNOSTICO_ORIGEM_DOS_DADOS=1, que abre
 * /diagnostico/origem-dos-dados (fechada por padrao, inclusive em
 * producao) — e como testes/origem-dos-dados.test.mjs alcanca
 * listarAtividades(), que nenhuma pagina da fase 1 consome.
 *
 * MODO DEGRADADO (`npm run test:supabase-degradado`, ou
 * COM_SUPABASE=chave-errada) — URL real, chave deliberadamente invalida. E
 * a unica forma de provar o que a revisao final chamou de pior parte do
 * CRITICO 1: com o Supabase configurado e a consulta falhando, a pagina
 * caia para o JSON e ficava IDENTICA a pagina certa. Agora ela cai e DIZ
 * que caiu (data-origem-clipping="json" no HTML, aviso no log do servidor),
 * e este modo e o que verifica isso.
 *
 * Os dois modos com Supabase FALAM COM A REDE. Nenhum substitui o offline:
 * Supabase fora do ar, sem internet ou .env.local ausente derrubam a
 * rodada, e e por isso que o padrao continua sendo o offline.
 */
import { spawn, spawnSync } from 'node:child_process';
import { lerEnvLocal } from '../testes/apoio/env-local.mjs';

const arquivosPedidos = process.argv.slice(2);

// COM_SUPABASE=1            -> credenciais reais, caminho remoto de verdade
// COM_SUPABASE=chave-errada -> URL real, chave invalida: exercita o ramo
//                              `if (error)` (chave errada, grant faltando,
//                              RLS apertada, coluna renomeada) sem precisar
//                              estragar nada no projeto Supabase de verdade
const chaveErrada = process.env.COM_SUPABASE === 'chave-errada';
const comSupabase = process.env.COM_SUPABASE === '1' || chaveErrada;

const porta = 3123;

/**
 * O ambiente do build e do servidor, conforme o modo.
 *
 * Nos dois casos partimos de uma COPIA de process.env e mexemos de forma
 * explicita: o que estiver no shell de quem rodou nao pode decidir em
 * silencio qual dos dois modos vale.
 */
function montarAmbiente() {
  const ambiente = { ...process.env };

  if (!comSupabase) {
    ambiente.NODE_ENV = 'test';
    delete ambiente.SUPABASE_URL;
    delete ambiente.SUPABASE_CHAVE_PUBLICAVEL;
    delete ambiente.DIAGNOSTICO_ORIGEM_DOS_DADOS;
    return ambiente;
  }

  // NODE_ENV fica com o Next: `next build` assume production sozinho, e
  // deixar 'test' aqui reintroduziria justamente a exclusao de .env.local.
  delete ambiente.NODE_ENV;

  const doArquivo = lerEnvLocal();
  ambiente.SUPABASE_URL = process.env.SUPABASE_URL || doArquivo.SUPABASE_URL;
  ambiente.SUPABASE_CHAVE_PUBLICAVEL =
    process.env.SUPABASE_CHAVE_PUBLICAVEL || doArquivo.SUPABASE_CHAVE_PUBLICAVEL;
  ambiente.DIAGNOSTICO_ORIGEM_DOS_DADOS = '1';

  const faltando = ['SUPABASE_URL', 'SUPABASE_CHAVE_PUBLICAVEL'].filter((v) => !ambiente[v]);
  if (faltando.length > 0) {
    console.error(
      `\n  COM_SUPABASE=1 sem ${faltando.join(' e ')} (nem no ambiente, nem em .env.local).\n`
      + '  Este modo existe justamente para falar com o banco real: sem a credencial\n'
      + '  ele nao teria uma versao util de si mesmo, so uma repeticao do modo offline\n'
      + '  com outro nome. Rodar `npm test` (offline) ou configurar .env.local.\n'
    );
    process.exit(1);
  }

  if (chaveErrada) {
    // JWT bem formado (o SDK do Supabase recusa string que nao pareca uma
    // chave antes mesmo de sair da maquina) e sem valor nenhum: o PostgREST
    // devolve 401, que chega em `{ error }` — o mesmo ramo de "grant
    // faltando" e "politica de RLS negou". A URL continua a real, entao nao
    // ha timeout de DNS no meio: a degradacao acontece rapido, como
    // aconteceria em producao com a chave trocada.
    ambiente.SUPABASE_CHAVE_PUBLICAVEL =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      + '.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNoYXZlLWRlbGliZXJhZGFtZW50ZS1lcnJhZGEiLCJleHAiOjE5OTk5OTk5OTl9'
      + '.assinatura-invalida-de-proposito';
  }

  return ambiente;
}

const ambiente = montarAmbiente();

console.log(
  chaveErrada ? 'Construindo com o Supabase configurado e a chave ERRADA (modo degradado)...'
  : comSupabase ? 'Construindo COM as credenciais do Supabase (modo com credenciais)...'
  : 'Construindo sem Supabase (modo offline, padrao)...'
);
if (spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: ambiente }).status !== 0) {
  process.exit(1);
}

console.log(`Subindo em :${porta}...`);
// detached: true para que o servidor vire lider do proprio grupo de
// processos. O `npx` sobe o `next-server` como filho; matar so o invólucro
// do npx deixa o next-server orfao segurando a porta. Encerrando o grupo
// inteiro (process.kill com pid negativo) os dois caem juntos.
const servidor = spawn('npx', ['next', 'start', '--port', String(porta)], {
  stdio: ['ignore', 'pipe', 'inherit'],
  detached: true,
  env: ambiente
});

// Um SIGINT/SIGTERM no orquestrador (Ctrl+C durante a suite, ou um `kill`)
// derruba o `node --test` em execucao e encerra este processo antes que o
// `finally` la embaixo rode — o mesmo vazamento de porta que o detached+kill
// de grupo resolveu para o caminho normal, so que pelo caminho do sinal.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    try { process.kill(-servidor.pid, 'SIGTERM'); } catch { /* ja encerrado */ }
    process.exit(130);
  });
}

const pronto = new Promise((resolve, reject) => {
  const limite = setTimeout(() => reject(new Error('servidor nao subiu em 60s')), 60_000);
  servidor.stdout.on('data', (bloco) => {
    if (String(bloco).includes('Ready')) { clearTimeout(limite); resolve(); }
  });
});

try {
  await pronto;
  const testes = spawnSync('node', ['--test', ...arquivosPedidos], {
    stdio: 'inherit',
    // COM_SUPABASE segue para os testes de proposito: testes/
    // origem-dos-dados.test.mjs exige "banco" num modo e "json" no outro, e
    // precisa saber contra qual servidor esta falando.
    env: { ...process.env, URL_BASE: `http://localhost:${porta}` }
  });
  process.exitCode = testes.status ?? 1;
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  try { process.kill(-servidor.pid, 'SIGTERM'); } catch { /* ja encerrado */ }
}
