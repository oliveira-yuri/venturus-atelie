/**
 * acoes/voluntarios.ts — a equipe marca em que pé está uma candidatura ao
 * voluntariado (RF26). A tela de leitura do que a RF25 grava.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts, galeria.ts, atividades.ts e
 * contatos.ts, e vale palavra por palavra: o Next publica cada função
 * exportada de um arquivo `'use server'` numa URL (spec §4.5), e ela não
 * passa por `app/admin/layout.tsx`, nem pela página, nem por
 * `generateMetadata`. A varredura de testes/painel-guarda.test.mjs lê
 * `app/admin/**` e NÃO alcança este arquivo.
 *
 * Por isso a função abaixo chama `ehEquipe()` por conta própria, na primeira
 * coisa que faz depois de ler o corpo — e testes/voluntarios.test.mjs varre
 * este arquivo exigindo isso de toda Action nova.
 *
 * A guarda daqui não é a tranca. A tranca é a RLS: `voluntarios: equipe
 * gerencia`, `for all` com `using` e `with check` em `public.eh_equipe()`
 * (supabase/migrations/004_pessoas.sql). O cliente deste projeto usa a
 * sessão de quem pediu e não existe chave de serviço no repositório (spec
 * §4.1): mesmo que alguém contornasse o `if`, o Postgres recusaria. O que a
 * guarda faz é transformar a recusa numa resposta que a tela entende.
 *
 * ATENÇÃO À ASSIMETRIA COM acoes/voluntariado.ts (a candidatura). Aquele
 * arquivo é o formulário de quem se OFERECE, e a guarda dele é
 * `usuarioAtual()`, não `ehEquipe()` — exigir equipe lá trancaria justamente
 * o público daquela tela. Este é o outro lado da mesma tabela e é o oposto:
 * sem sessão de equipe, nada. Os dois nomes são quase iguais; a diferença
 * entre eles é quem pode chamar. (A mesma armadilha existe entre
 * acoes/contato.ts e acoes/contatos.ts, e está escrita nos dois.)
 *
 * ===================================================================
 * SÓ A COLUNA `situacao` MUDA. NADA MAIS, EM CAMINHO NENHUM.
 * ===================================================================
 *
 * Não há `insert`, não há `delete`, e o `update` grava um objeto de UMA
 * chave. Isso é decisão da tarefa:
 *
 *  · o texto que a pessoa escreveu ao se candidatar é REGISTRO — é a
 *    resposta dela a "por que você quer ajudar". Editá-lo seria falsificar o
 *    que alguém disse à ONG;
 *  · as ÁREAS que ela marcou são escolha dela, não da equipe. Mudá-las por
 *    aqui transformaria "ela quer ajudar no acervo" em "nós a pusemos no
 *    acervo", sem que ela soubesse — e a candidatura é o que ela vê em
 *    /minha-conta;
 *  · apagar não tem desfazer, aconteceria num celular, de pé (regra 4 do
 *    CLAUDE.md), e apagaria a prova de que houve oferta de ajuda.
 *
 * O QUE ISSO CUSTA, dito em voz alta: /privacidade promete que a pessoa pode
 * "pedir a exclusão dos seus dados", e esta tela NÃO faz isso. Quem precisar
 * apagar uma candidatura a pedido de quem a fez depende de quem cuida do
 * site, no SQL Editor do Supabase. A tela diz isso por escrito
 * (componentes/ListaVoluntarios.ts) em vez de deixar a equipe procurando um
 * botão que não existe. É a mesma ausência (e o mesmo custo) que o RF29
 * registrou no item 0n do CLAUDE.md.
 *
 * O banco PERMITE as três coisas (a política é `for all`, e `authenticated`
 * tem `grant select, insert, update, delete`). Quem recusa é este arquivo, e
 * há teste que falha no dia em que um `insert` ou um `delete` aparecer aqui.
 *
 * ===================================================================
 * `inativo` TEM UMA CONSEQUÊNCIA FORA DESTA TELA
 * ===================================================================
 *
 * `SITUACOES_EM_ANDAMENTO` (compartilhado/candidatura.ts) deixa 'inativo' de
 * fora de propósito: quem encerrou e quer voltar precisa poder se candidatar
 * de novo. Ou seja, encerrar uma candidatura por aqui DEVOLVE à pessoa o
 * botão de candidatar-se em /minha-conta e em /voluntariado/candidatura.
 *
 * Isso não é efeito colateral, é o desenho — e é a única transição desta
 * tela que muda o que outra pessoa pode fazer no site. Por isso está dito na
 * legenda da lista e no aviso que volta depois do gesto: uma equipe que
 * encerre uma candidatura sem saber disso vai estranhar a segunda linha da
 * mesma pessoa aparecendo na fila.
 *
 * ===================================================================
 * A FUNÇÃO TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM
 * JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como nas outras telas do painel: o `<form>` manda o
 * POST, a Action grava e responde 303 para a lista, o navegador busca a
 * lista de novo. Sem script isso é o comportamento nativo do formulário. O
 * que a Action tem a dizer viaja no `?aviso=`, por lista fechada
 * (`avisoDeVoluntarios`, em compartilhado/avisos-do-painel.ts).
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try` — um catch em volta os transformaria em "não deu para fazer isso"
 * logo depois de uma gravação bem-sucedida.
 *
 * ===================================================================
 * SEM revalidatePath, E ISSO NÃO É ESQUECIMENTO
 * ===================================================================
 *
 * As Actions de publicações, galeria e atividades revalidam a página pública
 * que elas mudam. Esta não muda página pública nenhuma: nenhuma rota fora de
 * `/admin` lê `public.voluntarios`. A tela que ela muda para OUTRA pessoa é
 * `/minha-conta`, e aquela página é renderizada a cada requisição (ela lê a
 * sessão pelos cookies, o que a torna dinâmica) — não há cache do qual tirá-la.
 * O `redirect()` já traz a lista do painel de novo.
 *
 * ===================================================================
 * O QUE ESTA ACTION NÃO TOCA: `perfis.eh_voluntario`
 * ===================================================================
 *
 * Seria tentador marcar `eh_voluntario = true` ao pôr alguém em
 * "voluntariando". Não se faz aqui por dois motivos: aquela coluna é o que a
 * PESSOA marcou no próprio cadastro ("como você quis participar", em
 * componentes/MinhaConta.ts), e sobrescrevê-la seria a equipe respondendo
 * uma pergunta que era dela; e escrever em `public.perfis` a partir desta
 * tela abriria um caminho de update em linha de terceiro numa tabela que tem
 * a coluna `eh_equipe` — exatamente a superfície que a regra 6 do CLAUDE.md
 * existe para manter estreita.
 */
