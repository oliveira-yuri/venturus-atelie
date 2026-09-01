/**
 * componentes/PainelInicio.ts — a home do painel (RF33), medida sem
 * sessão, sem Next e sem navegador.
 *
 * ESTE ARQUIVO É A RESPOSTA A UM PROBLEMA REAL DA TAREFA P1: a tela do
 * painel está atrás de uma guarda que responde 404 a todo mundo hoje (não
 * há conta de equipe utilizável — CLAUDE.md, "O que trava hoje", itens 1 e
 * 2), então nenhuma requisição HTTP consegue ver o que ela desenha. Sem
 * isto, o conteúdo da home ficaria sem verificação nenhuma até alguém
 * conseguir entrar — e a lição do site antigo é justamente sobre uma home
 * de painel que ninguém conferiu: ela prometia seis telas inexistentes.
 *
 * O componente é `.ts` com `createElement` (não `.tsx`) exatamente para
 * caber aqui: o runtime nativo do Node importa, `react-dom/server`
 * renderiza. Mesmo padrão de componentes/ListaAreas.ts e irmãos.
 *
 * O QUE ISTO NÃO PROVA: que a página `/admin` de fato usa este componente
 * e chega inteira ao navegador de quem é equipe. Isso continua sem
 * medição, pelo motivo acima — está declarado no relatório da tarefa e no
 * cabeçalho de testes/painel-guarda.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PainelInicio, TELAS_DO_PAINEL } from '../componentes/PainelInicio.ts';
import { rotasReaisDoApp } from './apoio/rotas-migracao.mjs';

function renderizar(telas) {
  return renderToStaticMarkup(createElement(PainelInicio, { telas }));
}

const PRONTA = { caminho: '/admin/publicacoes', titulo: 'Notícias', descricao: 'Escrever e publicar.', pronta: true };
const EM_PREPARO = { caminho: '/admin/galeria', titulo: 'Galeria', descricao: 'Subir foto.', pronta: false };

// ---------------------------------------------------------------------
// A regra que este arquivo existe para guardar: nada de link para tela
// que não existe.
// ---------------------------------------------------------------------

test('tela em preparo não vira link — nenhum <a> e nenhum href', () => {
  const html = renderizar([EM_PREPARO]);

  assert.doesNotMatch(html, /<a\b/, 'a tela em preparo virou link — é o defeito do painel antigo');
  assert.doesNotMatch(html, /href=/, 'sobrou um href apontando para tela inexistente');
});

test('tela em preparo diz por escrito que não está pronta — não só por cor', () => {
  const html = renderizar([EM_PREPARO]);

  assert.match(html, /ainda não está pronta/,
    'quem usa leitor de tela precisa OUVIR o estado; um cinza mais claro não é anunciado');
  assert.match(html, /Galeria/, 'o título da tela em preparo sumiu');
});

test('tela pronta vira link com o caminho dela, e o cartão inteiro é o alvo', () => {
  const html = renderizar([PRONTA]);

  assert.match(html, /<a[^>]+href="\/admin\/publicacoes"/, 'a tela pronta não virou link');
  // Título E descrição dentro do mesmo <a>: no celular, de pé, o dedo não
  // pode precisar acertar a palavra (regra 4).
  const dentroDoLink = html.match(/<a[^>]*>[\s\S]*?<\/a>/)[0];
  assert.match(dentroDoLink, /Notícias/);
  assert.match(dentroDoLink, /Escrever e publicar\./);
});

test('o aviso de que há tela em preparo aparece uma vez só, e some quando todas estiverem prontas', () => {
  const comPreparo = renderizar([PRONTA, EM_PREPARO]);
  const ocorrencias = (comPreparo.match(/painel__aviso/g) || []).length;
  assert.equal(ocorrencias, 1, `o aviso apareceu ${ocorrencias} vezes`);

  const tudoPronto = renderizar([PRONTA]);
  assert.doesNotMatch(tudoPronto, /painel__aviso/,
    'sem tela em preparo o aviso não tem o que avisar — vira ruído permanente');
});

test('cada tela recebida desenha um item da lista, na ordem em que veio', () => {
  const html = renderizar([PRONTA, EM_PREPARO]);

  assert.equal((html.match(/<li[^>]*class="painel__tela"/g) || []).length, 2);
  assert.ok(html.indexOf('Notícias') < html.indexOf('Galeria'), 'a ordem da lista não foi preservada');
});

// ---------------------------------------------------------------------
// A lista de verdade, reconciliada contra o sistema de arquivos
// ---------------------------------------------------------------------

/**
 * A trava que impede a promessa de envelhecer — nos DOIS sentidos.
 *
 * A home do painel antigo prometia seis telas que nunca existiram, e nada
 * no projeto acusava isso. Aqui, marcar uma tela como pronta sem a rota
 * existir deixa a suíte vermelha; e criar a rota (Tarefa P2, P3 ou P4) sem
 * virar a marca também. Quem escrever a próxima tarefa descobre pelo
 * teste, não pela memória.
 */
test('TELAS_DO_PAINEL diz a verdade sobre o que existe em app/', async () => {
  const reais = await rotasReaisDoApp();

  const mentindo = TELAS_DO_PAINEL
    .filter((tela) => tela.pronta !== reais.includes(tela.caminho))
    .map((tela) => `${tela.caminho}: marcada como ${tela.pronta ? 'pronta' : 'em preparo'}, `
      + `mas a rota ${reais.includes(tela.caminho) ? 'existe' : 'não existe'} em app/`);

  assert.deepEqual(
    mentindo, [],
    'componentes/PainelInicio.ts promete o que não existe, ou esconde o que já existe:\n  '
    + mentindo.join('\n  ')
    + '\n  Se a tela acabou de ser criada, virar `pronta: true` na mesma tarefa.'
  );
});

test('TELAS_DO_PAINEL não repete caminho nem lista rota fora de /admin', () => {
  const caminhos = TELAS_DO_PAINEL.map((tela) => tela.caminho);

  assert.equal(new Set(caminhos).size, caminhos.length, 'caminho repetido na lista');

  const foraDoPainel = caminhos.filter((caminho) => !caminho.startsWith('/admin/'));
  assert.deepEqual(foraDoPainel, [],
    `a home do painel não é lugar de atalho para fora dele: ${foraDoPainel.join(', ')}`);
});
