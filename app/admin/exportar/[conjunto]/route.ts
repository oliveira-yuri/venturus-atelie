import { notFound, redirect } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { linhasParaExportar } from '@/servidor/dados/exportacao';
import { montarCsv, conjuntoPorChave, nomeDoArquivo } from '@/compartilhado/exportacao';

/**
 * `/admin/exportar/<conjunto>` — o RF31: a equipe leva os dados para fora,
 * em CSV.
 *
 * ===================================================================
 * ROUTE HANDLER, E NÃO SERVER ACTION — POR UM MOTIVO MECÂNICO
 * ===================================================================
 *
 * Um download é uma RESPOSTA COM CABEÇALHO PRÓPRIO: `Content-Type: text/csv`
 * e `Content-Disposition: attachment`, que é o que faz o navegador salvar o
 * arquivo em vez de desenhar o texto na tela. Server Action devolve o
 * resultado de uma renderização; ela não tem onde escrever esses cabeçalhos.
 *
 * E o desfecho prático é o que importa mais neste projeto: sendo Route
 * Handler, o download é um `<a href>` comum. FUNCIONA SEM JAVASCRIPT por
 * construção, não por cuidado — não há `fetch`, não há Blob, não há
 * `URL.createObjectURL`, que é como um export costuma ser feito e é
 * exatamente o que não funciona no celular de quem está com script
 * desligado ou com a página ainda não hidratada.
 *
 * É o mesmo raciocínio de app/auth/confirm/route.ts, que é Route Handler
 * porque precisa GRAVAR COOKIE — coisa que a renderização de um Server
 * Component também não pode fazer.
 *
 * ===================================================================
 * A GUARDA É A PRIMEIRA COISA, E ELA NÃO VEM DO LAYOUT
 * ===================================================================
 *
 * `app/admin/layout.tsx` NÃO ENVOLVE ESTE ARQUIVO. Layout é do sistema de
 * páginas; um `route.ts` é atendido por outro caminho e não passa por ele.
 * Ou seja: aqui a situação é a mesma das Server Actions do painel
 * (spec §4.5) — endpoint HTTP alcançável por quem souber a URL, sem página,
 * sem layout, sem `generateMetadata`.
 *
 * E A VARREDURA NÃO ALCANÇA ESTE ARQUIVO: `testes/painel-guarda.test.mjs`
 * varre `app/admin/**` procurando por `page.tsx`, e este não é um. Por isso
 * `testes/exportacao.test.mjs` tem a varredura irmã, que exige `ehEquipe()`
 * dentro de todo `route.ts` sob `app/admin/` — a mesma trava que
 * publicações, galeria, atividades e contatos têm para as Actions delas.
 *
 * O `notFound()` (e não um 403) pelo mesmo motivo do resto do painel: dizer
 * "você não tem permissão" contaria que existe um endereço que exporta a
 * lista de contatos da ONG. Ver app/admin/layout.tsx.
 *
 * A GUARDA NÃO É A TRANCA. Quem decide o que sai é a RLS: `contatos: equipe
 * gerencia` e `voluntarios: equipe gerencia`, as duas `for all using
 * (public.eh_equipe())` (004_pessoas.sql). O cliente usa a sessão de quem
 * pediu e não existe chave de serviço neste repositório — mesmo que este
 * `if` fosse contornado, o Postgres devolveria zero linha.
 *
 * ===================================================================
 * O QUE SAI DAQUI É DADO PESSOAL DE TERCEIRO
 * ===================================================================
 *
 * Nome, e-mail, telefone e texto livre de quem escreveu para a ONG, e de
 * quem se candidatou ao voluntariado. Três consequências, escritas para não
 * se perderem:
 *
 *  · `Cache-Control: no-store`, e não é enfeite: sem ele, a CDN da Netlify
 *    pode guardar a resposta de uma rota `/admin/...` e servi-la de novo. Um
 *    arquivo com a lista de contatos em cache compartilhado é o pior
 *    desfecho possível desta tarefa;
 *  · NADA VAI PARA O LOG além da contagem de linhas e do conjunto. Nem nome,
 *    nem e-mail, nem o CSV — o log da Netlify não é controlado pela ONG. É a
 *    mesma disciplina do `token_hash` em app/auth/confirm/route.ts;
 *  · a tela que oferece o download avisa por escrito que o arquivo carrega
 *    dado pessoal e não deve ser reenviado (componentes/PainelExportacoes.ts).
 *    A LGPD não termina no download.
 *
 * ===================================================================
 * CONSULTA QUE FALHOU NÃO VIRA ARQUIVO VAZIO
 * ===================================================================
 *
 * Esta é a inversão deliberada da política de degradação do site
 * (servidor/dados/degradacao.ts). Numa página, degradar para lista vazia
 * mantém o site no ar e o estado vazio já é texto escrito. Num ARQUIVO,
 * "vazio" é uma AFIRMAÇÃO: um CSV com cabeçalho e zero linhas diz "não há
 * ninguém", a equipe salva no celular, e o engano sobrevive à causa — o
 * arquivo vira anexo de e-mail e continua dizendo aquilo semanas depois.
 *
 * Então quando `degradou` é true não sai arquivo nenhum: a pessoa volta para
 * o painel com o aviso de que não deu para gerar. Zero linhas SEM falha
 * continua virando arquivo, com o cabeçalho e nenhuma linha — aí "não há
 * ninguém" é a resposta certa.
 */

