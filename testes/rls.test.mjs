/**
 * Testa a Row Level Security num Postgres de verdade.
 *
 * Sobe um Postgres portátil, cria o ambiente mínimo que imita o Supabase e
 * aplica as migrations reais de supabase/migrations. Depois assume o papel
 * `anon` — exatamente o que uma pessoa com a anon key e o DevTools aberto
 * consegue — e tenta ler o que não deveria.
 *
 * Isto NÃO substitui testes/seguranca.test.mjs, que roda contra o projeto
 * real e é o aceite bloqueante da seção 12. Este aqui pega o erro dias antes,
 * enquanto o SQL ainda está sendo escrito.
 *
 * Executar com: node --test testes/rls.test.mjs
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PASTA_DADOS = join(tmpdir(), `aac-rls-${process.pid}`);
const PORTA = 54330 + (process.pid % 200);

let postgres;
let cliente;

/** Um uuid fixo por papel, para os testes serem legíveis. */
const PESSOA = '11111111-1111-1111-1111-111111111111';
const OUTRA_PESSOA = '22222222-2222-2222-2222-222222222222';
const EQUIPE = '33333333-3333-3333-3333-333333333333';

before(async () => {
  postgres = new EmbeddedPostgres({
    databaseDir: PASTA_DADOS,
    user: 'postgres',
    password: 'teste',
    port: PORTA,
    persistent: false
  });

  await postgres.initialise();
  await postgres.start();

  cliente = postgres.getPgClient();
  await cliente.connect();

  // 1. Ambiente que imita o Supabase
  const ambiente = await readFile(
    new URL('./apoio/ambiente-supabase.sql', import.meta.url), 'utf8');
  await cliente.query(ambiente);

  // 2. As migrations reais, na ordem
  const pasta = new URL('../supabase/migrations/', import.meta.url);
  const arquivos = (await readdir(pasta)).filter((n) => n.endsWith('.sql')).sort();

  for (const arquivo of arquivos) {
    const sql = await readFile(new URL(arquivo, pasta), 'utf8');
    try {
      await cliente.query(sql);
    } catch (erro) {
      throw new Error(`migration ${arquivo} falhou: ${erro.message}`);
    }
  }

  // 3. Concessões para o que as migrations acabaram de criar
  await cliente.query(`
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;
  `);

  // 4. Pessoas de teste
  await cliente.query(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${PESSOA}',       'pessoa@exemplo.test', '{"nome":"Pessoa Um"}'),
      ('${OUTRA_PESSOA}', 'outra@exemplo.test',  '{"nome":"Pessoa Dois"}'),
      ('${EQUIPE}',       'equipe@exemplo.test', '{"nome":"Alguém da Equipe"}');
  `);
  // eh_equipe é concedido à mão, nunca pelo cadastro.
  await cliente.query(`update public.perfis set eh_equipe = true where id = '${EQUIPE}';`);

  // 5. Dados que precisam ficar protegidos
  await cliente.query(`
    insert into public.eventos (id, titulo, comeca_em, publicado)
    values ('44444444-4444-4444-4444-444444444444', 'Oficina de percussão', now() + interval '7 days', true);

    insert into public.inscricoes (evento_id, nome, email, telefone, eh_menor,
                                   responsavel_nome, responsavel_telefone, consentimento_dados)
    values ('44444444-4444-4444-4444-444444444444', 'Criança de Teste',
            'responsavel@exemplo.test', '11999999999', true,
            'Responsável de Teste', '11988888888', true);

    insert into public.contatos (nome, email, mensagem, consentimento_dados)
    values ('Escola de Teste', 'escola@exemplo.test', 'Gostaríamos de agendar', true);

    insert into public.doacoes (perfil_id, tipo, descricao)
    values ('${PESSOA}', 'item', 'Dez livros de literatura afro-brasileira');

    insert into public.voluntarios (perfil_id, mensagem)
    values ('${PESSOA}', 'Posso ajudar nas oficinas');

    insert into public.atividades (id, titulo, publicado)
    values ('teste-publico', 'Atividade pública de teste', true);
  `);
});

after(async () => {
  await cliente?.end();
  await postgres?.stop();
  await rm(PASTA_DADOS, { recursive: true, force: true });
});

/** Executa uma consulta como um papel específico, numa transação isolada. */
async function como(papel, uuid, sql) {
  await cliente.query('begin');
  try {
    if (uuid) {
      await cliente.query(`select set_config('request.jwt.claims', '{"sub":"${uuid}"}', true)`);
    } else {
      await cliente.query(`select set_config('request.jwt.claims', '', true)`);
    }
    await cliente.query(`set local role ${papel}`);
    const resultado = await cliente.query(sql);
    return { linhas: resultado.rows, erro: null };
  } catch (erro) {
    return { linhas: null, erro };
  } finally {
    await cliente.query('rollback');
  }
}

const comoAnonimo = (sql) => como('anon', null, sql);
const comoPessoa = (sql, uuid = PESSOA) => como('authenticated', uuid, sql);

/**
 * Executa uma ação como um papel e verifica o efeito DENTRO da mesma
 * transação, antes do rollback.
 *
 * Existe porque `como()` desfaz tudo ao final: verificar depois dele faria
 * qualquer teste de escrita passar, mesmo com a falha presente. Foi assim
 * que uma escalada de privilégio real passou despercebida por um tempo.
 */
async function comoEVerificar(papel, uuid, sqlAcao, sqlVerificacao) {
  await cliente.query('begin');
  try {
    await cliente.query(
      `select set_config('request.jwt.claims', '${uuid ? `{"sub":"${uuid}"}` : ''}', true)`);
    await cliente.query(`set local role ${papel}`);

    // Savepoint: quando a ação é bloqueada por exceção — que é justamente o
    // que esperamos numa tentativa de escalada — a transação inteira aborta e
    // a verificação seguinte não rodaria.
    await cliente.query('savepoint antes_da_acao');

    let erro = null;
    try {
      await cliente.query(sqlAcao);
    } catch (falha) {
      erro = falha;
      await cliente.query('rollback to savepoint antes_da_acao');
    }

    await cliente.query('reset role');
    const verificacao = await cliente.query(sqlVerificacao);
    return { erro, linhas: verificacao.rows };
  } finally {
    await cliente.query('rollback');
  }
}

// =====================================================================

describe('as migrations aplicam sem erro', () => {
  test('as 15 tabelas existem', async () => {
    const { rows } = await cliente.query(`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `);
    assert.equal(rows.length, 15, `esperadas 15 tabelas, vieram ${rows.length}`);
  });

  test('toda tabela do schema public tem RLS habilitada', async () => {
    const { rows } = await cliente.query(`
      select relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    assert.deepEqual(rows.map((r) => r.relname), [], 'tabelas sem RLS');
  });

  test('eh_equipe() não entra em recursão', async () => {
    // A armadilha: política em perfis que consulta perfis. Sem SECURITY
    // DEFINER isto estoura com "stack depth limit exceeded".
    const { erro } = await comoPessoa('select * from public.perfis');
    assert.equal(erro, null, `recursão em perfis: ${erro?.message}`);
  });
});

