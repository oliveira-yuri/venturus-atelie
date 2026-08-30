/**
 * As 14 URLs antigas com `.html` (site estático, fase 1) e a rota limpa
 * correspondente (Tarefa A7). Já circularam: matéria da Folha, WhatsApp,
 * Instagram — sem redirect, cada uma vira 404 no dia do deploy.
 *
 * Fonte única: `middleware.ts` constrói os redirects a partir daqui, e
 * `testes/redirects.test.mjs` reconcilia esta lista contra os `.html` do
 * site antigo — nenhum dos dois mantém cópia própria (rodada de correção 1
 * da Tarefa A7 — a versão anterior duplicava a lista à mão em três lugares
 * sem nada que os comparasse). Desde a Tarefa A8 esses `.html` são a cópia
 * congelada em `testes/apoio/html-original/`, e não mais `site/`, que foi
 * apagado nesta branch; a reconciliação continua sendo contra arquivos de
 * verdade, não contra uma segunda lista digitada.
 *
 * Por que isto vive em `middleware.ts`, não em `next.config.ts` `redirects()`
 * (onde a Tarefa A7 pôs originalmente): MEDIDO — o roteador do Next zera
 * `resHeaders` (`resHeaders: null`, em
 * node_modules/next/dist/server/lib/router-utils/resolve-routes.js) no ramo
 * que processa um redirect configurado por `next.config.ts`. Um `headers()`
 * casado com o mesmo `source` para acrescentar `Cache-Control` era
 * descartado antes de a resposta sair — confirmado com `curl -D-`, o
 * cabeçalho nunca chegava. Construindo o redirect com `NextResponse.redirect()`
 * dentro do middleware, os cabeçalhos setados na resposta sobrevivem.
 *
 * `/index.html` é a raiz — caso especial, não é troca de sufixo.
 * `/admin/index.html` NÃO está aqui: decisão do coordenador (30/08/2026)
 * registrada em `testes/redirects.test.mjs` — o painel (Bloco B) nunca
 * existiu no ar, nunca foi divulgado fora da equipe da ONG, e redirecionar
 * para uma rota que ainda não existe seria um 404 disfarçado.
 */
export const REDIRECTS_ANTIGOS: Array<{ origem: string; destino: string }> = [
  { origem: '/index.html', destino: '/' },
  { origem: '/quem-somos.html', destino: '/quem-somos' },
  { origem: '/projetos.html', destino: '/projetos' },
  { origem: '/agenda.html', destino: '/agenda' },
  { origem: '/noticias.html', destino: '/noticias' },
  { origem: '/galeria.html', destino: '/galeria' },
  { origem: '/acervo.html', destino: '/acervo' },
  { origem: '/para-escolas.html', destino: '/para-escolas' },
  { origem: '/voluntariado.html', destino: '/voluntariado' },
  { origem: '/doar.html', destino: '/doar' },
  { origem: '/contato.html', destino: '/contato' },
  { origem: '/entrar.html', destino: '/entrar' },
  { origem: '/recuperar-acesso.html', destino: '/recuperar-acesso' },
  { origem: '/privacidade.html', destino: '/privacidade' }
];
