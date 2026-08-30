/**
 * componentes/ListaAreas.ts — as áreas de voluntariado (RF24), ou o
 * estado vazio.
 *
 * Diferente de componentes/ListaEventos.ts e componentes/ListaMateriais.ts
 * (Tarefa A4, tabelas `eventos`/`acervo` vazias hoje): a tabela
 * `areas_voluntariado` TEM dado real em produção — as cinco áreas do seed
 * (supabase/seed.sql). O caso vazio só acontece hoje em modo offline
 * (`npm test`, sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL — ver
 * servidor/dados/voluntariado.ts), porque `areas_voluntariado` não tem JSON
 * versionado irmão para servir de fallback (ao contrário de atividades e
 * clipping). Mesmo assim, o texto de estado vazio precisa ser honesto e
 * real — mesma decisão de desenho de ListaEventos/ListaMateriais: a seção
 * "Onde você pode ajudar" sempre desenha algo, nunca fica com só o <h2> e
 * nada embaixo (mesma classe de defeito que motivou aquela decisão).
 *
 * Escrito com createElement, não JSX — mesmo motivo de ListaEventos.ts e
 * ListaMateriais.ts: fica um .ts puro, testável com react-dom/server pelo
 * runtime nativo do Node, sem subir o Next nem o Supabase.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaAreas } from '../componentes/ListaAreas.ts';

// Mesmo texto de site/assets/js/paginas/voluntariado.js (mensagemVazio
// passada a renderizarEstado) — o port não inventa um texto novo.
const MENSAGEM_VAZIO = 'As áreas de atuação ainda estão sendo organizadas. '
  + 'Fale com a gente que explicamos pessoalmente.';

// As cinco áreas reais do seed (supabase/seed.sql) — id, nome, descricao.
const AREAS_REAIS = [
  { id: 'apoio-pedagogico', nome: 'Apoio pedagógico e oficinas', descricao: 'Reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais.' },
  { id: 'comunicacao', nome: 'Comunicação e mídias', descricao: 'Fotos, vídeos, textos para redes sociais, divulgação de projetos e editais.' },
  { id: 'producao-eventos', nome: 'Produção de eventos', descricao: 'Montagem de exposições, recepção de público, feiras culturais, apresentações.' },
  { id: 'acervo', nome: 'Organização de acervo', descricao: 'Catalogação de livros, roupas, instrumentos musicais, fantasias e peças de memória ancestral.' },
  { id: 'administrativo', nome: 'Apoio administrativo', descricao: 'Captação de recursos, planejamento de projetos, atendimento à comunidade.' }
];

function renderizar(areas, mensagemVazio = MENSAGEM_VAZIO) {
  return renderToStaticMarkup(createElement(ListaAreas, { areas, mensagemVazio }));
}

test('lista vazia (modo offline, sem JSON de fallback): mostra o estado vazio com o texto exato recebido', () => {
  const html = renderizar([]);
  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, /As áreas de atuação ainda estão sendo organizadas\. Fale com a gente que explicamos pessoalmente\./);
});

test('lista vazia não desenha nenhum <article class="setor">', () => {
  assert.doesNotMatch(renderizar([]), /class="setor"/);
});

test('com as cinco áreas reais, desenha um <article class="setor"> por área', () => {
  const html = renderizar(AREAS_REAIS);
  for (const area of AREAS_REAIS) {
    assert.match(html, new RegExp(`<h3>${area.nome.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}</h3>`));
  }
  assert.equal((html.match(/class="setor"/g) || []).length, 5);
});

test('cada área mostra nome e descrição', () => {
  const html = renderizar([AREAS_REAIS[0]]);
  assert.match(html, /<h3>Apoio pedagógico e oficinas<\/h3>/);
  assert.match(
    html,
    /<p>Reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais\.<\/p>/
  );
});
