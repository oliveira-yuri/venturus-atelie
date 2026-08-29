/**
 * ACEITE BLOQUEANTE — seção 12 e seção 14 do documento de escopo.
 *
 * Com a anon key e SEM estar autenticado, tentar ler as tabelas que guardam
 * dados pessoais. O resultado precisa ser vazio em todas.
 *
 * Enquanto este teste não passar, o sistema não vai ao ar.
 *
 * Por que isto existe: o site é estático, então a anon key aparece no
 * código-fonte para qualquer visitante. Não há servidor no meio. A única
 * coisa entre um DevTools aberto e a lista completa de crianças inscritas é
 * a Row Level Security. Este arquivo é a prova de que ela está no lugar.
 *
 * Executar com: node --test testes/seguranca.test.mjs
 * Requer SUPABASE_URL e SUPABASE_CHAVE_PUBLICAVEL no ambiente, ou em
 * .env.local (não versionado — ver servidor/supabase.ts).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Carrega .env.local no process.env, se as variáveis ainda não estiverem
 * definidas.
 *
 * Precisa ser SÍNCRONO e rodar no topo do módulo, antes do describe() lá
 * embaixo: o `skip` do describe é avaliado antes de qualquer before()
 * rodar, então um carregamento assíncrono deixaria o aceite pulando mesmo
 * com o projeto configurado — foi exatamente assim que este teste ficou
 * silenciosamente pulado uma vez. `next dev`/`next build` carregam
 * .env.local sozinhos; um `node --test` direto neste arquivo, não.
 */
function carregarEnvLocal() {
  let bruto;
  try {
    bruto = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    return;
  }

  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const posicaoIgual = limpa.indexOf('=');
    if (posicaoIgual === -1) continue;
    const chave = limpa.slice(0, posicaoIgual).trim();
    const valor = limpa.slice(posicaoIgual + 1).trim();
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

carregarEnvLocal();

/** Tabelas cuja leitura sem autenticação precisa voltar vazia. */
const PROTEGIDAS = ['inscricoes', 'voluntarios', 'doacoes', 'contatos', 'presencas'];

/** Tabelas cuja leitura pública é intencional — o site depende delas. */
const PUBLICAS = ['atividades', 'clipping', 'eventos', 'publicacoes', 'acervo'];

/** Colunas que jamais podem aparecer numa resposta não autenticada. */
const COLUNAS_SENSIVEIS = ['email', 'telefone', 'cpf', 'responsavel_nome', 'responsavel_telefone'];

/**
 * Lê a configuração de forma SÍNCRONA, no carregamento do módulo (mesmo
 * motivo do carregarEnvLocal() acima: o skip do describe roda antes de
 * qualquer before()).
 *
 * site/config.js deixou de existir com a migração para Next.js — a página
 * agora fala com o Supabase só do servidor, via servidor/supabase.ts, que lê
 * as mesmas duas variáveis de ambiente.
 */
function lerConfiguracao() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL) {
    return { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_CHAVE_PUBLICAVEL };
  }

  return null;
}

const configuracao = lerConfiguracao();

/**
 * Consulta o PostgREST diretamente, sem supabase-js.
 *
 * De propósito: este teste precisa imitar o que uma pessoa faria com a anon
 * key na mão e o DevTools aberto — uma requisição HTTP crua. Uma biblioteca
 * no meio poderia mascarar o que a API realmente devolve.
 */
async function lerSemAutenticar(tabela) {
  const resposta = await fetch(
    `${configuracao.url}/rest/v1/${tabela}?select=*&limit=100`,
    {
      headers: {
        apikey: configuracao.chave,
        Authorization: `Bearer ${configuracao.chave}`
      }
    }
  );

  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}

describe('acesso indevido às tabelas com dados pessoais', { skip: skipSemConfiguracao() }, () => {
  for (const tabela of PROTEGIDAS) {
    test(`${tabela}: leitura sem autenticação volta vazia`, async () => {
      const { status, corpo } = await lerSemAutenticar(tabela);

      // 200 com lista vazia é o resultado esperado: a política filtra tudo.
      // 401, 403 ou 404 também protegem, e são aceitáveis.
      if (status === 200) {
        assert.ok(Array.isArray(corpo), `${tabela}: resposta não é lista`);
        assert.equal(corpo.length, 0,
          `VAZAMENTO: ${tabela} devolveu ${corpo.length} registros sem autenticação`);
      } else {
        assert.ok([401, 403, 404].includes(status),
          `${tabela}: status inesperado ${status}`);
      }
    });
  }

  test('nenhum dado pessoal aparece em qualquer tabela pública', async () => {
    // Uma política mal escrita numa tabela pública pode expor dados por junção
    // ou por coluna esquecida. Varre o que é legitimamente público.
    for (const tabela of PUBLICAS) {
      const { status, corpo } = await lerSemAutenticar(tabela);
      if (status !== 200 || !Array.isArray(corpo) || corpo.length === 0) continue;

      for (const registro of corpo) {
        for (const coluna of COLUNAS_SENSIVEIS) {
          assert.ok(!(coluna in registro),
            `VAZAMENTO: ${tabela} expõe a coluna "${coluna}" sem autenticação`);
        }
      }
    }
  });

  test('escrita nas tabelas de conteúdo é negada sem autenticação', async () => {
    // Leitura pública não pode vir acompanhada de escrita pública.
    const resposta = await fetch(`${configuracao.url}/rest/v1/atividades`, {
      method: 'POST',
      headers: {
        apikey: configuracao.chave,
        Authorization: `Bearer ${configuracao.chave}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ id: 'teste-invasao', titulo: 'não deveria entrar' })
    });

    assert.ok(resposta.status >= 400,
      `VAZAMENTO: escrita anônima em atividades devolveu ${resposta.status}`);
  });

  test('as tabelas públicas continuam legíveis — o site depende disso', async () => {
    // O oposto do vazamento também é defeito: RLS apertada demais quebra o site
    // e leva alguém a desativá-la inteira para "destravar".
    const { status, corpo } = await lerSemAutenticar('atividades');
    assert.equal(status, 200, 'atividades deveria ser lida sem autenticação');
    assert.ok(Array.isArray(corpo), 'atividades não devolveu lista');
  });
});

/**
 * Sem projeto Supabase configurado não há o que testar — mas o teste não
 * pode passar silenciosamente, ou a suíte ficaria verde sem ter verificado
 * nada. Marca como pulado, com o motivo visível.
 */
function skipSemConfiguracao() {
  return configuracao
    ? false
    : 'Supabase ainda não configurado. Defina SUPABASE_URL e SUPABASE_CHAVE_PUBLICAVEL '
      + 'no ambiente, ou em .env.local. ATENÇÃO: enquanto isso, o aceite bloqueante '
      + 'da seção 12 NÃO foi verificado.';
}
