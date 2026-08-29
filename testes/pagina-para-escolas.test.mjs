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
 *
 * Rodada de correção 3: a primeira versão fazia `assert.ok(instituicoes
 * .length > 0, ...)`, e isso tratava dois cenários bem diferentes como o
 * mesmo — "dado existe e a página não mostra" (defeito real, deve falhar)
 * e "dado não existe e a seção some" (a regra 2 do CLAUDE.md funcionando,
 * não deveria derrubar suíte nenhuma). Um `clipping.json` sem nenhum
 * registro de instituição/programação fazia este teste falhar por engano.
 * Corrigido seguindo o precedente que testes/seguranca.test.mjs já usa
 * para a mesma situação (`describe(..., { skip: skipSemConfiguracao() })`):
 * sem o que verificar, pula de forma VISÍVEL, com o motivo dito — nunca
 * falha e nunca passa em silêncio.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// SÍNCRONO e no topo do módulo, de propósito: o `skip` do describe() logo
// abaixo é avaliado antes de qualquer before()/teste assíncrono rodar —
// mesma razão pela qual testes/seguranca.test.mjs lê sua configuração de
// forma síncrona no topo do arquivo.
const clipping = JSON.parse(
  readFileSync(new URL('../dados-iniciais/clipping.json', import.meta.url), 'utf8')
);
const instituicoes = clipping.filter(
  (registro) => registro.tipo === 'instituicao' || registro.tipo === 'programacao'
);

/**
 * Sem nenhum registro de instituição/programação no JSON, não há título
 * nenhum para exigir na página — e a seção sumir, nesse caso, é o produto
 * acertando (regra 2 do CLAUDE.md), não um defeito. Pula com o motivo
 * visível, em vez de falhar (falso-vermelho) ou de passar sem dizer nada
 * (esconderia que este teste não verificou coisa alguma desta vez).
 */
function skipSemRegistroDeInstituicao() {
  return instituicoes.length > 0
    ? false
    : 'dados-iniciais/clipping.json não tem nenhum registro de instituição/programação agora — '
      + 'este teste não tem título nenhum para exigir na página. Sem dado, a seção "Onde já '
      + 'estivemos" deve mesmo sumir (regra 2 do CLAUDE.md); isso não é o defeito que este '
      + 'teste existe para pegar.';
}

describe(
  '/para-escolas mostra os registros reais de "Onde já estivemos"',
  { skip: skipSemRegistroDeInstituicao() },
  () => {
    test('pelo menos um título real de instituição/programação aparece no HTML', async () => {
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
  }
);
