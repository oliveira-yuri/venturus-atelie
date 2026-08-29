/**
 * Prova que a PÁGINA renderizada de /para-escolas mostra os registros reais
 * de "Onde já estivemos" — não só que o componente isolado sabe omitir a
 * seção quando não há dado (isso já está provado em
 * testes/prova-social.test.mjs).
 *
 * Nasce da Rodada de correção 2 da Tarefa 10. A correção da rodada 1 em
 * testes/paridade-texto.test.mjs (exigirPresenca=false do lado renderizado,
 * para não acusar a omissão LEGÍTIMA quando não há registro) abriu um
 * buraco: nada mais afirmava que a página de verdade, com dado de verdade
 * presente, de fato repassa esse dado ao componente. Uma regressão tão
 * simples quanto trocar `<SecaoOndeEstivemos registros={clipping} />` por
 * `<SecaoOndeEstivemos registros={[]} />` em app/para-escolas/page.tsx faz
 * a seção sumir do HTML — e, sem este teste, a suíte inteira continuava
 * verde. Seria o próprio defeito original (a seção sem conteúdo, relatado
 * pelo usuário olhando a tela) voltando, só que pior: sem seção nenhuma,
 * nem vazia.
 *
 * Por isso este teste busca a rota de verdade via HTTP — como
 * testes/paridade-texto.test.mjs — e confere um título real do JSON
 * versionado (a mesma fonte que alimenta o fallback local e que espelha o
 * conteúdo real semeado no Supabase).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

test('/para-escolas mostra pelo menos um título real de instituição/programação, quando o JSON tem algum', async () => {
  const clipping = JSON.parse(
    await readFile(new URL('../dados-iniciais/clipping.json', import.meta.url), 'utf8')
  );
  const instituicoes = clipping.filter(
    (registro) => registro.tipo === 'instituicao' || registro.tipo === 'programacao'
  );

  // Se um dia o JSON ficar sem nenhum desses dois tipos, este teste não tem
  // mais o que exigir — mas precisa dizer isso alto, não passar por engano.
  assert.ok(
    instituicoes.length > 0,
    'dados-iniciais/clipping.json não tem nenhum registro de instituição/programação — '
    + 'este teste não tem título nenhum para exigir na página'
  );

  const resposta = await fetch(`${BASE}/para-escolas`);
  assert.equal(resposta.status, 200, '/para-escolas não respondeu 200');
  const html = await resposta.text();

  const apareceu = instituicoes.some((registro) => html.includes(registro.titulo));
  assert.ok(
    apareceu,
    'nenhum título real de instituição/programação apareceu no HTML de /para-escolas — '
    + 'a seção pode ter parado de receber o dado de verdade (ver comentário no topo deste arquivo)'
  );
});
