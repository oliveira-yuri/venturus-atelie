/**
 * acoes/publicacoes.ts — escrever, editar, publicar e tirar do ar uma
 * notícia (RF04/RF33). Tarefa P2 do painel.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O Next publica cada função exportada de um arquivo `'use server'` numa
 * URL (spec §4.5). Ela NÃO passa por `app/admin/layout.tsx`, não passa por
 * `app/admin/publicacoes/page.tsx` e não passa por `generateMetadata` —
 * layout e página são renderização, Action é requisição. A varredura de
 * testes/painel-guarda.test.mjs, que exige `ehEquipe()` em toda página sob
 * `app/admin/`, também não alcança este arquivo: ela lê `app/admin/**`.
 *
 * Por isso CADA função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo. testes/publicacoes.test.mjs
 * tem uma varredura só para isto, que falha se uma Action nova esquecer.
 *
 * E a guarda daqui ainda não é a tranca: a tranca é a RLS
 * (`publicacoes: equipe gerencia`, com `using` e `with check` em
 * `public.eh_equipe()` — supabase/migrations/002_conteudo.sql). O cliente
 * deste projeto usa a sessão de quem pediu e não existe chave de serviço no
 * repositório (spec §4.1), então mesmo que alguém contornasse o `if`, o
 * Postgres recusaria. O que a guarda faz é transformar a recusa em uma
 * frase que a pessoa entende, em vez de um erro de banco cru.
 *
 * ===================================================================
 * `publicado` NUNCA VEM DO FORMULÁRIO DE TEXTO
 * ===================================================================
 *
 * `salvarPublicacao` não lê o campo `publicado`, e não é possível ligá-lo
 * mandando `publicado=true` no corpo: o objeto que vai ao banco é montado
 * chave por chave, a partir de `compartilhado/validacao.ts`, que só
 * conhece quatro campos. Publicar é `alternarPublicacao`, um botão separado,
 * com outro nome e outra confirmação visual.
 *
 * É a mesma disciplina da regra 6 do CLAUDE.md (`eh_equipe` nunca vem do
 * cadastro), aplicada a outro campo: espalhar o FormData (`...campos`) num
 * update é o que faria uma correção de vírgula poder publicar sozinha.
 *
 * ===================================================================
 * TODA FUNÇÃO TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM
 * JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET: o `<form>` manda o POST, a Action grava e responde um
 * 303 para a lista, o navegador busca a lista de novo. Sem script isso é o
 * comportamento nativo do formulário; com script o Next faz o mesmo sem
 * recarregar a página. O ganho extra é que atualizar a tela depois não
 * repete a gravação — não há "reenviar formulário?".
 *
 * O que a Action tem a dizer viaja no `?aviso=`, por lista fechada
 * (`avisoDaLista`, em compartilhado/avisos-do-painel.ts): um `redirect` não
 * carrega estado, e ecoar texto vindo da URL seria deixar qualquer pessoa
 * escrever uma mensagem dentro do painel da ONG.
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try` — a mesma advertência que acoes/autenticacao.ts carrega. Um catch em
 * volta os transformaria em "não foi possível gravar" logo depois de uma
 * gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { buscarPublicacao } from '@/servidor/dados/publicacoes';
import { lerPublicacao, validarPublicacao, lerAlternancia } from '@/compartilhado/validacao';
import { subirImagemInstitucional, apagarImagemInstitucional } from '@/servidor/upload-de-imagem';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const LISTA = '/admin/publicacoes';

/** Mensagem única de "o formulário voltou com campo errado" — a de acoes/autenticacao.ts. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, no formulário de texto.
 *
 * NÃO É `notFound()`, ao contrário do que as PÁGINAS do painel fazem, e a
 * diferença é o caso real: quem chega aqui quase sempre é alguém da equipe
 * que ficou uma hora escrevendo e teve a sessão vencida no meio. Responder
 * 404 nesse instante apagaria a tela — e com ela o texto. A recusa devolve
 * `valores`, ou seja, o formulário volta preenchido: a pessoa entra em outra
 * aba, volta e envia de novo.
 *
 * Não conta nada a quem não deveria saber: para chegar até aqui já é preciso
 * ter o identificador desta Action, que só existe no HTML de uma tela que
 * responde 404 para quem não é equipe.
 */
const SEM_PERMISSAO = 'Sua sessão de equipe não vale mais (ou nunca valeu). Entre de novo em '
  + 'outra aba e envie outra vez — o que você escreveu continua nesta tela.';

/**
 * Sem projeto Supabase configurado não há onde gravar. Acontece de verdade
 * na suíte offline (`npm test`) e num deploy sem as variáveis no painel da
 * Netlify (CLAUDE.md, "O que trava hoje", item 0e).
 *
 * Na prática ninguém vê esta mensagem, porque sem Supabase `ehEquipe()` já
 * devolveu false e o painel responde 404 antes — ela existe para o caso de a
 * ordem mudar, e para o log, que é onde a causa aparece.
 */
