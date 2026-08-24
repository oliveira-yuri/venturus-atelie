import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const RAIZ = new URL('../site/assets/dados-iniciais/', import.meta.url);

async function carregar(arquivo) {
  return JSON.parse(await readFile(new URL(arquivo, RAIZ), 'utf8'));
}

test('atividades.json é uma lista não vazia', async () => {
  const atividades = await carregar('atividades.json');
  assert.ok(Array.isArray(atividades));
  assert.ok(atividades.length >= 11, 'o escopo lista 11 atividades');
});

test('toda atividade tem id e título', async () => {
  for (const atividade of await carregar('atividades.json')) {
    assert.ok(atividade.id, 'atividade sem id');
    assert.ok(atividade.titulo, `atividade ${atividade.id} sem título`);
  }
});

test('os ids são únicos', async () => {
  const ids = (await carregar('atividades.json')).map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'há id repetido');
});

test('os ids são kebab-case sem acento', async () => {
  for (const { id } of await carregar('atividades.json')) {
    assert.match(id, /^[a-z0-9-]+$/, `id fora do padrão: ${id}`);
  }
});

test('descrição ausente é null, nunca texto de preenchimento', async () => {
  // O escopo proíbe inventar conteúdo. Quando a ONG não forneceu sinopse,
  // o campo precisa ser null para a página saber que deve omitir a seção.
  const suspeitos = /lorem|ipsum|em breve|placeholder|TODO|descrição aqui/i;
  for (const atividade of await carregar('atividades.json')) {
    if (atividade.descricao !== null) {
      assert.ok(atividade.descricao.length > 40, `descrição curta demais em ${atividade.id}`);
      assert.doesNotMatch(atividade.descricao, suspeitos, `texto de preenchimento em ${atividade.id}`);
    }
    if (atividade.resumo !== null) {
      assert.doesNotMatch(atividade.resumo, suspeitos, `texto de preenchimento em ${atividade.id}`);
    }
  }
});

test('as cinco atividades com release têm descrição', async () => {
  const comRelease = [
    'banzo', 'catirina-e-nego-dito', 'cafu-e-o-cafe',
    'brincadeiras-encantadas-na-mata', 'projeto-brincantes'
  ];
  const atividades = await carregar('atividades.json');
  for (const id of comRelease) {
    const atividade = atividades.find((a) => a.id === id);
    assert.ok(atividade, `atividade ausente: ${id}`);
    assert.ok(atividade.descricao, `${id} deveria ter descrição extraída do release`);
  }
});

test('nenhuma grafia proibida de nome próprio', async () => {
  // O escopo manda normalizar "Will Oliveira" e "Nathi Nunes".
  const bruto = JSON.stringify(await carregar('atividades.json'));
  assert.doesNotMatch(bruto, /Will Oliveira/, 'usar "Wil Oliveira"');
  assert.doesNotMatch(bruto, /Nathi Nunes/, 'usar "Nathália (Nathy) Monteiro"');
});

test('clipping.json só contém tipos previstos', async () => {
  const permitidos = new Set(['midia', 'instituicao', 'programacao']);
  for (const registro of await carregar('clipping.json')) {
    assert.ok(permitidos.has(registro.tipo), `tipo desconhecido: ${registro.tipo}`);
  }
});

test('todo registro de clipping tem id e título únicos', async () => {
  const registros = await carregar('clipping.json');
  const ids = registros.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'há id repetido');
  for (const registro of registros) {
    assert.ok(registro.titulo, `registro ${registro.id} sem título`);
  }
});

test('o clipping não inventa patrocinador nem parceiro', async () => {
  // A seção 9.2 do escopo recusa a seção "Nossos apoiadores": a ONG declarou
  // não possuir patrocinador nem parceiro institucional. O clipping registra
  // apenas onde já se apresentou e onde foi noticiada.
  const bruto = JSON.stringify(await carregar('clipping.json'));
  assert.doesNotMatch(bruto, /patrocinador|patrocínio|apoiador oficial|parceiro institucional/i);
});
