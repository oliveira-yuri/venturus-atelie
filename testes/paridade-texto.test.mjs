/**
 * Compara o texto visível do <main> renderizado pelo Next com o texto
 * visível do <main> do HTML original em site/*.html.
 *
 * Existe porque o Defeito 1 da correção de 2026-08-28 passou por 212 testes
 * e pela verificação de fidelidade anterior: aquela verificação comparava
 * PALAVRAS, e todas as palavras estavam presentes — o que sumiu foi só o
 * ESPAÇO entre elas ("pelo e-mailatelieafro@gmail.com"). Uma quebra de linha
 * entre texto e elemento vira um espaço em HTML, mas é removida em JSX
 * quando fica encostada na tag (armadilha clássica do JSX).
 *
 * Por isso a comparação aqui é de string completa (espaços normalizados),
 * não de presença de palavra: é o único jeito de um espaço que sumiu doer.
 *
 * Este teste protege as 12 páginas que ainda faltam migrar na fase 2 — é o
 * que impede este defeito de se repetir a cada página nova.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

// Mesma convenção de testes/paginas.test.mjs: a suíte inteira (via
// ferramentas/rodar-testes.mjs) já builda e sobe o Next uma vez só. Aqui
// basta um fetch da resposta já renderizada no servidor — o texto do <main>
// não muda com a hidratação, então dispensa selenium/Firefox.
const BASE = process.env.URL_BASE || 'http://localhost:3123';

// A fase 1 deixou a home (`/`) de fora desta lista — nada comparava o texto
// dela com o original, e foi exatamente esse buraco que o brief da Tarefa
// A2 apontou. As outras oito rotas do menu ainda migram na fase 2 (ver
// testes/paginas.test.mjs) — quando migrarem, ganham uma linha aqui também.
const PAGINAS = [
  {
    rota: '/',
    arquivoOriginal: 'site/index.html',
    // Mesma situação de "Onde já estivemos" em /para-escolas (ver o
    // comentário logo abaixo, em idsExcluidos de /para-escolas): "Na mídia"
    // já era dinâmica no HTML estático original — o <div id="lista-midia">
    // chegava vazio e era preenchido no cliente por
    // assets/js/paginas/prova-social.js, lendo os mesmos registros de
    // clipping que a Tarefa A2 passou a buscar no servidor
    // (servidor/dados/conteudo.ts, via componentes/SecaoNaMidia.ts).
    // Comparar o texto bruto do HTML estático (div vazio) contra o HTML já
    // renderizado com os registros de verdade acusaria uma divergência
    // ilegítima — por isso a seção sai desta comparação de string. O
    // conteúdo dela COM registro é provado à parte, contra a página
    // renderizada de verdade, em testes/pagina-home.test.mjs e
    // testes/paginas.test.mjs; a omissão dela SEM nenhum registro de
    // mídia é provada por unidade, direto no componente, em
    // testes/secao-na-midia.test.mjs (Rodada de correção 1 da Tarefa A2 —
    // antes dela nada exercitava esse caminho: comentar o `return null`
    // de componentes/SecaoNaMidia.ts não derrubava teste nenhum).
    idsExcluidos: ['titulo-midia-home']
  },
  { rota: '/quem-somos', arquivoOriginal: 'site/quem-somos.html' },
  { rota: '/privacidade', arquivoOriginal: 'site/privacidade.html' },
  {
    rota: '/para-escolas',
    arquivoOriginal: 'site/para-escolas.html',
    // "Onde já estivemos" já era dinâmica no HTML estático original: o
    // <div id="lista-instituicoes"> chegava vazio e era preenchido no
    // cliente por assets/js/paginas/prova-social.js, lendo os mesmos
    // registros de clipping que a Tarefa 10 passou a buscar no servidor
    // (servidor/dados/conteudo.ts). Comparar o texto bruto do HTML estático
    // contra o HTML já renderizado com esses registros acusaria uma
    // divergência, mas ela é legítima — o site antigo também mostrava essa
    // lista, só que via script, depois da carga da página. Por isso esta
    // seção sai da comparação de string aqui; a omissão dela quando não há
    // registro, e o conteúdo dela quando há, são provados à parte, de
    // verdade, em testes/prova-social.test.mjs. O resto de <main> — que não
    // vem de dado nenhum — continua comparado byte a byte por este teste.
    idsExcluidos: ['titulo-onde-estivemos']
  },
  {
    rota: '/projetos',
    arquivoOriginal: 'site/projetos.html',
    // O <div id="lista-atividades"> chegava vazio no HTML estático original
    // — quem o preenchia era assets/js/paginas/projetos.js, no cliente,
    // lendo listarAtividades(). Desde a Tarefa A3 o servidor busca as 11
    // atividades reais direto (servidor/dados/conteudo.ts, via
    // componentes/CardAtividade.ts) e as renderiza no HTML — comparar o
    // texto bruto do estático (div vazio) contra o renderizado (11 cartões
    // de verdade) acusaria uma divergência ilegítima, mesma situação de
    // "Na mídia" e "Onde já estivemos" acima. O conteúdo das 11 atividades
    // é provado à parte, contra a página renderizada de verdade, em
    // testes/paginas.test.mjs ("mostra as onze atividades" e "atividade
    // sem sinopse não exibe parágrafo vazio"); a omissão de campo por
    // atividade (regra 2 do CLAUDE.md no nível do campo) é provada por
    // unidade, direto no componente, em testes/card-atividade.test.mjs.
    idsExcluidos: ['lista-atividades']
  }
];

// Remove do HTML bruto o elemento (<section aria-labelledby="ID">, ou
// qualquer tag com id="ID") cujo id está em `idsExcluidos`, antes de
// extrair o texto — ver comentário acima.
//
// `exigirPresenca` cobre só o lado ORIGINAL (site/*.html): aquele arquivo é
// estático e versionado, o elemento alvo tem que existir nele sempre — se
// sumir, é sinal de erro de digitação no id, ou de o HTML de origem ter
// mudado sem avisar este teste. Do lado RENDERIZADO a ausência é legítima:
// a decisão 1 da Tarefa 10 manda a <section> inteira sumir quando não há
// nenhum registro (clipping vazio no banco, ou tudo despublicado — ver
// filtrarEOrdenarLocal em servidor/dados/conteudo.ts), e essa omissão já
// tem teste dedicado em testes/prova-social.test.mjs. Cobrar presença aqui
// faria este teste falhar exatamente quando o produto acerta — reproduzido
// forçando listarClipping() a devolver [] antes daquela correção.
function removerSecoesExcluidas(html, idsExcluidos, exigirPresenca) {
  return idsExcluidos.reduce((resultado, id) => {
    const removido = removerElementoPorId(resultado, id);
    if (exigirPresenca) {
      assert.ok(removido.encontrado, `elemento "${id}" a excluir não foi encontrado no HTML original`);
    }
    return removido.html;
  }, html);
}

/**
 * Remove um elemento (identificado por `id="ID"` ou `aria-labelledby="ID"`)
 * do HTML, respeitando aninhamento de tags do MESMO NOME dentro dele.
 *
 * Acrescentado na Tarefa A3 para excluir <div id="lista-atividades"> de
 * /projetos da comparação (a lista é preenchida com dado real, que não
 * existe no HTML estático original — mesma situação de "Onde já
 * estivemos"/"Na mídia", só que a div de origem não é uma <section
 * aria-labelledby>). Um `[\s\S]*?<\/div>` não-guloso, como o antigo regex
 * usava para <section>, pararia no primeiro </div> DE DENTRO da lista — a
 * ficha técnica de cada atividade usa <div> para cada linha
 * (componentes/CardAtividade.ts) — e devolveria HTML pela metade. Contar
 * profundidade por tag resolve isso; funciona também para o caso de
 * <section> que já existia, já que nenhuma das duas seções de prova social
 * aninha outra <section> dentro.
 */
