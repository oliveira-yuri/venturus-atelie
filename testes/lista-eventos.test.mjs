/**
 * componentes/ListaEventos.ts — a lista de eventos da agenda (RF14), ou o
 * estado vazio.
 *
 * Tarefa A4: ao contrário de componentes/SecaoNaMidia.ts e
 * componentes/SecaoOndeEstivemos.ts (que OMITEM a seção inteira sem
 * registro — regra 2 do CLAUDE.md), aqui a lista vazia é o caso NORMAL:
 * as tabelas eventos/acervo estão vazias hoje e continuam assim até o
 * Bloco B/C. Uma seção "Em breve" com só o <h2> e nada embaixo é pior que
 * inútil — por isso este componente sempre desenha algo: os cartões, OU um
 * parágrafo `.estado.estado--vazio` com texto real (aprovado no relatório
 * da Tarefa A4), nunca nada.
 *
 * Escrito com createElement, não JSX — mesmo motivo de CardAtividade.ts:
 * fica um .ts puro, importável direto pelo runtime nativo do Node (que
 * despe os tipos mas não transforma JSX), testável com react-dom/server
 * sem subir o Next nem o Supabase.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaEventos } from '../componentes/ListaEventos.ts';

const MENSAGEM_VAZIO = 'Nenhuma atividade marcada por enquanto.';

/** Evento completo: todo campo opcional presente. */
const COMPLETO = {
  id: 'oficina-trancas',
  titulo: 'Oficina de tranças',
  descricao: 'Uma tarde de cuidado capilar e troca entre gerações.',
  comeca_em: '2026-11-05T19:00:00.000Z',
  termina_em: null,
  local: 'Sede do Ateliê, Casa Verde',
  faixa_etaria: 'Livre'
};

/** Evento real mínimo: só o obrigatório (id, título, início). */
const MINIMO = {
  id: 'roda-de-capoeira',
  titulo: 'Roda de capoeira',
  descricao: null,
  comeca_em: '2026-12-01T15:00:00.000Z',
  termina_em: null,
  local: null,
  faixa_etaria: null
};

function renderizar(eventos, mensagemVazio = MENSAGEM_VAZIO) {
  return renderToStaticMarkup(createElement(ListaEventos, { eventos, mensagemVazio }));
}

test('lista vazia (o caso normal hoje): mostra o estado vazio com o texto exato recebido, não a seção omitida', () => {
  const html = renderizar([]);
  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, new RegExp(MENSAGEM_VAZIO));
});

test('lista vazia não desenha nenhum <article> nem <div class="lista-atividades">', () => {
  const html = renderizar([]);
  assert.doesNotMatch(html, /<article/);
  assert.doesNotMatch(html, /lista-atividades/);
});

test('mensagem vazia diferente por seção: o texto renderizado é o que foi passado, não um texto fixo interno', () => {
  const html = renderizar([], 'Ainda não há registro de atividades passadas por aqui.');
  assert.match(html, /Ainda não há registro de atividades passadas por aqui\./);
});

test('com eventos, desenha um <article class="atividade"> por evento, com o id do evento', () => {
  const html = renderizar([COMPLETO, MINIMO]);
  assert.match(html, /<article class="atividade" id="oficina-trancas">/);
  assert.match(html, /<article class="atividade" id="roda-de-capoeira">/);
});

test('evento completo: título, horário, local, descrição e faixa etária aparecem', () => {
  const html = renderizar([COMPLETO]);
  assert.match(html, /<h3 class="atividade__titulo">Oficina de tranças<\/h3>/);
  // react-dom/server emite o atributo como "dateTime" (o nome do PROP em
  // React, não a grafia HTML "datetime") — MEDIDO em node_modules/react-dom
  // /cjs/react-dom-server.node.development.js: só um mapa fixo de aliases
  // (SVG e alguns poucos como htmlFor/acceptCharset) reescreve o nome; fora
  // dele o prop passa direto. Não é defeito: nomes de atributo HTML são
  // case-insensitive por especificação, então o navegador interpreta
  // "dateTime" e "datetime" como o mesmo atributo ao fazer o parse.
  assert.match(html, /<time dateTime="2026-11-05T19:00:00\.000Z">/);
  assert.match(html, / · Sede do Ateliê, Casa Verde/);
  assert.match(html, /<p>Uma tarde de cuidado capilar e troca entre gerações\.<\/p>/);
  assert.match(html, /<strong>Para:<\/strong> Livre/);
});

test('evento sem local não deixa " · " solto no parágrafo de horário', () => {
  const html = renderizar([MINIMO]);
  const paragrafoResumo = html.match(/<p class="atividade__resumo">[\s\S]*?<\/p>/)[0];
  assert.doesNotMatch(paragrafoResumo, / · /, 'sem local, não deveria sobrar o separador " · "');
});

test('evento sem descrição não deixa <p></p> vazio no lugar', () => {
  const html = renderizar([MINIMO]);
  assert.doesNotMatch(html, /<p><\/p>/);
});

test('evento sem faixa etária não deixa "Para:" sem valor', () => {
  const html = renderizar([MINIMO]);
  assert.doesNotMatch(html, /Para:/);
});

test('nenhum evento gera link para /inscricao — RF15 é Bloco B, fora desta tarefa', () => {
  const html = renderizar([COMPLETO, MINIMO]);
  assert.doesNotMatch(html, /inscricao/, 'a Tarefa A4 não porta o botão "Quero me inscrever" (ver comentário de ListaEventos.ts)');
});
