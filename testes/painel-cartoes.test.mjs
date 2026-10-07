/**
 * Os cartões do painel no celular (revisão de 07/10/2026): linha de topo,
 * botões em coluna, campo de busca do filtro e o WhatsApp que não existe ali.
 *
 * O que se mede é o markup e as regras de CSS que o sustentam. A TELA foi
 * vista numa bancada com os componentes reais e o CSS real (o painel exige
 * sessão de equipe, que a suíte não tem) — ver CLAUDE.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaVoluntarios } from '../componentes/ListaVoluntarios.ts';
import { FiltroDaFila } from '../componentes/FiltroDaFila.ts';
import { montarTriagemDeVoluntarios } from '../compartilhado/triagem-de-voluntarios.ts';

const css = (arquivo) => readFileSync(new URL(`../estilos/${arquivo}`, import.meta.url), 'utf8');
const aplicado = css('sistema-aplicado.css');

const candidatura = (id, situacao) => ({
  id, nome: `Pessoa ${id}`, email: `${id}@exemplo.test`, telefone: null, tipo_pessoa: 'fisica',
  areas: ['Oficinas'], mensagem: null, situacao, criado_em: '2026-10-01T12:00:00.000Z'
});

const lista = (situacoes) => renderToStaticMarkup(createElement(ListaVoluntarios, {
  itens: montarTriagemDeVoluntarios(situacoes.map((s, i) => candidatura(`p${i}`, s))),
  acaoSituacao: '/x', degradou: false
}));

test('o cartão de candidatura abre com "Candidatura" e a situação, na mesma linha', () => {
  const html = lista(['em_contato']);
  assert.match(html,
    /<p class="voluntario__marcas"><span class="voluntario__rotulo">Candidatura<\/span><span class="voluntario__estado">Em contato<\/span><\/p>/);
});

test('"Encerrar" é o ÚLTIMO botão e o único discreto — o gesto mais pesado não é o primeiro alvo', () => {
  const html = lista(['ativo']);
  const botoes = [...html.matchAll(/<button type="submit" class="([^"]*)">([^<]*)/g)];
  assert.ok(botoes.length >= 2, 'o cartão devia ter botões de triagem');

  const ultimo = botoes[botoes.length - 1];
  assert.match(ultimo[1], /voluntario__botao--discreto/);
  assert.equal(ultimo[2], 'Encerrar');
  assert.equal(botoes.slice(0, -1).some((b) => /discreto/.test(b[1])), false);
});

test('um cartão já encerrado não ganha botão discreto nenhum', () => {
  assert.doesNotMatch(lista(['inativo']), /voluntario__botao--discreto/);
});

test('o campo de busca do filtro está dentro de .filtro__campo e tem regra de estilo própria', () => {
  const html = renderToStaticMarkup(createElement(FiltroDaFila, {
    filtro: { busca: '', area: '', situacao: '', tipoPessoa: '' },
    situacoes: [], areas: [], nomePlural: 'candidaturas', ativo: false
  }));
  assert.match(html, /<p class="filtro__campo"><label[^>]*>Nome ou e-mail<\/label><input[^>]*type="search"/);

  // Era o único campo do painel sem estilo: caía no padrão do navegador.
  assert.match(aplicado, /\.filtro__campo input\[type="search"\]/);
  assert.match(aplicado, /min-height:\s*var\(--alvo-toque\)/);
});

test('os grupos de botões do painel são padronizados pelo sufixo __botoes, e a presença fica de fora', () => {
  assert.match(aplicado, /\.painel \[class\*="__botoes"\]:not\(\.presenca__botoes\)/);
  assert.match(aplicado, /flex-direction:\s*column/);

  // Todo grupo de botões de cartão nomeado hoje cai no seletor.
  const usados = new Set();
  for (const arquivo of readdirSync(new URL('../componentes/', import.meta.url))) {
    if (!/^Lista.*\.ts$/.test(arquivo)) continue;
    const fonte = readFileSync(new URL(`../componentes/${arquivo}`, import.meta.url), 'utf8');
    for (const m of fonte.matchAll(/className:\s*'([a-z-]+__botoes)'/g)) usados.add(m[1]);
  }
  assert.ok(usados.size >= 9, `esperava ao menos 9 grupos de botões nas listas, achei ${usados.size}`);
  assert.ok(usados.has('presenca__botoes'), 'a lista de presença continua com o grupo próprio');
});

test('o botão flutuante de WhatsApp não aparece no painel', () => {
  assert.match(aplicado, /body:has\(\.painel\)\s+\.zap\s*\{\s*display:\s*none;?\s*\}/);
});

test('o painel continua dentro de um contêiner .painel — é ele que o :has procura', () => {
  const layout = readFileSync(new URL('../app/admin/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<div className="painel">/);
});
