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
 * Páginas de `app/` que NUNCA existiram no site antigo, e por isso não têm
 * — nem podem ter — URL `.html` apontando para elas.
 *
 * Até a Tarefa 2 da autenticação toda página do app novo era o port de uma
 * página antiga, e a reconciliação do fim deste arquivo podia exigir
 * igualdade exata entre destinos configurados e páginas reais. `/nova-senha`
 * é a primeira página genuinamente nova: ela recebe quem clicou no link de
 * recuperação de senha (rota `/auth/confirm`), um fluxo que o site estático
 * não tinha como ter — ali a autenticação era JavaScript no navegador.
 * Cobrar um redirect de uma URL antiga que jamais circulou seria inventar
 * história.
 *
 * A lista é explícita, e não um "ignore o que não bater", justamente para
 * que uma página PORTADA que ficasse sem redirect continue quebrando o
 * teste. Toda entrada aqui precisa de um motivo escrito.
 */
const PAGINAS_SEM_URL_ANTIGA = [
  '/nova-senha',
  // Tarefa P2 do painel. As duas telas de publicações NUNCA existiram como
  // arquivo: a home do painel antigo (hoje congelada em
  // testes/apoio/html-original/admin/index.html) LINKAVA para "publicacoes",
  // mas o arquivo não existe no diretório congelado — é um dos seis becos
  // que aquela tela prometia, e o defeito que componentes/PainelInicio.ts
  // existe para não repetir. Cobrar redirect de uma URL que nunca respondeu
  // nada seria inventar história; pior, criaria um 301 permanente para uma
  // tela que responde 404 a quem não é equipe.
  '/admin/publicacoes',
  '/admin/publicacoes/editar',
  // Tarefa P3 do painel, mesmo motivo: "galeria" era outro dos seis becos
  // que a home do painel antigo prometia, e o arquivo nunca existiu no
  // diretório congelado. A tela de confirmação de apagar não tem paralelo
  // nenhum no site antigo — ela nasceu desta tarefa, para substituir um
  // `confirm()` do navegador, que não existe sem JavaScript.
  '/admin/galeria',
  '/admin/galeria/apagar',
  // Tarefa P4 do painel, mesmo motivo: a home do painel antigo prometia
  // "eventos", "presenca", "contatos", "mais", "doacoes" e "publicacoes" —
  // nunca "atividades". Nenhuma URL antiga apontou para uma tela de editar
  // atividade, porque essa tela nunca existiu; editar era, até hoje, coisa
  // de quem desenvolve (é o que RF03 registrava como "edição pela equipe
  // falta").
  '/admin/atividades',
  '/admin/atividades/editar',
  // RF29, mesmo motivo, e vale a pena escrever a diferença: "contatos"
  // APARECE no painel antigo congelado — mas como CONTADOR
  // (`data-indicador="contatos"`, um número no topo), nunca como link para
  // uma tela. Os quatro links de lá eram eventos, presenca, publicacoes e
  // doacoes, e nenhum dos arquivos existe no diretório congelado. Ou seja:
  // nenhuma URL antiga apontou para uma tela de mensagens recebidas, porque
  // essa tela nunca existiu — quem quisesse ler abria o painel do Supabase.
  '/admin/contatos',
  // RF11, a área do usuário. O site antigo tinha `entrar.html` e
  // `recuperar-acesso.html` e mais nada de conta: a autenticação ali era
  // JavaScript no navegador, e depois de entrar não havia para onde ir —
  // é literalmente o buraco que esta tarefa fecha. Nenhuma URL `.html`
  // apontou para uma área de conta porque ela nunca existiu; cobrar um
  // redirect de um endereço que jamais circulou seria inventar história.
  '/minha-conta',
  // RF25, a candidatura ao voluntariado. O site antigo tinha
  // `voluntariado.html`, e o botão "Quero me candidatar" dela apontava para
  // `entrar.html` — não havia tela de candidatura, porque não havia como
  // gravar candidatura nenhuma (a autenticação ali era JavaScript no
  // navegador e `public.voluntarios` exige perfil autenticado). Ou seja:
  // nenhuma URL `.html` apontou para cá porque este endereço nunca
  // circulou. `/voluntariado` continua com o redirect dela, intacto.
  '/voluntariado/candidatura',
  // RF19–RF22, as doações. Aqui há uma diferença que vale escrever: ao
  // contrário de "atividades" e "contatos", "doacoes" ERA um dos quatro
  // LINKS da home do painel antigo (testes/apoio/html-original/admin/
  // index.html) — mas o arquivo `admin/doacoes.html` NÃO EXISTE no
  // diretório congelado. Era um dos seis becos que aquela tela prometia, e
  // é o defeito que componentes/PainelInicio.ts existe para não repetir.
  // Cobrar redirect de uma URL que nunca respondeu nada seria inventar
  // história; pior, criaria um 301 permanente para uma tela que responde
  // 404 a quem não é equipe.
  '/admin/doacoes',
  '/admin/doacoes/responder',
  '/admin/doacoes/registrar',
  // A tela pública de ofertar. O site antigo tinha `doar.html`, e ela
  // dizia para falar pelo WhatsApp ou por e-mail — não havia formulário de
  // oferta, porque não havia como gravar doação nenhuma (a autenticação
  // ali era JavaScript no navegador e `public.doacoes` exige perfil
  // autenticado, ou equipe). Nenhuma URL `.html` apontou para cá porque
  // este endereço nunca circulou. `/doar` continua com o redirect dela,
  // intacto.
  '/doar/ofertar'
];

