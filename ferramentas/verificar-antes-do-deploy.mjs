/**
 * Guardiao do deploy.
 *
 * O teste de acesso indevido (testes/seguranca.test.mjs) se PULA quando nao
 * ha Supabase configurado — e teste pulado deixa a suite verde. Verde sem
 * verificacao e exatamente como um vazamento chega a producao.
 *
 * Este script existe para que isso nao aconteca: ele falha, ruidosamente,
 * se o aceite bloqueante da secao 12 do escopo nao tiver sido executado.
 *
 * Executar com: npm run verificar-deploy
 */
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const problemas = [];

function relatar(titulo, detalhe) {
  problemas.push({ titulo, detalhe });
}

// ---------------------------------------------------------------------
// 1. Supabase precisa estar configurado
// ---------------------------------------------------------------------
let configurado = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

if (!configurado) {
  try {
    const bruto = await readFile(new URL('../site/config.js', import.meta.url), 'utf8');
    const url = bruto.match(/supabaseUrl:\s*'([^']*)'/)?.[1];
    const chave = bruto.match(/supabaseAnonKey:\s*'([^']*)'/)?.[1];
    configurado = Boolean(url && chave);
  } catch {
    configurado = false;
  }
}

if (!configurado) {
  relatar(
    'O aceite bloqueante da seção 12 NÃO foi verificado',
    'Não há projeto Supabase configurado, então o teste de acesso indevido foi pulado.\n'
    + '  Sem ele, ninguém sabe se as tabelas de inscritos, voluntários, doações e\n'
    + '  contatos estão protegidas. O escopo é explícito: enquanto esse teste não\n'
    + '  passar, o sistema não vai ao ar.'
  );
}

// ---------------------------------------------------------------------
// 2. A service role key nunca pode estar no que vai ser publicado
//
// Anon key e service role key sao os dois JWT e se parecem. Procurar pelo
// formato acusaria a anon key legitima em config.js — e um verificador que
// grita a toa vira um verificador ignorado. Entao decodificamos o payload e
// olhamos o papel: "anon" pode ser publicado, "service_role" nunca.
// ---------------------------------------------------------------------
function papelDoToken(token) {
  try {
    const payload = token.split('.')[1];
    const bruto = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    return JSON.parse(bruto).role || null;
  } catch {
    return null;
  }
}

const arquivosPublicados = spawnSync('sh', ['-c',
  'grep -rIl --exclude-dir=node_modules --exclude-dir=fontes -E "eyJ[A-Za-z0-9_-]{10,}\\." site/ || true'
], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);

for (const arquivo of arquivosPublicados) {
  const conteudo = await readFile(arquivo, 'utf8');
  const tokens = conteudo.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];

  for (const token of tokens) {
    const papel = papelDoToken(token);
    if (papel && papel !== 'anon') {
      relatar(
        `Chave de papel "${papel}" em arquivo publicado`,
        `Encontrada em: ${arquivo}\n`
        + '  Somente a anon key pode ser publicada. Qualquer outra ignora a RLS\n'
        + '  e daria acesso total aos dados de inscritos, doadores e contatos.'
      );
    }
  }
}

// Palavras que denunciam a chave secreta mesmo fora do formato JWT.
const segredosPorNome = spawnSync('sh', ['-c',
  'grep -rIl --exclude-dir=node_modules -E "service_role|SUPABASE_SERVICE_ROLE|sb_secret_" site/ || true'
], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);

if (segredosPorNome.length > 0) {
  relatar(
    'Referencia a chave secreta em arquivo publicado',
    `Encontrada em:\n  ${segredosPorNome.join('\n  ')}`
  );
}

// ---------------------------------------------------------------------
// 3. Toda tabela criada precisa ter RLS habilitada na mesma migration
// ---------------------------------------------------------------------
const migrations = spawnSync('sh', ['-c', 'cat supabase/migrations/*.sql'], { encoding: 'utf8' }).stdout || '';

const tabelasCriadas = [...migrations.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
const tabelasComRls = new Set(
  [...migrations.matchAll(/alter table public\.(\w+) enable row level security/g)].map((m) => m[1])
);

const semRls = tabelasCriadas.filter((tabela) => !tabelasComRls.has(tabela));
if (semRls.length > 0) {
  relatar(
    'Tabela criada sem Row Level Security',
    `Sem política: ${semRls.join(', ')}\n`
    + '  Toda tabela nasce com RLS na mesma migration. Sem isso, ela fica legível\n'
    + '  por qualquer pessoa com a anon key.'
  );
}

// ---------------------------------------------------------------------
// 4. Toda tabela precisa de grant explicito
//
// O projeto Supabase foi criado sem exposicao automatica de tabelas. Uma
// tabela sem grant nao chega a API: o sintoma e uma tela vazia, e o risco e
// alguem concluir que a RLS esta apertada demais e afrouxa-la.
// ---------------------------------------------------------------------
const tabelasComGrant = new Set(
  [...migrations.matchAll(/grant[^;]*?\son\s([^;]*?)\sto\s/gis)]
    .flatMap((achado) =>
      [...achado[1].matchAll(/public\.(\w+)/g)].map((t) => t[1]))
);

const semGrant = tabelasCriadas.filter((tabela) => !tabelasComGrant.has(tabela));
if (semGrant.length > 0) {
  relatar(
    'Tabela sem concessao explicita de privilegio',
    `Sem grant: ${semGrant.join(', ')}\n`
    + '  Com a exposicao automatica desligada no projeto, uma tabela sem grant\n'
    + '  simplesmente nao existe para a API — a tela fica vazia sem erro visivel.'
  );
}

// ---------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------
if (problemas.length === 0) {
  console.log('\n  Verificação de deploy: tudo certo.\n');
  process.exit(0);
}

console.error(`\n  DEPLOY BLOQUEADO — ${problemas.length} problema(s):\n`);
for (const { titulo, detalhe } of problemas) {
  console.error(`  ✗ ${titulo}`);
  console.error(`  ${detalhe}\n`);
}
process.exit(1);
