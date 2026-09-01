/**
 * Estado da migração para Next — fonte única para os testes que precisam
 * saber quais rotas já existem de verdade no app novo e quais ainda não.
 *
 * Rodada de correção 1 da Tarefa A1: até aqui, três arquivos (`links-menu
 * .test.mjs`, `links.test.mjs`, `sem-javascript.test.mjs`) mantinham cada um
 * a própria cópia de ROTAS_PENDENTES, e dois deles também duplicavam a lista
 * de páginas prontas. Cada rota migrada exigia lembrar de tocar em três
 * lugares, sem nada que acusasse um esquecimento além do específico de cada
 * arquivo.
 *
 * Por que este módulo não é `componentes/MenuMovel.tsx`: aquele arquivo tem
 * JSX, que o carregador de TypeScript nativo do Node não transforma.
 *
 * Por que este módulo não é um `*.test.mjs` existente (ex.: reexportar de
 * dentro de `links-menu.test.mjs`): MEDIDO nesta rodada — importar um módulo
 * `*.test.mjs` executa de novo, no processo de quem importa, todo `test()`
 * de nível superior que ele contiver. Um teste em `links.test.mjs` que
 * importasse `links-menu.test.mjs` rodaria os três testes de lá PELA SEGUNDA
 * VEZ dentro do arquivo de quem importou, inflando a contagem da suíte com
 * duplicatas silenciosas. Por isso este módulo não declara nenhum `test()`.
 *
 * Ao portar uma rota (Tarefas A2 em diante): mover a entrada de
 * ROTAS_PENDENTES para ROTAS_PRONTAS_MENU (se for item do menu) ou para
 * PAGINAS_PRONTAS_FORA_DO_MENU (se não for, como /privacidade), no mesmo
 * commit. Os três arquivos que importam daqui têm cada um seu próprio teste
 * de reconciliação contra a realidade (o HTML do menu, em links-menu; o
 * sistema de arquivos de app/, em links.test.mjs e sem-javascript.test.mjs)
 * — esquecer quebra pelo menos um deles.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Itens do MENU que já existem de verdade no Next.
export const ROTAS_PRONTAS_MENU = [
  '/', '/quem-somos', '/para-escolas', '/projetos',
  // Tarefa A4: as quatro páginas migram juntas (agenda, notícias, galeria,
  // acervo) — todas com tabela vazia hoje, mostrando o estado vazio da
  // Tarefa A4 em vez da lista (ver componentes/ListaEventos.ts e
  // componentes/ListaMateriais.ts).
  '/agenda', '/noticias', '/galeria', '/acervo',
  // Tarefa A5: voluntariado (RF24, com as cinco áreas reais do banco — ver
  // componentes/ListaAreas.ts) e doar (RF23, sem chave Pix — decisão D7
  // pendente, ver app/doar/page.tsx).
  '/voluntariado', '/doar',
  // Tarefa A6: contato (RF06 — sem formulário, ver app/contato/page.tsx) e
  // entrar (RF08–RF10, tela pronta, envio desligado até o Bloco B — ver
  // app/entrar/page.tsx e componentes/AbasEntrar.tsx).
  '/contato', '/entrar'
];

// Itens do menu (mais o "Entrar" do cabeçalho) que ainda não têm página no
// app novo. A fase 2 esgota esta lista tarefa a tarefa — Tarefa A6 é quem
// zera ela.
export const ROTAS_PENDENTES = [];

// Páginas prontas que NÃO são item do menu principal — a política de
// privacidade (rodapé) e, desde a Tarefa A6, recuperar-acesso (alcançada só
// pelo link "Esqueci minha senha" de /entrar — nunca foi item de menu, nem
// no site antigo).
// Tarefa 2 da autenticação acrescenta /nova-senha: ela não é, e não pode
// ser, item de menu — só se chega nela pelo link que o Supabase manda por
// e-mail, através de /auth/confirm, que é quem verifica o token e grava a
// sessão. Um item de menu apontando para cá levaria toda visita à tela de
// "esta página abre pelo link do e-mail".
//
// `/auth/confirm` NÃO entra em lista nenhuma daqui, e não precisa: é Route
// Handler (`route.ts`), e rotasReaisDoApp() abaixo só cataloga diretório com
// `page.tsx` dentro — MEDIDO nesta tarefa, rodando a função com a rota já
// criada: ela devolve as 15 páginas e nenhuma menção a /auth/confirm, igual
// ao que já acontece com /diagnostico/origem-dos-dados. Acrescentá-la aqui
// quebraria os dois testes de reconciliação, que comparam esta lista com o
// que a varredura encontra.
export const PAGINAS_PRONTAS_FORA_DO_MENU = ['/privacidade', '/recuperar-acesso', '/nova-senha'];

// Toda página PÚBLICA que já existe de verdade no Next, item de menu ou não.
export const PAGINAS_PRONTAS = [...ROTAS_PRONTAS_MENU, ...PAGINAS_PRONTAS_FORA_DO_MENU];

/**
 * Páginas que EXISTEM em app/ e respondem 404 para quase todo mundo: o
 * painel administrativo (RF33, Tarefa P1 do Bloco B).
 *
 * POR QUE ELAS NÃO ENTRAM EM PAGINAS_PRONTAS, e isto não é preciosismo de
 * nomenclatura. Aquela lista é consumida por testes que buscam a página e
 * afirmam coisas sobre o conteúdo dela — `<main id="conteudo">`, `<h1>`, os
 * 11 links do menu, os contatos do rodapé, links internos que resolvem.
 * `/admin` responde 404 para quem não é equipe (`app/admin/layout.tsx`), e
 * o 404 deste projeto tem TODAS essas coisas (app/not-found.tsx). Ou seja:
 * pôr `/admin` ali deixaria a suíte verde medindo a página de erro e
 * dizendo, no nome do teste, que mediu o painel. Teste que passa pelo
 * motivo errado é pior que teste ausente — ele afirma.
 *
 * NÃO SÃO ITEM DE MENU, e nunca serão: o painel não é conteúdo público,
 * não foi divulgado, e um item no menu de toda página anunciaria a
 * existência dele justamente para quem a guarda responde 404 (a decisão de
 * responder 404 em vez de "acesso negado" está em app/admin/layout.tsx).
 * Pelo mesmo motivo elas ficam fora do buscador (FORA_DO_BUSCADOR, em
 * app/robots.ts).
 *
 * O que cobre estas rotas é testes/painel-guarda.test.mjs: 404 para
 * anônimo, o layout inteiro no HTML servido, nada do painel vazando, e a
 * decisão de permissão exercitada por unidade.
 */
