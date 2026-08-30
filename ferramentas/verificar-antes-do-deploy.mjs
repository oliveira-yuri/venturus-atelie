/**
 * Guardiao do deploy.
 *
 * SETE secoes, nesta ordem: (1) o aceite bloqueante da secao 12 do escopo
 * roda de verdade; (2) o teste de vazamento E o de procedencia do dado
 * rodam contra um build feito COM as credenciais; (3) os diretorios que
 * vao ao ar sao varridos atras de
 * chave secreta; (4) nenhum .html solto em public/; (5) os VALORES das
 * variaveis de ambiente; (6) RLS em toda tabela; (7) grant em toda tabela.
 * As secoes 2 a 5 nasceram na revisao final da fase 1 — as tres ultimas
 * estavam previstas na spec §7.3 e nunca tinham sido feitas, e a varredura
 * ainda olhava `site/`, que deixou de ser o que a Netlify publica. A
 * Tarefa A8 apagou `site/`: a varredura da secao 3 agora cobre `.next` e
 * `public/`, os dois obrigatorios, e nao ha mais diretorio opcional.
 *
 * Este script CONSTROI o site (secao 2, via ferramentas/rodar-testes.mjs
 * com COM_SUPABASE=1) e fala com a rede. Demora mais que antes, de
 * proposito: e um portao de deploy, nao um linter.
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
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { lerEnvLocal } from '../testes/apoio/env-local.mjs';

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
// ler site/config.js. Resultado medido: com .env.local ausente e a
// variavel com o nome novo (SUPABASE_CHAVE_PUBLICAVEL, nao
// SUPABASE_ANON_KEY), testes/seguranca.test.mjs pulava em silencio E este
// guardiao ainda achava "tudo certo" lendo aquele arquivo — exatamente o
// falso verde que o cabecalho deste arquivo promete impedir.
//
// A correcao: nao duplicar a logica de configuracao aqui. Rodar o proprio
// teste, com o sinal EXIGIR_SUPABASE=1 (que faz aquele arquivo FALHAR, nao
// pular, quando a configuracao nao aparece — ver o skipSemConfiguracao()
// de la) e conferir o codigo de saida de verdade. Desde a Tarefa A8 aquele
// arquivo nem existe mais (`site/` foi apagado); a configuracao do aceite
// bloqueante vem exclusivamente de variavel de ambiente.
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
// 2. Os dois testes que so significam alguma coisa contra o build de verdade
//
// Ate a revisao final da fase 1 este guardiao nao chamava nenhum dos dois.
// Chamar nao basta: os dois precisam do build COM as variaveis do Supabase
// presentes — o build parecido com o que a Netlify produz —, e o modo
// offline da suite constroi com NODE_ENV=test e SEM elas. Por isso aqui e
// COM_SUPABASE=1.
//
//   - testes/vazamento.test.mjs varre `.next/static` e o HTML entregue atras
//     da URL e da chave reais. Varrer um build onde a credencial nem existia
//     nao prova que ela nao vaza do build em que existe.
//
//   - testes/origem-dos-dados.test.mjs exige que o conteudo venha do BANCO
//     quando ha credencial valida. Ele entrou aqui na re-revisao da fase 1,
//     e o motivo e concreto: com o guardiao rodando so o de vazamento, uma
//     consulta quebrada (coluna inexistente no select, grant faltando, RLS
//     apertada) fazia a camada de dados cair para o JSON versionado, a
//     pagina ficava IDENTICA a pagina certa e o guardiao respondia
//     "tudo certo", saida 0. O defeito exato que o CRITICO 1 nomeia —
//     publicar com o Supabase configurado servindo JSON o tempo todo —
//     passava pelo portao sem um ruido. O teste que existe para isso ja
//     existia; ninguem o estava chamando.
//
// Os dois numa invocacao so, de proposito: o passo ja constroi e sobe o
// servidor, entao o segundo arquivo custa perto de zero.
//
// Efeito colateral desejado: e este passo que produz o `.next` que a secao 3
// varre logo abaixo.
// ---------------------------------------------------------------------
const ARQUIVOS_CONTRA_O_BUILD_REAL = [
  'testes/vazamento.test.mjs',
  'testes/origem-dos-dados.test.mjs'
];

const contraOBuildReal = spawnSync(
  process.execPath,
  ['ferramentas/rodar-testes.mjs', ...ARQUIVOS_CONTRA_O_BUILD_REAL],
  { encoding: 'utf8', env: { ...process.env, COM_SUPABASE: '1' } }
);

if (contraOBuildReal.status !== 0) {
  relatar(
    'Vazamento de credencial ou procedência do dado: NÃO passou',
    `\`COM_SUPABASE=1 node ferramentas/rodar-testes.mjs ${ARQUIVOS_CONTRA_O_BUILD_REAL.join(' ')}\` falhou.\n`
    + '  Esse passo constrói COM as variáveis do Supabase — o mesmo tipo de build\n'
    + '  que a Netlify produz — e verifica duas coisas que só existem ali:\n'
    + '    · a URL e a chave reais NÃO aparecem em .next/static nem no HTML entregue;\n'
    + '    · o conteúdo servido vem mesmo do BANCO, e não do JSON versionado.\n'
    + '  Se a segunda falhou, o site está de pé e correto, mas servindo dado que\n'
    + '  ninguém consegue atualizar pelo painel: a consulta caiu e a página ficou\n'
    + '  idêntica à página certa. Ver o aviso "[dados]" na saída abaixo.\n'
    + '  Se nem subiu, a seção 3 também não terá o que varrer.\n\n'
    + '  Saída:\n'
    + String(contraOBuildReal.stdout + contraOBuildReal.stderr)
        .trim()
        .split('\n')
        .slice(-40)
        .map((linha) => `    ${linha}`)
        .join('\n')
  );
}

// ---------------------------------------------------------------------
// 3. A chave secreta nunca pode estar no que vai ser publicado
//
// Anon key e service role key sao os dois JWT e se parecem. Procurar pelo
// formato acusaria a anon key legitima — e um verificador que grita a toa
// vira um verificador ignorado. Entao decodificamos o payload e olhamos o
// papel: "anon" pode ser publicado, "service_role" nunca.
//
// O QUE MUDOU NA REVISAO FINAL DA FASE 1. Esta secao varria SO `site/` — o
// site estatico antigo. A Netlify publica `.next` desde a migracao
// (netlify.toml), e nada varria nem `.next` nem `public/`: o guardiao
// vigiava um diretorio que nao e mais o que vai ao ar. Pior, os `|| true`
// no fim de cada grep faziam o comando devolver vazio quando o diretorio
// sumisse, e o guardiao respondia "tudo certo" — a MESMA falha silenciosa
// que a Rodada 1 da Tarefa 10 corrigiu na secao 1 deste arquivo. O `git rm`
// aconteceu na Tarefa A8, e a correcao acima e o que impediu esse dia de
// virar um falso verde.
//
// Agora: diretorio esperado que nao existe FALHA, nunca vira silencio; e
// erro do proprio grep (codigo de saida >= 2) tambem falha, em vez de virar
// "nenhum resultado".
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

/**
 * Diretorios que vao ao ar.
 *
 * `.next` e `public/` sao o que a Netlify publica — os dois obrigatorios.
 *
 * A entrada de `site/` saiu na Tarefa A8, junto com o diretorio. Ela era
 * `obrigatorio: false`, e um diretorio opcional ausente imprime "· site/
 * nao existe" a CADA execucao: ruido permanente num script cuja premissa
 * declarada, tres paragrafos acima, e que verificador que grita a toa vira
 * verificador ignorado. Com ela fora, `obrigatorio` so tem um valor hoje —
 * o campo fica porque descreve a intencao de cada entrada, e o dia em que
 * um diretorio publicado voltar a ser opcional a distincao volta a valer.
 */
