/**
 * acoes/contatos.ts — a equipe marca em que pé está o atendimento de uma
 * mensagem recebida (RF29). A tela de leitura do que o RF07 grava.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts, acoes/galeria.ts e
 * acoes/atividades.ts, e vale palavra por palavra: o Next publica cada
 * função exportada de um arquivo `'use server'` numa URL (spec §4.5), e ela
 * não passa por `app/admin/layout.tsx`, nem pela página, nem por
 * `generateMetadata`. A varredura de testes/painel-guarda.test.mjs lê
 * `app/admin/**` e NÃO alcança este arquivo.
 *
 * Por isso a função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo — e testes/contatos.test.mjs
 * varre este arquivo exigindo isso de toda Action nova.
 *
 * A guarda daqui não é a tranca. A tranca é a RLS: `contatos: equipe
 * gerencia`, `for all` com `using` e `with check` em `public.eh_equipe()`
 * (supabase/migrations/004_pessoas.sql). O cliente deste projeto usa a
 * sessão de quem pediu e não existe chave de serviço no repositório (spec
 * §4.1): mesmo que alguém contornasse o `if`, o Postgres recusaria. O que a
 * guarda faz é transformar a recusa numa resposta que a tela entende.
 *
 * ATENÇÃO À ASSIMETRIA COM acoes/contato.ts (singular). Aquele arquivo é o
 * formulário PÚBLICO e é a única Action do projeto SEM `ehEquipe()`, de
 * propósito — quem escreve para a ONG não tem conta. Este é o outro lado da
 * mesma tabela e é o oposto: sem sessão de equipe, nada. Os dois nomes são
 * quase iguais; a diferença entre eles é quem pode chamar.
 *
 * ===================================================================
 * SÓ A COLUNA `situacao` MUDA. NADA MAIS, EM CAMINHO NENHUM.
 * ===================================================================
 *
 * Não há `insert`, não há `delete`, e o `update` grava um objeto de UMA
 * chave. Isso é decisão da tarefa, e é a decisão mais importante dela:
 *
 *  · o texto que a pessoa escreveu é REGISTRO. Editá-lo seria falsificar o
 *    que alguém disse à ONG — e a tela de atendimento é justamente o lugar
 *    onde a tentação de "arrumar o texto" aparece;
 *  · apagar não tem desfazer, aconteceria num celular, de pé (regra 4 do
 *    CLAUDE.md), e apagaria a prova de que houve contato. A política de
 *    privacidade promete guardar mensagem "até o atendimento ser concluído,
 *    e um tempo depois como histórico do contato" — "concluída" é como isso
 *    se registra aqui.
 *
 * O QUE ISSO CUSTA, dito em voz alta: /privacidade também promete que a
 * pessoa pode "pedir a exclusão dos seus dados", e esta tela NÃO faz isso.
 * Quem precisar apagar uma mensagem a pedido de quem escreveu depende de
 * quem cuida do site, no SQL Editor do Supabase. A tela diz isso por
 * escrito (componentes/ListaContatos.ts) em vez de deixar a equipe
 * procurando um botão que não existe.
 *
 * O banco PERMITE as três coisas (a política é `for all`, e
 * `authenticated` tem `grant select, insert, update, delete`). Quem recusa
 * é este arquivo, e há teste que falha no dia em que um `insert` ou um
 * `delete` aparecer aqui.
 *
 * ===================================================================
 * A FUNÇÃO TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM
 * JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como nas outras três telas do painel: o `<form>` manda
 * o POST, a Action grava e responde 303 para a lista, o navegador busca a
 * lista de novo. Sem script isso é o comportamento nativo do formulário. O
 * que a Action tem a dizer viaja no `?aviso=`, por lista fechada
 * (`avisoDeContatos`, em compartilhado/avisos-do-painel.ts).
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try` — um catch em volta os transformaria em "não deu para fazer isso"
 * logo depois de uma gravação bem-sucedida.
 *
 * ===================================================================
 * SEM revalidatePath, E ISSO NÃO É ESQUECIMENTO
 * ===================================================================
 *
 * As Actions de publicações, galeria e atividades revalidam a página
 * pública que elas mudam. Esta não muda página pública nenhuma: `situacao`
 * é coluna de trabalho interno, e nenhuma rota fora de `/admin` lê
 * `public.contatos`. O `redirect()` já traz a lista do painel de novo.
 */
