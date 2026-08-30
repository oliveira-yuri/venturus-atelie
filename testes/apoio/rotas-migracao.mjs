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
export const ROTAS_PRONTAS_MENU = ['/', '/quem-somos', '/para-escolas', '/projetos'];

// Itens do menu (mais o "Entrar" do cabeçalho) que ainda não têm página no
// app novo. Migram nas Tarefas A2 em diante.
export const ROTAS_PENDENTES = [
  '/agenda', '/noticias', '/galeria', '/acervo',
  '/voluntariado', '/doar', '/contato', '/entrar'
];

// Páginas prontas que NÃO são item do menu principal — hoje só a política de
// privacidade, alcançada pelo rodapé.
export const PAGINAS_PRONTAS_FORA_DO_MENU = ['/privacidade'];

// Toda página que já existe de verdade no Next, item de menu ou não.
export const PAGINAS_PRONTAS = [...ROTAS_PRONTAS_MENU, ...PAGINAS_PRONTAS_FORA_DO_MENU];

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