const DIRETORIOS_PUBLICADOS = [
  {
    caminho: '.next',
    obrigatorio: true,
    porque: 'é o que netlify.toml publica',
    // .next empacota bibliotecas de terceiros. O @supabase/supabase-js
    // carrega, no proprio codigo, `e.startsWith("sb_secret_")` e a mensagem
    // "Double check your Supabase `anon` or `service_role` API key" — o
    // padrao amplo acusava esses arquivos, medido. Um verificador que grita
    // a toa vira um verificador ignorado, entao aqui a busca por NOME exige
    // uma chave de verdade (prefixo mais o corpo), nao a palavra solta. A
    // busca por FORMATO (decodificar o JWT e olhar o papel) continua igual
    // e nao tem esse problema: ela nao acusa mencao, so credencial.
    codigoDeTerceiros: true
  },
  { caminho: 'public', obrigatorio: true, porque: 'vai inteiro para a raiz do site' }
];

/** Roda um grep e distingue "nada encontrado" (1) de "o grep falhou" (>=2). */
function grepArquivos(padrao, diretorio) {
  const resultado = spawnSync('sh', ['-c',
    `grep -rIl --exclude-dir=node_modules --exclude-dir=fontes --exclude-dir=cache `
    + `-E ${JSON.stringify(padrao)} ${JSON.stringify(diretorio)}`
  ], { encoding: 'utf8' });

  if (resultado.status === 0) return { arquivos: resultado.stdout.trim().split('\n').filter(Boolean) };
  if (resultado.status === 1) return { arquivos: [] };
  return { erro: (resultado.stderr || `grep saiu com ${resultado.status}`).trim() };
}

