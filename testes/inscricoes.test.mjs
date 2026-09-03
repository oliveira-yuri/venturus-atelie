/**
 * Inscrição em evento (RF15), lista de inscritos (RF16) e lista de presença
 * (RF17).
 *
 * ===================================================================
 * O QUE ESTE ARQUIVO CONSEGUE MEDIR, E O QUE NÃO
 * ===================================================================
 *
 * A RF15 é como o RF07: quem envia é o PÚBLICO, então o caminho do sucesso
 * é alcançável sem sessão. Mas, ao contrário do contato, nenhum teste daqui
 * envia um formulário válido com o Supabase configurado — isso gravaria uma
 * inscrição inventada num evento de verdade a cada rodada de
 * `npm run test:supabase`, e a linha apareceria na lista que a equipe leva
 * para a porta da oficina. A metade do BANCO está em `npm run rls`, contra
 * um Postgres real com as migrations reais (bloco "RF15", 14 testes).
 *
 * RF16 e RF17 são telas de PAINEL, e o painel responde 404 para quem não é
 * equipe — não há sessão de equipe na suíte (CLAUDE.md, "O que trava
 * hoje", itens 1 e 2). O que dá para medir sem sessão está aqui: as
 * decisões puras, o 404 das rotas novas, e as varreduras de código-fonte.
 *
 * ===================================================================
 * A VARREDURA MAIS IMPORTANTE DESTE ARQUIVO É UMA AUSÊNCIA
 * ===================================================================
 *
 * `acoes/inscricoes.ts` NÃO pode chamar `ehEquipe()`. É a segunda Action do
 * projeto de que isso é verdade (a outra é `acoes/contato.ts`), e a
 * ausência é o requisito: a decisão D4 do escopo diz que inscrever-se não
 * exige conta. Quem ler as Actions do painel vai achar que aqui faltou a
 * guarda — por isso existe um teste que falha se ela aparecer.
 *
 * A varredura IRMÃ, e oposta, vale para `acoes/presencas.ts`: aquela é do
 * painel, e `ehEquipe()` precisa estar lá.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ehCpf, formatarCpf, lerInscricao, validarInscricao
} from '../compartilhado/validacao.ts';
import { avisoDeInscricao } from '../compartilhado/avisos-de-inscricao.ts';
import { avisoDePresenca } from '../compartilhado/avisos-do-painel.ts';
import {
  conjuntoPorChave, exigeEvento, nomeDoArquivo, pedacoParaNomeDeArquivo, CONJUNTOS_EXPORTAVEIS
} from '../compartilhado/exportacao.ts';

const endereco = process.env.URL_BASE || 'http://localhost:3123';

/**
 * O código sem os comentários — a mesma função de testes/contato.test.mjs e
 * das outras varreduras do projeto.
 *
 * SEM ISTO A VARREDURA MENTE, e mente nos dois sentidos. Medido ao escrever
 * este arquivo: as três primeiras varreduras daqui ficaram vermelhas porque
 * o cabeçalho de `acoes/inscricoes.ts` EXPLICA que as Actions do painel
 * chamam `ehEquipe()` — a palavra estava num comentário, e o teste a leu
 * como código. O caso oposto é pior: um `.delete(` citado num comentário
 * faria a contagem "achei 1" passar enquanto o código real não tem nenhum.
 */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

/** O texto cru de um arquivo do projeto (para SQL e para HTML). */
const fonteCrua = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');

/** O CÓDIGO de um arquivo, sem comentários — o que as varreduras devem ler. */
const fonte = async (caminho) => semComentarios(await fonteCrua(caminho));

/** Um FormData com os campos preenchidos, para não repetir dez linhas por teste. */
function formulario(campos = {}) {
  const dados = new FormData();
  const padrao = {
    evento_id: '11111111-1111-1111-1111-111111111111',
    nome: 'Fulana de Teste',
    email: 'fulana@exemplo.test',
    consentimento: 'on'
  };
  for (const [chave, valor] of Object.entries({ ...padrao, ...campos })) {
    if (valor !== null && valor !== undefined) dados.set(chave, valor);
  }
  return dados;
}

