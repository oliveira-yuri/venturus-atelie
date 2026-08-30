/**
 * O site precisa continuar navegável e legível sem JavaScript.
 *
 * Este teste existe porque, na primeira versão do site, a navegação
 * alternativa morava dentro do próprio custom element de rodapé — sem
 * script, o elemento nunca existia, e a proteção não protegia nada. Só
 * apareceu quando alguém desligou o JavaScript de verdade e olhou.
 *
 * Reapontado para o app Next (Tarefa A1 da fase 2). componentes/MenuMovel.tsx
 * documenta a mesma lição: o servidor SEMPRE entrega o `<nav>` com os 11
 * links soltos no HTML, e o recolhimento no celular é só CSS aplicado depois
 * da hidratação — sem JavaScript (ou entre o HTML chegar e o React assumir),
 * o menu fica do jeito que o servidor mandou: aberto. A fase 1 já provou isso
 * por `fetch` puro (testes/cabecalho.test.mjs). Aqui é com o navegador de
 * verdade, `javascript.enabled=false` no perfil do Firefox — a única forma de
 * garantir que nenhum script, nem um `<script>` inline nem um módulo, está
 * fazendo esse trabalho por baixo.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Páginas que já existem de verdade no app Next nesta fase (mesma lista de
// testes/paginas.test.mjs), mais UMA rota ainda pendente: "/projetos" cai no
// 404 (app/not-found.tsx), que hoje é a segunda página mais alcançada do
// site (nove dos onze itens do menu ainda levam lá). O defeito histórico que
// este arquivo existe para pegar — navegação escondida atrás de script —
// seria mais grave ali, não menos, então vale medir mesmo sem conteúdo
// próprio. Ao portar uma página nova (Tarefas A2 em diante), acrescentar
// aqui também.
const PAGINAS = ['/', '/quem-somos', '/para-escolas', '/privacidade', '/projetos'];

// Os 11 itens do menu principal (componentes/MenuMovel.tsx, export ITENS).
// Duplicado aqui em vez de importado: o arquivo tem JSX, que o carregador de
// TypeScript nativo do Node não transforma — mesma razão documentada em
// testes/links-menu.test.mjs. Corresponde a ROTAS_PRONTAS + ROTAS_PENDENTES
// daquele arquivo, MENOS "/entrar": esse é o botão "Entrar" do cabeçalho,
// fora do <nav>, não um item do menu.
const HREFS_DO_MENU = [
  '/', '/quem-somos', '/projetos', '/agenda', '/noticias', '/galeria',
  '/acervo', '/para-escolas', '/voluntariado', '/doar', '/contato'
];

let navegador;

before(async () => {
  const opcoes = new Options().addArguments('-headless');
  opcoes.setPreference('javascript.enabled', false);
  navegador = await new Builder().forBrowser('firefox').setFirefoxOptions(opcoes).build();
});

after(async () => {
  await navegador?.quit();
});

for (const pagina of PAGINAS) {
  const rotulo = pagina === '/' ? 'início' : pagina;

  test(`${rotulo}: o conteúdo principal existe sem JavaScript`, async () => {
    await navegador.get(`${BASE}${pagina}`);
    const html = await navegador.getPageSource();

    assert.match(html, /<main[^>]*id="conteudo"/, 'falta <main id="conteudo">');
    assert.match(html, /<h1[^>]*>/, 'falta h1');
  });

  test(`${rotulo}: os 11 links do menu chegam prontos, sem JavaScript`, async () => {
    await navegador.get(`${BASE}${pagina}`);
    const html = await navegador.getPageSource();

    const abertura = html.match(/<nav[^>]*id="menu-principal"[^>]*>/);
    assert.ok(abertura, 'nav#menu-principal não chegou no HTML sem JavaScript');
    assert.doesNotMatch(abertura[0], /\shidden(\s|=|>)/,
      'o nav chegou com o atributo hidden — sem JavaScript ninguém vê o menu');

    const faltando = HREFS_DO_MENU.filter((href) => !html.includes(`href="${href}"`));
    assert.deepEqual(faltando, [],
      `links do menu ausentes sem JavaScript: ${faltando.join(', ')}`);
  });

  test(`${rotulo}: os contatos aparecem sem JavaScript`, async () => {
    await navegador.get(`${BASE}${pagina}`);
    const html = await navegador.getPageSource();

    assert.match(html, /tel:\+5511953968344/, 'falta telefone');
    assert.match(html, /mailto:atelieafro@gmail\.com/, 'falta e-mail');
  });
}
