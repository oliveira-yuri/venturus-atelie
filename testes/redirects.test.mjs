/**
 * As URLs antigas com `.html` já circularam — matéria da Folha, links
 * compartilhados no WhatsApp, posts no Instagram — e a versão nova do site
 * usa rota limpa (`/quem-somos`, não `/quem-somos.html`). Sem redirect, cada
 * uma dessas URLs vira 404 no dia do deploy.
 *
 * São 14 redirects, não 15 (correção de contagem herdada da Tarefa A7): o
 * site antigo tinha 15 `.html`, e o 15º — `/admin/index.html` — fica de
 * fora por decisão explícita, registrada no fim deste arquivo.
 *
 * 301, não 308: todo acesso aqui é navegação simples — clique em link
 * salvo, favorito de navegador, indexação de buscador — nunca um POST cujo
 * corpo precise sobreviver ao redirect, que é a única vantagem real do 308
 * sobre o 301. Em compensação, 301 é o código que crawlers e caches
 * entendem há duas décadas como "mudou para sempre, transfira o peso de
 * indexação" — inclusive o bot que gera a prévia de link do WhatsApp e do
 * Instagram, mais conservador que um navegador moderno. Não há corpo de
 * requisição para preservar aqui, então a garantia adicional do 308 não
 * compra nada e o 301 é a escolha mais compatível.
 *
 * `redirect: 'manual'` em todas as chamadas: o `fetch` padrão SEGUE o
 * redirect e a resposta chegaria como 200 da página nova, escondendo o
 * código e o destino que são exatamente o que este arquivo precisa medir.
 *
 * SEM LISTA MANUAL (rodada de correção 1 da Tarefa A7): a primeira versão
 * deste arquivo copiava à mão os 14 pares [origem, destino], sem nada que
 * os comparasse contra a fonte real — o mesmo padrão de "lista que
 * envelhece" que `testes/apoio/rotas-migracao.mjs` já resolveu para as
 * rotas do app. Agora os pares vêm de `compartilhado/redirects-antigos.ts`
 * (importado de verdade, não copiado — a mesma lista que `middleware.ts`
 * usa para construir os redirects) e são reconciliados contra os `.html`
 * do site antigo.
 *
 * CONTRA O QUE ESSA RECONCILIAÇÃO RODA HOJE (Tarefa A8). Antes: os `.html`
 * reais de `site/`. A Tarefa A8 apagou `site/`, e o cabeçalho anterior
 * mandava trocar a varredura por "uma lista fixa" — não foi o que se fez,
 * porque uma lista fixa escrita à mão aqui seria uma segunda cópia dos
 * mesmos 15 caminhos, e reconciliar uma lista contra a cópia dela não prova
 * nada. Em vez disso a varredura continua sendo de ARQUIVOS de verdade, só
 * que dos 15 HTML congelados em `testes/apoio/html-original/` — a mesma
 * cópia byte a byte que `testes/paridade-texto.test.mjs` usa como
 * referência (ver o LEIA-ME de lá). Os nomes de arquivo continuam vindo do
 * sistema de arquivos, não de uma lista digitada.
 *
 * O que essa reconciliação ainda vale, dito sem exagero: o conjunto de URLs
 * antigas é história fechada — nenhuma `.html` nova vai passar a circular —,
 * então este lado não muda mais. O que ele impede é alguém acrescentar ou
 * remover uma entrada de `REDIRECTS_ANTIGOS` sem que exista a URL antiga
 * correspondente. A metade viva da reconciliação é a outra, no fim deste
 * arquivo: os DESTINOS contra `rotasReaisDoApp()`, que muda a cada página
 * publicada em `app/`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REDIRECTS_ANTIGOS } from '../compartilhado/redirects-antigos.ts';
import { rotasReaisDoApp } from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const DIRETORIO_HTML_ORIGINAL = fileURLToPath(new URL('./apoio/html-original/', import.meta.url));

// A única URL antiga sem redirect — decisão do coordenador, ver o bloco de
// testes dedicado a `/admin` no fim deste arquivo. Qualquer outro `.html`
// do site antigo fora desta lista PRECISA ter um redirect configurado em
// compartilhado/redirects-antigos.ts, ou o teste de reconciliação abaixo
// falha — o mesmo tanto se um redirect configurado não corresponder a
// nenhum arquivo real.
const SEM_REDIRECT_DE_PROPOSITO = ['admin/index.html'];

/**
 * Varre recursivamente os `.html` congelados do site antigo — a fonte das
 * URLs antigas que já circularam. `LEIA-ME.txt` e qualquer outro arquivo
 * que não termine em `.html` ficam de fora pelo filtro abaixo.
 */
