/**
 * Todo item do menu principal e o botão "Entrar" do cabeçalho precisam
 * apontar para uma rota que existe, ou estar explicitamente listados como
 * ainda não migrados.
 *
 * Histórico do projeto: testes/links.test.mjs nasceu porque seis páginas do
 * menu apontavam para arquivos inexistentes e ninguém percebeu. Mas aquele
 * teste tinha ficado preso ao site estático legado — subia seu próprio
 * servidor lendo arquivos de `site/`, sem nunca falar com o Next —, e sem
 * este arquivo os destinos que ainda não tinham migrado (mais o "Entrar")
 * ficariam sem nenhum teste acompanhando no app novo. A própria Tarefa A1
 * reapontou links.test.mjs para o Next; os dois continuam divididos por
 * área (aqui o menu + "Entrar", lá o que fica fora dele).
 *
 * ROTAS_PRONTAS e ROTAS_PENDENTES precisam, juntas, esgotar exatamente os
 * hrefs que o servidor entrega hoje no menu + Entrar — sem sobra dos dois
 * lados. O teste falha nos dois sentidos:
 *
 *   - um item novo no menu (ou um novo "Entrar") cujo href não esteja em
 *     nenhuma das duas listas quebra o assert de conjunto abaixo;
 *   - uma rota de ROTAS_PENDENTES que passar a responder 200 (foi migrada,
 *     mas ninguém moveu a entrada para ROTAS_PRONTAS) quebra o assert de
 *     que rotas pendentes continuam 404.
 *
 * Não importa ITENS de componentes/MenuMovel.tsx diretamente: o arquivo tem
 * JSX, que o carregador de TypeScript nativo do Node não transforma. Em vez
 * disso lê o HTML que o servidor de fato entrega — o que também cobre o
 * caso sem JavaScript, já que é HTML cru via fetch, sem navegador.
 *
 * ROTAS_PRONTAS e ROTAS_PENDENTES vêm de testes/apoio/rotas-migracao.mjs
 * (Rodada de correção 1 da Tarefa A1): testes/links.test.mjs e
 * testes/sem-javascript.test.mjs precisam da mesma lista de pendentes, e
 * mantinham cada um a própria cópia. Ver o comentário daquele módulo para o
 * motivo de a fonte única não poder ser este próprio arquivo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROTAS_PRONTAS_MENU as ROTAS_PRONTAS, ROTAS_PENDENTES } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function hrefsDoMenu() {
  const html = await fetch(`${BASE}/`).then((resposta) => resposta.text());

  const blocoMenu = html.match(/<nav[^>]*id="menu-principal"[\s\S]*?<\/nav>/)?.[0] || '';
  const doMenu = [...blocoMenu.matchAll(/<a[^>]+href="([^"]+)"/g)].map((m) => m[1]);

  // A ordem dos atributos no HTML renderizado não é garantida — tenta os
  // dois sentidos (class antes de href, e o inverso).
  const entrar = html.match(/class="cabecalho__entrar"[^>]*href="([^"]+)"/)
    || html.match(/href="([^"]+)"[^>]*class="cabecalho__entrar"/);

  return [...doMenu, ...(entrar ? [entrar[1]] : [])];
}

test('cada item do menu e o Entrar estão em ROTAS_PRONTAS ou ROTAS_PENDENTES, sem sobra de nenhum lado', async () => {
  const hrefs = await hrefsDoMenu();
  const esperado = [...ROTAS_PRONTAS, ...ROTAS_PENDENTES];

  assert.deepEqual(
    [...hrefs].sort(),
    [...esperado].sort(),
    'o menu (ou o Entrar) tem um item fora das duas listas, ou uma rota listada sumiu do menu'
  );
});

test('toda rota de ROTAS_PRONTAS responde', async () => {
  for (const rota of ROTAS_PRONTAS) {
    const resposta = await fetch(`${BASE}${rota}`);
    assert.ok(resposta.ok, `${rota} deveria existir e não existe (status ${resposta.status})`);
  }
});

test('toda rota de ROTAS_PENDENTES continua sem página — mover para ROTAS_PRONTAS quando migrar', async () => {
  for (const rota of ROTAS_PENDENTES) {
    const resposta = await fetch(`${BASE}${rota}`);
    assert.equal(
      resposta.status, 404,
      `${rota} respondeu ${resposta.status}: parece que foi migrada — mova para ROTAS_PRONTAS`
    );
  }
});
