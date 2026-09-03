/**
 * acoes/presencas.ts — a lista de presença pelo celular (RF17), gravando em
 * `public.presencas`.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO
 * ===================================================================
 *
 * Server Action é alcançável por quem souber montar a requisição, sem
 * passar por página nem por layout (spec §4.5). A guarda de
 * `app/admin/**` NÃO alcança este arquivo — `testes/painel-guarda.test.mjs`
 * varre páginas. Por isso a primeira coisa que esta Action faz é chamar
 * `ehEquipe()` sozinha, e `testes/presencas.test.mjs` tem a varredura que
 * falha se ela sumir.
 *
 * A GUARDA NÃO É A TRANCA: `presencas: só a equipe` é `for all using
 * (public.eh_equipe())` (003_eventos.sql), e `anon` não recebe grant nenhum
 * nessa tabela — nem leitura, nem escrita. Mesmo que este `if` fosse
 * contornado, o Postgres recusaria.
 *
 * ===================================================================
 * TRÊS ESTADOS, E "AINDA NÃO CONFERI" NÃO É "FALTOU"
 * ===================================================================
 *
 * `public.presencas` guarda uma linha POR INSCRIÇÃO, com `presente`
 * booleano. A ausência da linha é o terceiro estado, e ele é informação de
 * verdade:
 *
 *   linha com true   → veio
 *   linha com false  → não veio
 *   nenhuma linha    → ninguém conferiu ainda
 *
 * Numa prestação de contas de edital os dois últimos são coisas muito
 * diferentes, e um sistema que só soubesse "marcado / não marcado"
 * transformaria uma lista que ninguém conferiu numa lista de faltas. Por
 * isso existe a ação `limpar`: ela APAGA a linha, devolvendo a inscrição
 * para "não conferido" — e é a única coisa que este arquivo apaga.
 *
 * ===================================================================
 * O QUE ELA NÃO FAZ, E POR QUÊ
 * ===================================================================
 *
 * Não inscreve ninguém, não apaga inscrição e não corrige nome, e-mail nem
 * telefone. Quem usa esta tela está de pé na porta de uma oficina, com o
 * celular numa mão (regra 4): todo gesto a mais ali é um gesto que se dá
 * por engano. `testes/presencas.test.mjs` falha se aparecer um `.insert(`
 * ou um `.delete(` em `inscricoes` neste arquivo.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { obterCliente } from '@/servidor/supabase';
import { ehEquipe } from '@/servidor/permissao';
import { usuarioAtual } from '@/servidor/sessao';
import { descrever } from '@/servidor/dados/degradacao';
import { ehIdentificador } from '@/compartilhado/validacao';

/** As três ações da tela. Lista fechada: o corpo da requisição é hostil. */
const ACOES = ['presente', 'ausente', 'limpar'] as const;
type AcaoDePresenca = (typeof ACOES)[number];

function ehAcaoDePresenca(valor: unknown): valor is AcaoDePresenca {
  return typeof valor === 'string' && (ACOES as readonly string[]).includes(valor);
}

/**
 * RF17 — marca (ou desmarca, ou limpa) a presença de uma inscrição.
 *
 * Termina SEMPRE em `redirect()`, inclusive na falha, e isso é o que a faz
 * funcionar sem JavaScript: o navegador faz o POST comum, recebe 303 e
 * recarrega a lista já com a marcação nova. `redirect()` sinaliza por
 * exceção e por isso fica FORA de qualquer `try`.
 */
export async function marcarPresenca(dados: FormData): Promise<void> {
  if (!await ehEquipe()) redirect('/admin/eventos');

  // Campo a campo, por nome — nunca espalhando o FormData. Aqui isso impede
  // que `marcada_em` e `id` venham do corpo da requisição.
  const inscricaoId = String(dados.get('inscricao_id') ?? '');
  const eventoId = String(dados.get('evento_id') ?? '');
  const acao = dados.get('acao');

  /**
   * Para onde voltar, com o aviso.
   *
   * O destino é montado a partir do id CONFERIDO, nunca do texto recebido:
   * sem isto, um `evento_id` com uma quebra de linha ou com um endereço
   * dentro viraria um redirect para fora do site (a família de defeitos
   * conhecida como "open redirect").
   *
   * Os DOIS caminhos precisam do separador certo — a lista de presença já
   * tem `?id=`, o painel de eventos não tem nada. A primeira versão disto
   * colava `&aviso=` nos dois e produzia `/admin/eventos&aviso=erro`, que
   * não é endereço nenhum.
   */
  const voltar = (aviso: string) => (ehIdentificador(eventoId)
    ? `/admin/eventos/presenca?id=${eventoId}&aviso=${aviso}`
    : `/admin/eventos?aviso=${aviso}`);

  if (!ehIdentificador(inscricaoId) || !ehAcaoDePresenca(acao)) {
    redirect(voltar('erro'));
  }

  let deuCerto = false;

  try {
    const supabase = await obterCliente();

    if (acao === 'limpar') {
      // O ÚNICO delete deste arquivo, e ele apaga a MARCAÇÃO, nunca a
      // inscrição — ver o cabeçalho sobre os três estados.
      const { error } = await supabase
        .from('presencas')
        .delete()
        .eq('inscricao_id', inscricaoId);

      if (error) {
        console.error('[presencas] não deu para limpar a marcação:', descrever(error));
      } else {
        deuCerto = true;
      }
    } else {
      // `marcada_por` sai da SESSÃO VERIFICADA, nunca do formulário — é a
      // regra 6 do CLAUDE.md aplicada a esta coluna. Ela existe para a ONG
      // saber quem conferiu a lista, e um valor vindo do corpo da
      // requisição faria essa resposta valer nada.
      const quem = await usuarioAtual();

      // `upsert` com `onConflict` na coluna única `inscricao_id`
      // (003_eventos.sql): marcar duas vezes a mesma pessoa ATUALIZA a
      // linha em vez de estourar por chave duplicada. Sem isto, corrigir um
      // toque errado exigiria apagar antes.
      const { error } = await supabase
        .from('presencas')
        .upsert({
          inscricao_id: inscricaoId,
          presente: acao === 'presente',
          marcada_em: new Date().toISOString(),
          marcada_por: quem?.id ?? null
        }, { onConflict: 'inscricao_id' });

      if (error) {
        console.error('[presencas] não deu para marcar:', descrever(error));
      } else {
        deuCerto = true;
      }
    }
  } catch (erro) {
    console.error('[presencas] marcarPresenca (exceção):', descrever(erro));
  }

  redirect(voltar(
    !deuCerto ? 'erro'
      : acao === 'presente' ? 'marcada'
        : acao === 'ausente' ? 'desmarcada' : 'limpa'
  ));
}