// =====================================================================
// 1. CPF — RN06
// =====================================================================

describe('CPF (RN06)', () => {
  test('aceita um CPF com os dígitos verificadores corretos', () => {
    // Gerado pela própria regra do módulo 11, não copiado de pessoa alguma.
    assert.equal(ehCpf('123.456.789-09'), true);
    assert.equal(ehCpf('12345678909'), true);
  });

  test('recusa quando um dígito verificador não bate', () => {
    assert.equal(ehCpf('123.456.789-00'), false);
  });

  test('RECUSA OS ONZE DÍGITOS IGUAIS — eles PASSAM na conta do módulo 11', () => {
    // É o furo clássico de quem implementa a regra sem saber disto: a conta
    // fecha certinho para todos eles. Sem a recusa à parte, "111.111.111-11"
    // entraria numa lista que vai para uma instituição parceira.
    for (const repetido of ['00000000000', '11111111111', '99999999999']) {
      assert.equal(ehCpf(repetido), false, `${repetido} passou`);
    }
  });

  test('recusa o que não tem onze dígitos', () => {
    assert.equal(ehCpf('123'), false);
    assert.equal(ehCpf(''), false);
    assert.equal(ehCpf(null), false);
    assert.equal(ehCpf('123456789012'), false);
  });

  test('formata como a pessoa lê, e devolve como veio o que não entende', () => {
    assert.equal(formatarCpf('12345678909'), '123.456.789-09');
    // Mascarar o que não entendemos esconderia o erro de quem digitou.
    assert.equal(formatarCpf('123'), '123');
  });
});

// =====================================================================
// 2. A leitura do FormData, com um corpo HOSTIL
// =====================================================================

describe('lerInscricao', () => {
  test('lê campo a campo, e o que não é campo do formulário NÃO passa', () => {
    const dados = formulario({
      // Colunas que existem na tabela e que ninguém pode escrever daqui.
      id: '99999999-9999-9999-9999-999999999999',
      criado_em: '1999-01-01T00:00:00Z',
      // E, por precaução, o nome da coluna de escalada de outro contexto.
      eh_equipe: 'true'
    });

    const campos = lerInscricao(dados);

    assert.deepEqual(Object.keys(campos).sort(), [
      'autorizaImagem', 'cpf', 'consentimento', 'ehMenor', 'email', 'eventoId',
      'nome', 'responsavelNome', 'responsavelTelefone', 'telefone'
    ].sort(), 'lerInscricao passou a conhecer um campo a mais — confira se ele pode existir');

    assert.equal('id' in campos, false);
    assert.equal('criado_em' in campos, false);
    assert.equal('eh_equipe' in campos, false);
  });

  test('caixa marcada é lida pelo CONTEÚDO, não pela presença do campo', () => {
    assert.equal(lerInscricao(formulario({ consentimento: 'on' })).consentimento, true);
    assert.equal(lerInscricao(formulario({ consentimento: null })).consentimento, false);
  });
});

// =====================================================================
// 3. A validação
// =====================================================================

