/**
 * Compara o texto visível do <main> renderizado pelo Next com o texto
 * visível do <main> do HTML original, congelado em
 * testes/apoio/html-original/*.html.
 *
 * DE ONDE VEM ESSA REFERÊNCIA (Tarefa A8). Até aqui ela era `site/*.html`,
 * o site estático que estava no ar. A Tarefa A8 apagou `site/` nesta
 * branch, e este teste perderia a referência junto — aposentá-lo não era
 * opção (é ele que pega a armadilha do JSX). Decisão: congelar. Os 15 HTML
 * foram copiados byte a byte para testes/apoio/html-original/ (conferidos
 * com `cmp`, arquivo a arquivo, antes da exclusão) e passam a ser uma
 * fotografia, não um diretório vivo. Ver testes/apoio/html-original/
 * LEIA-ME.txt.
 *
 * Por que congelar o HTML BRUTO, e não extrair o texto de uma vez para um
 * arquivo de referência. Dois motivos, os dois sobre o HTML de origem, não
 * sobre a comparação:
 *
 *   1. `idsExcluidos` e removerElementoPorId() trabalham sobre TAG e `id`
 *      do HTML bruto — contando profundidade de aninhamento, inclusive.
 *      Sem as tags não há como excluir uma seção, e as quinze exclusões
 *      reconciliadas por COBERTURA_DAS_EXCLUSOES (no fim deste arquivo)
 *      perderiam o ponto de apoio.
 *   2. Uma referência pré-extraída teria de ser REGERADA a cada exclusão
 *      nova — e regerar a referência a partir do que o teste mede é como
 *      este tipo de teste vira tautologia: passa sempre, porque o esperado
 *      é definido pelo obtido.
 *
 * O QUE A SIMETRIA NÃO DÁ (medido na rodada de correção 1 da Tarefa A8, e
 * o contrário do que este comentário afirmava antes). Os dois lados passam
 * pelo mesmo removerTags/decodificarEntidades/normalizarEspacos, e é
 * tentador concluir que isso protege contra erro nessas funções. NÃO
 * protege: um erro ali se aplica aos DOIS lados e a diferença se cancela.
 * A revisão trocou normalizarEspacos por uma versão mascarante E
 * reintroduziu o defeito real do e-mail colado em
 * /privacidade ao mesmo tempo: 15 testes, 15 verdes, com o defeito na
 * tela. Sob referência pré-extraída, as 14 páginas teriam falhado de uma
 * vez.
 *
 * Ou seja: a simetria é um PONTO CEGO conhecido deste arquivo, não uma
 * garantia dele. Por isso as três funções deixaram de morar aqui: vivem em
 * testes/apoio/texto-visivel.mjs e são verificadas DE FORA, com resultado
 * escrito à mão, em testes/texto-visivel.test.mjs (rodada de correção 2 da
 * Tarefa A8). Quem mexer nelas tem rede lá, não aqui.
 *
 * O que se perde, dito em voz alta: uma fotografia não diverge mais de
 * nada, então este teste deixa de acusar "o original mudou". Não há o que
 * acusar — o original não existe mais nesta branch. O que ele continua
 * fazendo é o motivo de existir: acusar que a PÁGINA NOVA se afastou do
 * texto que a migração prometeu preservar.
 *
 * Existe porque o Defeito 1 da correção de 2026-08-28 passou por 212 testes
 * e pela verificação de fidelidade anterior: aquela verificação comparava
 * PALAVRAS, e todas as palavras estavam presentes — o que sumiu foi só o
 * ESPAÇO entre elas ("pelo e-mailatelieafro@gmail.com"). Uma quebra de linha
 * entre texto e elemento vira um espaço em HTML, mas é removida em JSX
 * quando fica encostada na tag (armadilha clássica do JSX).
 *
 * Por isso a comparação aqui é de string completa (espaços normalizados),
 * não de presença de palavra: é o único jeito de um espaço que sumiu doer.
 *
 * Protege cada página migrada nesta fase 2 — a Tarefa A6 fecha o menu
 * principal (contato, entrar) mais recuperar-acesso; o que resta migrar
 * (painel, área do usuário) é Bloco B e ganha entrada aqui quando existir.
 * É o que impede este defeito de se repetir a cada página nova.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// As três funções que viram "texto que a pessoa vê" saíram deste arquivo na
// rodada de correção 2 da Tarefa A8: aplicadas aos DOIS lados, elas ficavam
// cegas a defeito nelas mesmas (medido — ver o cabeçalho do módulo). Agora
// testes/texto-visivel.test.mjs as verifica de fora, com resultado escrito
// à mão.
import {
  removerTags, decodificarEntidades, normalizarEspacos, blocosDeTexto
} from './apoio/texto-visivel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, '..');

// Mesma convenção de testes/paginas.test.mjs: a suíte inteira (via
// ferramentas/rodar-testes.mjs) já builda e sobe o Next uma vez só. Aqui
// basta um fetch da resposta já renderizada no servidor — o texto do <main>
// não muda com a hidratação, então dispensa selenium/Firefox.
const BASE = process.env.URL_BASE || 'http://localhost:3123';

// A fase 1 deixou a home (`/`) de fora desta lista — nada comparava o texto
// dela com o original, e foi exatamente esse buraco que o brief da Tarefa
// A2 apontou. As outras oito rotas do menu ainda migram na fase 2 (ver
// testes/paginas.test.mjs) — quando migrarem, ganham uma linha aqui também.
const PAGINAS = [
  {
    rota: '/',
    arquivoOriginal: 'testes/apoio/html-original/index.html',
    // Mesma situação de "Onde já estivemos" em /para-escolas (ver o
    // comentário logo abaixo, em idsExcluidos de /para-escolas): "Na mídia"
    // já era dinâmica no HTML estático original — o <div id="lista-midia">
    // chegava vazio e era preenchido no cliente por
    // assets/js/paginas/prova-social.js, lendo os mesmos registros de
    // clipping que a Tarefa A2 passou a buscar no servidor
    // (servidor/dados/conteudo.ts, via componentes/SecaoNaMidia.ts).
    // Comparar o texto bruto do HTML estático (div vazio) contra o HTML já
    // renderizado com os registros de verdade acusaria uma divergência
    // ilegítima — por isso a seção sai desta comparação de string. O
    // conteúdo dela COM registro é provado à parte, contra a página
    // renderizada de verdade, em testes/pagina-home.test.mjs e
    // testes/paginas.test.mjs; a omissão dela SEM nenhum registro de
    // mídia é provada por unidade, direto no componente, em
    // testes/secao-na-midia.test.mjs (Rodada de correção 1 da Tarefa A2 —
    // antes dela nada exercitava esse caminho: comentar o `return null`
    // de componentes/SecaoNaMidia.ts não derrubava teste nenhum).
    idsExcluidos: ['titulo-midia-home']
  },
  { rota: '/quem-somos', arquivoOriginal: 'testes/apoio/html-original/quem-somos.html' },
  { rota: '/privacidade', arquivoOriginal: 'testes/apoio/html-original/privacidade.html' },
  {
    rota: '/para-escolas',
    arquivoOriginal: 'testes/apoio/html-original/para-escolas.html',
    // "Onde já estivemos" já era dinâmica no HTML estático original: o
    // <div id="lista-instituicoes"> chegava vazio e era preenchido no
    // cliente por assets/js/paginas/prova-social.js, lendo os mesmos
    // registros de clipping que a Tarefa 10 passou a buscar no servidor
    // (servidor/dados/conteudo.ts). Comparar o texto bruto do HTML estático
    // contra o HTML já renderizado com esses registros acusaria uma
    // divergência, mas ela é legítima — o site antigo também mostrava essa
    // lista, só que via script, depois da carga da página. Por isso esta
    // seção sai da comparação de string aqui; a omissão dela quando não há
    // registro, e o conteúdo dela quando há, são provados à parte, de
    // verdade, em testes/prova-social.test.mjs. O resto de <main> — que não
    // vem de dado nenhum — continua comparado byte a byte por este teste.
    idsExcluidos: ['titulo-onde-estivemos']
  },
  {
    rota: '/projetos',
    arquivoOriginal: 'testes/apoio/html-original/projetos.html',
    // O <div id="lista-atividades"> chegava vazio no HTML estático original
    // — quem o preenchia era assets/js/paginas/projetos.js, no cliente,
    // lendo listarAtividades(). Desde a Tarefa A3 o servidor busca as 11
    // atividades reais direto (servidor/dados/conteudo.ts, via
    // componentes/CardAtividade.ts) e as renderiza no HTML — comparar o
    // texto bruto do estático (div vazio) contra o renderizado (11 cartões
    // de verdade) acusaria uma divergência ilegítima, mesma situação de
    // "Na mídia" e "Onde já estivemos" acima. O conteúdo das 11 atividades
    // é provado à parte, contra a página renderizada de verdade, em
    // testes/paginas.test.mjs ("mostra as onze atividades" e "atividade
    // sem sinopse não exibe parágrafo vazio"); a omissão de campo por
    // atividade (regra 2 do CLAUDE.md no nível do campo) é provada por
    // unidade, direto no componente, em testes/card-atividade.test.mjs.
    idsExcluidos: ['lista-atividades'],
    /**
     * O TEXTO DAS ATIVIDADES MUDOU DE TELA (pedido V1, 02/09/2026).
     *
     * `/projetos` virou uma lista de blocos: título, capa e resumo, com um
     * "Saber mais". A sinopse e a ficha técnica passaram a viver em
     * `/projetos/<id>`.
     *
     * Para este teste isso seria "frase da ONG que sumiu de /projetos", e
     * é exatamente por isso que `destinos` existe: a frase pode estar em
     * QUALQUER uma das rotas listadas. Mover texto é decisão, e a decisão
     * fica escrita aqui.
     *
     * Na prática o `<div id="lista-atividades">` já sai da comparação
     * (`idsExcluidos`, acima) porque chegava vazio no HTML estático — então
     * hoje esta lista não muda o resultado. Ela está aqui pelo dia em que
     * alguém tirar aquela exclusão, e para que a decisão não fique só no
     * commit.
     */
    destinos: ['/projetos', '/projetos/banzo']
  },
  {
    rota: '/agenda',
    arquivoOriginal: 'testes/apoio/html-original/agenda.html',
    // Tarefa A4. As duas <div id="lista-proximos">/<div id="lista-passados">
    // chegavam vazias no HTML estático original — quem as preenchia era
    // assets/js/paginas/agenda.js, no cliente, lendo listarProximos()/
    // listarPassados(). Desde a Tarefa A4 o servidor busca direto
    // (servidor/dados/eventos.ts) e SEMPRE desenha algo ali — os cartões,
    // ou o estado vazio com texto real (componentes/ListaEventos.ts) — e
    // esse texto não existe no HTML estático original (a mensagem morava
    // dentro do JS, não do arquivo .html). Comparar o texto bruto do
    // estático (divs vazias) contra o renderizado acusaria uma divergência
    // ilegítima, mesma situação de "lista-atividades" acima.
    idsExcluidos: ['lista-proximos', 'lista-passados']
  },
  {
    rota: '/noticias',
    arquivoOriginal: 'testes/apoio/html-original/noticias.html',
    // Tarefa A4. Diferente de agenda/acervo, RF04 não tem tabela nem módulo
    // de dados — o <div id="lista-noticias"> já trazia texto de estado
    // vazio no HTML estático original ("Nenhuma notícia publicada ainda.").
    // A Tarefa A4 troca esse texto por um mais honesto e acionável (ver o
    // comentário de app/noticias/page.tsx e o relatório da tarefa) — uma
    // divergência DELIBERADA de conteúdo, aprovada por quem coordena, não
    // um artefato de hidratação como as exclusões acima. Excluído da
    // comparação byte a byte pelo mesmo motivo prático: o texto muda de
    // propósito.
    idsExcluidos: ['lista-noticias']
  },
  {
    rota: '/galeria',
    arquivoOriginal: 'testes/apoio/html-original/galeria.html',
    // Tarefa A4, mesma situação de /noticias acima: RF05 também não tem
    // tabela nem módulo de dados, e o texto de estado vazio do
    // <div id="lista-albuns"> foi deliberadamente trocado (ver o comentário
    // de app/galeria/page.tsx).
    idsExcluidos: ['lista-albuns']
  },
  {
    rota: '/acervo',
    arquivoOriginal: 'testes/apoio/html-original/acervo.html',
    // Tarefa A4. Duas exclusões, dois motivos diferentes:
    //
    // "filtros-acervo" (o <form> de busca): no HTML estático original o
    // campo era <aac-form-campo rotulo="..." ajuda="...">, um custom
    // element sem filho nenhum — rótulo e texto de ajuda eram ATRIBUTOS,
    // não texto, e por isso não apareciam na extração de texto nem ali (só
    // depois que o script do componente rodava no navegador). O port desta
    // tarefa expande esse componente em <label>/<input> de verdade (mesma
    // mecânica de Cabecalho.tsx/Rodape.tsx expandindo aac-header/
    // aac-rodape) — o que introduz texto ("Buscar por palavra", a ajuda)
    // que nunca existiu como texto no HTML estático. Ver o comentário de
    // app/acervo/page.tsx.
    //
    // "lista-acervo": mesma situação de "lista-proximos"/"lista-passados"
    // em /agenda acima — chegava vazia no estático, preenchida no cliente
    // por assets/js/paginas/acervo.js; agora o servidor busca direto
    // (servidor/dados/acervo.ts) e sempre desenha algo, cartões ou o
    // estado vazio com texto real que não existia no arquivo .html.
    idsExcluidos: ['filtros-acervo', 'lista-acervo']
  },
  {
    rota: '/voluntariado',
    arquivoOriginal: 'testes/apoio/html-original/voluntariado.html',
    // Tarefa A5. O <div id="lista-areas"> chegava vazio no HTML estático
    // original — quem o preenchia era assets/js/paginas/voluntariado.js,
    // no cliente, lendo listarAreas(). Desde a Tarefa A5 o servidor busca
    // direto (servidor/dados/voluntariado.ts) e SEMPRE desenha algo ali —
    // os cinco cartões reais (com credenciais), ou o estado vazio com
    // texto real (sem credenciais) — mesma situação de "lista-proximos"/
    // "lista-passados" em /agenda: comparar o texto bruto do estático (div
    // vazia) contra o renderizado acusaria uma divergência ilegítima.
    // Só o <div id="lista-areas"> sai (não a <section> inteira): o h2
    // "Onde você pode ajudar" e o parágrafo acima dele não vêm de dado
    // nenhum e continuam comparados byte a byte.
    idsExcluidos: ['lista-areas']
  },
  {
    rota: '/doar',
    arquivoOriginal: 'testes/apoio/html-original/doar.html',
    // Tarefa A5. O <div id="dados-pix"> chegava vazio no HTML estático
    // original — quem o preenchia era assets/js/paginas/doar.js, no
    // cliente, escrevendo o aviso "sem chave Pix" (CHAVE_PIX = null, D7
    // pendente). O texto renderizado por este port é o MESMO aviso, só que
    // já vem pronto no HTML do servidor — comparar o estático (div vazia)
    // contra o renderizado (aviso presente) acusaria uma divergência
    // ilegítima, mesma classe de exclusão das outras rotas com JS no meio.
    // Só o <div id="dados-pix"> sai (não a <section> inteira): o h2
    // "Doação em dinheiro" continua comparado byte a byte.
    idsExcluidos: ['dados-pix'],
    // RF19. A <section aria-labelledby="titulo-oferecer"> é texto NOVO: o
    // botão que leva a /doar/ofertar e o parágrafo que o explica não
    // existem no HTML original nem poderiam existir (a rota nasceu nesta
    // tarefa). Mesma espécie de exclusão do formulário de contato — vai em
    // `idsAcrescentados`, que cobra a AUSÊNCIA do id do lado original, e
    // não a presença. O resto do <main> continua comparado palavra por
    // palavra, e foi por isso que a seção nova entrou ENTRE duas seções
    // existentes em vez de no fim.
    idsAcrescentados: ['titulo-oferecer']
  },
  {
    rota: '/contato',
    arquivoOriginal: 'testes/apoio/html-original/contato.html',
    // RF07. Até aqui esta rota era migração 1:1 e não precisava de exclusão
    // nenhuma — site/contato.html nunca teve formulário (ver o comentário de
    // app/contato/page.tsx). A tarefa do RF07 acrescenta a <section
    // aria-labelledby="titulo-mensagem">, que é texto NOVO: rótulos, textos
    // de ajuda e a frase de consentimento, nada disso existe no HTML
    // original nem poderia existir.
    //
    // Note a diferença para as outras exclusões desta lista: aquelas saem
    // porque a div chegava VAZIA no estático e é preenchida com dado real
    // agora. Esta sai porque é conteúdo que a migração acrescentou de
    // propósito. O resto do <main> — o parágrafo de destaque, "Canais
    // diretos", "Onde estamos" — continua comparado palavra por palavra, na
    // mesma ordem, e foi por isso que a seção nova entrou ENTRE duas seções
    // existentes em vez de no fim.
    //
    // A caixa de confirmação do envio (`?aviso=enviada`) NÃO precisa de
    // exclusão: sem o parâmetro na URL ela não desenha nada, e este teste
    // busca a rota sem parâmetro. Se alguém puser texto fixo ali, este teste
    // é quem acusa.
    //
    // Vai em `idsAcrescentados`, e não em `idsExcluidos`, porque a seção só
    // existe de um lado — ver o comentário daquela chave, logo abaixo desta
    // lista.
    idsAcrescentados: ['titulo-mensagem']
  },
  {
    rota: '/entrar',
    arquivoOriginal: 'testes/apoio/html-original/entrar.html',
    // Tarefa A6, revista pela Tarefa 3 da autenticação. Duas exclusões —
    // eram três:
    //
    // "aviso" DEIXOU DE PRECISAR SER EXCLUÍDO e voltou para a comparação.
    // No HTML estático original ele é `<div id="aviso" class="aviso"
    // hidden></div>`, vazio — só ganhava texto em runtime, escrito por
    // site/assets/js/paginas/entrar.js (mostrarAviso), depois de uma
    // tentativa de envio. A Tarefa A6 pôs ali um texto fixo ("o envio ainda
    // não está ativo"), que divergia do original e por isso saía daqui; a
    // Tarefa 3 ligou o envio de verdade e aquele texto saiu, então a caixa
    // voltou a nascer VAZIA e escondida, igual ao original. Sem a exclusão,
    // este teste passa a ser quem garante isso: qualquer texto fixo que
    // alguém devolva ao aviso — nas DUAS páginas — derruba a comparação.
    // Medido: foi assim que a exclusão foi retirada, com a suíte verde
    // depois.
    //
    // "painel-entrar"/"painel-criar": no HTML estático original, cada
    // campo era um <aac-form-campo rotulo="..." ajuda="...">, custom
    // element sem filho — rótulo e ajuda eram ATRIBUTOS, não texto (só
    // viravam texto depois que o script do componente rodava no
    // navegador), mesma situação de "filtros-acervo" em /acervo.
    // componentes/AbasEntrar.tsx expande cada campo em
    // componentes/CampoFormulario.ts, que desenha <label>/<p>/<input> de
    // verdade — introduzindo texto (rótulos, textos de ajuda) que nunca
    // existiu como texto no arquivo .html original. As duas <section>
    // saem inteiras (não só os campos) porque os dois <form> inteiros
    // vivem dentro delas.
    idsExcluidos: ['painel-entrar', 'painel-criar']
  },
  {
    rota: '/recuperar-acesso',
    arquivoOriginal: 'testes/apoio/html-original/recuperar-acesso.html',
    // Tarefa A6, revista pela Tarefa 3: "aviso" voltou para a comparação
    // (ver o porquê em /entrar acima — vale igual aqui, é o mesmo
    // elemento com o mesmo id nas duas páginas). "form-recuperar"
    // continua fora porque o único campo do formulário (e-mail) era um
    // <aac-form-campo> sem texto no estático, e vira <label>/<input> de
    // verdade aqui — mesma classe de "filtros-acervo"/"painel-entrar". O
    // botão "Enviar link" e o link "Voltar para entrar", que SÃO texto
    // literal nos dois lados, saem junto por estarem dentro do mesmo
    // <form> — cobertos à parte, por igualdade, em
    // testes/pagina-recuperar-acesso.test.mjs.
    idsExcluidos: ['form-recuperar']
  }
];

