/**
 * Agenda (RF14), notícias (RF04), galeria (RF05) e acervo (RF35) — Tarefa
 * A4. As quatro tabelas por trás delas (eventos, acervo) estão vazias hoje,
 * e notícias/galeria nem têm tabela — nenhuma das quatro tem um registro
 * publicado para mostrar. A regra 2 do CLAUDE.md manda omitir seção sem
 * dado, mas uma página com só título e nada embaixo é pior que inútil (ver
 * o brief da Tarefa A4): cada página precisa mostrar um estado vazio
 * HONESTO, com texto real — não a lista em branco, e não a omissão total.
 *
 * Este arquivo prova exatamente isso contra a página renderizada de
 * verdade — como testes/pagina-para-escolas.test.mjs e
 * testes/pagina-home.test.mjs, via fetch contra o servidor que a suíte
 * inteira já sobe (ferramentas/rodar-testes.mjs), sem subir servidor
 * próprio nem Selenium. A estrutura semântica genérica (200, <main
 * id="conteudo">, um <h1>) já é coberta por testes/paginas.test.mjs (as
 * quatro rotas entram na lista PAGINAS de lá); aqui o foco é o CONTEÚDO do
 * estado vazio, que aquele arquivo não verifica.
 *
 * Os quatro textos abaixo são os mesmos aprovados no relatório da Tarefa A4
 * (.superpowers/sdd/2026-08-29-fase-2-bloco-a/tarefa-A4-report.md) — se um
 * texto mudar ali, muda aqui e nas páginas juntos, no mesmo commit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

async function html(rota) {
  const resposta = await fetch(`${BASE}${rota}`);
  assert.equal(resposta.status, 200, `${rota} não respondeu 200`);
  return resposta.text();
}

test('agenda: "Em breve" mostra o estado vazio com texto real, não a lista em branco', async () => {
  const pagina = await html('/agenda');
  assert.match(pagina, /class="estado estado--vazio"/);
  assert.match(
    pagina,
    /Nenhuma atividade marcada por enquanto\. Acompanhe nosso Instagram ou fale com a gente para saber das próximas\./
  );
});

test('agenda: "Já aconteceu" mostra o estado vazio com texto real, diferente do de "Em breve"', async () => {
  const pagina = await html('/agenda');
  assert.match(pagina, /Ainda não há registro de atividades passadas por aqui\./);
});

test('agenda: nenhum <article class="atividade"> aparece (as duas seções estão mesmo vazias hoje)', async () => {
  const pagina = await html('/agenda');
  assert.doesNotMatch(pagina, /class="atividade"/);
});

test('noticias: mostra o estado vazio com texto real, não o placeholder seco do HTML estático original', async () => {
  const pagina = await html('/noticias');
  assert.match(pagina, /class="estado estado--vazio"/);
  assert.match(pagina, /Ainda não publicamos nenhuma notícia por aqui\./);
  assert.doesNotMatch(pagina, /Nenhuma notícia publicada ainda\./,
    'o texto antigo (site/noticias.html) não deveria sobreviver ao port');
});

// Rodada de correção 1 da Tarefa A5: o teste acima só confere a PRIMEIRA
// frase — achado real numa revisão que trocou os {' '} de app/doar/page.tsx
// por texto colado e viu a suíte inteira (327 testes) passar, porque o
// `<div id="dados-pix">` sai de testes/paridade-texto.test.mjs (exclusão
// legítima, mas também ponto cego) e nenhum outro teste comparava a frase
// inteira. Aqui a segunda frase de "notícias" tinha o MESMO ponto cego,
// registrado desde a revisão da própria Tarefa A4 e nunca fechado. Esta
// asserção casa as DUAS frases NUM SÓ regex — se o espaço entre elas
// sumisse (ou a segunda frase inteira), o match falharia aqui.
test('noticias: as duas frases do estado vazio aparecem juntas, com o espaço entre elas', async () => {
  const pagina = await html('/noticias');
  assert.match(
    pagina,
    /Ainda não publicamos nenhuma notícia por aqui\. Siga a gente no Instagram ou fale pelo WhatsApp para saber das novidades enquanto esta página ganha as primeiras publicações\./
  );
});

test('galeria: mostra o estado vazio com texto real, incluindo o motivo (autorização de imagem, RN07)', async () => {
  const pagina = await html('/galeria');
  assert.match(pagina, /class="estado estado--vazio"/);
  assert.match(pagina, /Ainda não publicamos nenhum álbum por aqui\./);
  assert.match(pagina, /autorização de uso de imagem/);
});

// Mesmo motivo do teste irmão em "noticias" acima (Rodada de correção 1 da
// Tarefa A5): as duas frases precisam bater NUM SÓ regex, para o espaço
// (e a segunda frase inteira) ficarem sensíveis a regressão.
test('galeria: as duas frases do estado vazio aparecem juntas, com o espaço entre elas', async () => {
  const pagina = await html('/galeria');
  assert.match(
    pagina,
    /Ainda não publicamos nenhum álbum por aqui\. As fotos e vídeos das nossas oficinas e apresentações só entram no ar depois da autorização de uso de imagem de quem aparece neles — assim que os primeiros álbuns estiverem prontos, você encontra os registros aqui\./
  );
});

test('acervo: sem busca, mostra o estado vazio padrão', async () => {
  const pagina = await html('/acervo');
  assert.match(pagina, /class="estado estado--vazio"/);
  assert.match(pagina, /Ainda não há material publicado no acervo\. Estamos preparando os primeiros\./);
});

test('acervo: com busca (?busca=quilombo), mostra a mensagem de busca sem resultado, não a padrão', async () => {
  const pagina = await html('/acervo?busca=quilombo');
  assert.match(pagina, /Nada encontrado para &quot;quilombo&quot;\. Tente outra palavra\./);
  assert.doesNotMatch(pagina, /Estamos preparando os primeiros\./);
});

test('acervo: o formulário de busca é um GET nativo — funciona sem JavaScript', async () => {
  const pagina = await html('/acervo');
  assert.match(pagina, /<form id="filtros-acervo"[^>]*method="get"[^>]*>/);
  assert.match(pagina, /name="busca"/);
});

test('acervo: nenhum <article class="atividade"> aparece (a tabela está vazia hoje)', async () => {
  const pagina = await html('/acervo');
  assert.doesNotMatch(pagina, /class="atividade"/);
});
