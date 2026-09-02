/**
 * As três funções que transformam HTML em "o texto que a pessoa vê na
 * tela": remover as tags, decodificar as entidades, normalizar os espaços.
 *
 * POR QUE MORAM AQUI, E NÃO DENTRO DE testes/paridade-texto.test.mjs (de
 * onde saíram na rodada de correção 2 da Tarefa A8). Aquele arquivo aplica
 * estas três funções aos DOIS lados da comparação — o HTML original
 * congelado e o HTML que o Next renderiza. Isso torna o teste cego para
 * defeito NELAS: um erro aqui se aplica aos dois lados e a diferença se
 * cancela.
 *
 * Não é suposição. MEDIDO na revisão da Tarefa A8: trocada
 * normalizarEspacos por uma versão mascarante E reintroduzido o defeito
 * real do e-mail colado em /privacidade, ao mesmo tempo, o arquivo de
 * paridade deu 15 testes, 15 verdes, com o defeito na tela.
 *
 * Extrair para cá permite que testes/texto-visivel.test.mjs as verifique
 * DE FORA, com o resultado esperado escrito à mão — nunca gerado por elas
 * mesmas, que é como este tipo de teste vira tautologia. Um módulo comum
 * (e não um `export` no próprio `*.test.mjs`) porque importar um
 * `*.test.mjs` reexecuta, no processo de quem importa, todo `test()` de
 * nível superior que ele contiver — medido na Rodada de correção 1 da
 * Tarefa A1, e o motivo de testes/apoio/rotas-migracao.mjs existir.
 *
 * Este módulo não declara nenhum `test()`, pelo mesmo motivo.
 */

// Elementos de bloco sempre quebram linha na tela, com ou sem espaço em
// branco no HTML fonte entre eles — por isso viram espaço aqui mesmo quando
// estão colados na tag vizinha (ex.: "</h1><p>" sem espaço nenhum no
// arquivo). Elementos em linha (a, strong...) não: se o texto some colado
// neles, é porque coisa nenhuma teria feito a tela mostrar espaço ali — é
// exatamente o Defeito 1 que o teste de paridade existe para pegar.
export const BLOCOS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'header', 'footer', 'nav', 'main',
  'blockquote', 'pre', 'table', 'tr', 'td', 'th', 'form', 'fieldset',
  'figure', 'figcaption', 'br', 'hr'
]);

export function removerTags(html) {
  return html
    // Comentários primeiro: o React usa `<!--$-->` como marcador interno de
    // hidratação, e o formato deles ("<!--...-->") não bate com o padrão de
    // tag abaixo (não começa com letra) — ficariam no texto se não saírem
    // aqui, sem inserir espaço, por não corresponderem a conteúdo nenhum.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, tag) =>
      BLOCOS.has(tag.toLowerCase()) ? ' ' : '');
}

/**
 * As seis entidades que o React pode emitir ao serializar texto (`&`, `<`,
 * `>`, `"`, `'`) mais `&nbsp;`.
 *
 * MEDIDO na rodada de correção 2 da Tarefa A8: hoje **nenhuma** delas
 * aparece no texto do `<main>` dos 15 HTML congelados — o conteúdo da ONG
 * não tem `&`, aspas retas nem apóstrofo reto, e o travessão dela é o
 * caractere literal `—`, não `&mdash;` (que, por isso, NÃO está nesta
 * tabela; acrescentar seria inventar interface). Ou seja: esta função é um
 * guarda-corpo para conteúdo que ainda não chegou, e o teste de unidade é
 * hoje a única coisa que a observa.
 */
export function decodificarEntidades(texto) {
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
export function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * O texto visível, mas PARTIDO POR BLOCO em vez de achatado numa string só.
 *
 * =====================================================================
 * POR QUE ISTO EXISTE (decisão D1, 02/09/2026)
 * =====================================================================
 *
 * `removerTags` troca todo elemento de bloco por um espaço, e o resultado é
 * uma linha só: título, parágrafo e item de lista viram texto corrido. Isso
 * serve para comparar duas páginas POR IGUALDADE — que foi o que
 * `paridade-texto.test.mjs` fez enquanto a missão era provar que a migração
 * não perdeu uma palavra.
 *
 * A missão mudou. O design system e o pedido V1 ACRESCENTAM texto às
 * páginas (numeração, "Saber mais", seções novas) e às vezes MOVEM texto
 * para uma rota de detalhe. Com igualdade, toda melhoria de tela vira teste
 * vermelho — e a saída fácil, excluir mais um id da comparação, vai
 * esvaziando a garantia até ela não valer nada.
 *
 * A garantia que precisa sobreviver é outra, e é mais simples de dizer:
 * NENHUMA FRASE DA ONG PODE SUMIR DO SITE. Para cobrar isso é preciso ter
 * as frases separadas, e é o que esta função entrega.
 *
 * =====================================================================
 * O QUE ELA PRESERVA DO TESTE ANTIGO
 * =====================================================================
 *
 * O defeito real que a paridade pegou foi `e-mailatelieafro@gmail.com`:
 * duas palavras coladas por falta de espaço entre elementos EM LINHA. Ele
 * continua sendo pego, porque o bloco original ("E-mail
 * atelieafro@gmail.com") deixa de ser encontrado no renderizado — a busca é
 * pelo conteúdo do bloco inteiro, não por palavra solta.
 *
 * `BLOCOS` é a MESMA lista que `removerTags` usa. Duas listas divergiriam
 * em qual elemento quebra linha, e a divergência seria invisível.
 *
 * O SENTINELA É ``, e não um espaço: um espaço partiria em cada
 * palavra. É um caractere de controle que não aparece em conteúdo de texto
 * — se um dia aparecer, ele some junto com o bloco, e o teste acusa.
 */
export const SENTINELA_DE_BLOCO = '';

export function blocosDeTexto(html) {
  const marcado = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, tag) =>
      BLOCOS.has(tag.toLowerCase()) ? SENTINELA_DE_BLOCO : '');

  return decodificarEntidades(marcado)
    .split(SENTINELA_DE_BLOCO)
    .map((pedaco) => normalizarEspacos(pedaco))
    .filter((pedaco) => pedaco.length > 0);
}