// Remove do HTML bruto o elemento (<section aria-labelledby="ID">, ou
// qualquer tag com id="ID") cujo id está em `idsExcluidos`, antes de
// extrair o texto — ver comentário acima.
//
// `exigirPresenca` cobre só o lado ORIGINAL (testes/apoio/html-original/
// *.html): aquele arquivo é uma cópia congelada e versionada, o elemento
// alvo tem que existir nele sempre — se sumir, é sinal de erro de digitação
// no id, ou de alguém ter editado a cópia congelada, que não deve mudar.
// Do lado RENDERIZADO a ausência é legítima:
// a decisão 1 da Tarefa 10 manda a <section> inteira sumir quando não há
// nenhum registro (clipping vazio no banco, ou tudo despublicado — ver
// filtrarEOrdenarLocal em servidor/dados/conteudo.ts), e essa omissão já
// tem teste dedicado em testes/prova-social.test.mjs. Cobrar presença aqui
// faria este teste falhar exatamente quando o produto acerta — reproduzido
// forçando listarClipping() a devolver [] antes daquela correção.
function removerSecoesExcluidas(html, idsExcluidos, exigirPresenca) {
  return idsExcluidos.reduce((resultado, id) => {
    const removido = removerElementoPorId(resultado, id);
    if (exigirPresenca) {
      assert.ok(removido.encontrado, `elemento "${id}" a excluir não foi encontrado no HTML original`);
    }
    return removido.html;
  }, html);
}

