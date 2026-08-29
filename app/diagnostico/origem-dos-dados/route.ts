import { listarAtividadesComOrigem, listarClippingComOrigem } from '@/servidor/dados/conteudo';

/**
 * Diagnóstico: o site está servindo do banco ou do JSON versionado?
 *
 * Por que existe, e por que num endpoint em vez de num teste comum
 * (CRÍTICO 1 e 2 da revisão final):
 *
 * `listarAtividades()` não é consumida por nenhuma página da fase 1 —
 * /projetos só migra na fase 2. E ela não pode ser chamada de um
 * `node --test` direto: servidor/dados/conteudo.ts começa com
 * `import 'server-only'` (que lança fora de um React Server Component, e é
 * para isso que serve), importa JSON sem `with { type: 'json' }`, resolve
 * `@/...` pelo tsconfig e acaba em `cookies()` do next/headers, que exige
 * contexto de requisição. Reproduzir tudo isso com hooks de carregador
 * seria testar uma imitação. Uma rota do próprio Next roda o código de
 * verdade, no runtime de verdade, com a requisição de verdade.
 *
 * FECHADA POR PADRÃO. Sem DIAGNOSTICO_ORIGEM_DOS_DADOS=1 no ambiente do
 * servidor, responde 404 como qualquer rota inexistente — inclusive em
 * produção, onde a variável não existe. testes/origem-dos-dados.test.mjs
 * afirma esse 404 no modo offline (o padrão do `npm test`, que não define a
 * variável) e o 200 no modo com credenciais.
 *
 * O corpo NUNCA carrega credencial nem registro: só procedência, contagem e
 * o carimbo (maior `criado_em`), que é a prova de que as linhas vieram do
 * Postgres — `criado_em` não existe em nenhum JSON de dados-iniciais/.
 * testes/vazamento.test.mjs continua varrendo URL e chave.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.DIAGNOSTICO_ORIGEM_DOS_DADOS !== '1') {
    return new Response('Não encontrado', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const [atividades, clipping] = await Promise.all([
    listarAtividadesComOrigem(),
    listarClippingComOrigem()
  ]);

  const resumir = ({ origem, registros, carimbo }: Awaited<ReturnType<typeof listarClippingComOrigem>>
    | Awaited<ReturnType<typeof listarAtividadesComOrigem>>) => ({
    origem,
    quantidade: registros.length,
    carimbo,
    // Só os ids: nome de peça de teatro e de instituição já é conteúdo
    // público do site. Serve para o teste confrontar com uma consulta
    // direta ao PostgREST, feita por fora do Next.
    ids: registros.map((registro) => registro.id)
  });

  return Response.json(
    { atividades: resumir(atividades), clipping: resumir(clipping) },
    { headers: { 'cache-control': 'no-store' } }
  );
}
