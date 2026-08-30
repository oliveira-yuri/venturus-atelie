/**
 * As URLs antigas com `.html` já circularam — matéria da Folha, links
 * compartilhados no WhatsApp, posts no Instagram — e a versão nova do site
 * usa rota limpa (`/quem-somos`, não `/quem-somos.html`). Sem redirect, cada
 * uma dessas 15 URLs vira 404 no dia do deploy.
 *
 * 301, não 308 (decisão registrada aqui porque `next.config.ts` só justifica
 * o resultado, não o porquê): todo acesso aqui é navegação simples — clique
 * em link salvo, favorito de navegador, indexação de buscador — nunca um
 * POST cujo corpo precise sobreviver ao redirect, que é a única vantagem
 * real do 308 sobre o 301. Em compensação, 301 é o código que crawlers e
 * caches entendem há duas décadas como "mudou para sempre, transfira o
 * peso de indexação" — inclusive o bot que gera a prévia de link do
 * WhatsApp e do Instagram, mais conservador que um navegador moderno. Não
 * há corpo de requisição para preservar aqui, então a garantia adicional do
 * 308 não compra nada e o 301 é a escolha mais compatível.
 *
 * `redirect: 'manual'` em todas as chamadas: o `fetch` padrão SEGUE o
 * redirect e a resposta chegaria como 200 da página nova, escondendo o
 * código e o destino que são exatamente o que este arquivo precisa medir.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// Par [URL antiga, rota nova]. `/index.html` é a raiz — caso especial citado
// na Tarefa A7: não é troca de sufixo, o destino é `/`.
const REDIRECTS_ESPERADOS = [
  ['/index.html', '/'],
  ['/quem-somos.html', '/quem-somos'],
  ['/projetos.html', '/projetos'],
  ['/agenda.html', '/agenda'],
  ['/noticias.html', '/noticias'],
  ['/galeria.html', '/galeria'],
  ['/acervo.html', '/acervo'],
  ['/para-escolas.html', '/para-escolas'],
  ['/voluntariado.html', '/voluntariado'],
  ['/doar.html', '/doar'],
  ['/contato.html', '/contato'],
  ['/entrar.html', '/entrar'],
  ['/recuperar-acesso.html', '/recuperar-acesso'],
  ['/privacidade.html', '/privacidade']
];

describe('as URLs antigas em .html redirecionam para a rota limpa correspondente', () => {
  for (const [antiga, nova] of REDIRECTS_ESPERADOS) {
    test(`${antiga} → ${nova}, com 301`, async () => {
      const resposta = await fetch(`${BASE}${antiga}`, { redirect: 'manual' });

      assert.equal(resposta.status, 301, `${antiga} respondeu ${resposta.status}, esperava 301`);

      const destino = new URL(resposta.headers.get('location'), BASE).pathname;
      assert.equal(destino, nova, `${antiga} rediciona para "${destino}", esperava "${nova}"`);
    });
  }
});

/**
 * `/admin/index.html` é a 15ª URL antiga, e a única sem resposta óbvia: o
 * painel (Bloco B) nunca existiu no ar — RF33 é só a casca da home segundo
 * o CLAUDE.md, não há conta de administrador criada e o cadastro está
 * travado pelo limite de e-mail do Supabase. Quem tem esse link é a equipe
 * de cinco pessoas da ONG, não o público: o painel nunca foi divulgado, não
 * está no menu, não aparece na matéria da Folha nem circulou no Instagram.
 *
 * Decisão (coordenador, 30/08/2026): NÃO redirecionar. As alternativas
 * enganam mais do que ajudam — mandar para `/entrar` sugere que existe um
 * painel funcionando do outro lado do login, quando não existe nada; e
 * redirecionar para `/admin` hoje seria 301 permanente apontando para uma
 * rota que ainda não existe, exatamente o "404 com passo extra" que o
 * comentário histórico deste arquivo em `next.config.ts` sempre rejeitou. O
 * 404 que sobra não é seco: `app/not-found.tsx` entrega página real, em
 * português, com `<main id="conteudo">` e caminho de volta (provado em
 * `testes/rota-inexistente.test.mjs`).
 *
 * ESTE TESTE PRECISA QUEBRAR NO DIA EM QUE O BLOCO B PUBLICAR `/admin`: a
 * publicação do painel e o redirect de `/admin/index.html` entram no mesmo
 * commit. Se este teste continuar verde depois de `/admin` existir, alguém
 * esqueceu o redirect — é exatamente o padrão de "lista presa a uma
 * verificação" que `testes/apoio/rotas-migracao.mjs` já usa para as outras
 * rotas da migração.
 */
test('/admin/index.html não redireciona — decisão explícita, não esquecimento (ver comentário acima)', async () => {
  const resposta = await fetch(`${BASE}/admin/index.html`, { redirect: 'manual' });
  assert.equal(
    resposta.status, 404,
    `/admin/index.html respondeu ${resposta.status}: se foi porque /admin passou a existir de `
    + 'verdade (Bloco B), este teste precisa virar um redirect de verdade — não apagar a cobertura'
  );
});