'use server';

import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { lerMudancaDeSituacao, ehIdentificador } from '@/compartilhado/validacao';
import { ehSituacaoDeVoluntario } from '@/compartilhado/triagem-de-voluntarios';

/** A tela para onde tudo volta. */
const LISTA = '/admin/voluntarios';

/**
 * De situação gravada para chave de aviso.
 *
 * Existe para o `?aviso=` continuar sendo uma LISTA FECHADA de frases
 * nossas: sem este mapa, o caminho fácil seria escrever `?aviso=${situacao}`
 * — e aí o valor da URL passaria a vir de um campo do formulário, que é
 * entrada de usuário. Ver compartilhado/avisos-do-painel.ts.
 */
const AVISO_DE: Record<string, string> = {
  novo: 'nova',
  em_contato: 'em-contato',
  ativo: 'ativa',
  inativo: 'encerrada'
};

/**
 * Sem projeto Supabase configurado não há onde gravar. Na prática ninguém
 * chega aqui, porque sem Supabase `ehEquipe()` já devolveu false e o painel
 * respondeu 404 antes — existe para o caso de a ordem mudar, e para o log,
 * que é onde a causa aparece.
 */
function semSupabase(): void {
  console.error('[voluntarios] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma mudança de situação pode ser gravada.');
}

