/**
 * acoes/atividades.ts — corrigir o texto de uma das 11 atividades reais e
 * decidir se ela aparece em /projetos (RF03/RF33). Tarefa P4 do painel.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts e acoes/galeria.ts, e vale
 * palavra por palavra: o Next publica cada função exportada de um arquivo
 * `'use server'` numa URL (spec §4.5), e ela não passa por
 * `app/admin/layout.tsx`, nem pela página, nem por `generateMetadata`. A
 * varredura de testes/painel-guarda.test.mjs lê `app/admin/**` e NÃO
 * alcança este arquivo.
 *
 * Por isso CADA função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo — e testes/atividades
 * .test.mjs varre este arquivo exigindo isso de toda Action nova.
 *
 * A guarda daqui não é a tranca. A tranca é a RLS: `atividades: equipe
 * gerencia`, com `using` e `with check` em `public.eh_equipe()`
 * (supabase/migrations/002_conteudo.sql). O cliente deste projeto usa a
 * sessão de quem pediu e não existe chave de serviço no repositório (spec
 * §4.1): mesmo que alguém contornasse o `if`, o Postgres recusaria. O que a
 * guarda faz é transformar a recusa numa frase que a pessoa entende.
 *
 * ===================================================================
 * SÓ EDITAR: NÃO SE CRIA E NÃO SE APAGA ATIVIDADE POR AQUI
 * ===================================================================
 *
 * Não há `insert` e não há `delete` neste arquivo, e é decisão da tarefa,
 * não omissão. As 11 atividades são conteúdo da ONG, escrito por eles, e
 * chegaram pelo seed versionado (dados-iniciais/atividades.json). Apagar
 * uma por engano — num celular, de pé, no meio de um evento (regra 4 do
 * CLAUDE.md) — não tem desfazer, não tem lixeira e não tem backup. O banco
 * permite (a política é `for all`); esta tela não oferece, e a lista diz
 * isso por escrito (componentes/ListaAtividades.ts).
 *
 * Consequência aceita: uma atividade nova da ONG só entra pelo seed ou pelo
 * painel do Supabase, por enquanto. Criar entra num dia em que houver
 * também como desfazer.
 *
 * ===================================================================
 * A ARMADILHA DESTA TAREFA: O TEXTO TEM DUAS FONTES, E ELAS PASSAM A
 * DIVERGIR AQUI
 * ===================================================================
 *
 * `servidor/dados/conteudo.ts` lê o JSON versionado de `dados-iniciais/`
 * quando não há Supabase, e a tabela quando há. Até esta tarefa os dois
 * diziam a mesma coisa, sempre. **O primeiro `update` bem-sucedido desta
 * Action é o instante em que eles deixam de dizer.**
 *
 * O que isso significa, escrito aqui porque é aqui que a divergência
 * nasce:
 *
 *  · /projetos com o banco fora do ar passa a servir o texto ANTIGO — não
 *    mais "o mesmo conteúdo por outro caminho". Quem confere de fora tem o
 *    `data-origem-atividades="json"` no `<main>`;
 *  · um deploy sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL (CLAUDE.md, item
 *    0e) faz isso de forma permanente e silenciosa: o site sobe inteiro,
 *    com o texto de antes da correção;
 *  · `npm run seed` regenera `supabase/seed.sql` a partir do JSON. O
 *    `on conflict (id) do nothing` protege as linhas que já existem, mas o
 *    arquivo gerado passa a ser uma fotografia velha — restaurar um banco a
 *    partir dele desfaz a correção da equipe.
 *
 * NADA DISSO É CONSERTADO AQUI, de propósito: consertar é escolher uma
 * fonte só (perdendo a rede de segurança offline) ou dar ao painel um
 * caminho de exportação para o JSON, que é commit no repositório — coisa
 * que a equipe da ONG não faz do celular. As duas são decisão do grupo. O
 * que esta tarefa faz é não deixar a armadilha sem sinalização: aqui, em
 * servidor/dados/conteudo.ts, em ferramentas/gerar-seed.mjs, na tela da
 * equipe e no CLAUDE.md.
 *
 * ===================================================================
 * `publicado` NUNCA VEM DO FORMULÁRIO DE TEXTO
 * ===================================================================
 *
 * `salvarAtividade` não lê o campo `publicado`, e não é possível ligá-lo
 * (nem desligá-lo) mandando `publicado=false` no corpo: o objeto que vai ao
 * banco é montado chave por chave a partir de `compartilhado/validacao.ts`,
 * que só conhece dez campos. Tirar do ar é `alternarAtividade`, um botão
 * separado.
 *
 * ATENÇÃO AO QUE MUDA EM RELAÇÃO ÀS PUBLICAÇÕES: aqui a coluna é
 * `not null default true` (002_conteudo.sql), o CONTRÁRIO de `publicacoes`.
 * Numa notícia o descuido colocaria algo no ar sem querer; numa atividade
 * ele TIRARIA do ar um conteúdo que a ONG tem publicado hoje. Os dois são
 * ruins e o remédio é o mesmo: a coluna não passa pelo formulário de texto.
 *
 * ===================================================================
 * TODA FUNÇÃO TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM
 * JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como em acoes/publicacoes.ts: o `<form>` manda o POST,
 * a Action grava e responde 303 para a lista, o navegador busca a lista de
 * novo. Sem script isso é o comportamento nativo do formulário. O que a
 * Action tem a dizer viaja no `?aviso=`, por lista fechada
 * (`avisoDeAtividades`, em compartilhado/avisos-do-painel.ts).
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try` — um catch em volta os transformaria em "não foi possível gravar"
 * logo depois de uma gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import {
  lerAtividade, validarAtividade, lerAlternancia, ehIdentificadorDeAtividade
} from '@/compartilhado/validacao';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const LISTA = '/admin/atividades';

/** A página pública que muda quando isto aqui grava. */
const PAGINA_PUBLICA = '/projetos';

