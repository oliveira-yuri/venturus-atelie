/**
 * acoes/eventos.ts — cadastrar, corrigir, publicar e tirar do ar um evento
 * da agenda (RF13/RF14).
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts, acoes/galeria.ts,
 * acoes/atividades.ts e acoes/contatos.ts, e vale palavra por palavra: o
 * Next publica cada função exportada de um arquivo `'use server'` numa URL
 * (spec §4.5), e ela NÃO passa por `app/admin/layout.tsx`, nem pela página,
 * nem por `generateMetadata`. A varredura de testes/painel-guarda.test.mjs
 * lê `app/admin/**` e NÃO alcança este arquivo.
 *
 * Por isso CADA função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo — e testes/eventos.test.mjs
 * tem a varredura irmã, que falha se uma Action nova esquecer.
 *
 * A guarda daqui não é a tranca. A tranca é a RLS: `eventos: equipe
 * gerencia`, com `using` e `with check` em `public.eh_equipe()`
 * (supabase/migrations/003_eventos.sql). O cliente deste projeto usa a
 * sessão de quem pediu e não existe chave de serviço no repositório (spec
 * §4.1): mesmo que alguém contornasse o `if`, o Postgres recusaria. O que a
 * guarda faz é transformar a recusa numa frase que a pessoa entende, em vez
 * de um erro de banco cru.
 *
 * ===================================================================
 * O FUSO HORÁRIO É A ARMADILHA DESTA TAREFA, E ELA MORA NA ESCRITA
 * ===================================================================
 *
 * O formulário manda hora de PAREDE: "2026-11-05T19:00", sem fuso nenhum.
 * `new Date(...)` disso interpreta no fuso do PROCESSO — que na Netlify é
 * UTC —, e o evento das 19h de São Paulo iria para o banco como 19:00Z. A
 * agenda, que imprime corretamente em São Paulo
 * (componentes/ListaEventos.ts, onde o defeito irmão foi corrigido no Bloco
 * A), mostraria 16:00. **A conversão não acontece aqui**: ela é
 * `instanteDeSaoPaulo()`, em compartilhado/validacao.ts, junto do
 * `FUSO_DA_ONG`, porque lá ela é uma função PURA e um `node --test` a
 * exercita sob `TZ=UTC` — que é a única forma de provar que o defeito não
 * voltou. Este arquivo só chama `colunasDoEvento()`.
 *
 * ===================================================================
 * NÃO EXISTE APAGAR, E AQUI O MOTIVO É MAIOR QUE NAS NOTÍCIAS
 * ===================================================================
 *
 * Não há `delete` neste arquivo, e é decisão. Em `acoes/publicacoes.ts` o
 * argumento é que apagar não tem desfazer e acontece num celular, de pé
 * (regra 4 do CLAUDE.md). Aqui há um segundo, específico desta tabela:
 *
 *     inscricoes.evento_id ... references public.eventos(id) ON DELETE CASCADE
 *
 * (003_eventos.sql). Apagar um evento apaga, EM SILÊNCIO, todas as
 * inscrições dele — nome, e-mail, telefone e responsável de criança a partir
 * de 10 anos. Hoje isso não machuca ninguém porque RF15 não existe e a
 * tabela está vazia; no dia em que existir, um toque errado destruiria a
 * lista de presença de um evento que já aconteceu. O banco permite (a
 * política é `for all`); esta tela não oferece, e a lista diz isso por
 * escrito. testes/eventos.test.mjs falha no dia em que um `.delete(`
 * aparecer aqui.
 *
 * ===================================================================
 * `publicado` NUNCA VEM DO FORMULÁRIO DE TEXTO
 * ===================================================================
 *
 * `salvarEvento` não lê o campo `publicado`, e não é possível ligá-lo
 * mandando `publicado=true` no corpo: o objeto que vai ao banco é montado
 * chave por chave por `colunasDoEvento()` (compartilhado/validacao.ts), que
 * só conhece seis colunas. Publicar é `alternarEvento`, um botão separado.
 *
 * A coluna é `not null default false` (003_eventos.sql) — como
 * `publicacoes`, e o CONTRÁRIO de `atividades`. O evento nasce rascunho:
 * numa agenda, o descuido de pôr no ar uma data errada faz gente aparecer no
 * dia errado na porta de um ateliê.
 *
 * ===================================================================
 * TODA FUNÇÃO TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM
 * JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como nas outras Actions do painel: o `<form>` manda o
 * POST, a Action grava e responde 303 para a lista, o navegador busca a
 * lista de novo. Sem script isso é o comportamento nativo do formulário. O
 * que a Action tem a dizer viaja no `?aviso=`, por lista fechada
 * (`avisoDeEventos`, em compartilhado/avisos-do-painel.ts): um redirect não
 * carrega estado, e ecoar texto vindo da URL seria deixar qualquer pessoa
 * escrever uma mensagem dentro do painel da ONG.
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
import { lerEvento, validarEvento, colunasDoEvento, lerAlternancia } from '@/compartilhado/validacao';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const LISTA = '/admin/eventos';

/** A página pública que muda quando algo aqui dá certo. */
const AGENDA = '/agenda';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, no formulário de texto.
 *
 * NÃO É `notFound()`, ao contrário do que as PÁGINAS do painel fazem, e a
 * diferença é o caso real: quem chega aqui quase sempre é alguém da equipe
 * que estava cadastrando um evento e teve a sessão vencida no meio.
 * Responder 404 nesse instante apagaria a tela — e com ela a data, o local e
 * a descrição já digitados no celular. A recusa devolve `valores`, ou seja,
 * o formulário volta preenchido.
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
  console.error('[eventos] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhum evento pode ser gravado.');
  return 'O banco de dados não está configurado neste endereço, então não dá para gravar agora.';
}

