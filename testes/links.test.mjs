/**
 * Todo link interno FORA do menu principal precisa resolver, ou apontar para
 * uma rota que a migração já declarou pendente.
 *
 * Este arquivo existe porque o menu apontou para agenda, acervo, voluntariado
 * e doar antes de essas páginas existirem: quem clicava recebia 404. Os
 * testes de página só olhavam as páginas que existiam — ninguém perguntava se
 * os destinos existiam.
 *
 * Reapontado para o app Next (Tarefa A1 da fase 2): a versão antiga subia um
 * servidor HTTP próprio lendo `site/`, e por isso nunca falou com o app novo
 * — o menu ganhou testes/links-menu.test.mjs, que percorre `nav#menu-principal`
 * e o "Entrar" do cabeçalho contra `URL_BASE`, mas nada cobria o que fica FORA
 * do menu: os links dentro do corpo de cada página ("Conhecer nossos
 * projetos", "Falar pelo WhatsApp"...), o rodapé (Política de privacidade,
 * telefone, e-mail, redes sociais) e o link "Pular para o conteúdo".
 *
 * Mesmo raciocínio de duas listas que links-menu.test.mjs usa, aplicado ao
 * que ele não cobre: um link para uma rota fora das duas listas quebra o
 * teste (typo, página nova sem cadastro aqui); um link para uma rota
 * PENDENTE que já responde 200 também quebra (foi migrada, mas ninguém
 * atualizou este arquivo).
 *
 * PAGINAS_PRONTAS e ROTAS_PENDENTES vêm de testes/apoio/rotas-migracao.mjs
 * (Rodada de correção 1 da Tarefa A1) — mesma fonte que links-menu.test.mjs
 * e sem-javascript.test.mjs usam, no lugar de cada arquivo guardar a própria
 * cópia. Isso sozinho não bastava: a revisão apontou que nada conferia
 * PAGINAS_PRONTAS contra a realidade — uma página nova que alguém esquecesse
 * de acrescentar à lista ficava sem cobertura aqui e a suíte continuava
 * verde. O teste "PAGINAS_CATALOGADAS bate com..." abaixo fecha esse buraco,
 * comparando as listas contra o que de fato existe em app/ (rotasReaisDoApp)
 * — desde a Tarefa P1 do painel são duas listas, porque nem toda página de
 * app/ é pública; ver testes/apoio/rotas-migracao.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGINAS_PRONTAS, PAGINAS_CATALOGADAS, ROTAS_PENDENTES, rotasReaisDoApp, ehRotaDinamica, ROTAS_DINAMICAS
} from './apoio/rotas-migracao.mjs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function htmlDe(pagina) {
  return fetch(`${BASE}${pagina}`).then((resposta) => resposta.text());
}

/**
 * Hrefs internos de uma página, EXCLUINDO o `<nav id="menu-principal">` e o
 * botão "Entrar" do cabeçalho — os dois já têm cobertura própria em
 * testes/links-menu.test.mjs. Sobra o que interessa aqui: o link de marca do
 * cabeçalho (sempre "/"), o corpo da página e o rodapé.
 */
function hrefsForaDoMenu(pagina) {
  const semMenu = pagina.replace(/<nav\b[^>]*id="menu-principal"[\s\S]*?<\/nav>/, '');
  const semEntrar = semMenu.replace(/<a\b[^>]*cabecalho__entrar[\s\S]*?<\/a>/, '');
  // Só <a href="...">: um regex genérico de "href" também pegaria
  // <link rel="stylesheet" href="/_next/static/..."> que o próprio Next
  // injeta no <head> — não é link de navegação, ninguém "clica" nele.
  return [...semEntrar.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)]
    .map((achado) => achado[1])
    .filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

test('o link de pular para o conteúdo existe, e o alvo existe, em toda página pronta', async () => {
  const semLinkOuAlvo = [];

  for (const pagina of PAGINAS_PRONTAS) {
    const html = await htmlDe(pagina);
    const temLink = /<a class="pular-para-conteudo" href="#conteudo">/.test(html);
    const temAlvo = /id="conteudo"/.test(html);
    if (!temLink || !temAlvo) semLinkOuAlvo.push(pagina);
  }

  assert.deepEqual(semLinkOuAlvo, [],
    `páginas sem o link de pular ou sem o alvo #conteudo: ${semLinkOuAlvo.join(', ')}`);
});

test('todo link interno fora do menu (conteúdo, rodapé, marca) aponta para uma rota catalogada', async () => {
  const desconhecidos = [];

  for (const pagina of PAGINAS_PRONTAS) {
    const html = await htmlDe(pagina);
    for (const href of new Set(hrefsForaDoMenu(html))) {
      if (PAGINAS_PRONTAS.includes(href) || ROTAS_PENDENTES.includes(href)) continue;
      // `/projetos/<id>` e `/noticias/<id>`: sob esses prefixos qualquer id
      // é rota real. Catalogar os onze ids seria pôr CONTEÚDO numa lista de
      // ROTAS — e o teste ficaria vermelho no dia em que a ONG renomeasse
      // uma atividade. Ver ROTAS_DINAMICAS em testes/apoio/rotas-migracao.mjs.
      if (ehRotaDinamica(href)) continue;
      desconhecidos.push(`${pagina} -> ${href}`);
    }
  }

  assert.deepEqual(desconhecidos, [],
    `link fora do menu para rota fora das duas listas — typo, ou página nova sem cadastro aqui:\n  ${desconhecidos.join('\n  ')}`);
});

