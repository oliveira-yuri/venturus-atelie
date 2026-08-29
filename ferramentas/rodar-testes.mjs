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
const servidor = spawn('npx', ['next', 'start', '--port', String(porta)], {
  stdio: ['ignore', 'pipe', 'inherit']
});

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
  servidor.kill();
}