function semSupabase(): string {
  console.error('[publicacoes] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma publicação pode ser gravada.');
  return 'O banco de dados não está configurado neste endereço, então não dá para gravar agora.';
}

/**
 * RF04/RF33 — grava uma notícia nova (sem `id`) ou as alterações de uma que
 * já existe (com `id`).
 *
 * NASCE COMO RASCUNHO, sempre: o `insert` abaixo não menciona `publicado`, e
 * a coluna é `not null default false` (supabase/migrations/002_conteudo.sql).
 * Nada vai ao ar por acidente — é a regra da tarefa, e ela está garantida
 * pela ausência da chave, não por um `false` escrito à mão que alguém possa
 * "parametrizar" depois.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura porque
 * o React o passa.
 */
export async function salvarPublicacao(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerPublicacao(dados);
  const { valido, erros } = validarPublicacao(campos);

  // TUDO o que a pessoa escreveu volta em toda recusa. Sem isto, um erro de
  // título devolve o formulário em branco e a notícia inteira se perde —
  // defeito medido na Tarefa 3 da autenticação (ver `valores` em
  // EstadoFormulario), e aqui ele custaria muito mais que oito campos: é um
  // texto longo, escrito no celular.
  const valores = {
    id: campos.id,
    titulo: campos.titulo,
    resumo: campos.resumo,
    corpo: campos.corpo,
    // O ARQUIVO NÃO VOLTA, e não pode: um <input type="file"> não aceita
    // valor por HTML (é regra do navegador, não escolha nossa). O que
    // volta é o alt escrito e o caminho já gravado — assim uma recusa de
    // título não faz a pessoa perder a descrição que ela acabou de
    // escrever, nem apaga a imagem que já estava lá.
    imagem_alt: campos.imagem_alt ?? '',
    imagem_atual: campos.imagem_atual ?? ''
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // Chave por chave, nunca `...campos`: ver o cabeçalho deste arquivo.
  // `resumo` vazio vira NULL, e não string vazia — a coluna aceita nulo, e a
  // tela de notícias omite o que é nulo (regra 2 do CLAUDE.md aplicada a
  // campo). Guardar '' faria a página desenhar um parágrafo vazio.
  // A IMAGEM SOBE ANTES DA LINHA, e a ordem tem consequência: se a
  // gravação falhar depois, o arquivo já está no bucket. Por isso
  // `subiuAgora` é guardado e o `catch`/falha apaga o órfão — mesma
  // disciplina de `acoes/galeria.ts`.
  let caminhoDaImagem: string | null = campos.imagem_atual || null;
  let subiuAgora: string | null = null;

  const arquivo = campos.arquivo;
  if (arquivo instanceof File && arquivo.size > 0) {
    const envio = await subirImagemInstitucional(arquivo, 'noticias');

    if (!envio.ok) {
      return {
        ok: false,
        valores,
        mensagem: CONFIRA_OS_CAMPOS,
        erros: {
          arquivo: envio.motivo === 'nao-e-imagem'
            ? 'Este arquivo não é uma imagem que o site saiba mostrar. Aceitamos JPG, PNG, GIF '
              + 'e WebP — que é o que sai da câmera do celular.'
            : 'Não deu para subir a imagem agora. O texto continua nesta tela: tente de novo.'
        }
      };
    }

    caminhoDaImagem = envio.caminho;
    subiuAgora = envio.caminho;
  }

  // Chave por chave, nunca `...campos`: ver o cabeçalho deste arquivo.
  // `resumo` vazio vira NULL, e não string vazia — a coluna aceita nulo, e a
  // tela de notícias omite o que é nulo (regra 2 do CLAUDE.md aplicada a
  // campo). Guardar '' faria a página desenhar um parágrafo vazio.
  const linha = {
    titulo: campos.titulo,
    resumo: campos.resumo || null,
    corpo: campos.corpo,
    imagem_caminho: caminhoDaImagem,
    // Alt vazio com imagem não chega aqui (validarPublicacao recusou), e
    // sem imagem ele vira NULL — o `check` da tabela exige exatamente isso.
    imagem_alt: caminhoDaImagem ? (campos.imagem_alt || null) : null
  };

  const editando = Boolean(campos.id);
  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    if (editando) {
      // `.select('id')` AQUI É DIFERENTE do caso de `inscricoes`/`contatos`,
      // onde pedir a linha de volta faz a escrita PARECER que falhou porque
      // a leitura é negada (CLAUDE.md, arquitetura). Em `publicacoes` a
      // equipe lê tudo (`using (publicado or eh_equipe())`), então o retorno
      // volta — e é a única forma de saber se o `update` acertou alguma
      // linha: um update que não casa nenhuma é SUCESSO no PostgREST, com
      // zero linhas. Sem isto, editar uma notícia apagada por outra pessoa
      // responderia "Alterações guardadas" sem ter guardado nada.
      const { data, error } = await supabase
        .from('publicacoes')
        .update(linha)
        .eq('id', campos.id)
        .select('id');

      if (error) {
        console.error('[publicacoes] salvar (edição):', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
      } else if (!Array.isArray(data) || data.length === 0) {
        falha = {
          ok: false,
          valores,
          mensagem: 'Esta notícia não está mais no banco — ou você não tem permissão para '
            + 'alterá-la. Volte à lista e confira. O texto que você escreveu continua nesta tela: '
            + 'se ela sumiu mesmo, copie o texto antes de sair daqui.'
        };
      }
    } else {
      const { error } = await supabase.from('publicacoes').insert(linha);

      if (error) {
        console.error('[publicacoes] salvar (nova):', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
      }
    }
  } catch (erro) {
    console.error('[publicacoes] salvar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
  }

  if (falha) {
    // O ARQUIVO JÁ ESTÁ NO BUCKET e a linha não foi gravada: sem esta
    // limpeza, cada tentativa malsucedida deixaria um órfão. Só apaga o
    // que ESTA chamada subiu — nunca a imagem que já estava na notícia.
    if (subiuAgora) await apagarImagemInstitucional(subiuAgora);
    return falha;
  }

  // Só a página pública precisa ser revalidada aqui: a lista do painel é
  // re-renderizada pelo próprio redirect abaixo. Editar uma notícia JÁ
  // publicada muda o que está no ar — e sem isto o texto novo poderia
  // demorar a aparecer no cache do roteador de quem já tinha visitado.
  revalidatePath('/noticias');

  // FORA do try — ver o cabeçalho.
  redirect(`${LISTA}?aviso=${editando ? 'salva' : 'criada'}`);
}

/**
 * A mensagem de falha de gravação. Genérica na tela, detalhada no log — a
 * regra 2 de acoes/autenticacao.ts: erro do Supabase nunca vai cru para
 * quem está usando.
 *
 * Termina dizendo que nada se perdeu, porque é verdade (o `valores` devolve
 * o texto) e porque é a primeira dúvida de quem acabou de escrever.
 */
function naoDeuParaGravar(): string {
  return 'Não deu para gravar agora. Tente de novo em alguns instantes — o texto continua '
    + 'nesta tela e nada se perdeu.';
}

/**
 * RF04/RF33 — colocar no ar ou tirar do ar. O ato separado.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: isto é um botão
 * dentro da lista, usado direto como `<form action={alternarPublicacao}>` num
 * Server Component. Sem componente de cliente no meio, ou seja, sem nada que
 * dependa de hidratar — é a forma que funciona sem JavaScript por
 * construção, não por cuidado.
 *
 * ===================================================================
 * O QUE ACONTECE COM `publicado_em`, E POR QUÊ
 * ===================================================================
 *
 * AO PUBLICAR: grava a data SÓ SE ainda não houver uma. Quem publica,
 * percebe um erro de digitação, tira do ar, corrige e publica de novo não
 * republicou — corrigiu. Carimbar a data de novo mandaria a notícia para o
 * topo de /noticias (que ordena por `publicado_em`) como se fosse nova, e
 * apagaria o registro de quando ela de fato saiu.
 *
 * AO TIRAR DO AR: a data FICA. Ela é um fato — aquela notícia esteve no ar
 * naquele dia —, e apagá-la seria destruir informação num gesto que a pessoa
 * pode estar fazendo por engano, num celular, sem desfazer. Só `publicado`
 * muda; é ele, e não a data, que decide o que a página pública mostra
 * (`.eq('publicado', true)` em servidor/dados/publicacoes.ts).
 */
export async function alternarPublicacao(dados: FormData): Promise<void> {
  const { id, acao } = lerAlternancia(dados);

  // A guarda, antes de tocar em qualquer coisa. `notFound()` aqui (e não uma
  // mensagem, como no formulário de texto) porque não há tela de trabalho
  // para preservar: este é um botão, e quem o aperta sem ser equipe recebe a
  // mesma resposta que recebe em /admin.
  if (!await ehEquipe()) notFound();

  if (!acao || !id) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  const publicando = acao === 'publicar';
  let deuCerto = false;

  try {
    // Ler antes de escrever, só por causa de `publicado_em` (ver acima): o
    // PostgREST não tem `coalesce` no update, então a decisão "já tem data?"
    // é tomada aqui. `buscarPublicacao` já é degradável e nunca lança.
    const { valor: atual } = await buscarPublicacao(id);

    if (atual) {
      const linha = publicando
        ? { publicado: true, publicado_em: atual.publicado_em ?? new Date().toISOString() }
        : { publicado: false };

      const supabase = await obterCliente();
      const { data, error } = await supabase
        .from('publicacoes')
        .update(linha)
        .eq('id', id)
        .select('id');

      if (error) console.error('[publicacoes] alternar:', descrever(error));
      else deuCerto = Array.isArray(data) && data.length > 0;
    }
  } catch (erro) {
    console.error('[publicacoes] alternar (exceção):', descrever(erro));
  }

  if (deuCerto) revalidatePath('/noticias');

  // FORA do try.
  redirect(`${LISTA}?aviso=${deuCerto ? (publicando ? 'publicada' : 'retirada') : 'erro'}`);
}