'use server';

import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { lerMudancaDeSituacao, ehIdentificador } from '@/compartilhado/validacao';
import { ehSituacaoDeContato } from '@/compartilhado/triagem-de-contatos';

/** A tela para onde tudo volta. */
const LISTA = '/admin/contatos';

/**
 * De situação gravada para chave de aviso.
 *
 * Existe para o `?aviso=` continuar sendo uma LISTA FECHADA de frases
 * nossas: sem este mapa, o caminho fácil seria escrever
 * `?aviso=${situacao}` — e aí o valor da URL passaria a vir de um campo do
 * formulário, que é entrada de usuário. Ver compartilhado/avisos-do-painel.ts.
 */
const AVISO_DE: Record<string, string> = {
  novo: 'nova',
  em_contato: 'em-contato',
  concluido: 'concluida'
};

/**
 * Sem projeto Supabase configurado não há onde gravar. Na prática ninguém
 * chega aqui, porque sem Supabase `ehEquipe()` já devolveu false e o painel
 * respondeu 404 antes — existe para o caso de a ordem mudar, e para o log,
 * que é onde a causa aparece.
 */
function semSupabase(): void {
  console.error('[contatos] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma mudança de situação pode ser gravada.');
}

/**
 * RF29 — muda a situação de UMA mensagem: novo → em contato → concluído, e
 * de volta, em qualquer sentido.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: é um botão dentro
 * da lista, usado direto como `<form action={mudarSituacao}>` num Server
 * Component. Sem componente de cliente no meio, ou seja, funciona sem
 * JavaScript por construção, não por cuidado — e, o que importa mais nesta
 * tela, NENHUM dado pessoal atravessa a fronteira servidor/navegador para
 * fazer o botão funcionar: o `<form>` leva o id e a situação pedida, e mais
 * nada.
 */
export async function mudarSituacao(dados: FormData): Promise<void> {
  const { id, situacao } = lerMudancaDeSituacao(dados);

  // A guarda, antes de tocar em qualquer coisa. `notFound()` aqui (e não
  // uma mensagem de formulário, como em salvarPublicacao/salvarAtividade)
  // porque não há tela de trabalho a preservar: este é um botão, e quem o
  // aperta sem ser equipe recebe a mesma resposta que recebe em /admin.
  if (!await ehEquipe()) notFound();

  // As duas entradas de usuário, cada uma com a sua recusa. `id` é uuid
  // (`gen_random_uuid()`, 004_pessoas.sql) — ao contrário do id de
  // atividade, que é `text` —, então um valor malformado aqui daria erro de
  // sintaxe no Postgres (22P02); recusar antes é o que impede um "não deu
  // para fazer isso" genérico de esconder uma requisição montada à mão.
  if (!ehIdentificador(id) || !ehSituacaoDeContato(situacao)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  let deuCerto = false;

  try {
    const supabase = await obterCliente();

    // UMA CHAVE SÓ, escrita à mão. Não é `{ ...campos }` e nunca pode ser:
    // o que a pessoa escreveu é registro, e um spread aqui é o caminho pelo
    // qual um campo `mensagem` no corpo da requisição chegaria ao banco
    // (regra 6 do CLAUDE.md aplicada ao texto de terceiro).
    //
    // `.select('id')` AQUI FUNCIONA E É NECESSÁRIO — e é o contrário do
    // insert de acoes/contato.ts, na MESMA tabela. Lá a leitura é negada a
    // `anon`, e pedir a linha de volta faria a gravação parecer que falhou.
    // Aqui quem chama é equipe, que lê tudo (`for all using eh_equipe()`),
    // e sem o retorno um update que não casa linha nenhuma é SUCESSO com
    // zero linhas no PostgREST: marcar como concluída uma mensagem que já
    // foi apagada responderia "pronto" sem ter mudado nada.
    const { data, error } = await supabase
      .from('contatos')
      .update({ situacao })
      .eq('id', id)
      .select('id');

    if (error) console.error('[contatos] mudar situação:', descrever(error));
    else deuCerto = Array.isArray(data) && data.length > 0;
  } catch (erro) {
    console.error('[contatos] mudar situação (exceção):', descrever(erro));
  }

  // FORA do try — ver o cabeçalho.
  redirect(`${LISTA}?aviso=${deuCerto ? AVISO_DE[situacao] : 'erro'}`);
}
