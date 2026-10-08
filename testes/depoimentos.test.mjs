import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  lerDepoimento, validarDepoimento, LIMITE_TEXTO_DO_DEPOIMENTO
} from '../compartilhado/validacao.ts';
import {
  SITUACOES_DE_DEPOIMENTO, ehSituacaoDeDepoimento, ordenarParaModeracao,
  avisoDoFormularioDeDepoimento, avisoDaModeracao
} from '../compartilhado/depoimentos.ts';
import { ListaDepoimentos } from '../componentes/ListaDepoimentos.ts';
import { ListaDepoimentosDoPainel } from '../componentes/ListaDepoimentosDoPainel.ts';

/** Tira comentários: a varredura de código não pode ler a palavra de um comentário como se fosse código. */
function semComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const semComentariosSql = (sql) => sql.replace(/--.*$/gm, '');
const ler = async (caminho) => semComentarios(
  await readFile(fileURLToPath(new URL(`../${caminho}`, import.meta.url)), 'utf8'));
const lerSql = async () => semComentariosSql(
  await readFile(fileURLToPath(new URL('../supabase/migrations/014_depoimentos.sql', import.meta.url)), 'utf8'));

const TEXTO = 'Foi uma tarde que a minha filha não esquece, obrigada.';
function formulario(campos) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}
const BOM = { nome: 'Maria', texto: TEXTO, declara_adulto: 'on', autoriza_publicacao: 'on' };

test('validação: um depoimento completo passa', () => {
  assert.equal(validarDepoimento(lerDepoimento(formulario(BOM))).valido, true);
});

test('validação: as duas declarações são obrigatórias, e cada uma tem a própria frase', () => {
  const sem = (campo) => validarDepoimento(lerDepoimento(formulario({ ...BOM, [campo]: '' })));
  assert.match(sem('declara_adulto').erros.declara_adulto, /18 anos/);
  assert.match(sem('autoriza_publicacao').erros.autoriza_publicacao, /publicar/);
  // "false" no corpo de uma requisição montada à mão NÃO conta como marcado.
  assert.equal(validarDepoimento(lerDepoimento(formulario({ ...BOM, declara_adulto: 'false' }))).valido, false);
});

test('validação: nome e texto obrigatórios, texto entre 20 e 1500 caracteres', () => {
  const r = validarDepoimento(lerDepoimento(formulario({ ...BOM, nome: '', texto: 'curto' })));
  assert.ok(r.erros.nome && r.erros.texto);
  const longo = validarDepoimento(lerDepoimento(formulario({ ...BOM, texto: 'a'.repeat(LIMITE_TEXTO_DO_DEPOIMENTO + 1) })));
  assert.match(longo.erros.texto, /passou de/);
});

test('leitura: o FormData é lido campo a campo — campos de moderação no corpo são ignorados', () => {
  const campos = lerDepoimento(formulario({ ...BOM, situacao: 'aprovado', moderado_em: 'agora', id: 'x' }));
  assert.deepEqual(Object.keys(campos).sort(), ['atividade', 'autorizaPublicacao', 'declaraAdulto', 'nome', 'texto']);
});

test('as situações da tela são exatamente as do check do banco (014)', async () => {
  const sql = await lerSql();
  const check = sql.match(/situacao\s+text not null default 'pendente'\s+check \(situacao in \(([^)]*)\)\)/);
  assert.ok(check, 'não achei o check de situacao em 014_depoimentos.sql');
  const doBanco = [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...SITUACOES_DE_DEPOIMENTO].sort(), doBanco.sort());
  assert.equal(ehSituacaoDeDepoimento('publicado'), false);
  assert.equal(ehSituacaoDeDepoimento(undefined), false);
});

test('fila: quem espera moderação vem primeiro; dentro do grupo, o mais novo', () => {
  const ordem = ordenarParaModeracao([
    { id: 'a', situacao: 'aprovado', criado_em: '2026-10-05T10:00:00Z' },
    { id: 'b', situacao: 'pendente', criado_em: '2026-10-01T10:00:00Z' },
    { id: 'c', situacao: 'recusado', criado_em: '2026-10-06T10:00:00Z' },
    { id: 'd', situacao: 'pendente', criado_em: '2026-10-03T10:00:00Z' }
  ]).map((x) => x.id);
  assert.deepEqual(ordem, ['d', 'b', 'a', 'c']);
});

test('avisos: lista fechada, sem herdar do protótipo', () => {
  assert.equal(avisoDoFormularioDeDepoimento('enviado').ok, true);
  for (const ruim of ['toString', 'constructor', '__proto__', undefined, ['enviado']]) {
    assert.equal(avisoDoFormularioDeDepoimento(ruim), null);
    assert.equal(avisoDaModeracao(ruim), null);
  }
  assert.equal(avisoDaModeracao('erro').ok, false);
});

