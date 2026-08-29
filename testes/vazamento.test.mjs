/**
 * Vazamento de credencial/URL do Supabase para o cliente.
 *
 * Duas superfícies, porque uma sozinha não basta:
 *
 * 1. `.next/static` — o bundle de cliente de verdade. Pegaria a URL se
 *    algum código de cliente importasse `servidor/supabase.ts` direto (o que
 *    `import 'server-only'` já devia impedir na build, mas o teste não
 *    confia só nisso).
 * 2. O HTML entregue pelas rotas — pegaria o caso em que um Server Component
 *    passa um objeto vindo do Supabase como prop para um componente de
 *    cliente: o dado sai serializado dentro de `self.__next_f.push(...)` no
 *    HTML, sem nunca encostar em `.next/static`.
 *
 * Requer `next build` já rodado — `ferramentas/rodar-testes.mjs` faz isso
 * antes de subir o servidor e chamar a suíte.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.URL_BASE || 'http://localhost:3123';
const URL_SUPABASE = 'lubsufltidrbmganftux.supabase.co';

async function todosOsArquivos(raiz) {
  const achados = [];
  for (const entrada of await readdir(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, entrada.name);
    if (entrada.isDirectory()) achados.push(...await todosOsArquivos(caminho));
    else achados.push(caminho);
  }
  return achados;
}

test('nenhum artefato de cliente contem a URL do Supabase', async () => {
  const arquivos = (await todosOsArquivos('.next/static')).filter((a) => a.endsWith('.js'));
  assert.ok(arquivos.length > 0, 'nada construido: rodar next build antes');

  const sujos = [];
  for (const arquivo of arquivos) {
    const conteudo = await readFile(arquivo, 'utf8');
    if (conteudo.includes(URL_SUPABASE)) sujos.push(arquivo);
  }
  assert.deepEqual(sujos, [], 'a URL do Supabase vazou para o bundle de cliente');
});

test('o HTML entregue nao carrega dado do Supabase no payload RSC', async () => {
  const sujas = [];
  for (const rota of ['/', '/quem-somos', '/privacidade', '/para-escolas']) {
    const html = await fetch(`${BASE}${rota}`).then((r) => r.text());
    if (html.includes(URL_SUPABASE)) sujas.push(rota);
  }
  assert.deepEqual(sujas, [], 'a URL do Supabase apareceu no HTML entregue');
});