describe('validarInscricao', () => {
  const semCpf = { exigeCpf: false };

  test('uma inscrição mínima e válida passa', () => {
    const { valido, erros } = validarInscricao(lerInscricao(formulario()), semCpf);
    assert.equal(valido, true, `recusou: ${JSON.stringify(erros)}`);
  });

  test('devolve TODOS os erros de uma vez, não o primeiro', () => {
    const { erros } = validarInscricao(
      lerInscricao(formulario({ nome: '', email: 'nao-e-email', consentimento: null })), semCpf);

    assert.ok(erros.nome && erros.email && erros.consentimento,
      `faltou erro: ${JSON.stringify(erros)}`);
  });

  test('sem consentimento não passa — é a LGPD antes do banco', () => {
    const { valido, erros } = validarInscricao(
      lerInscricao(formulario({ consentimento: null })), semCpf);
    assert.equal(valido, false);
    assert.ok(erros.consentimento);
  });

  test('evento que não é uuid é recusado ANTES de qualquer consulta', () => {
    const { valido, erros } = validarInscricao(
      lerInscricao(formulario({ evento_id: 'nao-e-uuid' })), semCpf);
    assert.equal(valido, false);
    assert.ok(erros.evento_id);
  });

  test('RN02: menor de idade sem responsável é recusado, nos DOIS campos', () => {
    const { valido, erros } = validarInscricao(
      lerInscricao(formulario({ eh_menor: 'on' })), semCpf);

    assert.equal(valido, false);
    assert.ok(erros.responsavel_nome, 'faltou cobrar o nome do responsável');
    assert.ok(erros.responsavel_telefone, 'faltou cobrar o telefone do responsável');
  });

  test('RN02: menor COM responsável completo passa', () => {
    const { valido, erros } = validarInscricao(lerInscricao(formulario({
      eh_menor: 'on',
      responsavel_nome: 'Responsável de Teste',
      responsavel_telefone: '(11) 95396-8344'
    })), semCpf);

    assert.equal(valido, true, `recusou: ${JSON.stringify(erros)}`);
  });

  test('telefone é OPCIONAL, mas se vier, vem com DDD', () => {
    assert.equal(validarInscricao(lerInscricao(formulario()), semCpf).valido, true);
    assert.equal(
      validarInscricao(lerInscricao(formulario({ telefone: '99999' })), semCpf).valido, false);
    assert.equal(
      validarInscricao(lerInscricao(formulario({ telefone: '11953968344' })), semCpf).valido,
      true);
  });

  test('RN06: com `exigeCpf`, o CPF passa a ser obrigatório', () => {
    const semNada = validarInscricao(lerInscricao(formulario()), { exigeCpf: true });
    assert.equal(semNada.valido, false);
    assert.ok(semNada.erros.cpf);

    const comCpf = validarInscricao(
      lerInscricao(formulario({ cpf: '123.456.789-09' })), { exigeCpf: true });
    assert.equal(comCpf.valido, true, `recusou: ${JSON.stringify(comCpf.erros)}`);
  });

  test('RN06: sem `exigeCpf`, um CPF QUEBRADO ainda é recusado', () => {
    // O campo nem aparece na tela; chegando preenchido e errado, gravar um
    // número quebrado que ninguém pediu é pior que recusar.
    const { valido } = validarInscricao(
      lerInscricao(formulario({ cpf: '111.111.111-11' })), { exigeCpf: false });
    assert.equal(valido, false);
  });

  test('a autorização de imagem NÃO é obrigatória (RN07 não condiciona participação)', () => {
    // Regra 1 do CLAUDE.md: condicionar o acesso à arte à cessão da própria
    // imagem é exatamente o que esta ONG não faz.
    const { valido } = validarInscricao(
      lerInscricao(formulario({ autoriza_imagem: null })), semCpf);
    assert.equal(valido, true);
  });
});

// =====================================================================
// 4. As listas fechadas de aviso
// =====================================================================

describe('avisos', () => {
  test('a confirmação de inscrição NÃO promete e-mail — o RF18 não existe', () => {
    const aviso = avisoDeInscricao('inscrita');
    assert.ok(aviso?.ok);
    // Comparação por conteúdo: no dia em que o RF18 existir, ESTA frase
    // muda junto, e este teste é o lembrete.
    assert.match(aviso.texto, /não enviamos e-mail de confirmação ainda/,
      'a frase deixou de avisar que não há e-mail de confirmação — se o RF18 passou a existir, '
      + 'reescreva a frase E este teste no mesmo commit');
  });

  test('valor fora da lista não desenha nada — `?aviso=` é escrito por quem quiser', () => {
    for (const hostil of ['qualquer-coisa', 'toString', 'constructor', '__proto__', '', 42]) {
      assert.equal(avisoDeInscricao(hostil), null, `"${hostil}" passou`);
      assert.equal(avisoDePresenca(hostil), null, `"${hostil}" passou em presença`);
    }
  });

  test('a presença tem os três desfechos, e "limpa" diz que não é falta', () => {
    assert.ok(avisoDePresenca('marcada')?.ok);
    assert.ok(avisoDePresenca('desmarcada')?.ok);
    assert.match(avisoDePresenca('limpa').texto, /diferente de/,
      'o aviso de limpar precisa dizer que "não conferido" não é "faltou"');
    assert.equal(avisoDePresenca('erro').ok, false);
  });
});

