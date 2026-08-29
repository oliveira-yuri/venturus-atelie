/**
 * Todo modulo de servidor/ comeca com `import 'server-only'`.
 *
 * A regra ja estava escrita (restricoes-globais.md da spec, regra do
 * CLAUDE.md), e mesmo assim um arquivo nasceu sem ela — o antigo
 * servidor/dados/SecaoOndeEstivemos. A correcao daquela vez foi MOVER o
 * arquivo para componentes/, o que resolveu o caso e nao instalou trava
 * nenhuma: o proximo modulo que esquecer a linha continua sem quebrar nada.
 *
 * Na fase 2 nascem sessao.ts, acoes/* e mais seis modulos de dados. O que
 * `server-only` impede e concreto: importado de um Client Component, o
 * modulo quebra a BUILD, com erro claro, em vez de o bundler empacotar
 * silenciosamente a leitura de dado — e, junto com ela, SUPABASE_URL e
 * SUPABASE_CHAVE_PUBLICAVEL — dentro do JavaScript que o navegador baixa.
 * testes/vazamento.test.mjs pega o vazamento depois de acontecer; esta
 * linha impede que aconteca.
 *
 * Le o arquivo como TEXTO, sem importar: `import 'server-only'` lanca fora
 * de um React Server Component, que e exatamente o seu proposito, entao
 * importar estes modulos aqui e impossivel por construcao.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RAIZ_SERVIDOR = new URL('../servidor/', import.meta.url).pathname;

/** Extensoes que viram modulo de verdade. */
const MODULOS = /\.(ts|tsx|mts|js|mjs|jsx)$/;

async function modulosDoServidor(raiz) {
  const achados = [];
  for (const entrada of await readdir(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, entrada.name);
    if (entrada.isDirectory()) achados.push(...await modulosDoServidor(caminho));
    else if (MODULOS.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

/**
 * A PRIMEIRA instrucao do arquivo, nao "alguma linha com server-only": a
 * ordem importa. Um `import './outra-coisa'` antes dele ja teria executado
 * o outro modulo antes de a barreira valer. Comentario e linha em branco
 * antes sao permitidos — o projeto documenta muito em cabecalho de arquivo.
 */
function primeiraInstrucao(codigo) {
  const linhas = codigo.split('\n');
  let dentroDeBloco = false;
  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (dentroDeBloco) {
      if (linha.includes('*/')) dentroDeBloco = false;
      continue;
    }
    if (!linha) continue;
    if (linha.startsWith('//')) continue;
    if (linha.startsWith('/*')) {
      if (!linha.includes('*/')) dentroDeBloco = true;
      continue;
    }
    return linha;
  }
  return null;
}

test('todo modulo em servidor/ comeca com import \'server-only\'', async () => {
  const modulos = await modulosDoServidor(RAIZ_SERVIDOR);
  assert.ok(modulos.length > 0, 'nenhum modulo encontrado em servidor/ — o teste nao verificou nada');

  const semBarreira = [];
  for (const caminho of modulos) {
    const primeira = primeiraInstrucao(await readFile(caminho, 'utf8'));
    if (!/^import\s+['"]server-only['"];?$/.test(primeira ?? '')) {
      semBarreira.push(`${caminho.replace(RAIZ_SERVIDOR, 'servidor/')} (primeira instrução: ${primeira ?? 'nenhuma'})`);
    }
  }

  assert.deepEqual(
    semBarreira, [],
    'módulo em servidor/ sem `import \'server-only\'` como primeira instrução:\n  '
    + semBarreira.join('\n  ')
    + '\n  Sem essa linha, importar o módulo de um Client Component compila em '
    + 'silêncio e leva a leitura de dado (e as credenciais) para o bundle do navegador.'
  );
});
