/**
 * Mural de avisos (RF27) e mensagem para grupo (RF28).
 *
 * ===================================================================
 * O REQUISITO MAIS PERIGOSO DO PROJETO, E POR QUÊ
 * ===================================================================
 *
 * Todo o resto do painel é reversível. Tirar do ar devolve, editar
 * regrava, apagar uma foto tem tela de confirmação. **E-mail enviado não
 * volta** — e o RF28 manda para um GRUPO.
 *
 * Por isso a maior parte deste arquivo não mede o caminho feliz: mede as
 * RECUSAS e as SEPARAÇÕES. Que rascunho não sai. Que o texto não viaja no
 * payload. Que o grupo é lista fechada. Que escrever, publicar e enviar são
 * três gestos, e não um.
 *
 * A metade do BANCO está em `npm run rls` (bloco "RF27", 9 testes): que
 * `anon` não alcança, que conta comum sem candidatura não lê, e — o que
 * mais paga — que candidatura `novo` NÃO basta. Qualquer pessoa com conta
 * se candidata em /voluntariado/candidatura; se 'novo' contasse, preencher
 * um formulário daria acesso à comunicação interna da ONG.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { lerAviso, validarAviso, colunasDoAviso } from '../compartilhado/validacao.ts';
import { avisoDoMural } from '../compartilhado/avisos-do-painel.ts';
import {
  GRUPOS_DE_AVISO, grupoPorChave, ehChaveDeGrupo
} from '../compartilhado/grupos-de-aviso.ts';

const endereco = process.env.URL_BASE || 'http://localhost:3123';

function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

const fonteCrua = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const fonte = async (caminho) => semComentarios(await fonteCrua(caminho));
const sqlSemComentarios = async (caminho) =>
  (await fonteCrua(caminho)).split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

function formulario(campos = {}) {
  const dados = new FormData();
  for (const [k, v] of Object.entries({ titulo: 'Aviso', corpo: 'Texto', ...campos })) {
    if (v !== null && v !== undefined) dados.set(k, v);
  }
  return dados;
}

// =====================================================================
// 1. O que é um aviso válido
// =====================================================================

describe('validarAviso', () => {
  test('título e corpo são obrigatórios, e os erros vêm todos de uma vez', () => {
    const { valido, erros } = validarAviso(lerAviso(formulario({ titulo: '', corpo: '' })));
    assert.equal(valido, false);
    assert.ok(erros.titulo && erros.corpo, `faltou erro: ${JSON.stringify(erros)}`);
  });

  test('sem `id` é aviso NOVO, e isso não é erro', () => {
    const { valido } = validarAviso(lerAviso(formulario()));
    assert.equal(valido, true);
  });

  test('`id` que não é uuid é recusado', () => {
    const { valido, erros } = validarAviso(lerAviso(formulario({ id: 'nao-e-uuid' })));
    assert.equal(valido, false);
    assert.ok(erros.id);
  });

  test('O OBJETO QUE VAI AO BANCO NÃO CONHECE `publicado` — escrever não é publicar', () => {
    // É a trava central do RF27: `salvarAviso` não pode publicar nem por
    // acidente. Num mural INTERNO o descuido põe texto na frente de gente
    // que ainda não devia ver.
    const colunas = colunasDoAviso(lerAviso(formulario({
      publicado: 'true', publicado_em: '2020-01-01', id: '11111111-1111-1111-1111-111111111111'
    })));

    assert.deepEqual(Object.keys(colunas).sort(), ['corpo', 'titulo']);
    assert.equal('publicado' in colunas, false,
      'colunasDoAviso passou a conhecer `publicado`: salvarAviso poderia publicar sozinha');
    assert.equal('publicado_em' in colunas, false);
    assert.equal('id' in colunas, false,
      '`id` no objeto do insert deixaria escolher o id de uma linha nova pelo corpo da requisição');
  });
});

// =====================================================================
// 2. Os grupos — lista fechada
// =====================================================================

describe('grupos de aviso (RF28)', () => {
  test('valor fora da lista não é grupo nenhum', () => {
    for (const hostil of ['todos', 'toString', '__proto__', '', 42, null,
      "perfis' or '1'='1"]) {
      assert.equal(ehChaveDeGrupo(hostil), false, `"${hostil}" passou`);
      assert.equal(grupoPorChave(hostil), null, `"${hostil}" devolveu grupo`);
    }
  });

  test('NENHUM grupo alcança "todo mundo"', () => {
    // Um botão que manda e-mail para todas as pessoas que já tocaram no
    // site é o botão que ninguém deveria ter num celular, de pé.
    const suspeitos = GRUPOS_DE_AVISO.filter((g) =>
      /todos|todo mundo|geral|base/i.test(`${g.chave} ${g.rotulo}`));
    assert.deepEqual(suspeitos, [], 'apareceu um grupo que alcança todo mundo');
  });

  test('todo grupo diz quem está dentro, para quem vai apertar o botão', () => {
    for (const grupo of GRUPOS_DE_AVISO) {
      assert.ok(grupo.rotulo && grupo.descricao, `grupo "${grupo.chave}" sem texto`);
      assert.equal(typeof grupo.exigeEvento, 'boolean');
    }
  });

  test('o grupo de voluntários DIZ que só alcança quem está ativo', () => {
    // Se a frase não disser isso, a equipe manda achando que alcança quem
    // se candidatou — e conclui que o envio falhou.
    assert.match(grupoPorChave('voluntarios').descricao, /ATIVA|ativa/,
      'a descrição precisa dizer que "nova" e "em contato" não recebem');
  });
});

// =====================================================================
// 3. As frases da tela
// =====================================================================

describe('avisos da tela', () => {
  test('publicar DIZ que não enviou e-mail — os dois gestos são vizinhos', () => {
    assert.match(avisoDoMural('publicado').texto, /NÃO foi enviado por e-mail|não foi enviado/i,
      'sem esta frase, a equipe publica e acha que mandou');
  });

  test('tirar do mural DIZ que o e-mail já enviado não volta', () => {
    assert.match(avisoDoMural('retirado').texto, /não dá para desfazer|continua com o e-mail/i);
  });

  test('as duas RECUSAS explicam, em vez de sumir em silêncio', () => {
    // Um botão que não faz nada sem dizer por quê é o começo de apertar
    // várias vezes — e este é o botão errado para se apertar várias vezes.
    assert.equal(avisoDoMural('rascunho-nao-envia').ok, false);
    assert.match(avisoDoMural('rascunho-nao-envia').texto, /[Pp]ublique/);
    assert.equal(avisoDoMural('sem-evento').ok, false);
    assert.match(avisoDoMural('sem-evento').texto, /evento/i);
  });

  test('a falha de envio DIZ que ninguém recebeu nada', () => {
    assert.match(avisoDoMural('envio-falhou').texto, /ninguém recebeu/i,
      'sem isso, a equipe não sabe se pode tentar de novo');
  });

  test('valor fora da lista não desenha nada', () => {
    for (const hostil of ['qualquer', 'toString', '__proto__', '', 7]) {
      assert.equal(avisoDoMural(hostil), null, `"${hostil}" passou`);
    }
  });
});

// =====================================================================
// 4. As varreduras
// =====================================================================

describe('as travas do código', () => {
  test('toda Action de avisos chama ehEquipe() sozinha', async () => {
    const codigo = await fonte('acoes/avisos.ts');
    const guardas = codigo.match(/if \(!await ehEquipe\(\)\)/g) ?? [];
    const actions = codigo.match(/export async function \w+/g) ?? [];

    assert.equal(guardas.length, actions.length,
      `${actions.length} Actions e ${guardas.length} guardas. Server Action é endpoint HTTP `
      + 'público (spec §4.5) e não passa por página nem por layout.');
  });

  test('salvarAviso NÃO toca em `publicado` — nem para gravar false', async () => {
    const codigo = await fonte('acoes/avisos.ts');
    const salvar = codigo.slice(codigo.indexOf('export async function salvarAviso'),
      codigo.indexOf('export async function alternarAviso'));

    assert.equal(/publicado/.test(salvar), false,
      'salvarAviso menciona `publicado`: escrever voltou a poder publicar');
  });

  test('enviarAviso RECUSA rascunho — a rede embaixo do botão', async () => {
    const codigo = await fonte('acoes/avisos.ts');
    assert.ok(/!aviso\.publicado/.test(codigo),
      'a Action de envio não confere se o aviso está publicado');
  });

  test('o TEXTO do aviso NÃO viaja para a Edge Function', async () => {
    // É a regra inteira da spec §9. Se `titulo` ou `corpo` aparecerem no
    // objeto mandado a `avisar()`, este endpoint vira um jeito de mandar
    // qualquer coisa para uma lista, em nome do domínio da ONG.
    const codigo = await fonte('acoes/avisos.ts');
    const chamada = codigo.slice(codigo.indexOf('avisar({'), codigo.indexOf('avisar({') + 300);

    assert.equal(/titulo|corpo/.test(chamada), false,
      `o texto do aviso está sendo mandado à Edge Function: ${chamada.slice(0, 160)}`);
  });

  test('o tipo do pedido de e-mail não tem campo de texto em variante nenhuma', async () => {
    const codigo = await fonte('servidor/email.ts');
    const tipo = codigo.slice(codigo.indexOf('export type PedidoDeEmail'),
      codigo.indexOf('export async function avisar'));

    for (const proibido of ['assunto', 'corpo', 'texto', 'html', 'destinatario']) {
      assert.equal(tipo.includes(proibido), false,
        `PedidoDeEmail ganhou um campo "${proibido}" — a função passaria a aceitar conteúdo`);
    }
  });

  test('a Edge Function recusa rascunho e não aceita texto no payload', async () => {
    const codigo = await fonteCrua('supabase/functions/enviar-email/index.ts');

    assert.ok(codigo.includes('aviso_nao_publicado'),
      'a função não recusa rascunho — é a rede embaixo da recusa da Action');
    assert.ok(codigo.includes("from('avisos')"),
      'a função não busca o aviso no banco: ela estaria confiando no payload');
  });

  test('o aviso vai UM E-MAIL POR PESSOA, nunca uma lista no mesmo `to`', async () => {
    // `to: [todos]` mostraria o endereço de cada pessoa para todas as
    // outras — um vazamento em massa feito pela própria ONG.
    const codigo = await fonte('supabase/functions/enviar-email/index.ts');
    assert.ok(codigo.includes('emails/batch'),
      'o envio para grupo precisa usar o batch, que manda N mensagens separadas');
    assert.ok(/to: \[email\]/.test(codigo),
      'cada mensagem do lote precisa ter um destinatário só');
  });

  test('as três telas novas têm a guarda no corpo E no generateMetadata', async () => {
    for (const pagina of ['app/admin/avisos/page.tsx', 'app/admin/avisos/editar/page.tsx']) {
      const codigo = await fonte(pagina);
      const guardas = codigo.match(/if \(!await ehEquipe\(\)\) notFound\(\)/g) ?? [];
      assert.ok(guardas.length >= 2, `${pagina} tem ${guardas.length} guarda(s), precisa de 2`);
      assert.equal(/export const metadata/.test(codigo), false,
        `${pagina} usa 'export const metadata', que vaza o título`);
    }
  });

  test('o mural público recusa com REDIRECT, não com 404', async () => {
    const codigo = await fonte('app/avisos/page.tsx');
    assert.ok(/redirect\('\/entrar/.test(codigo),
      'quem chega sem sessão precisa ir para /entrar — um 404 esconderia o mural de quem tem '
      + 'direito a ele');
    assert.equal(/notFound\(\)/.test(codigo), false,
      'o mural não é segredo: que o Ateliê tem voluntariado está em /voluntariado, público');
  });
});

// =====================================================================
// 5. A migration 012
// =====================================================================

describe('a migration 012 diz o mesmo que o site', () => {
  test('a política NÃO tem nenhuma forma de `publicado` sozinho', async () => {
    // É a diferença para `publicacoes`, onde `publicado` significa "o mundo
    // vê". Um aviso publicado precisa continuar invisível para quem não é
    // voluntário ativo nem equipe.
    const sql = await sqlSemComentarios('supabase/migrations/012_avisos.sql');
    const politica = sql.slice(sql.indexOf('avisos: voluntario ativo'),
      sql.indexOf('avisos: equipe gerencia'));

    assert.ok(politica.includes('eh_voluntario_ativo()'));
    assert.equal(/using \(publicado\)/.test(politica), false,
      'a política deixou `publicado` sozinho: o aviso interno virou público');
  });

  test('`anon` não recebe grant nenhum em avisos', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/012_avisos.sql');
    const grants = sql.split('\n').filter((l) => l.trim().startsWith('grant'));

    for (const linha of grants) {
      assert.equal(/\banon\b/.test(linha), false,
        `um grant alcança anon: ${linha.trim()} — é a trava ANTES da RLS`);
    }
  });

  test('eh_voluntario_ativo() é security definer e olha SÓ `ativo`', async () => {
    const sql = await sqlSemComentarios('supabase/migrations/012_avisos.sql');
    const funcao = sql.slice(sql.indexOf('function public.eh_voluntario_ativo'),
      sql.indexOf('revoke all on function public.eh_voluntario_ativo'));

    assert.ok(funcao.includes('security definer'),
      'sem definer, a política em `voluntarios` entraria em recursão');
    assert.ok(funcao.includes("situacao = 'ativo'"));
    assert.equal(/'novo'|'em_contato'/.test(funcao), false,
      'preencher o formulário de candidatura passou a dar acesso à comunicação interna');
  });

  test('o site chama a MESMA função do banco que a política chama', async () => {
    // Comparar `situacao === "ativo"` no JavaScript criaria uma segunda
    // definição de "voluntário ativo", e as duas divergiriam em silêncio.
    const codigo = await fonte('servidor/permissao.ts');
    assert.ok(codigo.includes("rpc('eh_voluntario_ativo')"));
  });
});

// =====================================================================
// 6. O que o servidor serve
// =====================================================================

describe('as rotas novas, por HTTP', () => {
  test('as telas de aviso do painel respondem 404 para quem não é equipe', async () => {
    for (const rota of ['/admin/avisos', '/admin/avisos/editar']) {
      const resposta = await fetch(`${endereco}${rota}`);
      assert.equal(resposta.status, 404, `${rota} respondeu ${resposta.status}`);
    }
  });

  test('o mural manda para /entrar quem chega sem sessão', async () => {
    const resposta = await fetch(`${endereco}/avisos`, { redirect: 'manual' });
    assert.ok([302, 303, 307].includes(resposta.status),
      `esperava um redirect, veio ${resposta.status}`);
    assert.match(resposta.headers.get('location') ?? '', /\/entrar/);
  });

  test('o mural NÃO aparece no menu — ele é interno', async () => {
    const html = await (await fetch(`${endereco}/`)).text();
    const menu = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.equal(menu.includes('href="/avisos"'), false,
      'o mural entrou no menu: o menu é o mesmo para toda visita, e para a maioria aquele '
      + 'item só redirecionaria');
  });
});
