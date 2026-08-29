/**
 * O dado exibido veio do BANCO ou do JSON versionado? — e a resposta precisa
 * ser verificavel de fora.
 *
 * CRITICO 1 da revisao final da fase 1. servidor/dados/conteudo.ts tem fonte
 * dupla de proposito: sem Supabase configurado le dados-iniciais/*.json, com
 * Supabase consulta a tabela, e em QUALQUER falha da consulta cai de volta
 * para o JSON — rede de seguranca correta, porque banco fora do ar nao pode
 * derrubar a pagina institucional da ONG.
 *
 * O defeito era a falha ser INDISTINGUIVEL do sucesso. As duas fontes
 * carregam o mesmo conteudo real (ferramentas/gerar-seed.mjs gera o seed.sql
 * a partir dos mesmos JSON): medido contra o banco de verdade, sao os mesmos
 * 11 ids de atividades e os mesmos 14 de clipping, sem sobra de nenhum lado.
 * Chave errada, grant faltando, politica de RLS apertada demais, coluna
 * renomeada ou rede fora produziam uma pagina IDENTICA a pagina certa. Dava
 * para publicar com o Supabase configurado, servindo JSON o tempo todo, e
 * ninguem saber.
 *
 * A distincao passou a ser observavel em tres lugares, e este arquivo cobre
 * os tres:
 *   1. `origem` no retorno de listarAtividadesComOrigem()/
 *      listarClippingComOrigem();
 *   2. `carimbo` — o maior `criado_em` das linhas. `criado_em` existe na
 *      tabela (supabase/migrations/002_conteudo.sql) e NAO existe em nenhum
 *      JSON: e um dado que o caminho local nao teria como fabricar, o que
 *      impede `origem` de ser so uma palavra em que se acredita;
 *   3. `data-origem-clipping` no <main> de /para-escolas — visivel no
 *      codigo-fonte da pagina, sem ferramenta nenhuma.
 *
 * TRES MODOS, um por cenario (ver ferramentas/rodar-testes.mjs):
 *   - `npm test`                       -> sem Supabase        -> espera "json"
 *   - `npm run test:supabase`          -> credenciais reais   -> espera "banco"
 *   - `npm run test:supabase-degradado`-> chave errada        -> espera "json"
 *
 * O terceiro e o que fecha o buraco: prova que "configurado e falhando"
 * deixou de ser igual a "configurado e funcionando".
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerEnvLocal } from './apoio/env-local.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const chaveErrada = process.env.COM_SUPABASE === 'chave-errada';
const comCredenciais = process.env.COM_SUPABASE === '1';
const offline = !chaveErrada && !comCredenciais;

/** Origem esperada do conteudo neste modo. */
const ORIGEM_ESPERADA = comCredenciais ? 'banco' : 'json';

const clippingLocal = JSON.parse(
  readFileSync(new URL('../dados-iniciais/clipping.json', import.meta.url), 'utf8')
);
const atividadesLocais = JSON.parse(
  readFileSync(new URL('../dados-iniciais/atividades.json', import.meta.url), 'utf8')
);

async function diagnostico() {
  const resposta = await fetch(`${BASE}/diagnostico/origem-dos-dados`);
  return { status: resposta.status, corpo: resposta.status === 200 ? await resposta.json() : null };
}

async function htmlParaEscolas() {
  const resposta = await fetch(`${BASE}/para-escolas`);
  assert.equal(resposta.status, 200, '/para-escolas nao respondeu 200');
  return resposta.text();
}

function origemDoHtml(html) {
  return html.match(/<main[^>]*data-origem-clipping="([^"]*)"/)?.[1] ?? null;
}

// ---------------------------------------------------------------------
// Vale nos tres modos
// ---------------------------------------------------------------------

test('a pagina diz de onde veio o clipping, e diz o que este modo espera', async () => {
  const origem = origemDoHtml(await htmlParaEscolas());
  assert.ok(origem, 'o <main> de /para-escolas nao carrega data-origem-clipping');
  assert.equal(
    origem, ORIGEM_ESPERADA,
    `neste modo o conteudo deveria vir de "${ORIGEM_ESPERADA}" e veio de "${origem}"`
  );
});

test('o conteudo real aparece na pagina, venha de onde vier', async () => {
  // A rede de seguranca so vale se a pagina continuar CERTA nos tres
  // cenarios. Um titulo real de instituicao/programacao precisa estar la
  // com o banco no ar, com o banco fora, e sem banco nenhum.
  const html = await htmlParaEscolas();
  const instituicoes = clippingLocal.filter(
    (r) => r.tipo === 'instituicao' || r.tipo === 'programacao'
  );
  if (instituicoes.length === 0) return; // sem dado, a secao some de proposito
  assert.ok(
    instituicoes.some((r) => html.includes(r.titulo)),
    'nenhum titulo real apareceu em /para-escolas'
  );
});