/** Mensagem única de "o formulário voltou com campo errado". */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, no formulário de texto.
 *
 * NÃO É `notFound()`, ao contrário do que as PÁGINAS do painel fazem, pelo
 * mesmo motivo escrito em acoes/publicacoes.ts: quem chega aqui quase
 * sempre é alguém da equipe que ficou um tempo corrigindo um texto e teve a
 * sessão vencida no meio. Responder 404 nesse instante apagaria a tela — e
 * com ela o texto. A recusa devolve `valores`, ou seja, o formulário volta
 * preenchido.
 */
const SEM_PERMISSAO = 'Sua sessão de equipe não vale mais (ou nunca valeu). Entre de novo em '
  + 'outra aba e envie outra vez — o que você escreveu continua nesta tela.';

/**
 * Sem projeto Supabase configurado não há onde gravar. Na prática ninguém
 * vê esta mensagem, porque sem Supabase `ehEquipe()` já devolveu false e o
 * painel responde 404 antes — ela existe para o caso de a ordem mudar, e
 * para o log, que é onde a causa aparece.
 */
function semSupabase(): string {
  console.error('[atividades] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma correção pode ser gravada.');
  return 'O banco de dados não está configurado neste endereço, então não dá para gravar agora.';
}

/**
 * A mensagem de falha de gravação. Genérica na tela, detalhada no log —
 * erro do Supabase nunca vai cru para quem está usando.
 */
function naoDeuParaGravar(): string {
  return 'Não deu para gravar agora. Tente de novo em alguns instantes — o texto continua '
    + 'nesta tela e nada se perdeu.';
}

/**
 * RF03/RF33 — grava a correção de UMA das 11 atividades.
 *
 * Não cria: sem `id` válido a Action recusa, e a recusa é uma frase, não um
 * insert. `validarAtividade` é quem exige o id (ao contrário de
 * `validarPublicacao`, onde id vazio significa "notícia nova").
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura
 * porque o React o passa.
 */