function removerElementoPorId(html, id) {
  const abertura = html.match(new RegExp(
    `<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*(?:\\bid=["']${id}["']|\\baria-labelledby=["']${id}["'])[^>]*>`
  ));
  if (!abertura) return { html, encontrado: false };

  const tag = abertura[1].toLowerCase();
  const inicio = abertura.index;
  const fimAbertura = inicio + abertura[0].length;

  const marcador = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  marcador.lastIndex = fimAbertura;

  let profundidade = 1;
  let fim = -1;
  let m;
  while ((m = marcador.exec(html))) {
    if (m[0].startsWith('</')) {
      profundidade -= 1;
      if (profundidade === 0) {
        fim = m.index + m[0].length;
        break;
      }
    } else if (!m[0].endsWith('/>')) {
      profundidade += 1;
    }
  }

  if (fim === -1) return { html, encontrado: false };
  return { html: html.slice(0, inicio) + html.slice(fim), encontrado: true };
}

function extrairTextoDoMain(html, idsExcluidos = [], exigirPresenca = false) {
  const semSecoesExcluidas = removerSecoesExcluidas(html, idsExcluidos, exigirPresenca);

  const abre = semSecoesExcluidas.match(/<main\b[^>]*id=["']conteudo["'][^>]*>/i);
  assert.ok(abre, 'não achou <main id="conteudo"> no documento');

  const inicio = abre.index + abre[0].length;
  const fim = semSecoesExcluidas.indexOf('</main>', inicio);
  assert.ok(fim !== -1, 'não achou </main> no documento');

  const miolo = semSecoesExcluidas.slice(inicio, fim);
  return normalizarEspacos(decodificarEntidades(removerTags(miolo)));
}

// Elementos de bloco sempre quebram linha na tela, com ou sem espaço em
// branco no HTML fonte entre eles — por isso viram espaço aqui mesmo quando
// estão colados na tag vizinha (ex.: "</h1><p>" sem espaço nenhum no
// arquivo). Elementos em linha (a, strong...) não: se o texto some colado
// neles, é porque coisa nenhuma teria feito a tela mostrar espaço ali — é
// exatamente o Defeito 1 que este teste existe para pegar.
const BLOCOS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'header', 'footer', 'nav', 'main',
  'blockquote', 'pre', 'table', 'tr', 'td', 'th', 'form', 'fieldset',
  'figure', 'figcaption', 'br', 'hr'
]);

