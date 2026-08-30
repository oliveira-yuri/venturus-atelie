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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Páginas que já existem de verdade no app Next nesta fase — mesma lista que
// testes/paginas.test.mjs mantém para a bateria estrutural. Ao portar uma
// página nova (Tarefas A2 em diante), acrescentar aqui também.
const PAGINAS_PRONTAS = ['/', '/quem-somos', '/para-escolas', '/privacidade'];

// Mesma lista de ROTAS_PENDENTES em testes/links-menu.test.mjs. Duplicada de
// propósito: as duas listas nascem do mesmo estado da migração, mas vigiam
// coisas diferentes (menu vs. conteúdo/rodapé) — se uma rota migrar, as DUAS
// precisam ser atualizadas no mesmo commit. Esquecer esta aqui não passa
// batido: o teste abaixo que confere "continua pendente" acusa.
const ROTAS_PENDENTES = [
  '/projetos', '/agenda', '/noticias', '/galeria', '/acervo',
  '/voluntariado', '/doar', '/contato', '/entrar'
];

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

test('rota pendente referenciada fora do menu continua sem página — se migrou, mover para PAGINAS_PRONTAS aqui e em links-menu.test.mjs', async () => {
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
