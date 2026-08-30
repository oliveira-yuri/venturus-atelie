/**
 * As três funções que `testes/paridade-texto.test.mjs` usa para transformar
 * HTML em "o texto que a pessoa vê", verificadas DE FORA.
 *
 * POR QUE ESTE ARQUIVO EXISTE. O teste de paridade aplica removerTags,
 * decodificarEntidades e normalizarEspacos aos DOIS lados da comparação —
 * o HTML original congelado e o que o Next renderiza. Isso o torna cego a
 * defeito NELAS: o erro entra dos dois lados e a diferença se cancela.
 * MEDIDO na revisão da Tarefa A8 — trocada normalizarEspacos por uma versão
 * mascarante E reintroduzido o defeito real do e-mail colado em
 * /privacidade ao mesmo tempo, aquele arquivo deu 15 testes, 15 verdes, com
 * o defeito na tela. Este arquivo é a rede que faltava.
 *
 * TODO VALOR ESPERADO AQUI É ESCRITO À MÃO, nunca produzido pela função sob
 * teste nem por uma reimplementação dela. Uma referência gerada pelo que se
 * mede é como este tipo de teste vira tautologia: passa sempre.
 *
 * Cada asserção abaixo foi provada quebrável (rodada de correção 2 da
 * Tarefa A8): quebrando uma função de cada vez, este arquivo fica vermelho
 * nas linhas que a observam. Asserção que passa com a função quebrada não
 * observa nada, e não deve ficar aqui.
 *
 * Não sobe servidor nem navegador: é unidade pura, roda em milissegundos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  removerTags, decodificarEntidades, normalizarEspacos
} from './apoio/texto-visivel.mjs';

// =====================================================================
// normalizarEspacos
// =====================================================================

test('normalizarEspacos: espaço, tabulação e quebra de linha viram UM espaço', () => {
  // Os três tipos de vão-branco que aparecem em HTML indentado à mão, na
  // mesma string, em sequências de tamanhos diferentes.
  assert.equal(normalizarEspacos('Ateliê   Afro'), 'Ateliê Afro');
  assert.equal(normalizarEspacos('Ateliê\t\tAfro'), 'Ateliê Afro');
  assert.equal(normalizarEspacos('Ateliê\n\nAfro'), 'Ateliê Afro');
  assert.equal(normalizarEspacos('Ateliê \n\t  Afro'), 'Ateliê Afro');
  assert.equal(normalizarEspacos('Ateliê\r\nAfro'), 'Ateliê Afro');
});

test('normalizarEspacos: um espaço que já é único continua lá — não é isso que ela remove', () => {
  // O contrário do caso acima, e o que impede uma "normalização" que
  // simplesmente apaga espaço de passar como correta. É a asserção que a
  // versão mascarante da revisão violaria.
  assert.equal(normalizarEspacos('Fale pelo e-mail atelieafro@gmail.com'),
    'Fale pelo e-mail atelieafro@gmail.com');
});

test('normalizarEspacos: espaço das pontas some, o do meio fica', () => {
  assert.equal(normalizarEspacos('   Quem somos   '), 'Quem somos');
  assert.equal(normalizarEspacos('\n  Quem somos  \n'), 'Quem somos');
  assert.equal(normalizarEspacos(' Quem  somos '), 'Quem somos');
});

test('normalizarEspacos: string vazia, e string só de espaço, continuam vazias', () => {
  assert.equal(normalizarEspacos(''), '');
  assert.equal(normalizarEspacos('   '), '');
  assert.equal(normalizarEspacos('\n\t '), '');
});

// =====================================================================
// removerTags
// =====================================================================

test('removerTags: tag EM LINHA não introduz espaço — é o defeito que o teste de paridade existe para pegar', () => {
  // O caso literal do Defeito 1 (correção de 2026-08-28): no HTML, "pelo
  // e-mail" e o <a> do endereço estavam separados por quebra de linha, que
  // vale um espaço; em JSX a quebra encostada na tag é REMOVIDA, e a tela
  // mostrou "e-mailatelieafro@gmail.com". Se <a> passasse a introduzir
  // espaço aqui, os dois lados ficariam iguais e o defeito voltaria a
  // passar despercebido.
  assert.equal(removerTags('e-mail<a href="mailto:x">atelieafro@gmail.com</a>'),
    'e-mailatelieafro@gmail.com');
  assert.equal(removerTags('<strong>Telefone</strong><span>(11) 95396-8344</span>'),
    'Telefone(11) 95396-8344');
  assert.equal(removerTags('bem <em>vindo</em> ao ateliê'), 'bem vindo ao ateliê');
});

test('removerTags: tag de BLOCO separa, mesmo colada', () => {
  // Bloco quebra linha na tela com ou sem vão-branco no arquivo. Cada tag
  // vira um espaço, então "</h1><p>" produz dois — normalizarEspacos junta
  // depois, e é por isso que as duas funções são testadas separadas.
  assert.equal(removerTags('<h1>Quem somos</h1><p>Somos o Ateliê</p>'),
    ' Quem somos  Somos o Ateliê ');
  assert.equal(removerTags('<li>Dança</li><li>Percussão</li>'),
    ' Dança  Percussão ');
  assert.equal(removerTags('Rua Dr. Paulo Gatti, 135<br />Vila Romero'),
    'Rua Dr. Paulo Gatti, 135 Vila Romero');
});

test('removerTags: comentário HTML some sem deixar espaço — o marcador que o React põe ao redor de {\' \'}', () => {
  // `<!--$-->` e afins são marcadores internos de hidratação do React. Não
  // são conteúdo, e não podem virar espaço: se virassem, um espaço
  // fantasma entraria só no lado renderizado e a paridade acusaria
  // divergência onde não há.
  assert.equal(removerTags('<!--$-->'), '');
  assert.equal(removerTags('e-mail<!--$-->atelieafro@gmail.com'),
    'e-mailatelieafro@gmail.com');
  assert.equal(removerTags('a<!-- comentário com <tag> e várias\nlinhas -->b'), 'ab');
});

test('removerTags: o nome da tag é lido sem depender de caixa nem de atributo', () => {
  assert.equal(removerTags('<P>bloco</P>'), ' bloco ');
  assert.equal(removerTags('<SPAN>em linha</SPAN>'), 'em linha');
  assert.equal(removerTags('<div class="conteudo" id="x" data-y="z">texto</div>'), ' texto ');
});

// =====================================================================
// decodificarEntidades
// =====================================================================
//
// A tabela da função tem seis entradas: &amp; &lt; &gt; &quot; &#39; &nbsp;
// — as cinco que o React pode emitir ao serializar texto, mais o espaço
// duro. `&mdash;` NÃO está lá, de propósito: o travessão da ONG é o
// caractere literal `—`. MEDIDO nesta rodada: nenhuma entidade aparece hoje
// no texto do <main> dos 15 HTML congelados, então esta função é um
// guarda-corpo para conteúdo que ainda não chegou — e estes testes são a
// única coisa que a observa.

test('decodificarEntidades: as seis entidades da tabela viram o caractere', () => {
  assert.equal(decodificarEntidades('arte &amp; cultura'), 'arte & cultura');
  assert.equal(decodificarEntidades('&lt;main&gt;'), '<main>');
  assert.equal(decodificarEntidades('o &quot;Ateliê&quot;'), 'o "Ateliê"');
  assert.equal(decodificarEntidades('mem&#39;ria'), 'mem\'ria');
  assert.equal(decodificarEntidades('(11)&nbsp;95396-8344'), '(11) 95396-8344');
});

test('decodificarEntidades: várias entidades na mesma string, todas as ocorrências', () => {
  assert.equal(
    decodificarEntidades('arte &amp; cultura &amp; mem&oacute;ria'),
    'arte & cultura & mem&oacute;ria'
  );
  assert.equal(decodificarEntidades('&quot;a&quot; e &quot;b&quot;'), '"a" e "b"');
});

test('decodificarEntidades: `&mdash;` NÃO está na tabela — o travessão da ONG é o caractere literal', () => {
  // Registrado como comportamento, não como falta: acrescentar &mdash; sem
  // que ele apareça no conteúdo seria inventar interface. O dia em que
  // alguém escrever &mdash; num texto real, esta asserção vira vermelha e
  // obriga a decidir — que é o que se quer dela.
  assert.equal(decodificarEntidades('arte &mdash; cultura'), 'arte &mdash; cultura');
  assert.equal(decodificarEntidades('arte — cultura'), 'arte — cultura');
});

test('decodificarEntidades: texto sem entidade nenhuma passa intacto', () => {
  // O caso real de hoje: nenhum dos 15 HTML congelados tem entidade no
  // <main>. Se a função começasse a mexer no que não deve, é aqui que
  // apareceria.
  assert.equal(
    decodificarEntidades('Rua Dr. Paulo Gatti, 135 — Vila Romero'),
    'Rua Dr. Paulo Gatti, 135 — Vila Romero'
  );
  assert.equal(decodificarEntidades(''), '');
});