/**
 * Palavras que denunciam a chave secreta mesmo fora do formato JWT.
 *
 * Em codigo que escrevemos, a MENCAO ja e suspeita. Em codigo empacotado de
 * terceiros, so a chave inteira.
 */
const PADRAO_POR_NOME = {
  nosso: 'service_role|SUPABASE_SERVICE_ROLE|sb_secret_',
  terceiros: 'SUPABASE_SERVICE_ROLE|sb_secret_[A-Za-z0-9_-]{16,}'
};

const diretoriosParaVarrer = [];

for (const { caminho, obrigatorio, porque, codigoDeTerceiros } of DIRETORIOS_PUBLICADOS) {
  if (existsSync(caminho)) {
    diretoriosParaVarrer.push({ caminho, codigoDeTerceiros: Boolean(codigoDeTerceiros) });
    continue;
  }

  if (obrigatorio) {
    relatar(
      `Diretório publicado ausente: ${caminho}/`,
      `${caminho}/ não existe, e ${porque}.\n`
      + '  O guardião NÃO pode responder "tudo certo" sobre um diretório que não\n'
      + '  varreu. Rodar `next build` antes, ou corrigir netlify.toml se o que vai\n'
      + '  ao ar mudou de lugar.'
    );
  } else {
    // Ramo sem nenhuma entrada alcançando-o hoje: desde a Tarefa A8 as duas
    // entradas de DIRETORIOS_PUBLICADOS são `obrigatorio: true`. Fica como
    // parte do mecanismo (ver o comentário daquela lista), não como código
    // que alguém achou que roda.
    console.log(`  · ${caminho}/ não existe — nada a varrer ali (${porque}).`);
  }
}