/**
 * Remove um elemento (identificado por `id="ID"` ou `aria-labelledby="ID"`)
 * do HTML, respeitando aninhamento de tags do MESMO NOME dentro dele.
 *
 * Acrescentado na Tarefa A3 para excluir <div id="lista-atividades"> de
 * /projetos da comparação (a lista é preenchida com dado real, que não
 * existe no HTML estático original — mesma situação de "Onde já
 * estivemos"/"Na mídia", só que a div de origem não é uma <section
 * aria-labelledby>). Um `[\s\S]*?<\/div>` não-guloso, como o antigo regex
 * usava para <section>, pararia no primeiro </div> DE DENTRO da lista — a
 * ficha técnica de cada atividade usa <div> para cada linha
 * (componentes/CardAtividade.ts) — e devolveria HTML pela metade. Contar
 * profundidade por tag resolve isso; funciona também para o caso de
 * <section> que já existia, já que nenhuma das duas seções de prova social
 * aninha outra <section> dentro.
 */
function removerElementoPorId(html, id) {
  const abertura = html.match(new RegExp(
    `<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*(?:\\bid=["']${id}["']|\\baria-labelledby=["']${id}["'])[^>]*>`
  ));
  if (!abertura) return { html, encontrado: false };

  const tag = abertura[1].toLowerCase();
  const inicio = abertura.index;
  const fimAbertura = inicio + abertura[0].length;

  const marcador = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  marcador.lastIndex = fimAbertura;

  let profundidade = 1;
  let fim = -1;
  let m;
  while ((m = marcador.exec(html))) {
    if (m[0].startsWith('</')) {
      profundidade -= 1;
      if (profundidade === 0) {
        fim = m.index + m[0].length;
        break;
      }
    } else if (!m[0].endsWith('/>')) {
      profundidade += 1;
    }
  }

  if (fim === -1) return { html, encontrado: false };
  return { html: html.slice(0, inicio) + html.slice(fim), encontrado: true };
}