async function arquivosHtmlReais(diretorio = DIRETORIO_HTML_ORIGINAL, prefixo = '') {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  let arquivos = [];

  for (const entrada of entradas) {
    const relativo = prefixo === '' ? entrada.name : `${prefixo}/${entrada.name}`;
    if (entrada.isDirectory()) {
      arquivos = arquivos.concat(await arquivosHtmlReais(join(diretorio, entrada.name), relativo));
    } else if (entrada.name.endsWith('.html')) {
      arquivos.push(relativo);
    }
  }

  return arquivos;
}

/** `index.html` (e só ele) vai para a raiz; os demais só perdem o sufixo. */
function destinoEsperado(caminhoRelativo) {
  return caminhoRelativo === 'index.html' ? '/' : `/${caminhoRelativo.replace(/\.html$/, '')}`;
}

test('compartilhado/redirects-antigos.ts tem um redirect para cada .html do site antigo, sem sobra de nenhum lado (exceto /admin/index.html, decisão explícita)', async () => {
  const fontesReais = (await arquivosHtmlReais())
    .filter((caminho) => !SEM_REDIRECT_DE_PROPOSITO.includes(caminho))
    .map((caminho) => `/${caminho}`)
    .sort();

  const fontesConfiguradas = REDIRECTS_ANTIGOS.map((redirect) => redirect.origem).sort();

  assert.deepEqual(
    fontesConfiguradas, fontesReais,
    'a lista de compartilhado/redirects-antigos.ts e os .html congelados em '
    + 'testes/apoio/html-original/ divergem — um redirect sobrando sem URL antiga correspondente, '
    + 'ou uma URL antiga sem redirect configurado'
  );
});

test('cada redirect configurado aponta para a rota que o nome do arquivo implica', () => {
  for (const { origem, destino } of REDIRECTS_ANTIGOS) {
    const esperado = destinoEsperado(origem.slice(1));
    assert.equal(destino, esperado, `${origem} está configurado para "${destino}", esperava "${esperado}"`);
  }
});

describe('cada redirect configurado responde de verdade, com 301 e o destino declarado', () => {
  for (const { origem, destino } of REDIRECTS_ANTIGOS) {
    test(`${origem} → ${destino}, com 301`, async () => {
      const resposta = await fetch(`${BASE}${origem}`, { redirect: 'manual' });

      assert.equal(resposta.status, 301, `${origem} respondeu ${resposta.status}, esperava 301`);

      const destinoReal = new URL(resposta.headers.get('location'), BASE).pathname;
      assert.equal(destinoReal, destino, `${origem} redireciona para "${destinoReal}", esperava "${destino}"`);
    });
  }
});

/**
 * Cache-Control limitado (rodada de correção 1 da Tarefa A7): um 301 sem
 * cabeçalho explícito é cacheável por heurística do navegador, difícil de
 * limpar depois. Testa só uma amostra, não os 14 — os 14 saem do mesmo
 * `respostaRedirect.headers.set(...)` em middleware.ts, então uma amostra já
 * denuncia se a linha for removida ou o valor mudar sem querer.
 */
test('o redirect sai com Cache-Control limitado, não cacheável para sempre por heurística', async () => {
  const resposta = await fetch(`${BASE}/quem-somos.html`, { redirect: 'manual' });
  const cacheControl = resposta.headers.get('cache-control') || '';

  assert.match(cacheControl, /max-age=\d+/, `Cache-Control veio "${cacheControl}", sem max-age`);
  assert.doesNotMatch(cacheControl, /no-store/, 'no-store impediria qualquer cache — não é a decisão tomada');
});

/**
 * A query string precisa sobreviver ao redirect (rodada de correção 2 da
 * Tarefa A7 — regressão introduzida na rodada 1, sem teste cobrindo). Há
 * um consumidor real hoje: `app/acervo/page.tsx` lê `?busca`.
 *
 * CORREÇÃO DE FATO (Tarefa A8): este comentário citava também
 * `site/assets/js/paginas/entrar.js` lendo `?destino` como "consumidor
 * real". Não era: aquele arquivo era do site estático, que a Netlify não
 * publica desde a migração (`publish = ".next"`), e o app novo não lê
 * `destino` em lugar nenhum — o redirecionamento pós-login é Bloco B.
 * O motivo que sustenta este teste sozinho é o outro, abaixo: um link antigo do tipo
 * `/quem-somos.html?utm_source=folha&fbclid=abc` — o exato tipo de link que
 * já circulou, com parâmetro de rastreio de campanha — perderia esses
 * parâmetros no redirect se o `search` não for propagado.
 */