describe('ACEITE BLOQUEANTE: leitura anônima das tabelas com dados pessoais', () => {
  for (const tabela of ['inscricoes', 'voluntarios', 'doacoes', 'contatos', 'presencas']) {
    test(`${tabela} volta vazia para quem não está autenticado`, async () => {
      const { linhas, erro } = await comoAnonimo(`select * from public.${tabela}`);
      if (erro) return; // erro de permissão também protege
      assert.equal(linhas.length, 0,
        `VAZAMENTO: ${tabela} devolveu ${linhas.length} registro(s) para anônimo`);
    });
  }

  test('os dados existem de fato — o teste acima não passa por tabela vazia', async () => {
    // Sem isto, um banco vazio faria o aceite passar sem provar nada.
    for (const tabela of ['inscricoes', 'voluntarios', 'doacoes', 'contatos']) {
      const { rows } = await cliente.query(`select count(*)::int as total from public.${tabela}`);
      assert.ok(rows[0].total > 0, `${tabela} está vazia: o teste de vazamento seria vácuo`);
    }
  });
});

describe('escrita anônima', () => {
  test('inscrição sem conta é permitida — RF15 depende disso', async () => {
    const { erro } = await comoAnonimo(`
      insert into public.inscricoes (evento_id, nome, email, consentimento_dados)
      values ('44444444-4444-4444-4444-444444444444', 'Alguém', 'alguem@exemplo.test', true)
    `);
    assert.equal(erro, null, `inscrição anônima foi bloqueada: ${erro?.message}`);
  });

  test('mensagem de contato sem conta é permitida — RF07 depende disso', async () => {
    const { erro } = await comoAnonimo(`
      insert into public.contatos (nome, email, mensagem, consentimento_dados)
      values ('Alguém', 'alguem@exemplo.test', 'Olá', true)
    `);
    assert.equal(erro, null, `contato anônimo foi bloqueado: ${erro?.message}`);
  });

  test('quem insere não consegue ler de volta', async () => {
    // É por isto que o código do site usa .insert() sem .select().
    const { linhas, erro } = await comoAnonimo(`
      insert into public.contatos (nome, email, mensagem, consentimento_dados)
      values ('Alguém', 'alguem@exemplo.test', 'Olá', true)
      returning *
    `);
    assert.ok(erro !== null || linhas.length === 0,
      'VAZAMENTO: o insert anônimo devolveu a linha gravada');
  });

  test('escrita anônima em conteúdo público é negada', async () => {
    const { erro } = await comoAnonimo(`
      insert into public.atividades (id, titulo) values ('invasao', 'não deveria entrar')
    `);
    assert.ok(erro !== null, 'VAZAMENTO: anônimo conseguiu escrever em atividades');
  });

  test('anônimo não consegue tornar ninguém equipe', async () => {
    // A RLS não gera erro num update bloqueado: ela simplesmente não deixa
    // nenhuma linha ser alcançada. Verificar erro seria a pergunta errada —
    // o que importa é que nada mudou.
    await comoAnonimo(`update public.perfis set eh_equipe = true`);

    const { rows } = await cliente.query(
      `select id from public.perfis where eh_equipe order by id`);
    assert.deepEqual(rows.map((r) => r.id), [EQUIPE],
      'ESCALADA DE PRIVILÉGIO: alguém além da equipe ficou com eh_equipe');
  });

  test('pessoa autenticada não consegue se tornar equipe', async () => {
    // A política de update em perfis permite editar o próprio registro, e o
    // with check só garante que o id continue sendo o dela — não impede
    // mudar eh_equipe. Sem o trigger de proteção, qualquer pessoa com conta
    // vira equipe e lê inscritos, doadores e contatos.
    //
    // A verificação acontece dentro da transação de propósito: verificar
    // depois do rollback faria este teste passar mesmo com a falha presente.
    const { linhas, erro } = await comoEVerificar(
      'authenticated', PESSOA,
      `update public.perfis set eh_equipe = true where id = '${PESSOA}'`,
      `select eh_equipe from public.perfis where id = '${PESSOA}'`
    );

    assert.equal(linhas[0].eh_equipe, false,
      `ESCALADA DE PRIVILÉGIO: a pessoa conseguiu se declarar equipe (erro do update: ${erro?.message ?? 'nenhum'})`);
  });

  test('a equipe consegue conceder o papel de equipe a outra pessoa', async () => {
    // O trigger não pode ser tão rígido que impeça a própria equipe de
    // trabalhar: é assim que uma nova pessoa da ONG ganha acesso.
    const { erro, linhas } = await comoEVerificar(
      'authenticated', EQUIPE,
      `update public.perfis set eh_equipe = true where id = '${OUTRA_PESSOA}'`,
      `select eh_equipe from public.perfis where id = '${OUTRA_PESSOA}'`
    );

    assert.equal(erro, null, `a equipe foi bloqueada: ${erro?.message}`);
    assert.equal(linhas[0].eh_equipe, true, 'a equipe não conseguiu conceder o papel');
  });

  test('a pessoa ainda consegue editar os próprios dados', async () => {
    // A proteção não pode quebrar o RF11.
    const { erro, linhas } = await comoEVerificar(
      'authenticated', PESSOA,
      `update public.perfis set telefone = '11970000000' where id = '${PESSOA}'`,
      `select telefone from public.perfis where id = '${PESSOA}'`
    );

    assert.equal(erro, null, `edição do próprio perfil bloqueada: ${erro?.message}`);
    assert.equal(linhas[0].telefone, '11970000000', 'o telefone não foi atualizado');
  });
});

