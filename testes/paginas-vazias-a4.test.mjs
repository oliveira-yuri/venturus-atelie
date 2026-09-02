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

/**
 * =====================================================================
 * O ESTADO VAZIO SÓ PODE SER COBRADO QUANDO A LISTA ESTÁ VAZIA
 * =====================================================================
 *
 * Este arquivo nasceu afirmando "as quatro tabelas estão vazias hoje". Era
 * verdade em 29/08/2026 e DEIXOU DE SER em 02/09, quando a equipe percorreu
 * o painel e publicou uma foto, um material, um evento e uma notícia de
 * teste. MEDIDO: `npm run test:supabase` passou a dar dez vermelhos, todos
 * aqui, e nenhum era defeito de código — era a suíte cobrando CONTEÚDO.
 *
 * O CLAUDE.md já previa isto para as atividades (item 0k): "será a suíte
 * cobrando conteúdo, não defeito de código". Previa e não tinha mecanismo.
 * Este é o mecanismo.
 *
 * Uma suíte que fica vermelha por hábito é uma suíte que ninguém lê — e o
 * conserto NÃO é afrouxar a asserção, é cobrar o invariante certo:
 *
 *     OU a lista está vazia E o estado vazio traz o texto real,
 *     OU a lista tem itens E o estado vazio NÃO aparece.
 *
 * As duas metades importam. Sem a segunda, uma página que desenhasse itens
 * E o "ainda não publicamos nada" ao mesmo tempo passaria — e essa é
 * exatamente a contradição que a pessoa veria na tela.
 *
 * `estado--vazio` é a marca, e ela é do NOSSO CSS: se a página parar de
 * usá-la, os testes daqui param de encontrar o estado vazio e ficam
 * vermelhos. É o desfecho certo.
 */
function estaVazia(pagina) {
  return /class="estado estado--vazio"/.test(pagina);
}

/**
 * Cobra o invariante das duas pontas.
 *
 * `textos` são as frases do estado vazio, cada uma um regex. `itens` é o
 * padrão que marca um item desenhado.
 */
function vazioOuCheio(pagina, { rota, textos, itens }) {
  if (estaVazia(pagina)) {
    for (const texto of textos) {
      assert.match(pagina, texto,
        `${rota} está vazia mas o texto do estado vazio mudou ou sumiu`);
    }
    assert.doesNotMatch(pagina, itens,
      `${rota} mostra o estado vazio E itens ao mesmo tempo — a pessoa lê uma contradição`);
    return 'vazia';
  }

  assert.match(pagina, itens,
    `${rota} não tem estado vazio nem item nenhum: a página ficou só com o título`);
  return 'com itens';
}

test('agenda: ou o estado vazio com texto real, ou os eventos — nunca os dois', async () => {
  const pagina = await html('/agenda');

  // As DUAS seções ("Em breve" e "Já aconteceu") têm textos diferentes, e
  // uma pode estar vazia com a outra cheia. Por isso a cobrança é por
  // seção: se há QUALQUER estado vazio, ao menos um dos dois textos
  // precisa estar lá com as palavras certas.
  if (estaVazia(pagina)) {
    const temUm = /Nenhuma atividade marcada por enquanto\. Acompanhe nosso Instagram ou fale com a gente para saber das próximas\./.test(pagina)
      || /Ainda não há registro de atividades passadas por aqui\./.test(pagina);
    assert.ok(temUm,
      '/agenda desenhou um estado vazio sem nenhum dos dois textos reais');
  } else {
    assert.match(pagina, /class="atividade"/,
      '/agenda ficou sem estado vazio E sem evento: a página tem só o título');
  }
});

test('noticias: ou o estado vazio com texto real, ou as notícias — nunca os dois', async () => {
  const pagina = await html('/noticias');

  vazioOuCheio(pagina, {
    rota: '/noticias',
    textos: [/Ainda não publicamos nenhuma notícia por aqui\./],
    itens: /class="atividade"/
  });

  // Vale nos DOIS estados: o texto do site antigo não pode ressuscitar.
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
  // Só cobrável quando a página ESTÁ vazia — ver `vazioOuCheio` acima.
  if (!estaVazia(pagina)) return;
  assert.match(
    pagina,
    /Ainda não publicamos nenhuma notícia por aqui\. Siga a gente no Instagram ou fale pelo WhatsApp para saber das novidades enquanto esta página ganha as primeiras publicações\./
  );
});

test('galeria: ou o estado vazio com o motivo (RN07), ou os álbuns — nunca os dois', async () => {
  const pagina = await html('/galeria');

  vazioOuCheio(pagina, {
    rota: '/galeria',
    textos: [/Ainda não publicamos nenhum álbum por aqui\./, /autorização de uso de imagem/],
    // A galeria desenha `.album`, não `.atividade`.
    itens: /class="album"/
  });
});

// Mesmo motivo do teste irmão em "noticias" acima (Rodada de correção 1 da
// Tarefa A5): as duas frases precisam bater NUM SÓ regex, para o espaço
// (e a segunda frase inteira) ficarem sensíveis a regressão.
test('galeria: as duas frases do estado vazio aparecem juntas, com o espaço entre elas', async () => {
  const pagina = await html('/galeria');
  if (!estaVazia(pagina)) return;
  assert.match(
    pagina,
    /Ainda não publicamos nenhum álbum por aqui\. As fotos e vídeos das nossas oficinas e apresentações só entram no ar depois da autorização de uso de imagem de quem aparece neles — assim que os primeiros álbuns estiverem prontos, você encontra os registros aqui\./
  );
});

test('acervo: ou o estado vazio padrão, ou os materiais — nunca os dois', async () => {
  const pagina = await html('/acervo');

  vazioOuCheio(pagina, {
    rota: '/acervo',
    textos: [/Ainda não há material publicado no acervo\. Estamos preparando os primeiros\./],
    itens: /class="atividade"/
  });
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

test('acervo: a busca que não acha nada diz isso, mesmo com a tabela cheia', async () => {
  // Este teste substituiu "nenhum <article> aparece (a tabela está vazia
  // hoje)", que dependia da tabela estar vazia. O que ele mede agora vale
  // sempre: uma busca sem resultado mostra a mensagem DA BUSCA, e não a
  // lista inteira nem o estado vazio padrão.
  const pagina = await html('/acervo?busca=zzzznaoexistezzzz');

  assert.match(pagina, /Nada encontrado para/,
    'a busca sem resultado não avisou — a pessoa concluiria que o acervo está vazio');
  assert.doesNotMatch(pagina, /Estamos preparando os primeiros\./,
    'a busca sem resultado mostrou o estado vazio PADRÃO: são coisas diferentes');
});
