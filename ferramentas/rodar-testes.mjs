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
 * NODE_ENV=test no build e no servidor (Rodada de correcao 1 da Tarefa 10):
 * o Next IGNORA .env.local quando NODE_ENV=test, de proposito, por design
 * documentado do proprio framework. Isso faz temSupabase()
 * (servidor/dados/conteudo.ts) devolver false aqui, e a suite inteira —
 * paridade de texto, vazamento, renderizacao — roda contra o JSON
 * versionado, deterministico e offline, que e exatamente pra isso que a
 * fonte dupla foi desenhada. testes/seguranca.test.mjs nao depende disto:
 * ele le .env.local por conta propria (ver testes/apoio/env-local.mjs),
 * entao continua verificando contra o banco real mesmo com o servidor
 * principal da suite rodando sem essas variaveis.
 */
import { spawn, spawnSync } from 'node:child_process';

const arquivosPedidos = process.argv.slice(2);

const porta = 3123;
const envSemSupabase = { ...process.env, NODE_ENV: 'test' };

console.log('Construindo...');
if (spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: envSemSupabase }).status !== 0) {
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
  env: envSemSupabase
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
    env: { ...process.env, URL_BASE: `http://localhost:${porta}` }
  });
  process.exitCode = testes.status ?? 1;
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  try { process.kill(-servidor.pid, 'SIGTERM'); } catch { /* ja encerrado */ }
}
