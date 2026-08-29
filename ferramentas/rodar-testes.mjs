/**
 * Constroi o site uma vez, sobe um servidor e roda a suite inteira contra ele.
 *
 * Os testes de navegador leem a URL de URL_BASE. Sem esta orquestracao, cada
 * arquivo de teste subiria o proprio Next — cinco builds por rodada.
 */
import { spawn, spawnSync } from 'node:child_process';

const porta = 3123;

console.log('Construindo...');
if (spawnSync('npx', ['next', 'build'], { stdio: 'inherit' }).status !== 0) {
  process.exit(1);
}

console.log(`Subindo em :${porta}...`);
// detached: true para que o servidor vire lider do proprio grupo de
// processos. O `npx` sobe o `next-server` como filho; matar so o invólucro
// do npx deixa o next-server orfao segurando a porta. Encerrando o grupo
// inteiro (process.kill com pid negativo) os dois caem juntos.
const servidor = spawn('npx', ['next', 'start', '--port', String(porta)], {
  stdio: ['ignore', 'pipe', 'inherit'],
  detached: true
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
  const testes = spawnSync('node', ['--test'], {
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
