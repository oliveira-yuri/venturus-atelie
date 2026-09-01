/**
 * componentes/ListaMateriais.ts — a lista do acervo aberto (RF35), ou o
 * estado vazio.
 *
 * Mesma decisão de testes/lista-eventos.test.mjs: a tabela `acervo` está
 * vazia hoje, e o estado vazio é o caso NORMAL, não uma seção omitida —
 * ver o comentário de componentes/ListaMateriais.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaMateriais } from '../componentes/ListaMateriais.ts';

const MENSAGEM_VAZIO = 'Ainda não há material publicado no acervo. Estamos preparando os primeiros.';

/**
 * Material completo: todo campo opcional presente, mais os DOIS endereços
 * já resolvidos.
 *
 * `urlDownload` nasceu com o RF36 (01/09/2026): é o mesmo arquivo com
 * `?download=<nome>`, que é o que faz o Storage responder
 * `Content-Disposition: attachment`. O atributo `download` de um `<a>` NÃO
 * funciona entre origens, e o arquivo está SEMPRE em outra origem — o bloco
 * inteiro está no cabeçalho de `enderecoParaBaixar`, em
 * servidor/dados/acervo.ts.
 */
const COMPLETO = {
  id: 'cartilha-consciencia-negra',
  titulo: 'Cartilha do Mês da Consciência Negra',
  descricao: 'Atividades para trabalhar história e cultura afro-brasileira em sala de aula.',
  tema: 'Educação antirracista',
  faixa_etaria: 'Ensino fundamental',
  tamanho_bytes: 2_500_000,
  arquivo_caminho: 'cartilhas/consciencia-negra.pdf',
  url: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/cartilhas/consciencia-negra.pdf',
  urlDownload: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/cartilhas/consciencia-negra.pdf?download=cartilha-do-mes-da-consciencia-negra.pdf'
};

/** Material real mínimo: só o obrigatório (id, título, caminho do arquivo, urls). */
const MINIMO = {
  id: 'ficha-tecnica-banzo',
  titulo: 'Ficha técnica — Banzo',
  descricao: null,
  tema: null,
  faixa_etaria: null,
  tamanho_bytes: null,
  arquivo_caminho: 'fichas/banzo.pdf',
  url: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/fichas/banzo.pdf',
  urlDownload: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/fichas/banzo.pdf?download=ficha-tecnica-banzo.pdf'
};

function renderizar(materiais, mensagemVazio = MENSAGEM_VAZIO) {
  return renderToStaticMarkup(createElement(ListaMateriais, { materiais, mensagemVazio }));
}

test('lista vazia (o caso normal hoje): mostra o estado vazio com o texto exato recebido', () => {
  const html = renderizar([]);
  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, new RegExp(MENSAGEM_VAZIO.replace(/[.]/g, '\\.')));
});

test('lista vazia não desenha nenhum <article>', () => {
  assert.doesNotMatch(renderizar([]), /<article/);
});

test('mensagem vazia com busca sem resultado é a que foi passada, não a mensagem padrão', () => {
  const html = renderizar([], 'Nada encontrado para "quilombo". Tente outra palavra.');
  // react-dom/server escapa aspas em nó de texto (&quot;) — HTML só exige
  // isso dentro de atributo, mas React escapa de forma uniforme; o
  // navegador decodifica de volta para " ao exibir. Mesma entidade que
  // testes/paridade-texto.test.mjs já trata em decodificarEntidades().
  assert.match(html, /Nada encontrado para &quot;quilombo&quot;\. Tente outra palavra\./);
});

test('com materiais, desenha um <article class="atividade"> por material, com o id do material', () => {
  const html = renderizar([COMPLETO, MINIMO]);
  assert.match(html, /<article class="atividade" id="cartilha-consciencia-negra">/);
  assert.match(html, /<article class="atividade" id="ficha-tecnica-banzo">/);
});

test('material completo: título, descrição, ficha (tema/faixa/tamanho) e link de download aparecem', () => {
  const html = renderizar([COMPLETO]);
  assert.match(html, /<h3 class="atividade__titulo">Cartilha do Mês da Consciência Negra<\/h3>/);
  assert.match(html, /<p>Atividades para trabalhar história e cultura afro-brasileira em sala de aula\.<\/p>/);
  assert.match(html, /<dt>Tema<\/dt><dd>Educação antirracista<\/dd>/);
  assert.match(html, /<dt>Para<\/dt><dd>Ensino fundamental<\/dd>/);
  assert.match(html, /<dt>Tamanho<\/dt><dd>2\.4 MB<\/dd>/);
  // DOIS links desde o RF36 — abrir para ler e baixar. O de baixar aponta
  // para `urlDownload` (com `?download=`), não para `url`: o atributo
  // `download` do HTML é ignorado entre origens, e o arquivo está sempre em
  // outra origem.
  assert.match(html, /<a class="botao botao--secundario" href="[^"]+" target="_blank" rel="noopener">Abrir para ler/);
  assert.match(
    html,
    /<a class="botao" href="https:\/\/exemplo\.supabase\.co\/storage\/v1\/object\/public\/acervo\/cartilhas\/consciencia-negra\.pdf\?download=cartilha-do-mes-da-consciencia-negra\.pdf" download="">Baixar material/
  );
});

test('material sem descrição não deixa <p></p> vazio no lugar', () => {
  assert.doesNotMatch(renderizar([MINIMO]), /<p><\/p>/);
});

test('material sem tema, faixa etária nem tamanho não desenha <dl> vazia', () => {
  const html = renderizar([MINIMO]);
  assert.doesNotMatch(html, /<dl/, 'sem nenhum campo de ficha, a <dl> inteira não deveria aparecer');
});

test('material sem tamanho não mostra "Tamanho" na ficha, mas mantém os campos que tem', () => {
  const comTemaSemTamanho = { ...MINIMO, tema: 'Música' };
  const html = renderizar([comTemaSemTamanho]);
  assert.match(html, /<dt>Tema<\/dt><dd>Música<\/dd>/);
  assert.doesNotMatch(html, /<dt>Tamanho<\/dt>/);
});

test('o link de download sempre existe (arquivo_caminho é obrigatório na tabela) e nunca fica vazio', () => {
  const html = renderizar([MINIMO]);
  assert.match(html, /<a class="botao" href="[^"]*\?download=[^"]+" download="">Baixar material/);
});

test('tamanho em KB quando menor que 1 MB', () => {
  const pequeno = { ...MINIMO, tamanho_bytes: 500_000 };
  const html = renderizar([pequeno]);
  assert.match(html, /<dd>488 KB<\/dd>/);
});