test('a página pública: vazio escrito sem inventar nada, e cheio sem estado vazio', () => {
  const vazio = renderToStaticMarkup(createElement(ListaDepoimentos, { depoimentos: [] }));
  assert.match(vazio, /Ainda não há depoimentos publicados/);
  const cheio = renderToStaticMarkup(createElement(ListaDepoimentos, {
    depoimentos: [{ id: '1', nome: 'Maria', atividade: 'Oficina', texto: `${TEXTO}\n\nSegundo parágrafo <b>x</b>` }]
  }));
  assert.doesNotMatch(cheio, /Ainda não há/);
  assert.match(cheio, /<blockquote/);
  assert.match(cheio, /Maria<\/strong> · Oficina/);
  assert.match(cheio, /&lt;b&gt;x&lt;\/b&gt;/, 'o texto vai escapado, nunca como HTML');
});

test('a fila do painel: botões certos por situação, e a falha de consulta não vira "nenhum"', () => {
  const item = (situacao) => ({ id: 'i', nome: 'Maria', atividade: null, texto: TEXTO, situacao, criado_em: '2026-10-01T12:00:00Z' });
  const html = (situacao) => renderToStaticMarkup(createElement(ListaDepoimentosDoPainel, {
    itens: [item(situacao)], acaoModerar: '/x', degradou: false }));
  assert.match(html('pendente'), /Aprovar e publicar/);
  assert.match(html('pendente'), /Recusar/);
  assert.doesNotMatch(html('pendente'), /Tirar do ar/);
  assert.match(html('aprovado'), /Tirar do ar/);
  assert.doesNotMatch(html('aprovado'), /Aprovar e publicar/);
  const falha = renderToStaticMarkup(createElement(ListaDepoimentosDoPainel, { itens: [], acaoModerar: '/x', degradou: true }));
  assert.match(falha, /estado--erro/);
  assert.doesNotMatch(falha, /Nenhum depoimento recebido/);
});

// --- Varreduras: as duas Actions têm políticas OPOSTAS --------------------

test('acoes/depoimento.ts (público) NÃO chama ehEquipe(), grava por RPC e nunca escreve a situação', async () => {
  const codigo = await ler('acoes/depoimento.ts');
  assert.doesNotMatch(codigo, /ehEquipe\s*\(/, 'o formulário é público: sem conta, sem guarda');
  assert.match(codigo, /\.rpc\('registrar_depoimento'/);
  assert.doesNotMatch(codigo, /situacao|moderado_em/, 'a Action pública não conhece a coluna de moderação');
  assert.doesNotMatch(codigo, /\.select\(/, 'pedir a linha de volta faria o envio parecer falha');
  assert.doesNotMatch(codigo, /\.delete\(|\.update\(/);
});

test('acoes/depoimentos.ts (moderação) EXIGE ehEquipe(), faz um update e nenhum insert/delete', async () => {
  const codigo = await ler('acoes/depoimentos.ts');
  assert.match(codigo, /await ehEquipe\(\)/);
  assert.equal((codigo.match(/\.update\(/g) ?? []).length, 1);
  assert.doesNotMatch(codigo, /\.insert\(|\.delete\(|\.upsert\(/);
  const update = codigo.match(/\.update\(\{([^}]*)\}\)/)[1];
  assert.doesNotMatch(update, /texto|nome|atividade/, 'o que a pessoa escreveu é registro');
});

test('a guarda aparece antes de qualquer consulta, na ação de moderar', async () => {
  const codigo = await ler('acoes/depoimentos.ts');
  assert.ok(codigo.indexOf('ehEquipe()') < codigo.indexOf('obterCliente()'));
});

test('a página do painel guarda o corpo E o generateMetadata', async () => {
  const codigo = await ler('app/admin/depoimentos/page.tsx');
  assert.equal((codigo.match(/if \(!await ehEquipe\(\)\) notFound\(\);/g) ?? []).length, 2);
});

// --- A migration ----------------------------------------------------------

test('014: RLS na mesma migration, leitura pública só do aprovado, escrita só pendente, e o limite de envio ligado', async () => {
  const sql = await lerSql();
  assert.match(sql, /enable row level security/);
  assert.match(sql, /using \(situacao = 'aprovado' or public\.eh_equipe\(\)\)/);
  assert.match(sql, /with check \(situacao = 'pendente' and moderado_em is null/);
  assert.match(sql, /create trigger limitar_depoimentos/);
  assert.match(sql, /constraint depoimento_exige_adulto check \(declara_adulto\)/);
  assert.match(sql, /constraint depoimento_exige_autorizacao check \(autoriza_publicacao\)/);
  assert.doesNotMatch(sql, /email|telefone/i, 'coleta mínima: o depoimento não guarda contato');
  assert.doesNotMatch(sql, /grant [^;]*delete[^;]*to anon/);
});