function extrairTextoDoMain(html, idsExcluidos = [], exigirPresenca = false) {
  const semSecoesExcluidas = removerSecoesExcluidas(html, idsExcluidos, exigirPresenca);

  const abre = semSecoesExcluidas.match(/<main\b[^>]*id=["']conteudo["'][^>]*>/i);
  assert.ok(abre, 'não achou <main id="conteudo"> no documento');

  const inicio = abre.index + abre[0].length;
  const fim = semSecoesExcluidas.indexOf('</main>', inicio);
  assert.ok(fim !== -1, 'não achou </main> no documento');

  const miolo = semSecoesExcluidas.slice(inicio, fim);
  return normalizarEspacos(decodificarEntidades(removerTags(miolo)));
}

/**
 * `idsAcrescentados` — a segunda espécie de exclusão, nascida com o RF07.
 *
 * As doze primeiras exclusões desta lista têm todas a mesma forma: um
 * elemento que EXISTE nos dois lados, vazio no HTML estático original
 * (porque um script o preenchia depois) e cheio no renderizado. Por isso
 * `exigirPresenca` cobra a presença do lado original: se o id sumir de lá,
 * é erro de digitação ou alguém editou a cópia congelada.
 *
 * O formulário de contato é outra coisa: ele NÃO EXISTE no HTML original, e
 * nunca existiu (site/contato.html nasceu sem formulário). Cobrar presença
 * dele lá derrubaria o teste; não cobrar nada abriria a porta para excluir,
 * por engano, um id que existe nos dois lados — que é exatamente a exclusão
 * perigosa, a que apaga texto original da comparação sem ninguém notar.
 *
 * Então a exigência INVERTE: o id precisa estar AUSENTE do original. É uma
 * verificação de verdade, não uma dispensa — trocar `idsAcrescentados` por
 * `idsExcluidos` (ou vice-versa) derruba o teste nos dois sentidos.
 */
/**
 * =====================================================================
 * FRASES DELIBERADAMENTE REESCRITAS
 * =====================================================================
 *
 * A regra deste arquivo é "nenhuma frase da ONG pode sumir do site". Ela
 * está certa, e é justamente por isso que precisa de uma porta declarada:
 * às vezes uma frase do original DEIXA DE SER VERDADE, e mantê-la seria
 * pior do que perdê-la.
 *
 * Cada entrada aqui exige as DUAS PONTAS, e é isso que a torna uma
 * verificação em vez de uma dispensa:
 *
 *   · `antiga` precisa estar AUSENTE do site (prova que a troca aconteceu);
 *   · `nova` precisa estar PRESENTE (prova que ela foi substituída, e não
 *     simplesmente apagada).
 *
 * Trocar uma por outra, ou esquecer de acrescentar a nova, derruba o teste.
 * E o `porque` fica escrito aqui, no lugar onde a próxima pessoa vai
 * procurar quando estranhar a diferença.
 */
const FRASES_SUBSTITUIDAS = [
  {
    rota: '/privacidade',
    antiga: 'Fora esses dois, o site não busca nada em servidores de terceiros.',
    nova: 'Fora esses dois, o site quase não busca nada em servidores de terceiros.',
    porque: 'O mapa do Google em /quem-somos e /contato (pedido V1, 02/09/2026) tornou a '
      + 'afirmação original FALSA. Uma política de privacidade que afirma o que deixou de ser '
      + 'verdade é pior que uma que não afirmava nada. A página passou a declarar o mapa num '
      + 'parágrafo próprio, logo abaixo.'
  }
];

/**
 * =====================================================================
 * DE "IDÊNTICO" PARA "NENHUMA FRASE SUMIU" — decisão D1, 02/09/2026
 * =====================================================================
 *
 * Este teste comparava o texto do <main> por IGUALDADE com o HTML
 * congelado. Isso foi o certo enquanto a missão era provar que a migração
 * para o Next não perdeu uma palavra da ONG — e funcionou: foi ele que
 * pegou `e-mailatelieafro@gmail.com` quando ninguém estava olhando.
 *
 * A missão mudou. O design system v1 e o pedido V1 ACRESCENTAM texto às
 * páginas (numeração dos caminhos, "Saber mais", seções novas) e, no bloco
 * de projetos e notícias, MOVEM texto para uma rota de detalhe. Com
 * igualdade, toda melhoria de tela vira vermelho — e a saída fácil,
 * excluir mais um id da comparação, esvazia a garantia sem ninguém notar.
 *
 * Então a asserção passa a ser a que realmente importa:
 *
 *     TODO BLOCO DE TEXTO DO HTML ORIGINAL AINDA APARECE NO SITE.
 *
 * "Bloco" é título, parágrafo, item de lista — ver `blocosDeTexto` em
 * testes/apoio/texto-visivel.mjs. Acrescentar é livre; SUMIR não é.
 *
 * =====================================================================
 * O QUE SE PERDE, E O QUE COBRE O BURACO
 * =====================================================================
 *
 * Perde-se o alarme contra texto ACRESCENTADO por engano — antes, qualquer
 * palavra a mais derrubava o teste. Isso é justamente o que precisava
 * mudar, mas deixa um flanco: conteúdo institucional inventado (regra 2)
 * não é mais pego aqui.
 *
 * Quem cobre: `testes/paginas.test.mjs`, que afirma o conteúdo real de cada
 * rota, e a revisão humana de cada tarefa. Está registrado para quem vier:
 * este arquivo garante que nada SOME; ele não garante mais que nada ENTRE.
 *
 * =====================================================================
 * `destinos`: para quando o texto muda de rota
 * =====================================================================
 *
 * Por padrão a frase é procurada na PRÓPRIA rota. Uma página que passa a
 * distribuir seu conteúdo em rotas de detalhe declara `destinos` — e a
 * frase pode estar em qualquer uma delas. É explícito de propósito: mover
 * texto para outra tela é decisão, e decisão fica escrita.
 */
/**
 * Quantos blocos cada página rendeu, preenchido pelos testes do laço e
 * conferido pelo teste do total, logo depois dele.
 */
const contagemDeBlocos = new Map();

async function textoDaRota(rota, idsExcluidos) {
  const resposta = await fetch(`${BASE}${rota}`);
  assert.equal(resposta.status, 200, `${rota} não respondeu 200`);
  const html = await resposta.text();

  const semExcluidos = removerSecoesExcluidas(html, idsExcluidos, /* exigirPresenca */ false);
  const abre = semExcluidos.match(/<main\b[^>]*id=["\']conteudo["\'][^>]*>/i);
  assert.ok(abre, `não achou <main id="conteudo"> em ${rota}`);
  const inicio = abre.index + abre[0].length;
  const fim = semExcluidos.indexOf('</main>', inicio);
  assert.ok(fim !== -1, `não achou </main> em ${rota}`);

  return normalizarEspacos(decodificarEntidades(removerTags(semExcluidos.slice(inicio, fim))));
}

for (const pagina of PAGINAS) {
  test(`${pagina.rota}: nenhuma frase do HTML original sumiu do site`, async () => {
    const idsExcluidos = pagina.idsExcluidos ?? [];
    const idsAcrescentados = pagina.idsAcrescentados ?? [];

    const htmlOriginal = readFileSync(path.join(RAIZ, pagina.arquivoOriginal), 'utf-8');

    for (const id of idsAcrescentados) {
      assert.ok(
        !removerElementoPorId(htmlOriginal, id).encontrado,
        `"${id}" está declarado como idsAcrescentados (só existe na página nova), mas EXISTE no `
        + 'HTML original — excluí-lo apagaria texto original da comparação. Se ele existe nos '
        + 'dois lados, o lugar dele é idsExcluidos.'
      );
    }

    // O <main> do original, sem as seções excluídas, partido em blocos.
    const semExcluidosOriginal = removerSecoesExcluidas(
      htmlOriginal, idsExcluidos, /* exigirPresenca */ true);
    const abre = semExcluidosOriginal.match(/<main\b[^>]*id=["\']conteudo["\'][^>]*>/i);
    assert.ok(abre, 'não achou <main id="conteudo"> no HTML original');
    const inicio = abre.index + abre[0].length;
    const fim = semExcluidosOriginal.indexOf('</main>', inicio);
    const blocosOriginais = blocosDeTexto(semExcluidosOriginal.slice(inicio, fim));

    // TRAVA CONTRA VACUIDADE, primeira metade: sem ela, um erro de
    // extração que devolvesse lista vazia deixaria este teste verde sem
    // verificar nada. O piso é 1 e não mais, porque quatro páginas
    // (/noticias, /galeria, /acervo, /recuperar-acesso) legitimamente têm
    // dois blocos depois das exclusões — são telas de estado vazio, e a
    // lista que as preenche sai da comparação. MEDIDO. A trava de verdade
    // é a segunda metade, no teste do TOTAL, logo abaixo do laço.
    assert.ok(blocosOriginais.length >= 1,
      `${pagina.rota}: o HTML original não rendeu bloco de texto nenhum — `
      + 'a extração quebrou, ou a exclusão comeu a página inteira');
    contagemDeBlocos.set(pagina.rota, blocosOriginais.length);

    const rotas = pagina.destinos ?? [pagina.rota];
    const textos = [];
    for (const rota of rotas) {
      textos.push(await textoDaRota(rota, [...idsExcluidos, ...idsAcrescentados]));
    }

    // As frases declaradas como reescritas saem da cobrança de PRESENÇA —
    // e ganham, logo abaixo, uma cobrança própria e mais dura.
    const substituidas = FRASES_SUBSTITUIDAS
      .filter((entrada) => entrada.rota === pagina.rota)
      .map((entrada) => entrada.antiga);

    const sumiram = blocosOriginais
      .filter((bloco) => !substituidas.some((antiga) => bloco.includes(antiga)))
      .filter((bloco) => !textos.some((texto) => texto.includes(bloco)));

    assert.deepEqual(sumiram, [],
      `${pagina.rota}: ${sumiram.length} bloco(s) de texto do HTML original não foram `
      + `encontrados em ${rotas.join(', ')}:\n  - ` + sumiram.join('\n  - '));
  });
}

/**
 * TRAVA CONTRA VACUIDADE, segunda metade.
 *
 * O piso por página é 1, porque quatro delas têm mesmo pouquíssimo texto
 * depois das exclusões. Um piso baixo em cada uma, porém, deixaria passar o
 * defeito que mais assusta aqui: `blocosDeTexto` quebrar de um jeito que
 * devolva um bloco por página em vez de vinte. Cada teste ficaria verde,
 * comparando quase nada, e ninguém veria.
 *
 * Por isso o TOTAL é cobrado à parte. 173 é o que as 14 páginas de PAGINAS
 * rendem hoje — MEDIDO em 02/09/2026, contando bloco a bloco. O piso está
 * um pouco abaixo para tolerar edição legítima da cópia congelada (que não
 * deveria acontecer: ver testes/apoio/html-original/LEIA-ME.txt), e bem
 * acima do que qualquer quebra de extração produziria.
 */
test('a extração por bloco não degradou: o total das páginas continua alto', () => {
  const total = [...contagemDeBlocos.values()].reduce((soma, n) => soma + n, 0);

  assert.equal(contagemDeBlocos.size, PAGINAS.length,
    `só ${contagemDeBlocos.size} das ${PAGINAS.length} páginas foram medidas — `
    + 'algum teste do laço não chegou a contar, e o total abaixo não vale');

  assert.ok(total >= 160,
    `as ${PAGINAS.length} páginas renderam ${total} blocos de texto no total; `
    + 'esperava ao menos 160 (MEDIDO: 173 em 02/09/2026). Uma queda desse tamanho '
    + 'significa que blocosDeTexto parou de partir o HTML — e cada teste acima '
    + 'passou a comparar quase nada.');
});

// =====================================================================
// Reconciliação da lista de exclusões — Rodada de correção 1 da Tarefa A5.
// =====================================================================
//
// Achado da revisão: removeram os `{' '}` do parágrafo do aviso Pix em
// app/doar/page.tsx (a armadilha do JSX come espaços, restrição global #3)
// e a suíte inteira — 327 testes — continuou verde. `dados-pix` sai da
// comparação acima (exclusão LEGÍTIMA: a div chegava vazia no HTML estático
// original), mas ninguém tinha essa mesma frase coberta em outro lugar por
// IGUALDADE sensível a espaço — só fragmentos isolados, que passam mesmo
// com as pontas coladas. Toda exclusão desta lista tem o mesmo risco: é um
// bloco que este arquivo especificamente NÃO observa.
//
// Esta tabela não prova que a cobertura declarada é forte — só que ela
// EXISTE (o arquivo está no repositório) e que ninguém esqueceu de decidir
// alguma coisa a respeito. Uma exclusão nova sem entrada aqui derruba o
// teste abaixo; isso força quem adicionar uma seção nova a `idsExcluidos` a
// escrever a cobertura correspondente (ou o motivo de não precisar) no
// mesmo commit — o problema real que motivou isto é a lista crescer a cada
// tarefa sem que ninguém reconcilie. O que este mecanismo NÃO faz: verificar
// que o teste apontado realmente compara a frase inteira por igualdade —
// isso é julgamento humano (uma revisão, ou uma leitura do arquivo), não
// uma checagem mecânica. Um `assert.match` fraco dentro do arquivo correto
// passa por aqui sem acusar nada; foi exatamente esse tipo de fraqueza que
// causou o achado desta rodada, e nenhuma automação abaixo o teria pego —
// só a comparação por igualdade que este arquivo motivou em cada teste.
const COBERTURA_DAS_EXCLUSOES = {
  'titulo-midia-home': {
    arquivo: 'testes/secao-na-midia.test.mjs',
    nota: '"strong e span do item ficam colados" — prova a fronteira <strong></strong><span>, sem espaço solto (proposital).'
  },
  'titulo-onde-estivemos': {
    arquivo: 'testes/prova-social.test.mjs',
    nota: 'mesmo teste irmão de titulo-midia-home, para SecaoOndeEstivemos.'
  },
  'lista-atividades': {
    semFronteira: true,
    motivo: 'componentes/CardAtividade.ts não concatena texto com elemento nenhum — título, resumo, '
      + 'cada parágrafo de sinopse e cada <dt>/<dd> da ficha vivem em blocos próprios (h2/p/dt/dd), '
      + 'sempre separados por tag de bloco. Não há fronteira texto-elemento para uma comparação de '
      + 'espaço observar (medido lendo o componente inteiro nesta rodada, não suposto).'
  },
  'lista-proximos': {
    arquivo: 'testes/lista-eventos.test.mjs',
    nota: '"evento completo" casa " · Sede do Ateliê..." (o espaço antes do separador) por igualdade de substring.'
  },
  'lista-passados': { arquivo: 'testes/lista-eventos.test.mjs', nota: 'mesmo componente de lista-proximos.' },
  'lista-noticias': {
    arquivo: 'testes/paginas-vazias-a4.test.mjs',
    nota: 'as duas frases do estado vazio, num só regex — acrescentado nesta rodada (ponto cego da Tarefa A4).'
  },
  'lista-albuns': {
    arquivo: 'testes/paginas-vazias-a4.test.mjs',
    nota: 'mesmo tipo de teste de lista-noticias — acrescentado nesta rodada.'
  },
  'filtros-acervo': {
    semFronteira: true,
    motivo: 'rótulo e ajuda do formulário de busca são um <label> e um <p> cada, sem texto colado em '
      + 'elemento nenhum — ver o comentário de app/acervo/page.tsx.'
  },
  'lista-acervo': { arquivo: 'testes/lista-materiais.test.mjs', nota: 'mesmo padrão de lista-proximos, para materiais.' },
  'lista-areas': {
    arquivo: 'testes/lista-areas.test.mjs',
    nota: 'ListaAreas.ts também não concatena texto com elemento (h3/p separados) — mesma situação de lista-atividades.'
  },
  'dados-pix': {
    arquivo: 'testes/pagina-doar.test.mjs',
    nota: 'achado desta rodada — "o aviso sem chave Pix é a frase inteira..." compara por igualdade, tags fora.'
  },
  'painel-entrar': {
    arquivo: 'testes/campo-formulario.test.mjs',
    nota: 'Tarefa A6 — a única fronteira texto-elemento de CampoFormulario.ts é rótulo + espaço + '
      + '<span class="campo__obrigatorio">*</span>, coberta por "campo obrigatório recebe required e a '
      + 'marca visual" (regex com o espaço literal). Correção (Rodada de correção 1): a nota anterior '
      + 'dizia que "o resto do painel é <label>/<p>/<input> em blocos próprios" — incompleto, porque '
      + 'o link "Esqueci minha senha" (componentes/AbasEntrar.tsx) NÃO vem de CampoFormulario e é '
      + 'texto literal do HTML estático original; ficou sem cobertura nenhuma até esta rodada. Coberto '
      + 'agora, por igualdade, em testes/pagina-entrar.test.mjs ("os dois textos literais que '
      + 'sobrevivem à expansão de CampoFormulario...").'
  },
  'painel-criar': {
    arquivo: 'testes/campo-formulario.test.mjs',
    nota: 'mesmo componente (CampoFormulario.ts) e mesma fronteira de painel-entrar. Mesma correção: a '
      + '<legend>Como você quer participar?</legend> (componentes/AbasEntrar.tsx) também não vem de '
      + 'CampoFormulario — coberta pelo mesmo teste novo de testes/pagina-entrar.test.mjs.'
  },
  'titulo-mensagem': {
    arquivo: 'testes/contato.test.mjs',
    nota: 'RF07 — a seção inteira do formulário de contato sai daqui porque é texto NOVO, que '
      + 'não existe no HTML original. A fronteira texto-elemento que ela esconde é o parágrafo '
      + '"…está na <Link>política de privacidade</Link>." (o único lugar do formulário onde texto '
      + 'encosta em elemento; o resto vem de CampoFormulario, em blocos próprios): comparado por '
      + 'IGUALDADE, com o espaço antes do link, em "o parágrafo do consentimento aponta para a '
      + 'política de privacidade, com o espaço no lugar". O título da seção e o rótulo da caixa de '
      + 'consentimento também são comparados por igualdade no mesmo arquivo.'
  },
  'titulo-oferecer': {
    arquivo: 'testes/doacoes.test.mjs',
    nota: 'RF19 — a seção nova de /doar sai daqui porque é texto que não existe no HTML '
      + 'original. Ela tem UMA fronteira texto-elemento: nenhuma. O parágrafo é texto puro '
      + 'dentro de <p>, o botão é um <Link> sozinho dentro do <p class="abertura__acoes"> (não '
      + 'encosta em texto nenhum) e o <h2> é texto puro — ou seja, não há espaço entre texto e '
      + 'tag para o JSX comer. Coberta assim mesmo, por IGUALDADE, em "a seção nova de /doar '
      + 'leva ao formulário de oferta, com o texto inteiro": se alguém acrescentar texto '
      + 'colado a um elemento ali, é aquele teste que acusa.'
  },
  'form-recuperar': {
    arquivo: 'testes/campo-formulario.test.mjs',
    nota: 'mesmo componente e mesma fronteira de painel-entrar/painel-criar (um só campo obrigatório, '
      + 'e-mail). "Enviar link" e "Voltar para entrar" — texto literal que sai junto por estarem dentro '
      + 'do mesmo <form> — são cobertos por igualdade em testes/pagina-recuperar-acesso.test.mjs.'
  }
};

test('toda exclusão de paridade-texto tem cobertura registrada (arquivo existente, ou motivo de por que não precisa)', () => {
  // As DUAS espécies de exclusão entram aqui: `idsExcluidos` (existe nos
  // dois lados) e `idsAcrescentados` (só na página nova). A diferença entre
  // elas é sobre o HTML original; o risco que esta tabela cobre é o mesmo
  // nos dois casos — um bloco que este arquivo deixa de observar.
  const todasAsExclusoes = [...new Set(
    PAGINAS.flatMap((p) => [...(p.idsExcluidos ?? []), ...(p.idsAcrescentados ?? [])])
  )];

  for (const id of todasAsExclusoes) {
    const entrada = COBERTURA_DAS_EXCLUSOES[id];
    assert.ok(
      entrada,
      `exclusão "${id}" sem entrada em COBERTURA_DAS_EXCLUSOES — ao excluir uma seção nova daqui, `
      + 'registre onde a fronteira texto-elemento dela é coberta (ou por que não há fronteira nenhuma)'
    );

    if (entrada.semFronteira) {
      assert.ok(entrada.motivo, `"${id}": semFronteira precisa vir com o motivo escrito`);
      continue;
    }

    assert.ok(entrada.arquivo, `"${id}": precisa de "arquivo" (ou "semFronteira: true" com "motivo")`);
    assert.ok(
      existsSync(path.join(RAIZ, entrada.arquivo)),
      `"${id}" aponta para ${entrada.arquivo}, que não existe mais — a cobertura sumiu junto`
    );
  }

  // Sentido inverso: nada em COBERTURA_DAS_EXCLUSOES referencia um id que
  // não está (mais) excluído — evita a tabela crescer com entrada morta que
  // ninguém nota quando uma seção deixa de ser excluída (ex.: um campo que
  // ganhou dado real e não precisa mais sair da comparação).
  for (const id of Object.keys(COBERTURA_DAS_EXCLUSOES)) {
    assert.ok(
      todasAsExclusoes.includes(id),
      `COBERTURA_DAS_EXCLUSOES tem "${id}", que não está em nenhum idsExcluidos/idsAcrescentados de PAGINAS — entrada morta`
    );
  }
});

/**
 * A cobrança das frases reescritas, e ela é MAIS DURA que a de presença:
 * exige que a antiga tenha sumido E que a nova esteja no lugar.
 *
 * Sem a primeira metade, alguém declararia uma substituição que nunca
 * aconteceu e a frase antiga continuaria na tela, mentindo. Sem a segunda,
 * "substituir" viraria sinônimo de "apagar".
 */
for (const entrada of FRASES_SUBSTITUIDAS) {
  test(`${entrada.rota}: a frase reescrita foi de fato trocada, nas duas pontas`, async () => {
    const pagina = PAGINAS.find((p) => p.rota === entrada.rota);
    assert.ok(pagina, `FRASES_SUBSTITUIDAS cita ${entrada.rota}, que não está em PAGINAS`);

    // A antiga precisa EXISTIR no original — senão a entrada é letra morta,
    // ou alguém errou a transcrição e a exclusão não está protegendo nada.
    const htmlOriginal = readFileSync(path.join(RAIZ, pagina.arquivoOriginal), 'utf-8');
    const abre = htmlOriginal.match(/<main\b[^>]*id=["\']conteudo["\'][^>]*>/i);
    const originalTexto = normalizarEspacos(decodificarEntidades(removerTags(
      htmlOriginal.slice(abre.index + abre[0].length, htmlOriginal.indexOf('</main>')))));
    assert.ok(originalTexto.includes(entrada.antiga),
      `a frase declarada como antiga não existe no HTML original de ${entrada.rota} — `
      + 'a entrada está errada, e não está protegendo nada');

    const texto = await textoDaRota(entrada.rota, pagina.idsExcluidos ?? []);

    assert.ok(!texto.includes(entrada.antiga),
      `a frase antiga AINDA ESTÁ na tela de ${entrada.rota}: "${entrada.antiga}". `
      + `Ela foi declarada como substituída porque ${entrada.porque}`);

    assert.ok(texto.includes(entrada.nova),
      `a frase nova NÃO está na tela de ${entrada.rota}: "${entrada.nova}". `
      + 'Substituir não é apagar.');
  });
}