/**
 * RF26 — muda a situação de UMA candidatura: nova → em contato →
 * voluntariando → encerrada, e de volta, em qualquer sentido.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: é um botão dentro
 * da lista, usado direto como `<form action={mudarSituacaoDaCandidatura}>`
 * num Server Component. Sem componente de cliente no meio, ou seja, funciona
 * sem JavaScript por construção, não por cuidado — e, o que importa mais
 * nesta tela, NENHUM dado pessoal atravessa a fronteira servidor/navegador
 * para fazer o botão funcionar: o `<form>` leva o id e a situação pedida, e
 * mais nada.
 *
 * LÊ O FormData COM `lerMudancaDeSituacao`, a mesma função de
 * acoes/contatos.ts, e isso é reúso deliberado: o que os dois botões mandam
 * é literalmente o mesmo par de campos, e a regra do projeto é que FormData
 * seja lido campo a campo por nome, num lugar só (compartilhado/validacao.ts).
 * O que NÃO é compartilhado é a lista fechada de situações — são dois
 * `check` diferentes no banco, e `ehSituacaoDeVoluntario` é quem vale aqui.
 */
export async function mudarSituacaoDaCandidatura(dados: FormData): Promise<void> {
  const { id, situacao } = lerMudancaDeSituacao(dados);

  // A guarda, antes de tocar em qualquer coisa. `notFound()` aqui (e não uma
  // mensagem de formulário, como em salvarPublicacao/salvarAtividade) porque
  // não há tela de trabalho a preservar: este é um botão, e quem o aperta
  // sem ser equipe recebe a mesma resposta que recebe em /admin.
  if (!await ehEquipe()) notFound();

  // As duas entradas de usuário, cada uma com a sua recusa. `id` é uuid
  // (`gen_random_uuid()`, 004_pessoas.sql) — ao contrário do id de
  // atividade, que é `text` —, então um valor malformado aqui daria erro de
  // sintaxe no Postgres (22P02); recusar antes é o que impede um "não deu
  // para fazer isso" genérico de esconder uma requisição montada à mão.
  if (!ehIdentificador(id) || !ehSituacaoDeVoluntario(situacao)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  let deuCerto = false;

  try {
    const supabase = await obterCliente();

    // UMA CHAVE SÓ, escrita à mão. Não é `{ ...campos }` e nunca pode ser: a
    // mensagem e as áreas são o que a pessoa disse e escolheu, e um spread
    // aqui é o caminho pelo qual um campo `mensagem` no corpo da requisição
    // chegaria ao banco (regra 6 do CLAUDE.md aplicada ao registro de
    // terceiro).
    //
    // `.select('id')` AQUI FUNCIONA E É NECESSÁRIO. Quem chama é equipe, que
    // lê tudo (`for all using eh_equipe()`), e sem o retorno um update que
    // não casa linha nenhuma é SUCESSO com zero linhas no PostgREST: encerrar
    // uma candidatura que já foi apagada responderia "pronto" sem ter mudado
    // nada. É o contrário do insert de acoes/contato.ts, onde a leitura é
    // negada a quem escreve e pedir a linha de volta faria a gravação parecer
    // que falhou.
    const { data, error } = await supabase
      .from('voluntarios')
      .update({ situacao })
      .eq('id', id)
      .select('id');

    if (error) console.error('[voluntarios] mudar situação:', descrever(error));
    else deuCerto = Array.isArray(data) && data.length > 0;
  } catch (erro) {
    console.error('[voluntarios] mudar situação (exceção):', descrever(erro));
  }

  // FORA do try — ver o cabeçalho.
  redirect(`${LISTA}?aviso=${deuCerto ? AVISO_DE[situacao] : 'erro'}`);
}