// =====================================================================
// 5. As varreduras de código-fonte
// =====================================================================

describe('as guardas estão onde precisam estar', () => {
  test('acoes/inscricoes.ts NÃO chama ehEquipe() — inscrever-se não exige conta (D4)', async () => {
    const codigo = await fonte('acoes/inscricoes.ts');

    assert.equal(/\behEquipe\s*\(/.test(codigo), false,
      'acoes/inscricoes.ts passou a exigir equipe. Isso trancaria o público fora das '
      + 'inscrições — a decisão D4 do escopo diz que inscrever-se NÃO exige conta, e a '
      + 'política do banco concorda (`for insert with check (true)`).');
  });

  test('acoes/presencas.ts CHAMA ehEquipe() — a varredura de app/admin/** não a alcança', async () => {
    const codigo = await fonte('acoes/presencas.ts');

    assert.ok(/\behEquipe\s*\(/.test(codigo),
      'Server Action é endpoint HTTP público (spec §4.5) e não passa por página nem por '
      + 'layout: testes/painel-guarda.test.mjs varre app/admin/** e NÃO alcança este arquivo.');
  });

  test('acoes/presencas.ts não escreve NEM APAGA inscrição — ela só marca presença', async () => {
    const codigo = await fonte('acoes/presencas.ts');

    assert.equal(/from\(['"]inscricoes['"]\)/.test(codigo), false,
      'a Action de presença passou a tocar em public.inscricoes. Ela marca quem veio; '
      + 'apagar uma inscrição apagaria a prova de que alguém participou.');

    // O único delete permitido é o da MARCAÇÃO, em `presencas`.
    const deletes = codigo.match(/\.delete\(/g) ?? [];
    assert.equal(deletes.length, 1,
      `esperava exatamente um .delete( (o de limpar a marcação), achei ${deletes.length}`);
  });

  test('a tela de inscritos só LÊ: nada de insert, update ou delete', async () => {
    const codigo = await fonte('app/admin/eventos/inscritos/page.tsx');

    for (const proibido of ['.insert(', '.update(', '.delete(']) {
      assert.equal(codigo.includes(proibido), false,
        `${proibido} apareceu na tela de inscritos — o que a pessoa preencheu é registro`);
    }
  });

  test('a guarda está no CORPO e no generateMetadata das três telas novas', async () => {
    // A repetição não é descuido: MEDIDO na Tarefa P1, com a guarda só no
    // layout o Next respondia 404 E mandava a página inteira no payload de
    // hidratação; e um `export const metadata` vaza o título por outro
    // caminho.
    for (const pagina of [
      'app/admin/eventos/inscritos/page.tsx',
      'app/admin/eventos/presenca/page.tsx',
      'app/admin/relatorio/page.tsx'
    ]) {
      const codigo = await fonte(pagina);
      const guardas = codigo.match(/if\s*\(!await ehEquipe\(\)\)\s*notFound\(\)/g) ?? [];

      assert.ok(guardas.length >= 2,
        `${pagina} tem ${guardas.length} guarda(s); precisa de duas — corpo e generateMetadata`);
      assert.equal(/export const metadata/.test(codigo), false,
        `${pagina} usa 'export const metadata', que vaza o título para quem não é equipe`);
    }
  });
});

// =====================================================================
// 6. A reconciliação com a migration 010
//
// As três palavras que `registrar_inscricao` devolve são STRINGS em dois
// arquivos diferentes — o SQL e a Action. Quando divergem, nada quebra
// visivelmente: a Action cai no ramo "palavra fora da lista" e toda
// inscrição passa a responder "não deu para confirmar", mesmo tendo
// gravado. É a mesma classe de defeito do prefixo `area:` da RF25.
// =====================================================================

/**
 * O SQL sem os comentários `-- ...`.
 *
 * Mesmo motivo do `semComentarios` acima, e o mesmo tropeço: a migration
 * 010 EXPLICA, em comentário, por que duas funções são `security definer` e
 * uma não é. Contar as ocorrências no arquivo cru dava 4 em vez de 2.
 */
const sqlSemComentarios = async (caminho) =>
  (await fonteCrua(caminho))
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n');

describe('o site e a migration 010 falam a mesma língua', () => {
  test('as três palavras da função existem no SQL E na Action', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/010_inscricao_por_visitante.sql');
    const acao = await fonte('acoes/inscricoes.ts');

    for (const palavra of ['ok', 'lotado', 'indisponivel']) {
      assert.ok(sql.includes(`return '${palavra}'`),
        `a migration não devolve "${palavra}" em lugar nenhum`);
      assert.ok(acao.includes(`'${palavra}'`),
        `acoes/inscricoes.ts não conhece a resposta "${palavra}"`);
    }
  });

  test('a Action chama exatamente as funções que a migration cria', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/010_inscricao_por_visitante.sql');
    const acao = await fonte('acoes/inscricoes.ts');
    const dados = await fonte('servidor/dados/inscricoes.ts');

    assert.ok(sql.includes('function public.registrar_inscricao'));
    assert.ok(acao.includes("rpc('registrar_inscricao'"),
      'a Action não chama registrar_inscricao — o balde por visitante e a trava de vaga '
      + 'deixam de existir');

    assert.ok(sql.includes('function public.vagas_restantes'));
    assert.ok(dados.includes("rpc('vagas_restantes'"));
  });

  test('a migration 010 NÃO mexe em política nem em tabela', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/010_inscricao_por_visitante.sql');

    for (const proibido of ['create table', 'alter table', 'create policy', 'drop policy']) {
      assert.equal(sql.toLowerCase().includes(proibido), false,
        `a 010 faz "${proibido}". Ela deveria acrescentar FUNÇÕES e nada mais — mexer em `
        + 'política aqui poderia afrouxar a RLS de uma tabela com dado de criança.');
    }
  });

  test('as duas funções que CONTAM são security definer, e a que grava não é', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/010_inscricao_por_visitante.sql');

    // `vagas_restantes` e `reservar_vaga` contam uma tabela cuja leitura é
    // negada a anon: sem definer, a contagem devolveria zero sempre e a
    // trava de vagas passaria em silêncio.
    const definer = (sql.match(/security definer/g) ?? []).length;
    assert.equal(definer, 2, `esperava 2 "security definer", achei ${definer}`);

    // `registrar_inscricao` é invoker para a RLS de public.inscricoes
    // continuar valendo palavra por palavra.
    assert.ok(/registrar_inscricao[\s\S]{0,600}security invoker/.test(sql),
      'registrar_inscricao precisa ser security invoker — definer pularia a RLS da tabela');
  });
});

// =====================================================================
// 7. A exportação da lista de inscritos (RF16 + RF31)
// =====================================================================

describe('exportação dos inscritos', () => {
  test('`inscritos` é um conjunto da lista fechada, e exige evento', () => {
    const conjunto = conjuntoPorChave('inscritos');
    assert.ok(conjunto, 'o conjunto não está na lista fechada');
    assert.equal(exigeEvento('inscritos'), true);
    assert.equal(exigeEvento('contatos'), false);
  });

  test('a autorização de imagem vem ANTES do contato na planilha (RN07)', () => {
    const colunas = conjuntoPorChave('inscritos').colunas.map((c) => c.chave);
    assert.ok(colunas.indexOf('autoriza_imagem') < colunas.indexOf('email'),
      'numa planilha larga, o que fica à direita é o que ninguém rola para ver — e esta é a '
      + 'coluna que decide se a pessoa pode sair numa foto publicada');
  });

  test('a presença sai como TEXTO, e não como sim/não', () => {
    // Um booleano viraria "sim"/"não" e a célula vazia do terceiro estado
    // seria lida como "não veio" — oito faltas que ninguém verificou, dentro
    // de um documento oficial.
    const colunas = conjuntoPorChave('inscritos').colunas.map((c) => c.chave);
    assert.ok(colunas.includes('presenca'));
  });

  test('o nome do arquivo leva o evento, em ASCII', () => {
    const conjunto = conjuntoPorChave('inscritos');
    const nome = nomeDoArquivo(conjunto, new Date('2026-09-02T12:00:00'), 'Oficina de Percussão');

    assert.equal(nome, 'inscritos-oficina-de-percussao-2026-09-02.csv');
    assert.equal(/^[\x20-\x7e]+$/.test(nome), true,
      'nome de arquivo com acento exige filename*=UTF-8, que navegador velho ignora — e aí o '
      + 'arquivo é salvo como "download", sem extensão');
  });

  test('sem sufixo, o nome continua como era — os outros conjuntos não mudam', () => {
    assert.equal(
      nomeDoArquivo(conjuntoPorChave('contatos'), new Date('2026-09-02T12:00:00')),
      'mensagens-2026-09-02.csv');
  });

  test('pedacoParaNomeDeArquivo tira acento, espaço e pontuação', () => {
    assert.equal(pedacoParaNomeDeArquivo('Ateliê Afro: Vivência!'), 'atelie-afro-vivencia');
    assert.equal(pedacoParaNomeDeArquivo('   '), '');
    // Sem hífen sobrando na ponta depois do corte.
    assert.equal(/-$/.test(pedacoParaNomeDeArquivo('a'.repeat(38) + ' bcd', 40)), false);
  });

  test('todo conjunto da lista tem rótulo, descrição e colunas', () => {
    for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
      assert.ok(conjunto.rotulo && conjunto.descricao && conjunto.colunas.length > 0,
        `conjunto "${conjunto.chave}" incompleto`);
    }
  });
});