test('rota pronta referenciada fora do menu de fato responde', async () => {
  const quebrados = [];

  for (const pagina of PAGINAS_PRONTAS) {
    const html = await htmlDe(pagina);
    const destinos = hrefsForaDoMenu(html).filter((href) => PAGINAS_PRONTAS.includes(href));

    for (const destino of new Set(destinos)) {
      const resposta = await fetch(`${BASE}${destino}`);
      if (!resposta.ok) quebrados.push(`${pagina} -> ${destino} (${resposta.status})`);
    }
  }

  assert.deepEqual(quebrados, [], `links quebrados:\n  ${quebrados.join('\n  ')}`);
});

/**
 * Mesmo achado da revisão final do Bloco A que está em
 * testes/links-menu.test.mjs: ROTAS_PENDENTES está vazia desde a Tarefa A6,
 * e o `for` abaixo passa sem executar assert nenhum, sem anunciar nada.
 * Pular com o motivo escrito (padrão de testes/rota-inexistente.test.mjs)
 * faz a suíte dizer, em toda rodada, que esta verificação não tem o que
 * verificar.
 */
function semRotaPendente() {
  return ROTAS_PENDENTES.length > 0
    ? false
    : 'ROTAS_PENDENTES (testes/apoio/rotas-migracao.mjs) está vazia — todo item do menu já '
      + 'migrou (Tarefa A6), então nenhuma página pode referenciar rota pendente FORA do '
      + 'menu: não há rota pendente. Volta a rodar sozinho quando a lista voltar a ter '
      + 'entrada. Os outros dois testes deste arquivo (links quebrados e a reconciliação '
      + 'de PAGINAS_PRONTAS contra app/) não dependem disto e continuam rodando.';
}

test('rota pendente referenciada fora do menu continua sem página — se migrou, mover para PAGINAS_PRONTAS aqui e em links-menu.test.mjs', { skip: semRotaPendente() }, async () => {
  const pareceMigrada = [];

  for (const pagina of PAGINAS_PRONTAS) {
    const html = await htmlDe(pagina);
    const destinos = hrefsForaDoMenu(html).filter((href) => ROTAS_PENDENTES.includes(href));

    for (const destino of new Set(destinos)) {
      const resposta = await fetch(`${BASE}${destino}`);
      if (resposta.status !== 404) pareceMigrada.push(`${pagina} -> ${destino} (${resposta.status})`);
    }
  }

  assert.deepEqual(pareceMigrada, [],
    `rota pendente respondeu diferente de 404 — parece migrada, atualizar as duas listas:\n  ${pareceMigrada.join('\n  ')}`);
});

/**
 * Reconcilia contra PAGINAS_CATALOGADAS, não contra PAGINAS_PRONTAS
 * (Tarefa P1 do painel): desde `app/admin/`, existe página real em `app/`
 * que NÃO é pública — ela responde 404 para quem não é equipe. As duas
 * listas e o motivo da separação estão em testes/apoio/rotas-migracao.mjs.
 * O que este teste garante continua igual: nenhuma página nasce em `app/`
 * sem alguém cadastrá-la em ALGUMA das duas listas, e nenhuma entrada
 * sobra sem página real por trás.
 */
test('PAGINAS_CATALOGADAS bate com as páginas reais em app/ (page.tsx) — esquecer de acrescentar uma quebra aqui', async () => {
  const reais = await rotasReaisDoApp();

  // As rotas dinâmicas aparecem em `app/` como `/projetos/[id]` — o nome
  // do diretório. No catálogo elas entram pelo endereço de EXEMPLO, que é
  // o que responde de fato. A tradução acontece aqui, e o mapa é a fonte:
  // uma rota `[id]` nova sem entrada em ROTAS_DINAMICAS derruba este teste.
  const reaisTraduzidas = reais.map((rota) => {
    if (!(rota in ROTAS_DINAMICAS)) return rota;
    return ROTAS_DINAMICAS[rota] ?? rota;
  });

  assert.deepEqual(
    [...PAGINAS_CATALOGADAS, ...Object.entries(ROTAS_DINAMICAS)
      .filter(([, exemplo]) => exemplo === null).map(([rota]) => rota)].sort(),
    [...reaisTraduzidas].sort(),
    'as listas de testes/apoio/rotas-migracao.mjs e as páginas reais em app/ divergem — '
    + 'uma página nova sem entrada em nenhuma delas fica sem a cobertura deste arquivo; '
    + 'uma entrada sem página real por trás é lixo na lista'
  );
});