export async function salvarAtividade(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerAtividade(dados);
  const { valido, erros } = validarAtividade(campos);

  // TUDO o que a pessoa escreveu volta em toda recusa. Sem isto, um erro de
  // um campo devolve o formulário em branco e a sinopse inteira se perde —
  // defeito medido na Tarefa 3 da autenticação, e aqui ele custaria o texto
  // que a ONG escreveu, redigitado no celular.
  //
  // CAMPO A CAMPO, e não `{ ...campos }`, mesmo sendo só a volta para a
  // tela: um spread aqui é um spread que a próxima pessoa copia para o
  // objeto de baixo, o que vai ao banco. A regra 6 do CLAUDE.md só se
  // sustenta enquanto não houver, neste arquivo, um exemplo de como
  // espalhar o que veio da requisição.
  const valores = {
    id: campos.id,
    titulo: campos.titulo,
    resumo: campos.resumo,
    descricao: campos.descricao,
    genero: campos.genero,
    duracao: campos.duracao,
    elenco: campos.elenco,
    classificacao: campos.classificacao,
    local: campos.local,
    rider: campos.rider
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // Chave por chave, nunca espalhando o que veio da requisição: ver o
  // cabeçalho deste arquivo. Campo vazio vira NULL, e não string vazia — a
  // coluna aceita nulo e componentes/CardAtividade.ts OMITE o que é nulo
  // (regra 2 do CLAUDE.md no nível do campo). Guardar '' faria a ficha
  // técnica desenhar uma linha com o rótulo e nenhum valor.
  const linha = {
    titulo: campos.titulo,
    resumo: campos.resumo || null,
    descricao: campos.descricao || null,
    genero: campos.genero || null,
    duracao: campos.duracao || null,
    elenco: campos.elenco || null,
    classificacao: campos.classificacao || null,
    local: campos.local || null,
    rider: campos.rider || null
  };

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    // `.select('id')` AQUI É DIFERENTE do caso de `inscricoes`/`contatos`,
    // onde pedir a linha de volta faz a escrita PARECER que falhou porque a
    // leitura é negada (CLAUDE.md, arquitetura). Em `atividades` a equipe lê
    // tudo (`using (publicado or eh_equipe())`), então o retorno volta — e é
    // a única forma de saber se o `update` acertou alguma linha: um update
    // que não casa nenhuma é SUCESSO no PostgREST, com zero linhas. Sem
    // isto, corrigir uma atividade com um id que não existe responderia
    // "Correção guardada" sem ter guardado nada. E aqui o risco é maior que
    // nas publicações: `id` é `text`, então nem o Postgres reclama do
    // formato — nada acusaria.
    const { data, error } = await supabase
      .from('atividades')
      .update(linha)
      .eq('id', campos.id)
      .select('id');

    if (error) {
      console.error('[atividades] salvar:', descrever(error));
      falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
    } else if (!Array.isArray(data) || data.length === 0) {
      falha = {
        ok: false,
        valores,
        mensagem: 'Esta atividade não está mais no banco de dados — ou você não tem permissão '
          + 'para alterá-la. Volte à lista e confira. O texto que você escreveu continua nesta '
          + 'tela: se ela sumiu mesmo, copie o texto antes de sair daqui.'
      };
    }
  } catch (erro) {
    console.error('[atividades] salvar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
  }

  if (falha) return falha;

  // A página pública muda AGORA: as 11 atividades estão no ar, ao contrário
  // das notícias, que nascem como rascunho. Sem isto, a correção poderia
  // demorar a aparecer no cache do roteador de quem já tinha visitado — e a
  // equipe abriria /projetos, veria o texto velho e corrigiria de novo.
  revalidatePath(PAGINA_PUBLICA);

  // FORA do try — ver o cabeçalho.
  redirect(`${LISTA}?aviso=salva`);
}

/**
 * RF03/RF33 — tirar do ar ou pôr de volta. O ato separado.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: é um botão dentro
 * da lista, usado direto como `<form action={alternarAtividade}>` num Server
 * Component. Sem componente de cliente no meio, ou seja, funciona sem
 * JavaScript por construção, não por cuidado.
 *
 * POR QUE ESTE BOTÃO EXISTE numa tela que não apaga nada: sem ele, uma
 * atividade que a ONG parou de oferecer ficaria no site para sempre, e a
 * única saída seria apagar — o gesto sem desfazer, que esta tarefa recusa.
 * Tirar do ar é reversível num toque: o texto continua inteiro no banco e na
 * lista da equipe, e "Pôr de volta" o traz de volta a /projetos.
 *
 * O QUE ELE NÃO GARANTE, e a tela diz isso por escrito: com o banco fora do
 * ar, /projetos passa a servir o JSON versionado — onde a atividade
 * continua publicada. Ou seja, tirar do ar vale enquanto o banco responde.
 * A trava de verdade seria editar também o `publicado` do JSON, que é
 * commit no repositório. Ver o cabeçalho deste arquivo.
 *
 * Reaproveita `lerAlternancia` (a mesma lista fechada publicar/despublicar
 * das publicações): é a mesma decisão sobre a mesma entrada de usuário, e
 * duas cópias divergiriam.
 */
export async function alternarAtividade(dados: FormData): Promise<void> {
  const { id, acao } = lerAlternancia(dados);

  // A guarda, antes de tocar em qualquer coisa. `notFound()` aqui (e não uma
  // mensagem, como no formulário de texto) porque não há tela de trabalho a
  // preservar: este é um botão, e quem o aperta sem ser equipe recebe a
  // mesma resposta que recebe em /admin.
  if (!await ehEquipe()) notFound();

  // `id` de atividade é `text`, não uuid: um valor com lixo dentro não
  // levanta erro no Postgres, ele só não casa com linha nenhuma. Recusar
  // aqui é o que impede um "não deu para fazer isso" genérico de esconder
  // uma requisição malformada.
  if (!acao || !ehIdentificadorDeAtividade(id)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  const publicando = acao === 'publicar';
  let deuCerto = false;

  try {
    // Uma coluna só. Não há `publicado_em` nesta tabela (002_conteudo.sql),
    // então não existe aqui a leitura-antes-de-escrever que
    // acoes/publicacoes.ts precisa fazer por causa da data.
    const supabase = await obterCliente();
    const { data, error } = await supabase
      .from('atividades')
      .update({ publicado: publicando })
      .eq('id', id)
      .select('id');

    if (error) console.error('[atividades] alternar:', descrever(error));
    else deuCerto = Array.isArray(data) && data.length > 0;
  } catch (erro) {
    console.error('[atividades] alternar (exceção):', descrever(erro));
  }

  if (deuCerto) revalidatePath(PAGINA_PUBLICA);

  // FORA do try.
  redirect(`${LISTA}?aviso=${deuCerto ? (publicando ? 'publicada' : 'retirada') : 'erro'}`);
}