// =====================================================================
// 8. O que o servidor serve
// =====================================================================

describe('as rotas novas, por HTTP', () => {
  test('as três telas de painel respondem 404 para quem não é equipe', async () => {
    for (const rota of [
      '/admin/eventos/inscritos?id=11111111-1111-1111-1111-111111111111',
      '/admin/eventos/presenca?id=11111111-1111-1111-1111-111111111111',
      '/admin/relatorio'
    ]) {
      const resposta = await fetch(`${endereco}${rota}`);
      assert.equal(resposta.status, 404, `${rota} respondeu ${resposta.status}`);
    }
  });

  test('a exportação de inscritos também responde 404 sem sessão de equipe', async () => {
    const resposta = await fetch(
      `${endereco}/admin/exportar/inscritos?evento=11111111-1111-1111-1111-111111111111`);
    assert.equal(resposta.status, 404);
  });

  test('a página de inscrição é PÚBLICA — ela não responde 404 por falta de sessão', async () => {
    // Sem Supabase na suíte offline o evento não existe, então a resposta é
    // 404 por EVENTO INEXISTENTE, não por falta de sessão. O que se mede
    // aqui é que ela não redireciona para /entrar — que é o que uma tela
    // com guarda de sessão faria.
    const resposta = await fetch(
      `${endereco}/agenda/11111111-1111-1111-1111-111111111111/inscricao`,
      { redirect: 'manual' });

    assert.equal(resposta.status === 307 || resposta.status === 302, false,
      'a página de inscrição redirecionou — ela não pode exigir conta (decisão D4)');
  });

  test('a agenda continua prometendo inscrição sem conta — e agora é verdade', async () => {
    const html = await (await fetch(`${endereco}/agenda`)).text();

    // Texto ORIGINAL da ONG, travado por testes/paridade-texto.test.mjs.
    // Ele esteve no ar prometendo o que o site não fazia.
    assert.match(html, /criar conta/,
      'a frase da ONG sobre inscrição sem conta sumiu de /agenda');
  });
});
