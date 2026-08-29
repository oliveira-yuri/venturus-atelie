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
// 1. O aceite bloqueante da secao 12 precisa ter RODADO e PASSADO — nao
// "parecer configurado".
//
// Ate a Rodada de correcao 1, esta secao apenas conferia se
// SUPABASE_URL/SUPABASE_ANON_KEY estavam no ambiente e, se nao, caia para
// ler site/config.js — arquivo do site antigo que continuou existindo
// depois da migracao para Next.js. Resultado medido: com .env.local
// ausente e a variavel com o nome novo (SUPABASE_CHAVE_PUBLICAVEL, nao
// SUPABASE_ANON_KEY), testes/seguranca.test.mjs pulava em silencio E este
// guardiao ainda achava "tudo certo" lendo o config.js morto — exatamente
// o falso verde que o cabecalho deste arquivo promete impedir.
//
// A correcao: nao duplicar a logica de configuracao aqui. Rodar o proprio
// teste, com o sinal EXIGIR_SUPABASE=1 (que faz aquele arquivo FALHAR, nao
// pular, quando a configuracao nao aparece — ver o skipSemConfiguracao()
// de la) e conferir o codigo de saida de verdade. Sem fallback para
// site/config.js: aquele arquivo pertence ao site estatico anterior e nao
// existe mais no Next.
// ---------------------------------------------------------------------
const aceite = spawnSync(
  process.execPath,
  ['--test', 'testes/seguranca.test.mjs'],
  {
    encoding: 'utf8',
    env: { ...process.env, EXIGIR_SUPABASE: '1' }
  }
);

if (aceite.status !== 0) {
  relatar(
    'O aceite bloqueante da seção 12 NÃO passou',
    '`node --test testes/seguranca.test.mjs` (com EXIGIR_SUPABASE=1) não terminou com sucesso.\n'
    + '  Sem ele, ninguém sabe se as tabelas de inscritos, voluntários, doações e\n'
    + '  contatos estão protegidas. O escopo é explícito: enquanto esse teste não\n'
    + '  passar, o sistema não vai ao ar.\n\n'
    + '  Saída do teste:\n'
    + String(aceite.stdout + aceite.stderr)
        .trim()
        .split('\n')
        .map((linha) => `    ${linha}`)
        .join('\n')
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