test('nenhum JSON de dados-iniciais tem criado_em — e por isso que o carimbo prova a procedencia', () => {
  // Se um dia esses arquivos passarem a carregar criado_em, `carimbo` deixa
  // de ser prova de nada e este arquivo precisa de outro sinal. Melhor
  // descobrir por um teste vermelho do que por um falso verde.
  for (const registro of [...atividadesLocais, ...clippingLocal]) {
    assert.ok(
      !('criado_em' in registro),
      `${registro.id} tem criado_em no JSON: o carimbo deixou de distinguir banco de JSON`
    );
  }
});

// ---------------------------------------------------------------------
// Modo offline (padrao do `npm test`)
// ---------------------------------------------------------------------

describe('sem Supabase configurado', { skip: offline ? false : 'so no modo offline' }, () => {
  test('a rota de diagnostico fica fechada quando ninguem a abre', async () => {
    // DIAGNOSTICO_ORIGEM_DOS_DADOS nao existe aqui, nem existe em producao:
    // fechada e o estado padrao, e e este teste que garante que continua
    // sendo. Se a rota respondesse 200 sem a variavel, um endpoint de
    // diagnostico interno estaria publico no site da ONG.
    const { status } = await diagnostico();
    assert.equal(status, 404, `a rota de diagnostico respondeu ${status} sem a variavel de ambiente`);
  });
});

// ---------------------------------------------------------------------
// Modo com credenciais reais
// ---------------------------------------------------------------------

describe(
  'com as credenciais reais do Supabase',
  { skip: comCredenciais ? false : 'so com COM_SUPABASE=1' },
  () => {
    test('listarAtividades e listarClipping devolvem "banco", com carimbo do Postgres', async () => {
      const { status, corpo } = await diagnostico();
      assert.equal(status, 200, 'a rota de diagnostico deveria estar aberta neste modo');

      for (const [nome, resumo] of Object.entries(corpo)) {
        assert.equal(resumo.origem, 'banco',
          `${nome}: caiu para o JSON com credencial valida — ver o aviso no log do servidor`);
        assert.ok(resumo.quantidade > 0, `${nome}: o banco devolveu lista vazia`);
        assert.ok(resumo.carimbo,
          `${nome}: sem carimbo. criado_em so existe na tabela; sem ele, "banco" e palavra sem lastro`);
        assert.ok(!Number.isNaN(Date.parse(resumo.carimbo)),
          `${nome}: carimbo nao e uma data ISO: ${resumo.carimbo}`);
      }
    });

    test('o que a pagina serve bate com uma consulta feita por fora do Next', async () => {
      // Prova independente: este teste fala com o PostgREST direto, com a
      // mesma chave anonima, sem passar pelo app. Se a camada de dados
      // estivesse servindo JSON e mentindo no campo `origem`, as duas listas
      // continuariam iguais (os JSON espelham o seed) — por isso a igualdade
      // sozinha nao bastaria; ela vale junto com o carimbo do teste acima,
      // que o JSON nao tem como produzir.
      const env = { ...lerEnvLocal(), ...process.env };
      const url = env.SUPABASE_URL;
      const chave = env.SUPABASE_CHAVE_PUBLICAVEL;
      assert.ok(url && chave, 'sem credencial para a consulta direta');

      const { corpo } = await diagnostico();

      for (const [tabela, campo] of [['atividades', 'atividades'], ['clipping', 'clipping']]) {
        const direto = await fetch(
          `${url.replace(/\/$/, '')}/rest/v1/${tabela}?select=id&order=titulo`,
          { headers: { apikey: chave, Authorization: `Bearer ${chave}` } }
        );
        assert.equal(direto.status, 200, `consulta direta a ${tabela} respondeu ${direto.status}`);
        const ids = (await direto.json()).map((linha) => linha.id);

        assert.deepEqual(
          corpo[campo].ids, ids,
          `${tabela}: a lista servida pelo app difere da lista que o PostgREST devolve`
        );
      }
    });
  }
);

// ---------------------------------------------------------------------
// Modo degradado: Supabase configurado, consulta falhando
// ---------------------------------------------------------------------

describe(
  'com o Supabase configurado e a consulta falhando',
  { skip: chaveErrada ? false : 'so com COM_SUPABASE=chave-errada' },
  () => {
    test('a pagina continua no ar e diz que caiu para o JSON', async () => {
      // ESTE e o teste que o CRITICO 1 pedia. Antes da correcao, este modo
      // produzia uma pagina byte a byte igual a do modo com credenciais
      // validas, e nenhum teste no projeto conseguia notar a diferenca.
      const origem = origemDoHtml(await htmlParaEscolas());
      assert.equal(
        origem, 'json',
        'com a chave errada a pagina deveria declarar que caiu para o JSON'
      );
    });

    test('o diagnostico reporta json e carimbo nulo nas duas listas', async () => {
      const { status, corpo } = await diagnostico();
      assert.equal(status, 200, 'a rota de diagnostico deveria estar aberta neste modo');

      for (const [nome, resumo] of Object.entries(corpo)) {
        assert.equal(resumo.origem, 'json', `${nome}: deveria ter caido para o JSON`);
        assert.equal(resumo.carimbo, null, `${nome}: carimbo so existe quando a origem e o banco`);
        assert.ok(resumo.quantidade > 0, `${nome}: a rede de seguranca devolveu lista vazia`);
      }
    });
  }
);