test('a query string do link antigo sobrevive ao redirect', async () => {
  const resposta = await fetch(
    `${BASE}/quem-somos.html?utm_source=folha&fbclid=abc`,
    { redirect: 'manual' }
  );

  assert.equal(resposta.status, 301, `respondeu ${resposta.status}, esperava 301`);

  const destino = new URL(resposta.headers.get('location'), BASE);
  assert.equal(destino.pathname, '/quem-somos', `caminho veio "${destino.pathname}"`);
  assert.equal(
    destino.searchParams.get('utm_source'), 'folha',
    `query string não sobreviveu — Location completo: "${resposta.headers.get('location')}"`
  );
  assert.equal(destino.searchParams.get('fbclid'), 'abc', 'fbclid não sobreviveu ao redirect');
});

/**
 * Todo destino de redirect precisa ser uma página real, não só "responder
 * 301 com o Location certo" — a reconciliação com os HTML congelados
 * (acima) nunca compara contra `app/`, então uma página do site antigo jamais portada
 * seria OBRIGADA a entrar em `REDIRECTS_ANTIGOS` (a reconciliação exigiria
 * isso) e redirecionaria 301 para um 404, com a suíte inteira verde.
 * `rotasReaisDoApp()` (testes/apoio/rotas-migracao.mjs) é o "chão de
 * fábrica" das páginas que de fato existem — mesmo papel que já cumpre para
 * `testes/links.test.mjs`.
 */
test('todo destino de compartilhado/redirects-antigos.ts é uma página real de app/, sem sobra de nenhum lado', async () => {
  const destinosConfigurados = REDIRECTS_ANTIGOS.map((redirect) => redirect.destino).sort();
  const rotasReais = (await rotasReaisDoApp()).sort();

  assert.deepEqual(
    destinosConfigurados, rotasReais,
    'os destinos configurados e as páginas reais de app/ divergem — um redirect aponta para '
    + 'página que não existe, ou uma página real ficou sem nenhum redirect apontando para ela'
  );
});

/**
 * `/admin/index.html` é a 15ª URL antiga, e a única sem resposta óbvia: o
 * painel (Bloco B) nunca existiu no ar — RF33 é só a casca da home segundo
 * o CLAUDE.md, não há conta de administrador criada e o cadastro está
 * travado pelo limite de e-mail do Supabase. Quem tem esse link é a equipe
 * de cinco pessoas da ONG, não o público: o painel nunca foi divulgado, não
 * está no menu, não aparece na matéria da Folha nem circulou no Instagram.
 *
 * Decisão (coordenador, 30/08/2026): NÃO redirecionar. As alternativas
 * enganam mais do que ajudam — mandar para `/entrar` sugere que existe um
 * painel funcionando do outro lado do login, quando não existe nada; e
 * redirecionar para `/admin` hoje seria 301 permanente apontando para uma
 * rota que ainda não existe, exatamente um 404 disfarçado. O 404 que sobra
 * não é seco: `app/not-found.tsx` entrega página real, em português, com
 * `<main id="conteudo">` e caminho de volta (provado em
 * `testes/rota-inexistente.test.mjs`).
 *
 * A TRAVA CERTA (corrigida na rodada de correção 1 — a primeira versão
 * media o caminho ERRADO). A versão anterior só testava que
 * `/admin/index.html` continuava 404, e isso NÃO prova nada sobre a
 * decisão: MEDIDO — criar `app/admin/page.tsx` faz `/admin` existir, mas o
 * Next não mapeia `/admin/index.html` para essa página (esse caminho
 * literal não corresponde a rota nenhuma do App Router). Com o painel
 * criado, os testes deste arquivo continuavam todos verdes — a decisão
 * estava destravada e o comentário anterior afirmava o contrário.
 *
 * A trava certa observa a condição de que a decisão realmente depende:
 * `/admin` (não `/admin/index.html`) ainda não existir. No dia em que o
 * Bloco B publicar `app/admin/`, o teste abaixo vira vermelho — obrigando a
 * decidir de novo o destino de `/admin/index.html` (provavelmente `/admin`)
 * em vez de a mudança passar despercebida. Provado nesta rodada: criado
 * `app/admin/page.tsx`, rodada a suite, este teste específico ficou
 * vermelho; apagado o arquivo, voltou a verde.
 */
test('/admin ainda não existe — publicá-lo (Bloco B) exige revisitar esta decisão (ver comentário acima)', async () => {
  const resposta = await fetch(`${BASE}/admin`, { redirect: 'manual' });
  assert.equal(
    resposta.status, 404,
    `/admin respondeu ${resposta.status}: parece que o Bloco B publicou o painel — hora de decidir `
    + 'o redirect de /admin/index.html e atualizar este teste, não apagar a trava'
  );
});

test('/admin/index.html não redireciona hoje — estado atual, decisão registrada acima', async () => {
  const resposta = await fetch(`${BASE}/admin/index.html`, { redirect: 'manual' });
  assert.equal(resposta.status, 404, `/admin/index.html respondeu ${resposta.status}, esperava 404`);
});