export const PAGINAS_SO_PARA_EQUIPE = [
  '/admin',
  // Tarefa P2: a lista de notícias da equipe e a tela de escrever/editar.
  // São UMA rota para criar e editar (`/admin/publicacoes/editar`, com `?id=`
  // quando é edição) — ver o cabeçalho daquele page.tsx.
  '/admin/publicacoes',
  '/admin/publicacoes/editar'
];

/**
 * Toda página real de app/, pública ou não — é ESTA lista que precisa
 * bater com o sistema de arquivos.
 *
 * A reconciliação (em testes/links.test.mjs e testes/sem-javascript
 * .test.mjs) existe para que uma página nova não fique sem cobertura
 * nenhuma em silêncio. Ela continua valendo com o painel: quem criar
 * `app/admin/publicacoes/page.tsx` na Tarefa P2 e não cadastrar a rota aqui
 * quebra os dois testes.
 */
export const PAGINAS_CATALOGADAS = [...PAGINAS_PRONTAS, ...PAGINAS_SO_PARA_EQUIPE];

const DIRETORIO_APP = fileURLToPath(new URL('../../app/', import.meta.url));

/**
 * Varre `app/` recursivamente e devolve a rota de toda página real — todo
 * diretório com um `page.tsx` dentro. É o "chão de fábrica" contra o qual
 * `PAGINAS_PRONTAS` precisa bater: sem isso, uma página nova que alguém
 * esquecesse de acrescentar à lista ficaria sem a cobertura que este arquivo
 * existe para dar (achado da Rodada de correção 1 — a lista podia envelhecer
 * em silêncio, e o comentário antigo afirmava uma reconciliação que não
 * existia).
 *
 * Ignora route handlers (`route.ts`, como `app/diagnostico/origem-dos-dados`)
 * e arquivos especiais do App Router (`layout.tsx`, `not-found.tsx`) — nenhum
 * dos dois é uma página navegável por conta própria.
 */
export async function rotasReaisDoApp(diretorio = DIRETORIO_APP, prefixo = '') {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  let rotas = [];

  for (const entrada of entradas) {
    if (entrada.isDirectory()) {
      rotas = rotas.concat(
        await rotasReaisDoApp(join(diretorio, entrada.name), `${prefixo}/${entrada.name}`)
      );
    } else if (entrada.name === 'page.tsx') {
      rotas.push(prefixo === '' ? '/' : prefixo);
    }
  }

  return rotas;
}