/**
 * Nunca em cache, nem por acidente — ver o bloco acima. `force-dynamic`
 * porque a resposta depende da sessão de quem pediu e do conteúdo do banco
 * naquele instante.
 */
export const dynamic = 'force-dynamic';

/** Para onde a falha volta. O painel, com um aviso da lista fechada. */
const PAINEL = '/admin';

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ conjunto: string }> }
) {
  // A GUARDA, antes de qualquer leitura. `ehEquipe()` (servidor/permissao.ts)
  // falha FECHADA: sem sessão, sem Supabase, erro de consulta e prazo
  // estourado chegam todos aqui como `false`.
  if (!await ehEquipe()) notFound();

  // O SEGMENTO DA URL É ENTRADA DE USUÁRIO, e passa por lista fechada
  // (compartilhado/exportacao.ts). Sem ela, o caminho fácil seria usar o
  // valor como nome de tabela, e `/admin/exportar/perfis` viraria um export
  // que ninguém desenhou. Valor fora da lista é um endereço que não existe —
  // daí `notFound()`, e não um aviso.
  const conjunto = conjuntoPorChave((await params).conjunto);
  if (!conjunto) notFound();

  const { valor: linhas, degradou } = await linhasParaExportar(conjunto.chave);

  // Ver o bloco "consulta que falhou não vira arquivo vazio". `redirect()`
  // sinaliza por exceção e fica FORA de qualquer try — a mesma advertência
  // que todas as Actions deste projeto carregam.
  if (degradou) {
    console.error(`[exportacao] "${conjunto.chave}": a consulta não voltou; NENHUM arquivo foi `
      + 'gerado, para não entregar uma planilha vazia que parece um retrato do banco.');
    redirect(`${PAINEL}?aviso=exportacao-erro`);
  }

  // Só a contagem e o conjunto. Nenhum nome, nenhum e-mail, nenhuma linha do
  // arquivo — ver o bloco sobre dado pessoal acima.
  console.info(`[exportacao] "${conjunto.chave}": ${linhas.length} linha(s) exportada(s).`);

  const csv = montarCsv(conjunto.colunas, linhas);

  return new Response(csv, {
    headers: {
      // `charset=utf-8` junto do BOM que montarCsv escreve: o cabeçalho
      // resolve para quem lê pela rede, o BOM para quem abre o arquivo
      // salvo, no Excel, sem passar por rede nenhuma. Os dois, porque os
      // dois caminhos existem.
      'content-type': 'text/csv; charset=utf-8',
      // `attachment` é o que faz o navegador SALVAR em vez de desenhar. Sem
      // ele, um CSV de contatos abriria como texto na tela — e ficaria no
      // histórico do navegador do celular pessoal de quem é da equipe.
      'content-disposition': `attachment; filename="${nomeDoArquivo(conjunto, new Date())}"`,
      'cache-control': 'no-store'
    }
  });
}