/**
 * O contrário da lista acima: página de `app/` que TEVE URL antiga e mesmo
 * assim fica sem redirect apontando para ela.
 *
 * Uma só, `/admin` — o painel (RF33), publicado pela Tarefa P1 do Bloco B.
 * A decisão de não redirecionar `/admin/index.html` foi revisitada naquela
 * tarefa e mantida; o porquê, agora que o painel existe, está no bloco de
 * comentário do fim deste arquivo.
 *
 * Duas listas separadas, e não uma de "ignore o que não bater", porque os
 * motivos são diferentes e envelhecem de formas diferentes: acima, páginas
 * que nunca tiveram URL antiga (cobrá-las seria inventar história); aqui,
 * uma que teve e cuja URL antiga foi deliberadamente deixada em 404.
 */
const PAGINAS_ANTIGAS_SEM_REDIRECT = ['/admin'];

/** As duas juntas: o que a reconciliação de destinos não cobra. */
const FORA_DA_RECONCILIACAO = [...PAGINAS_SEM_URL_ANTIGA, ...PAGINAS_ANTIGAS_SEM_REDIRECT];

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
  const rotasReais = (await rotasReaisDoApp())
    .filter((rota) => !FORA_DA_RECONCILIACAO.includes(rota))
    .sort();

  assert.deepEqual(
    destinosConfigurados, rotasReais,
    'os destinos configurados e as páginas reais de app/ divergem — um redirect aponta para '
    + 'página que não existe, ou uma página PORTADA do site antigo ficou sem nenhum redirect '
    + 'apontando para ela. Página que nasceu no app novo entra em PAGINAS_SEM_URL_ANTIGA, '
    + 'no topo deste arquivo, com o motivo escrito'
  );

  // A lista de exceções não pode envelhecer em silêncio: uma entrada que
  // deixe de corresponder a uma página real é lixo que afrouxa o teste.
  const rotasTodas = await rotasReaisDoApp();
  const sobrando = FORA_DA_RECONCILIACAO.filter((rota) => !rotasTodas.includes(rota));
  assert.deepEqual(sobrando, [],
    `PAGINAS_SEM_URL_ANTIGA/PAGINAS_ANTIGAS_SEM_REDIRECT citam página que não existe em app/: ${sobrando.join(', ')}`);
});

/**
 * `/admin/index.html` é a 15ª URL antiga, e a única sem redirect.
 *
 * A DECISÃO ORIGINAL (coordenador, 30/08/2026) foi tomada quando o painel
 * não existia em lugar nenhum: mandar para `/entrar` sugeriria um painel
 * funcionando do outro lado do login, e mandar para `/admin` seria um 301
 * permanente apontando para rota inexistente — um 404 disfarçado. O teste
 * que fechava aquele bloco existia para QUEBRAR no dia em que `app/admin/`
 * nascesse, obrigando a decidir de novo em vez de a mudança passar
 * despercebida.
 *
 * ESSE DIA CHEGOU: Tarefa P1 do Bloco B, 31/08/2026. `/admin` existe.
 *
 * A DECISÃO FOI REVISITADA E MANTIDA — não redirecionar —, agora por
 * motivos diferentes dos de ontem:
 *
 *  1. o painel responde 404 para quem não é equipe (app/admin/layout.tsx),
 *     e hoje isso é TODO MUNDO: não há conta de equipe utilizável neste
 *     projeto (CLAUDE.md, "O que trava hoje", itens 1 e 2). Um 301 levaria
 *     a pessoa ao mesmo 404, com um salto a mais no meio;
 *  2. um redirect é PÚBLICO e permanente: ele confirmaria, para qualquer
 *     um que peça `/admin/index.html`, que `/admin` é o endereço novo do
 *     painel. É exatamente o que a decisão de responder 404 (em vez de
 *     "acesso negado") recusa fazer. Não redirecionar mantém as duas
 *     respostas iguais e mudas;
 *  3. quem tem o link antigo é a equipe de cinco pessoas da ONG — o painel
 *     nunca foi divulgado, não está no menu, não aparece na matéria da
 *     Folha nem no Instagram. Para essas cinco pessoas o endereço novo se
 *     resolve dizendo o endereço novo, não com um 301.
 *
 * O 404 que sobra não é seco: `app/not-found.tsx` entrega página real, em
 * português, com `<main id="conteudo">` e caminho de volta (provado em
 * testes/rota-inexistente.test.mjs).
 *
 * A TRAVA, agora, é outra — e é o primeiro teste abaixo. A condição de que
 * esta decisão depende deixou de ser "`/admin` não existe" (existe) e
 * passou a ser "`/admin` responde 404 para quem não é equipe". No dia em
 * que a guarda mudar — um redirect para `/entrar`, um "acesso negado", uma
 * home de painel aberta —, o teste fica vermelho e obriga a decidir de
 * novo o destino de `/admin/index.html`.
 *
 * O que este arquivo NÃO consegue medir, e por isso não afirma: o caminho
 * de quem É equipe. Sem sessão utilizável, todo fetch daqui é anônimo. O
 * que dá para provar sem sessão está em testes/painel-guarda.test.mjs.
 */
test('/admin responde 404 para quem não é equipe — a guarda do painel, medida sem sessão', async () => {
  const resposta = await fetch(`${BASE}/admin`, { redirect: 'manual' });
  assert.equal(
    resposta.status, 404,
    `/admin respondeu ${resposta.status} para uma requisição ANÔNIMA. Se a guarda de `
    + 'app/admin/layout.tsx mudou de propósito, a decisão de deixar /admin/index.html sem '
    + 'redirect depende dela — revisitar o comentário acima, não apagar a trava'
  );
});

test('/admin/index.html não redireciona — decisão revisitada e mantida na Tarefa P1, ver acima', async () => {
  const resposta = await fetch(`${BASE}/admin/index.html`, { redirect: 'manual' });
  assert.equal(resposta.status, 404, `/admin/index.html respondeu ${resposta.status}, esperava 404`);
});
