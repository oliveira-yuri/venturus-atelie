/**
 * Sobe um `next start` À PARTE, com ambiente próprio, para o teste que
 * precisa de um servidor diferente do da suíte.
 *
 * POR QUE ISTO EXISTE. `ferramentas/rodar-testes.mjs` constrói UMA vez e sobe
 * UM servidor, e é assim de propósito — sem isso cada arquivo de teste faria
 * seu próprio build. Mas duas coisas da Tarefa 4 da autenticação só existem
 * sob um ambiente que o servidor da suíte não pode ter, porque valem para
 * todas as páginas ao mesmo tempo:
 *
 *   - o cabeçalho de quem ESTÁ autenticado (`DIAGNOSTICO_CABECALHO_COM_
 *     SESSAO`, ver app/layout.tsx). Ligado no servidor da suíte, ele mudaria
 *     o cabeçalho de todas as páginas e derrubaria paridade-texto,
 *     sem-javascript e mais uns quantos;
 *   - a renovação de sessão no middleware, que só fala com o Supabase quando
 *     `SUPABASE_URL` existe. A suíte roda offline de propósito.
 *
 * NÃO CONSTRÓI NADA: reaproveita o `.next` que `rodar-testes.mjs` acabou de
 * produzir. Isso é possível porque `process.env.SUPABASE_URL` sobrevive
 * LITERALMENTE no bundle do middleware — MEDIDO em 30/08/2026 com
 * `grep -o 'process.env.SUPABASE_URL' .next/server/edge/chunks/*.js`, e o
 * host real do projeto NÃO aparece em lugar nenhum de `.next/`. Ou seja: no
 * Edge do `next start` a variável é lida em EXECUÇÃO, não embutida no build.
 * Se um dia isso mudar (o Next embutir env no bundle de Edge), os testes que
 * dependem deste arquivo passam a medir o ambiente do BUILD, e não o que
 * este módulo passa — e vão falhar dizendo "0 chamadas", o que é o jeito
 * certo de descobrir.
 *
 * O ambiente parte de uma cópia LIMPA: `NODE_ENV=test` (para o Next ignorar
 * o `.env.local`, exatamente como no modo offline) e as variáveis do
 * Supabase apagadas, a menos que o teste peça outras. Sem isso, uma rodada
 * `npm run test:supabase` daria a estes testes um servidor falando com o
 * banco de verdade, e o que eles medem mudaria conforme o modo.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const RAIZ = new URL('../../', import.meta.url).pathname;

/** Uma porta livre agora — pedida ao sistema, não chutada. */
export function portaLivre() {
  return new Promise((resolve, reject) => {
    const sonda = createServer();
    sonda.on('error', reject);
    sonda.listen(0, '127.0.0.1', () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  });
}

/**
 * Sobe o servidor e resolve quando ele responde. Devolve `{ base, encerrar }`.
 *
 * `detached: true` + `process.kill(-pid)` pelo mesmo motivo documentado em
 * ferramentas/rodar-testes.mjs: o `npx` sobe o `next-server` como filho, e
 * matar só o invólucro deixaria o servidor órfão segurando a porta — aqui
 * isso travaria a rodada seguinte da suíte.
 */
export async function subirServidor({ ambiente = {}, porta } = {}) {
  const escolhida = porta ?? await portaLivre();

  const base = { ...process.env };
  base.NODE_ENV = 'test';
  delete base.SUPABASE_URL;
  delete base.SUPABASE_CHAVE_PUBLICAVEL;
  delete base.DIAGNOSTICO_ORIGEM_DOS_DADOS;
  delete base.DIAGNOSTICO_CABECALHO_COM_SESSAO;

  const servidor = spawn('npx', ['next', 'start', '--port', String(escolhida)], {
    cwd: RAIZ,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...base, ...ambiente }
  });

  // O log do servidor é guardado, não impresso: em rodada verde ele é ruído,
  // e em rodada vermelha é a única pista do que aconteceu do lado de lá.
  const log = [];
  servidor.stderr.on('data', (bloco) => log.push(String(bloco)));

  const pronto = new Promise((resolve, reject) => {
    const limite = setTimeout(
      () => reject(new Error(`servidor de teste não subiu em 60s na porta ${escolhida}.\n${log.join('')}`)),
      60_000
    );
    servidor.stdout.on('data', (bloco) => {
      log.push(String(bloco));
      if (String(bloco).includes('Ready')) { clearTimeout(limite); resolve(); }
    });
    servidor.on('exit', (codigo) => {
      clearTimeout(limite);
      reject(new Error(`servidor de teste encerrou com ${codigo} antes de subir.\n${log.join('')}`));
    });
  });

  await pronto;

  return {
    base: `http://localhost:${escolhida}`,
    log: () => log.join(''),
    encerrar: () => {
      try { process.kill(-servidor.pid, 'SIGTERM'); } catch { /* já encerrado */ }
    }
  };
}