/**
 * A mensagem de falha de gravação. Genérica na tela, detalhada no log — a
 * mesma regra de acoes/publicacoes.ts: erro do Supabase nunca vai cru para
 * quem está usando.
 */
function naoDeuParaGravar(): string {
  return 'Não deu para gravar agora. Tente de novo em alguns instantes — o que você escreveu '
    + 'continua nesta tela e nada se perdeu.';
}

/**
 * RF13 — grava um evento novo (sem `id`) ou as alterações de um que já
 * existe (com `id`).
 *
 * NASCE COMO RASCUNHO, sempre: o `insert` abaixo não menciona `publicado`, e
 * a coluna é `not null default false`. Nada entra na agenda por acidente — e
 * a garantia é a AUSÊNCIA da chave, não um `false` escrito à mão que alguém
 * possa "parametrizar" depois.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura porque
 * o React o passa.
 */
export async function salvarEvento(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerEvento(dados);
  const { valido, erros } = validarEvento(campos);

  /**
   * TUDO o que a pessoa escreveu volta em toda recusa. Sem isto, um erro na
   * hora de terminar devolve o formulário em branco e o evento inteiro se
   * perde — defeito medido na Tarefa 3 da autenticação (o React 19 dá
   * `reset()` no <form> ao fim de uma action; sem script, a página é
   * renderizada do zero).
   *
   * As duas datas voltam como HORA DE PAREDE, exatamente como chegaram: é
   * isso que o `<input type="datetime-local">` sabe mostrar. Devolver o ISO
   * convertido faria o campo aparecer vazio (o formato não casa) na tela em
   * que a pessoa está tentando consertar justamente aquilo.
   */
  const valores = {
    id: campos.id,
    titulo: campos.titulo,
    descricao: campos.descricao,
    comeca_em: campos.comeca_em,
    termina_em: campos.termina_em,
    local: campos.local,
    faixa_etaria: campos.faixa_etaria
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // Chave por chave, nunca `...campos` — ver o cabeçalho. A conversão de
  // fuso acontece aqui dentro (`instanteDeSaoPaulo`).
  const linha = colunasDoEvento(campos);

  // Não acontece: `validarEvento` já recusou uma data que não converte. Fica
  // porque a alternativa é um `!` no TypeScript, que é uma afirmação sem
  // prova — e porque no dia em que as duas regras divergirem, o desfecho
  // certo é a recusa, não gravar `null` numa coluna `not null`.
  if (linha === null) {
    return {
      ok: false,
      valores,
      erros: { comeca_em: 'Não entendi o dia e a hora. Use o seletor do celular.' },
      mensagem: CONFIRA_OS_CAMPOS
    };
  }

  const editando = Boolean(campos.id);
  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    if (editando) {
      // `.select('id')` AQUI É OBRIGATÓRIO, e é o CONTRÁRIO de
      // `inscricoes`/`contatos`, onde pedir a linha de volta faz a escrita
      // PARECER que falhou porque a leitura é negada. Em `eventos` a equipe
      // lê tudo (`using (publicado or eh_equipe())`), então o retorno volta —
      // e é a única forma de saber se o `update` acertou alguma linha: um
      // update que não casa nenhuma é SUCESSO no PostgREST, com zero linhas.
      // Sem isto, corrigir um evento apagado por outra pessoa responderia
      // "guardado" sem ter guardado nada.
      const { data, error } = await supabase
        .from('eventos')
        .update(linha)
        .eq('id', campos.id)
        .select('id');

      if (error) {
        console.error('[eventos] salvar (edição):', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
      } else if (!Array.isArray(data) || data.length === 0) {
        falha = {
          ok: false,
          valores,
          mensagem: 'Este evento não está mais no banco — ou você não tem permissão para '
            + 'alterá-lo. Volte à lista e confira. O que você escreveu continua nesta tela.'
        };
      }
    } else {
      const { error } = await supabase.from('eventos').insert(linha);

      if (error) {
        console.error('[eventos] salvar (novo):', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
      }
    }
  } catch (erro) {
    console.error('[eventos] salvar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
  }

  if (falha) return falha;

  // Só a agenda precisa ser revalidada aqui: a lista do painel é
  // re-renderizada pelo próprio redirect abaixo. Corrigir um evento JÁ
  // publicado muda o que está no ar — e sem isto a correção poderia demorar a
  // aparecer no cache do roteador de quem já tinha visitado /agenda.
  revalidatePath(AGENDA);

  // FORA do try — ver o cabeçalho.
  redirect(`${LISTA}?aviso=${editando ? 'salvo' : 'criado'}`);
}

/**
 * RF13/RF14 — colocar na agenda ou tirar dela. O ato separado.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: isto é um botão
 * dentro da lista, usado direto como `<form action={alternarEvento}>` num
 * Server Component. Sem componente de cliente no meio, ou seja, sem nada que
 * dependa de hidratar — é a forma que funciona sem JavaScript por
 * construção, não por cuidado.
 *
 * MAIS SIMPLES QUE `alternarPublicacao`, e a diferença é de esquema:
 * `public.eventos` não tem coluna `publicado_em`. Não há data para carimbar
 * ao publicar nem para preservar ao tirar do ar — a data que importa num
 * evento é `comeca_em`, que a equipe escreve no formulário. Por isso esta
 * função não precisa LER antes de escrever, como a das notícias precisa.
 */
export async function alternarEvento(dados: FormData): Promise<void> {
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
    const supabase = await obterCliente();
    const { data, error } = await supabase
      .from('eventos')
      .update({ publicado: publicando })
      .eq('id', id)
      .select('id');

    if (error) console.error('[eventos] alternar:', descrever(error));
    else deuCerto = Array.isArray(data) && data.length > 0;
  } catch (erro) {
    console.error('[eventos] alternar (exceção):', descrever(erro));
  }

  if (deuCerto) revalidatePath(AGENDA);

  // FORA do try.
  redirect(`${LISTA}?aviso=${deuCerto ? (publicando ? 'publicado' : 'retirado') : 'erro'}`);
}
