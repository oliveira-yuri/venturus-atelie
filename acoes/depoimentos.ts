'use server';

import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { lerMudancaDeSituacao, ehIdentificador } from '@/compartilhado/validacao';
import { ehSituacaoDeDepoimento } from '@/compartilhado/depoimentos';

/**
 * A MODERAÇÃO de depoimentos — só a equipe. O oposto de
 * `acoes/depoimento.ts` (singular, público), e os nomes quase iguais são o
 * mesmo caso de contato/contatos: a varredura de `testes/depoimentos.test.mjs`
 * exige `ehEquipe()` aqui e a ausência dele lá.
 *
 * UM `update`, UMA coluna de decisão (`situacao`) mais o carimbo
 * `moderado_em`. Não há `insert` nem `delete`, e nunca se toca em `texto` ou
 * `nome`: o que a pessoa escreveu é registro, e a equipe só decide se vai ao
 * ar. Aprovar e depois recusar é possível — recusar tira do ar.
 *
 * Aprovar publica nome e texto de uma pessoa: a autorização dela está na
 * coluna `autoriza_publicacao`, que o banco exige `true` em todo registro.
 */
const LISTA = '/admin/depoimentos';

export async function moderarDepoimento(dados: FormData): Promise<void> {
  const { id, situacao } = lerMudancaDeSituacao(dados);

  if (!await ehEquipe()) notFound();

  if (!ehIdentificador(id) || !ehSituacaoDeDepoimento(situacao)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    console.error('[depoimentos] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente.');
    redirect(`${LISTA}?aviso=erro`);
  }

  let deuCerto = false;

  try {
    const supabase = await obterCliente();
    const { data, error } = await supabase
      .from('depoimentos')
      .update({ situacao, moderado_em: new Date().toISOString() })
      .eq('id', id)
      .select('id');

    if (error) console.error('[depoimentos] moderar:', descrever(error));
    else deuCerto = Array.isArray(data) && data.length > 0;
  } catch (erro) {
    console.error('[depoimentos] moderar (exceção):', descrever(erro));
  }

  redirect(`${LISTA}?aviso=${deuCerto ? situacao : 'erro'}`);
}
