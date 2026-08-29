/**
 * Todo item do menu principal e o botão "Entrar" do cabeçalho precisam
 * apontar para uma rota que existe, ou estar explicitamente listados como
 * ainda não migrados.
 *
 * Histórico do projeto: testes/links.test.mjs nasceu porque seis páginas do
 * menu apontavam para arquivos inexistentes e ninguém percebeu. Mas aquele
 * teste ficou preso ao site/ estático legado — sobe seu próprio servidor
 * lendo arquivos de site/, nunca fala com o Next. Sem este arquivo, os nove
 * destinos que ainda não migraram (mais o "Entrar") ficam sem nenhum teste
 * acompanhando neste app novo.
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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Migradas nesta fase: existem de verdade no Next (Tarefa 9 e a home já
// existente antes dela).
const ROTAS_PRONTAS = ['/', '/quem-somos', '/para-escolas'];

// Itens do menu (mais o "Entrar" do cabeçalho) que ainda não têm página no
// app novo. Migram na fase 2 — plano ainda não escrito, ver "Ao terminar" em
// docs/superpowers/plans/2026-08-28-migracao-nextjs-fundacao.md. Ao migrar
// uma dessas rotas, mover a entrada para ROTAS_PRONTAS: o teste abaixo
// acusa se isso for esquecido.
const ROTAS_PENDENTES = [
  '/projetos', '/agenda', '/noticias', '/galeria', '/acervo',
  '/voluntariado', '/doar', '/contato', '/entrar'
];

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