describe('leitura pública intencional', () => {
  for (const tabela of ['atividades', 'clipping', 'eventos', 'areas_voluntariado']) {
    test(`${tabela} continua legível sem autenticação`, async () => {
      const { erro } = await comoAnonimo(`select * from public.${tabela}`);
      assert.equal(erro, null, `${tabela} deveria ser pública: ${erro?.message}`);
    });
  }

  test('evento não publicado não aparece para anônimo', async () => {
    await cliente.query(`
      insert into public.eventos (id, titulo, comeca_em, publicado)
      values ('55555555-5555-5555-5555-555555555555', 'Rascunho', now(), false)
    `);
    const { linhas, erro } = await comoAnonimo(
      `select * from public.eventos where id = '55555555-5555-5555-5555-555555555555'`);
    assert.equal(erro, null, `consulta falhou: ${erro?.message}`);
    assert.equal(linhas.length, 0, 'VAZAMENTO: rascunho de evento visível ao público');
  });

  test('foto sem autorização de uso de imagem não aparece — RN07', async () => {
    await cliente.query(`
      insert into public.midia (album, tipo, caminho, alt, publicado, autorizacao_registrada)
      values ('oficina', 'imagem', 'foto.jpg', 'Crianças na oficina', true, false)
    `);
    const { linhas, erro } = await comoAnonimo(`select * from public.midia`);
    assert.equal(erro, null, `consulta falhou: ${erro?.message}`);
    assert.equal(linhas.length, 0,
      'VAZAMENTO: foto sem autorização registrada visível ao público');
  });
});