function removerTags(html) {
  return html
    // Comentários primeiro: o React usa `<!--$-->` como marcador interno de
    // hidratação, e o formato deles ("<!--...-->") não bate com o padrão de
    // tag abaixo (não começa com letra) — ficariam no texto se não saírem
    // aqui, sem inserir espaço, por não corresponderem a conteúdo nenhum.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, tag) =>
      BLOCOS.has(tag.toLowerCase()) ? ' ' : '');
}

function decodificarEntidades(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ');
}

// Uma quebra de linha entre texto e elemento vale um espaço em HTML — é a
// regra que a normalização replica aqui, dos dois lados da comparação.
function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

for (const pagina of PAGINAS) {
  test(`${pagina.rota}: texto visível do <main> é idêntico ao HTML original`, async () => {
    const idsExcluidos = pagina.idsExcluidos ?? [];

    const htmlOriginal = readFileSync(path.join(RAIZ, pagina.arquivoOriginal), 'utf-8');
    const textoOriginal = extrairTextoDoMain(htmlOriginal, idsExcluidos, /* exigirPresenca */ true);

    const resposta = await fetch(`${BASE}${pagina.rota}`);
    assert.equal(resposta.status, 200, `${pagina.rota} não respondeu 200`);
    const htmlRenderizado = await resposta.text();
    const textoRenderizado = extrairTextoDoMain(htmlRenderizado, idsExcluidos, /* exigirPresenca */ false);

    assert.equal(textoRenderizado, textoOriginal);
  });
}