for (const { caminho: diretorio, codigoDeTerceiros } of diretoriosParaVarrer) {
  const porFormato = grepArquivos('eyJ[A-Za-z0-9_-]{10,}\\.', diretorio);
  if (porFormato.erro) {
    relatar(`Não foi possível varrer ${diretorio}/`, porFormato.erro);
    continue;
  }

  for (const arquivo of porFormato.arquivos) {
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

  const porNome = grepArquivos(
    codigoDeTerceiros ? PADRAO_POR_NOME.terceiros : PADRAO_POR_NOME.nosso,
    diretorio
  );
  if (porNome.erro) {
    relatar(`Não foi possível varrer ${diretorio}/`, porNome.erro);
  } else if (porNome.arquivos.length > 0) {
    relatar(
      'Referencia a chave secreta em arquivo publicado',
      `Encontrada em:\n  ${porNome.arquivos.join('\n  ')}`
    );
  }
}

// ---------------------------------------------------------------------
// 4. Nenhum .html solto em public/
//
// Previsto na spec §7.3. A suposicao original — de que um arquivo estatico
// em public/ tem precedencia sobre o redirect de mesmo caminho — estava
// ERRADA, e foi MEDIDO (rodada de correcao 1 da Tarefa A7): criado
// `public/quem-somos.html`, reconstruido, medido com curl contra
// `/quem-somos.html` — o redirect venceu (301 para /quem-somos), o arquivo
// estatico nao foi servido.
//
// MECANISMO ATUALIZADO NA RODADA DE CORRECAO 2 (o comentario acima nasceu
// desatualizado no mesmo commit que moveu o codigo): os 14 redirects nao
// vivem mais em `next.config.ts` `redirects()` — vivem em `middleware.ts`
// (NextResponse.redirect), porque so assim um Cache-Control explicito
// sobrevive na resposta (ver compartilhado/redirects-antigos.ts). A
// conclusao medida acima continua valendo pelo mesmo motivo estrutural:
// o middleware roda antes do check de arquivo estatico/pagina
// (`node_modules/next/dist/server/lib/router-utils/resolve-routes.js`,
// `calculateRoutes()` — middleware aparece antes de `check_fs` na lista),
// entao um redirect construido no middleware tambem vence um `.html`
// esquecido em public/ no mesmo caminho.
//
// O check continua valendo por outro motivo, este sim real: um `.html`
// solto so e inofensivo enquanto existir redirect configurado para o MESMO
// caminho. Sem esse redirect (esquecido, ou com a `origem` digitada
// errada em compartilhado/redirects-antigos.ts), o arquivo estatico seria
// servido tal como esta — sem cabecalho, sem os controles de
// acessibilidade, sem a camada de dados — e ninguem veria erro nenhum.
//
// Duvida em aberto, NAO medida: na Netlify, o `@netlify/plugin-nextjs` pode
// servir public/ direto pela CDN, sem passar pela funcao/edge onde o
// middleware do Next roda. Esse caminho nao foi testado contra o deploy
// real — nao da para afirmar nem descartar aqui.
// ---------------------------------------------------------------------
if (existsSync('public')) {
  const html = spawnSync('sh', ['-c', 'find public -type f -name "*.html"'], { encoding: 'utf8' });
  const soltos = (html.stdout || '').trim().split('\n').filter(Boolean);

  if (html.status !== 0) {
    relatar('Não foi possível listar os .html de public/', (html.stderr || '').trim());
  } else if (soltos.length > 0) {
    relatar(
      'Arquivo .html solto em public/',
      `Encontrado:\n  ${soltos.join('\n  ')}\n`
      + '  Medido: um redirect configurado para o mesmo caminho ainda vence (a ordem\n'
      + '  real do Next é headers → redirects → rewrites → arquivos estáticos). O risco\n'
      + '  é o caminho SEM redirect nenhum: esse arquivo seria servido tal como está,\n'
      + '  sem erro nenhum.'
    );
  }
}

// ---------------------------------------------------------------------
// 5. Os VALORES das variaveis de ambiente, nao so a presenca delas
//
// Tambem previsto na spec §7.3 e nunca feito. Sao tres perguntas
// diferentes, e so a primeira era feita em algum lugar:
//   - existe? (a secao 1 responde, rodando o aceite de verdade)
//   - a chave publicavel e mesmo publicavel, ou alguem colou a secreta?
//   - sobrou alguma variavel que nao devia existir neste projeto?
//
// Le .env.local e process.env: sao as duas fontes que alimentam o build.
// Na Netlify o painel vira process.env; aqui na maquina, .env.local.
// ---------------------------------------------------------------------
const ambiente = { ...lerEnvLocal(), ...process.env };

/** Uma chave do Supabase e publicavel? Cobre o formato JWT e o formato novo. */
function chaveEhPublicavel(valor) {
  if (valor.startsWith('sb_secret_')) return { publicavel: false, papel: 'sb_secret_' };
  if (valor.startsWith('sb_publishable_')) return { publicavel: true, papel: 'sb_publishable_' };
  const papel = papelDoToken(valor);
  if (papel) return { publicavel: papel === 'anon', papel };
  return { publicavel: null, papel: null };
}

if (!ambiente.SUPABASE_URL) {
  relatar('SUPABASE_URL ausente', 'Sem ela o site não fala com o banco: nem em .env.local, nem no ambiente.');
} else if (!ambiente.SUPABASE_URL.startsWith('https://')) {
  relatar(
    'SUPABASE_URL não é https',
    `Valor: ${ambiente.SUPABASE_URL}\n`
    + '  A anon key viaja em todo pedido. Sem TLS ela vai em claro.'
  );
}

if (!ambiente.SUPABASE_CHAVE_PUBLICAVEL) {
  relatar('SUPABASE_CHAVE_PUBLICAVEL ausente', 'Nem em .env.local, nem no ambiente.');
} else {
  const { publicavel, papel } = chaveEhPublicavel(ambiente.SUPABASE_CHAVE_PUBLICAVEL);
  if (publicavel === false) {
    relatar(
      `SUPABASE_CHAVE_PUBLICAVEL carrega uma chave de papel "${papel}"`,
      '  Essa variável alimenta servidor/supabase.ts, que é o cliente usado para\n'
      + '  TODA leitura do site. Uma chave que ignora a RLS ali entrega, de uma vez,\n'
      + '  as tabelas de inscritos, voluntários, doações e contatos — e o aceite\n'
      + '  bloqueante da seção 12 passaria assim mesmo, porque ele testa a política,\n'
      + '  não qual chave o site usa.'
    );
  } else if (publicavel === null) {
    relatar(
      'SUPABASE_CHAVE_PUBLICAVEL não parece uma chave do Supabase',
      '  Não é JWT decodificável nem começa com sb_publishable_/sb_secret_.\n'
      + '  O guardião não consegue dizer se ela é publicável, e chave que o\n'
      + '  verificador não entende não vai ao ar.'
    );
  }
}

for (const [nome, valor] of Object.entries(ambiente)) {
  if (typeof valor !== 'string' || !valor) continue;

  // Restrição global da spec: nenhuma variável NEXT_PUBLIC_. Esse prefixo é
  // o que faz o Next EMBUTIR o valor no bundle do navegador — é a porta
  // exata pela qual a credencial iria parar no cliente, e testes/
  // vazamento.test.mjs só veria depois de acontecer.
  if (nome.startsWith('NEXT_PUBLIC_')) {
    relatar(
      `Variável com prefixo NEXT_PUBLIC_: ${nome}`,
      '  Esse prefixo manda o Next embutir o valor no JavaScript que o navegador\n'
      + '  baixa. Este projeto não tem nenhuma variável que deva ir para o cliente:\n'
      + '  todo acesso a dado é do servidor (servidor/dados/). Remover — inclusive\n'
      + '  do painel de variáveis da Netlify, que não aparece no repositório.'
    );
  }

  if (/SUPABASE/i.test(nome) && /SERVICE_ROLE|SECRET/i.test(nome)) {
    relatar(
      `Variável de chave secreta configurada: ${nome}`,
      '  A spec §4.2 é explícita: não existe cliente com chave que ignora a RLS\n'
      + '  neste projeto, e nenhuma variável com chave secreta em lugar nenhum.\n'
      + '  Enquanto ela existir, basta um import errado para furar todas as políticas.'
    );
    continue;
  }

  // Pelo VALOR, não pelo nome: uma chave secreta guardada numa variável de
  // nome inocente não seria pega pela regra acima.
  const suspeita = valor.startsWith('sb_secret_')
    || (valor.startsWith('eyJ') && papelDoToken(valor) && papelDoToken(valor) !== 'anon');
  if (suspeita) {
    relatar(
      `Variável ${nome} contém uma chave que ignora a RLS`,
      `  Papel: ${valor.startsWith('sb_secret_') ? 'sb_secret_' : papelDoToken(valor)}\n`
      + '  O nome da variável não denuncia, o valor sim.'
    );
  }
}

// ---------------------------------------------------------------------
// 6. Toda tabela criada precisa ter RLS habilitada na mesma migration
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
// 7. Toda tabela precisa de grant explicito
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