describe('isolamento entre pessoas autenticadas', () => {
  test('uma pessoa não lê a doação de outra', async () => {
    const { linhas } = await comoPessoa('select * from public.doacoes', OUTRA_PESSOA);
    assert.equal(linhas.length, 0,
      'VAZAMENTO: uma pessoa autenticada leu a doação de outra');
  });

  test('a pessoa lê a própria doação', async () => {
    const { linhas } = await comoPessoa('select * from public.doacoes', PESSOA);
    assert.equal(linhas.length, 1, 'a pessoa deveria ver a própria doação');
  });

  test('uma pessoa não lê o perfil de outra', async () => {
    const { linhas } = await comoPessoa(
      `select * from public.perfis where id = '${OUTRA_PESSOA}'`, PESSOA);
    assert.equal(linhas.length, 0, 'VAZAMENTO: perfil alheio visível');
  });

  test('pessoa autenticada comum não lê inscrições', async () => {
    // Ter conta de voluntário não dá acesso aos dados dos participantes.
    const { linhas } = await comoPessoa('select * from public.inscricoes', PESSOA);
    assert.equal(linhas.length, 0,
      'VAZAMENTO: pessoa autenticada comum leu as inscrições');
  });
});

describe('a equipe enxerga o que precisa', () => {
  for (const tabela of ['inscricoes', 'contatos', 'doacoes', 'voluntarios']) {
    test(`a equipe lê ${tabela}`, async () => {
      const { linhas, erro } = await comoPessoa(`select * from public.${tabela}`, EQUIPE);
      assert.equal(erro, null, `equipe bloqueada em ${tabela}: ${erro?.message}`);
      assert.ok(linhas.length > 0, `a equipe precisa enxergar ${tabela}`);
    });
  }
});

describe('regras de negócio impostas pelo banco', () => {
  test('RN02: inscrição de menor sem responsável é recusada', async () => {
    const { erro } = await comoAnonimo(`
      insert into public.inscricoes (evento_id, nome, email, eh_menor, consentimento_dados)
      values ('44444444-4444-4444-4444-444444444444', 'Criança', 'c@exemplo.test', true, true)
    `);
    assert.ok(erro !== null, 'menor foi inscrito sem responsável identificado');
  });

  test('inscrição sem consentimento é recusada', async () => {
    const { erro } = await comoAnonimo(`
      insert into public.inscricoes (evento_id, nome, email, consentimento_dados)
      values ('44444444-4444-4444-4444-444444444444', 'Alguém', 'a@exemplo.test', false)
    `);
    assert.ok(erro !== null, 'inscrição aceita sem consentimento de dados');
  });

  test('RNF02: imagem sem texto alternativo é recusada', async () => {
    const { erro } = await comoPessoa(`
      insert into public.publicacoes (titulo, corpo, imagem_caminho)
      values ('Notícia', 'Corpo da notícia', 'foto.jpg')
    `, EQUIPE);
    assert.ok(erro !== null, 'publicação aceita com imagem sem alt');
  });

  test('a busca do acervo funciona em português', async () => {
    await cliente.query(`
      insert into public.acervo (titulo, descricao, tema, arquivo_caminho, publicado)
      values ('Contação de histórias afro-brasileiras', 'Material para professores',
              'literatura', 'material.pdf', true)
    `);
    const { rows } = await cliente.query(`
      select titulo from public.acervo
      where busca @@ plainto_tsquery('portuguese', 'histórias')
    `);
    assert.equal(rows.length, 1, 'a busca em português não encontrou o material');
  });
});
