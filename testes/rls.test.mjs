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
// A metade do SITE do limite por visitante (migration 007). Importada aqui
// para o teste comparar o hash dos DOIS lados contra um Postgres de
// verdade — ver o bloco no fim deste arquivo.
import { hashDaOrigem, SEM_IP } from '../compartilhado/origem-do-visitante.ts';

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

  // 3. Nenhuma concessão extra aqui, de propósito: quem concede são as
  //    próprias migrations. Se faltar um grant lá, este teste acusa.

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

describe('privilégios: a camada antes da política', () => {
  // A RLS decide o que passa; o GRANT decide o que sequer é tentado. Com o
  // projeto criado sem exposição automática de tabelas, esta é uma segunda
  // barreira independente: mesmo uma política escrita errada não expõe uma
  // tabela em que anon não tem privilégio nenhum.
  const SEM_LEITURA_ANONIMA = [
    'inscricoes', 'voluntarios', 'voluntario_areas', 'doacoes',
    'contatos', 'presencas', 'perfis', 'envios_recentes'
  ];

  for (const tabela of SEM_LEITURA_ANONIMA) {
    test(`anon não tem privilégio de SELECT em ${tabela}`, async () => {
      const { rows } = await cliente.query(
        `select has_table_privilege('anon', 'public.${tabela}', 'SELECT') as tem`);
      assert.equal(rows[0].tem, false,
        `anon tem privilégio de leitura em ${tabela} — o grant está largo demais`);
    });
  }

  test('anon só escreve onde o site precisa: inscricoes e contatos', async () => {
    const { rows } = await cliente.query(`
      select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'INSERT')
      order by c.relname
    `);
    assert.deepEqual(rows.map((r) => r.tabela), ['contatos', 'inscricoes'],
      'anon pode inserir em tabela que não deveria');
  });

  test('anon nunca pode apagar nada', async () => {
    const { rows } = await cliente.query(`
      select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'DELETE')
    `);
    assert.deepEqual(rows.map((r) => r.tabela), [], 'anon tem privilégio de exclusão');
  });

  test('toda tabela lida pelo site tem grant para anon', async () => {
    // O oposto também quebra: sem grant, a tabela pública some do site e
    // alguém pode concluir que a RLS está apertada demais e afrouxá-la.
    for (const tabela of ['atividades', 'clipping', 'eventos', 'publicacoes',
                          'midia', 'acervo', 'areas_voluntariado']) {
      const { rows } = await cliente.query(
        `select has_table_privilege('anon', 'public.${tabela}', 'SELECT') as tem`);
      assert.equal(rows[0].tem, true, `falta grant de leitura em ${tabela}`);
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

/**
 * RF29 — a triagem das mensagens recebidas, do lado do BANCO.
 *
 * ESTE BLOCO É A ÚNICA MEDIÇÃO REAL DA ESCRITA DESTA TELA. A tela
 * (/admin/contatos) e a Server Action (acoes/contatos.ts) estão atrás de
 * `ehEquipe()`, e a suíte não tem sessão de equipe — testes/contatos
 * .test.mjs só alcança as decisões puras, o que o componente desenha e a
 * recusa por HTTP. Aqui, contra um Postgres de verdade com as migrations
 * reais, dá para exercitar o `update` que a Action faz.
 */
describe('RF29: a equipe tria as mensagens recebidas', () => {
  const MENSAGEM = `select situacao from public.contatos where email = 'escola@exemplo.test'`;

  test('a equipe muda a situação de uma mensagem', async () => {
    const { linhas, erro } = await comoEVerificar(
      'authenticated', EQUIPE,
      `update public.contatos set situacao = 'em_contato' where email = 'escola@exemplo.test'`,
      MENSAGEM
    );

    assert.equal(erro, null, `a equipe foi bloqueada: ${erro?.message}`);
    assert.equal(linhas[0].situacao, 'em_contato',
      'a equipe não conseguiu marcar o andamento do atendimento');
  });

  test('anônimo não muda a situação de nada', async () => {
    // A RLS não gera erro num update bloqueado: ela simplesmente não alcança
    // linha nenhuma. O que importa é que nada mudou — e a verificação
    // acontece DENTRO da transação, senão o rollback faria o teste passar
    // com a falha presente.
    const { linhas } = await comoEVerificar(
      'anon', null,
      `update public.contatos set situacao = 'concluido'`,
      MENSAGEM
    );

    assert.equal(linhas[0].situacao, 'novo',
      'VAZAMENTO: anônimo mexeu na fila de atendimento da ONG');
  });

  test('anônimo não LÊ mensagem nenhuma — é o que torna a tela da equipe necessária', async () => {
    // `anon` tem `grant insert` em contatos e mais nada (004_pessoas.sql):
    // o erro aqui é de permissão de tabela, antes mesmo da RLS. É por isso
    // que quem escreve pelo formulário não recebe a linha de volta (ver o
    // comentário do `.insert()` sem `.select()` em acoes/contato.ts).
    const { erro } = await comoAnonimo('select * from public.contatos');
    assert.ok(erro !== null, 'VAZAMENTO: anônimo leu as mensagens recebidas');
  });

  test('situação inventada é recusada pelo banco, não só pela tela', async () => {
    // compartilhado/triagem-de-contatos.ts tem a mesma lista fechada, e é
    // ela que impede a requisição de chegar aqui. Esta é a segunda tranca.
    const { erro } = await comoPessoa(
      `update public.contatos set situacao = 'arquivado'`, EQUIPE);
    assert.ok(erro !== null, 'o check de situacao deixou passar um valor fora da lista');
  });

  test('o banco PERMITE apagar mensagem — quem recusa é acoes/contatos.ts', async () => {
    // A política é `for all`, e `authenticated` tem `grant delete`. A tela
    // não oferece o gesto, de propósito (apagar não tem desfazer e apagaria
    // a prova de que houve contato), e há teste que falha no dia em que um
    // `.delete(` aparecer naquele arquivo. Este teste existe para que a
    // distinção fique escrita: a recusa é do CÓDIGO, não do banco — quem
    // precisar apagar a pedido de quem escreveu (LGPD) faz pelo SQL Editor.
    const { erro } = await comoPessoa(
      `delete from public.contatos where email = 'escola@exemplo.test'`, EQUIPE);
    assert.equal(erro, null,
      `a equipe não consegue apagar nem pelo SQL: ${erro?.message} — se isto mudou, a promessa `
      + 'de exclusão de /privacidade ficou sem caminho nenhum');
  });
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

// =====================================================================
// Limite de envio POR VISITANTE — supabase/migrations/007_limite_por_visitante.sql
//
// Este bloco tem uma propriedade que nenhum outro deste arquivo tem: ele é
// a ÚNICA verificação possível da migration 007. Ela não está aplicada no
// projeto Supabase de produção (aplicar migration exige credencial que este
// repositório não tem, e não vai ter — spec §4.1), então
// `npm run test:supabase` não a alcança. Aqui há um Postgres de verdade com
// as migrations reais, e é onde ela pode ser exercitada.
//
// O QUE ESTÁ SENDO PROVADO, e por que cada coisa importa:
//
//  · que dois visitantes NÃO compartilham balde. É o defeito que a 007
//    existe para consertar: com o `x-forwarded-for` do servidor, 10 envios
//    de uma pessoa derrubavam o formulário para todo mundo (spec §4.6);
//  · que o balde do visitante EXISTE, ou seja, que trocar o balde global
//    por baldes por origem não desligou o limite;
//  · que o hash calculado em compartilhado/origem-do-visitante.ts é
//    exatamente o que o Postgres calcula. Este é o teste que mais paga: se
//    os dois lados divergirem, nada quebra visivelmente — o limite
//    simplesmente para de reconhecer a mesma pessoa, e ninguém descobre
//    até chegar o envio em massa;
//  · que `registrar_contato` não devolve a linha gravada. `anon` tem
//    `grant insert` e NENHUM select em `public.contatos`: uma função que
//    devolvesse a linha seria uma porta lateral de leitura numa tabela com
//    dado pessoal.
// =====================================================================

describe('limite de envio por visitante (migration 007)', () => {
  const VISITANTE_A = hashDaOrigem('203.0.113.7');
  const VISITANTE_B = hashDaOrigem('203.0.113.99');

  /** Chama registrar_contato como `anon`, dentro de uma transação isolada. */
  function enviarComo(visitante, quantos = 1) {
    const chamadas = Array.from({ length: quantos }, () => `
      select public.registrar_contato(
        '${visitante}', 'Fulana de Teste', 'fulana@exemplo.test',
        'Mensagem de teste automatizado.', true, null, null);
    `).join('\n');

    return comoAnonimo(chamadas);
  }

  test('o hash do site é o MESMO que o Postgres calcula — os dois lados do balde', async () => {
    // compartilhado/origem-do-visitante.ts usa node:crypto; a migration usa
    // `encode(sha256(convert_to(ip, 'UTF8')), 'hex')`. Nada garante que os
    // dois continuem iguais além desta linha.
    const { rows } = await cliente.query(`
      select encode(sha256(convert_to('203.0.113.7', 'UTF8')), 'hex') as hash,
             encode(sha256(convert_to('desconhecida', 'UTF8')), 'hex') as sem_ip
    `);

    assert.equal(rows[0].hash, hashDaOrigem('203.0.113.7'),
      'o hash do site e o do banco divergiram: os envios de uma mesma pessoa passam a cair em '
      + 'baldes diferentes, e o limite deixa de existir sem nada acusar');
    assert.equal(rows[0].sem_ip, hashDaOrigem(SEM_IP));
  });

  test('quem não tem conta consegue enviar pela função — RF07 depende disso', async () => {
    const { erro } = await enviarComo(VISITANTE_A);
    assert.equal(erro, null, `registrar_contato foi bloqueada para anon: ${erro?.message}`);
  });

  test('a mensagem chega mesmo à tabela, com origem "contato" e o consentimento gravado', async () => {
    const { linhas } = await comoEVerificar(
      'anon', null,
      `select public.registrar_contato('${VISITANTE_A}', 'Fulana de Teste',
         'fulana@exemplo.test', 'Mensagem de teste automatizado.', true,
         '  ', 'EMEF de Teste')`,
      `select origem, nome, telefone, instituicao, consentimento_dados, situacao
       from public.contatos where email = 'fulana@exemplo.test'`
    );

    assert.equal(linhas.length, 1, 'a linha não foi gravada');
    assert.equal(linhas[0].origem, 'contato',
      '`origem` precisa ser escrita pela função, nunca por quem manda o corpo da requisição');
    assert.equal(linhas[0].situacao, 'novo', 'a mensagem precisa nascer pendente para quem atende');
    assert.equal(linhas[0].consentimento_dados, true);
    assert.equal(linhas[0].telefone, null, 'telefone em branco precisa virar NULL, não string vazia');
    assert.equal(linhas[0].instituicao, 'EMEF de Teste');
  });

  test('a função NÃO devolve a linha gravada — anon não tem select em contatos', async () => {
    const { linhas, erro } = await enviarComo(VISITANTE_A);

    assert.equal(erro, null);
    // `returns void`: a única coluna do resultado vem vazia (o driver a
    // entrega como string vazia, não como null). Se um dia alguém trocar
    // por `returns public.contatos`, isto acusa.
    assert.ok(
      linhas[0].registrar_contato === '' || linhas[0].registrar_contato === null,
      `VAZAMENTO: registrar_contato devolveu conteúdo para quem não pode ler a tabela: `
      + JSON.stringify(linhas[0])
    );
  });

  test('DOIS VISITANTES NÃO COMPARTILHAM BALDE — é o defeito que a 007 conserta', async () => {
    // Antes da 007 a origem vinha do `x-forwarded-for`, que neste desenho é
    // sempre o servidor: 10 envios de uma pessoa fechavam o formulário para
    // o site inteiro.
    const { erro } = await comoAnonimo(`
      ${Array.from({ length: 30 }, () => `
        select public.registrar_contato('${VISITANTE_A}', 'A', 'a@exemplo.test', 'oi', true, null, null);
      `).join('\n')}
      select public.registrar_contato('${VISITANTE_B}', 'B', 'b@exemplo.test', 'oi', true, null, null);
    `);

    assert.equal(erro, null,
      `o balde de um visitante derrubou o envio de OUTRO: ${erro?.message}`);
  });

  test('o balde do visitante existe: o 31º envio da MESMA origem é recusado', async () => {
    const { erro } = await enviarComo(VISITANTE_A, 31);

    assert.ok(erro !== null, 'o limite por origem sumiu — 31 envios da mesma origem passaram');
    assert.equal(erro.code, 'P0001',
      'o código precisa ser P0001: é por ele que compartilhado/erros.ts traduz a recusa');
  });

  test('30 envios da mesma origem ainda passam — o número precisa caber numa turma de escola', async () => {
    // O site tem /para-escolas, e o caminho natural dali é uma turma
    // inteira saindo por um IP só. Turma de escola pública em São Paulo tem
    // ~30 alunos; era por isso que o 10 de 005 precisava subir.
    const { erro } = await enviarComo(VISITANTE_A, 30);
    assert.equal(erro, null, `30 envios da mesma origem foram recusados: ${erro?.message}`);
  });

  test('origem forjada com formato inválido cai no balde de "desconhecida", não num balde novo', async () => {
    // O hash chega como PARÂMETRO, ou seja, quem chama escolhe o valor.
    // Isso é conhecido e está escrito na migration; o que não pode é lixo
    // arbitrário virar chave em `envios_recentes`.
    const { linhas } = await comoEVerificar(
      'anon', null,
      `select public.registrar_contato('nao-sou-um-hash; drop table x', 'A',
         'a@exemplo.test', 'oi', true, null, null)`,
      `select origem from public.envios_recentes where tabela = 'contatos' order by origem`
    );

    const origens = linhas.map((l) => l.origem);
    assert.ok(origens.includes(hashDaOrigem(SEM_IP)),
      `origem forjada não caiu no balde de "desconhecida": ${JSON.stringify(origens)}`);
    assert.ok(!origens.some((o) => o.includes('drop table')),
      'o valor recebido foi gravado cru em envios_recentes');
  });

  test('o teto do site existe — sem ele, quem tem a chave insere sem limite nenhum', async () => {
    // O balde por visitante é escolhido por quem chama. Sozinho, ele seria
    // PIOR que o limite global de hoje: bastaria mandar um hash novo a cada
    // envio. O teto é o fusível que impede isso, num número que uso normal
    // não alcança (300/hora).
    // As 300 linhas entram como DONO do banco, e não como anon, de
    // propósito: `anon` não tem grant nenhum em `envios_recentes` (quem
    // escreve ali é o trigger, que roda como definer) e a primeira versão
    // deste teste passou justamente por causa disso — recusa por
    // privilégio (42501), não pelo teto. Um teste que confunde as duas
    // recusas ficaria verde com o teto apagado.
    await cliente.query('begin');
    let erro = null;
    try {
      await cliente.query(`
        insert into public.envios_recentes (origem, tabela)
        select 'teto-do-site', 'contatos' from generate_series(1, 300)
      `);
      await cliente.query(`select set_config('request.jwt.claims', '', true)`);
      await cliente.query('set local role anon');
      await cliente.query(
        `select public.registrar_contato('${VISITANTE_A}', 'A', 'a@exemplo.test',
           'oi', true, null, null)`);
    } catch (falha) {
      erro = falha;
    } finally {
      await cliente.query('rollback');
    }

    assert.ok(erro !== null, 'o teto do site não recusou nada — 300 envios na hora passaram');
    assert.equal(erro.code, 'P0001',
      `a recusa veio por outro motivo (${erro.code}), não pelo teto`);
  });

  test('o caminho de 005 continua inteiro: insert direto ainda é limitado, pelo cabeçalho', async () => {
    // `limitar_inscricoes` (RF15, ainda não escrito) e qualquer insert que
    // não passe por `registrar_contato` continuam contando pelo
    // `request.headers`. Um `create or replace` que quebrasse isso deixaria
    // a tabela sem limite nenhum por esse caminho.
    const { erro } = await comoAnonimo(`
      ${Array.from({ length: 31 }, () => `
        insert into public.contatos (nome, email, mensagem, consentimento_dados)
        values ('A', 'a@exemplo.test', 'oi', true);
      `).join('\n')}
    `);

    assert.ok(erro !== null, 'insert direto em contatos ficou sem limite nenhum');
    assert.equal(erro.code, 'P0001');
  });

  test('cada envio conta nos DOIS baldes: o da origem e o do teto do site', async () => {
    // Sem esta verificação, apagar a metade "teto-do-site" do insert do
    // trigger não derrubaria nada: o teste do teto abaixo semeia as 300
    // linhas por conta própria, então ele continuaria verde com o teto
    // virando código morto em produção. MEDIDO: foi exatamente o que
    // aconteceu ao apagar aquela metade — 57 testes, 57 verdes.
    // Contagem por DELTA, e não em números absolutos: o `before()` deste
    // arquivo já grava um contato (que dispara o trigger), então o balde do
    // teto nunca começa em zero.
    const CONTAR = `select origem, count(*)::int as quantas from public.envios_recentes
                    where tabela = 'contatos' group by origem`;
    const mapa = (linhas) => Object.fromEntries(linhas.map((l) => [l.origem, l.quantas]));

    const antes = mapa((await cliente.query(CONTAR)).rows);

    const { linhas } = await comoEVerificar(
      'anon', null,
      `select public.registrar_contato('${VISITANTE_A}', 'A', 'a@exemplo.test',
         'oi', true, null, null)`,
      CONTAR
    );

    const depois = mapa(linhas);
    const cresceu = (origem) => (depois[origem] ?? 0) - (antes[origem] ?? 0);

    assert.equal(cresceu(VISITANTE_A), 1, 'o envio não foi contado no balde da origem');
    assert.equal(cresceu('teto-do-site'), 1,
      'o envio não foi contado no teto do site — o teto vira código morto e quem tem a chave '
      + 'volta a inserir sem limite nenhum');
  });

  test('a configuração da origem é da TRANSAÇÃO, e não fica grudada na conexão do pool', async () => {
    // Se `set_config` fosse chamado sem `is_local => true`, o balde de uma
    // pessoa vazaria para a próxima requisição que reaproveitasse a mesma
    // conexão — no Supabase, que usa pool, isso acontece o tempo todo.
    //
    // ESTA CHAMADA COMMITA, e é o ponto do teste: dentro de uma transação
    // que dá rollback (o `como()` do topo deste arquivo) as duas formas
    // somem igual, e a diferença fica invisível. MEDIDO: com
    // `is_local => false` na migration, a primeira versão deste teste
    // passava do mesmo jeito.
    //
    // Visitante próprio, para a linha que fica committada em
    // `envios_recentes` não entrar no balde que os outros testes contam.
    const VISITANTE_C = hashDaOrigem('203.0.113.55');

    await cliente.query(`select set_config('request.jwt.claims', '', false)`);
    await cliente.query('set role anon');
    try {
      await cliente.query(`select public.registrar_contato('${VISITANTE_C}', 'C',
        'c@exemplo.test', 'oi', true, null, null)`);
    } finally {
      await cliente.query('reset role');
    }

    const { rows } = await cliente.query(
      `select current_setting('app.origem_do_visitante', true) as origem`);

    // Limpeza antes do assert: um `set_config` não-local deixaria a sessão
    // suja para os testes seguintes mesmo com este falhando.
    await cliente.query(`select set_config('app.origem_do_visitante', '', false)`);

    assert.ok(rows[0].origem === null || rows[0].origem === '',
      `a origem do visitante sobreviveu à transação e ficou grudada na conexão: ${rows[0].origem}`);
  });
});

// =====================================================================
// O BUCKET DA GALERIA É PRIVADO — supabase/migrations/008_galeria_privada.sql
//
// A brecha que esta migration fecha estava no item 0j do CLAUDE.md: o
// bucket `galeria` nascia público (006_storage.sql), e por isso uma foto
// GUARDADA, uma foto SEM AUTORIZAÇÃO e uma foto TIRADA DO AR continuavam
// baixáveis por quem tivesse o endereço. A coluna `publicado` governava o
// que a página desenhava; nunca governou o arquivo.
//
// ESTE BLOCO É A VERIFICAÇÃO MAIS FORTE QUE ESTA TAREFA CONSEGUE FAZER. A
// migration não pode ser aplicada no projeto real (não existe service_role
// — spec §4.1), então ninguém a viu valendo em produção; aqui ela roda
// contra um Postgres de verdade, com as políticas reais, e o que se mede é
// exatamente o que o Storage mede na hora de assinar uma URL: um `select`
// em `storage.objects`.
//
// Se o `select` volta vazio, `createSignedUrl` recusa — e sem URL assinada
// não há como baixar arquivo de um bucket privado.
// =====================================================================
describe('RN07 no ARQUIVO: quem lê storage.objects no bucket galeria', () => {
  const PUBLICADA = 'evento/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa.jpg';
  const GUARDADA = 'evento/bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb.jpg';
  const SEM_AUTORIZACAO = 'evento/cccccccc-3333-4333-8333-cccccccccccc.jpg';
  const ORFA = 'evento/dddddddd-4444-4444-8444-dddddddddddd.jpg';
  const NO_ACERVO = 'cartilhas/apostila.pdf';

  before(async () => {
    // Três linhas em public.midia, uma para cada estado que a tela conhece,
    // mais um arquivo SEM linha nenhuma (o órfão que `enviarMidia` pode
    // deixar quando o insert falha depois de o upload ter dado certo).
    await cliente.query(`
      insert into public.midia (album, tipo, caminho, alt, autorizacao_registrada, publicado)
      values
        ('Evento', 'imagem', '${PUBLICADA}',       'Foto publicada',  true,  true),
        ('Evento', 'imagem', '${GUARDADA}',        'Foto guardada',   true,  false),
        ('Evento', 'imagem', '${SEM_AUTORIZACAO}', 'Sem autorizacao', false, false);

      insert into storage.objects (bucket_id, name) values
        ('galeria', '${PUBLICADA}'),
        ('galeria', '${GUARDADA}'),
        ('galeria', '${SEM_AUTORIZACAO}'),
        ('galeria', '${ORFA}'),
        ('acervo',  '${NO_ACERVO}');
    `);
  });

  const nomes = (linhas) => linhas.map((l) => l.name).sort();

  test('o bucket galeria deixou de ser público, e SÓ ele', async () => {
    const { rows } = await cliente.query('select id, public from storage.buckets order by id');
    const porId = Object.fromEntries(rows.map((r) => [r.id, r.public]));

    assert.equal(porId.galeria, false,
      'o bucket galeria continua público: o endereço /object/public/galeria/... serve arquivo '
      + 'sem chave nenhuma, e a RN07 não vale para o arquivo');
    // A instrução da tarefa foi explícita: acervo e identidade são material
    // feito para download livre (RF35/RF36) e ficam como estavam.
    assert.equal(porId.acervo, true, 'o bucket acervo mudou — download livre é requisito (RF36)');
    assert.equal(porId.identidade, true, 'o bucket identidade mudou');
  });

  test('anônimo só alcança o arquivo de uma foto publicada E autorizada', async () => {
    const { linhas, erro } = await comoAnonimo(
      `select name from storage.objects where bucket_id = 'galeria'`);

    assert.equal(erro, null, `anon não conseguiu nem consultar: ${erro?.message}`);
    assert.deepEqual(nomes(linhas), [PUBLICADA],
      'VAZAMENTO: anônimo alcança arquivo que a RN07 não deixa. Guardada, sem autorização e '
      + 'órfã não podem ter endereço assinável');
  });

  test('a equipe alcança tudo — inclusive o órfão, que é o que ela precisa apagar', async () => {
    const { linhas, erro } = await como('authenticated', EQUIPE,
      `select name from storage.objects where bucket_id = 'galeria'`);

    assert.equal(erro, null, `a equipe não conseguiu consultar: ${erro?.message}`);
    assert.deepEqual(nomes(linhas), [PUBLICADA, GUARDADA, SEM_AUTORIZACAO, ORFA].sort(),
      'a equipe deixou de ver algum arquivo: o painel mostra a miniatura de cada foto, e é '
      + 'olhando que a pessoa decide se apaga');
  });

  test('tirar do ar FECHA o arquivo, e não só a listagem', async () => {
    // O gesto exato do painel: `porNoAr` grava `publicado = false`. Antes de
    // 008 isso não mexia no arquivo — era o item 0j inteiro.
    await cliente.query('begin');
    try {
      await cliente.query(
        `update public.midia set publicado = false where caminho = '${PUBLICADA}'`);

      await cliente.query(`select set_config('request.jwt.claims', '', true)`);
      await cliente.query('set local role anon');
      const { rows } = await cliente.query(
        `select name from storage.objects where bucket_id = 'galeria'`);
      await cliente.query('reset role');

      assert.deepEqual(nomes(rows), [],
        'depois de "Tirar do ar" o arquivo continua alcançável: a brecha do item 0j não foi '
        + 'fechada');
    } finally {
      await cliente.query('rollback');
    }
  });

  test('acervo e identidade continuam de leitura aberta', async () => {
    const { linhas, erro } = await comoAnonimo(
      `select name from storage.objects where bucket_id in ('acervo', 'identidade')`);

    assert.equal(erro, null, `anon perdeu a leitura do acervo: ${erro?.message}`);
    assert.deepEqual(nomes(linhas), [NO_ACERVO],
      'a política recriada por 008 fechou material que é para download livre (RF35/RF36) — '
      + 'a instrução era não encostar nesses dois buckets');
  });

  test('a política permissiva antiga não sobrou ao lado da nova', async () => {
    // Políticas do Postgres se SOMAM com OU. Se "arquivos publicos: leitura"
    // continuasse citando `galeria`, tudo acima passaria a valer nada — e
    // os testes de vazamento não acusariam nada, porque eles medem o efeito
    // e o efeito seria "vê tudo".
    const { rows } = await cliente.query(`
      select polname, pg_get_expr(polqual, polrelid) as expressao
      from pg_policy
      where polrelid = 'storage.objects'::regclass and polcmd = 'r'
      order by polname
    `);

    const permissiva = rows.find((r) => r.polname === 'arquivos publicos: leitura');
    assert.ok(permissiva, 'a política de leitura de acervo/identidade sumiu');
    assert.ok(!permissiva.expressao.includes('galeria'),
      `"arquivos publicos: leitura" ainda cita galeria: ${permissiva.expressao}`);
  });
});
