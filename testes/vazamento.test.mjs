/**
 * Vazamento de credencial/URL do Supabase para o cliente.
 *
 * Duas superfícies, porque uma sozinha não basta:
 *
 * 1. `.next/static` — o bundle de cliente de verdade. Pegaria a URL/chave se
 *    algum código de cliente importasse `servidor/supabase.ts` direto (o que
 *    `import 'server-only'` já devia impedir na build, mas o teste não
 *    confia só nisso).
 * 2. O HTML entregue pelas rotas — pegaria o caso em que um Server Component
 *    passa um objeto vindo do Supabase como prop para um componente de
 *    cliente: o dado sai serializado dentro de `self.__next_f.push(...)` no
 *    HTML, sem nunca encostar em `.next/static`.
 *
 * Requer `next build` já rodado — `ferramentas/rodar-testes.mjs` faz isso
 * antes de subir o servidor e chamar a suíte. Desde a Rodada de correção 1
 * da Tarefa 10, esse build roda com NODE_ENV=test (o Next ignora
 * .env.local nesse modo, de propósito — ver comentário em
 * ferramentas/rodar-testes.mjs), então este arquivo NÃO pode contar com
 * process.env sozinho para saber o que procurar: lê .env.local direto,
 * como testes/seguranca.test.mjs já fazia.
 *
 * A URL e a chave usadas na busca são as REAIS do projeto (derivadas de
 * .env.local), não uma string cravada no código: uma URL fixa continuaria
 * "passando" para sempre depois de uma rotação de projeto Supabase (a spec
 * §4.7 prevê isso), testando uma credencial que já não existe mais em
 * lugar nenhum — um teste verde que parou de verificar é o mesmo defeito
 * do guardião de deploy que este mesmo ciclo de correção consertou.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lerEnvLocal } from './apoio/env-local.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const doArquivo = lerEnvLocal();
const URL_SUPABASE_COMPLETA = process.env.SUPABASE_URL || doArquivo.SUPABASE_URL;
const CHAVE_SUPABASE = process.env.SUPABASE_CHAVE_PUBLICAVEL || doArquivo.SUPABASE_CHAVE_PUBLICAVEL;

// Só o domínio: a URL completa (com "https://") não aparece assim em bundle
// nenhum — o SDK do Supabase monta a URL a partir das partes. Barra final
// também sai (ex.: .env.local com "https://xxx.supabase.co/"): mantida,
// ela deixaria de bater com uma referência ao domínio "nu", sem path
// nenhum atrás — o oposto do que se quer num teste de vazamento, que
// precisa do padrão mais abrangente possível, não do mais específico.
const URL_SUPABASE = URL_SUPABASE_COMPLETA?.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * Falha ALTO e CEDO se não há o que procurar — nunca pula. Ao contrário do
 * aceite bloqueante (testes/seguranca.test.mjs), que tem um modo "pulado,
 * mas visível" para quem roda a suíte sem Supabase configurado, este teste
 * não tem uma versão útil de si mesmo sem saber a credencial real: "não
 * vazou" só significa alguma coisa se soubermos o que seria vazar.
 */
function exigirCredenciais() {
  assert.ok(
    URL_SUPABASE,
    'SUPABASE_URL não encontrada (nem no ambiente, nem em .env.local) — '
    + 'este teste não sabe o que procurar, e um teste de vazamento que não '
    + 'sabe o que procurar não prova nada.'
  );
  assert.ok(
    CHAVE_SUPABASE,
    'SUPABASE_CHAVE_PUBLICAVEL não encontrada (nem no ambiente, nem em '
    + '.env.local) — mesmo motivo acima, agora para a chave.'
  );
}

async function todosOsArquivos(raiz) {
  const achados = [];
  for (const entrada of await readdir(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, entrada.name);
    if (entrada.isDirectory()) achados.push(...await todosOsArquivos(caminho));
    else achados.push(caminho);
  }
  return achados;
}

test('nenhum artefato de cliente contem a URL nem a chave do Supabase', async () => {
  exigirCredenciais();

  const arquivos = (await todosOsArquivos('.next/static')).filter((a) => a.endsWith('.js'));
  assert.ok(arquivos.length > 0, 'nada construido: rodar next build antes');

  const sujos = [];
  for (const arquivo of arquivos) {
    const conteudo = await readFile(arquivo, 'utf8');
    if (conteudo.includes(URL_SUPABASE) || conteudo.includes(CHAVE_SUPABASE)) sujos.push(arquivo);
  }
  assert.deepEqual(sujos, [], 'a URL ou a chave do Supabase vazou para o bundle de cliente');
});

test('o HTML entregue nao carrega URL nem chave do Supabase no payload RSC', async () => {
  exigirCredenciais();

  const sujas = [];
  for (const rota of ['/', '/quem-somos', '/privacidade', '/para-escolas']) {
    const html = await fetch(`${BASE}${rota}`).then((r) => r.text());
    if (html.includes(URL_SUPABASE) || html.includes(CHAVE_SUPABASE)) sujas.push(rota);
  }
  assert.deepEqual(sujas, [], 'a URL ou a chave do Supabase apareceu no HTML entregue');
});
