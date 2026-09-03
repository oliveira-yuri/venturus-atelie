import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';

/**
 * servidor/dados/avisos.ts — o mural de avisos (RF27).
 *
 * =====================================================================
 * DUAS LEITURAS, E A RLS É QUEM AS SEPARA
 * =====================================================================
 *
 * `listarAvisos()` é o que o MURAL desenha, e `listarAvisosDoPainel()` é o
 * que a equipe vê. As duas consultam a mesma tabela; quem decide o que
 * volta é a política (012):
 *
 *     using ((publicado and public.eh_voluntario_ativo()) or public.eh_equipe())
 *
 * Repare no que NÃO está nela: nenhuma forma de `publicado` sozinho. Um
 * aviso publicado continua invisível para quem não é voluntário ativo nem
 * equipe — é o OPOSTO de `publicacoes`, onde `publicado` significa "o mundo
 * vê". Foi por isso que a tabela é nova em vez de uma coluna lá (a
 * migration explica por inteiro).
 *
 * O `.eq('publicado', true)` de `listarAvisos()` é INTENÇÃO escrita — "esta
 * é a consulta do mural" —, não a tranca.
 *
 * =====================================================================
 * AS DUAS DEVOLVEM `Degradavel`
 * =====================================================================
 *
 * Diferente de `eventos` (onde a agenda vazia degrada em silêncio para o
 * estado vazio já escrito), aqui uma lista vazia é uma AFIRMAÇÃO com
 * consequência: "não há aviso nenhum" faz um voluntário fechar a página e
 * não voltar. Falha de consulta precisa aparecer como falha.
 */

export type Aviso = {
  id: string;
  titulo: string;
  corpo: string;
  publicado_em: string | null;
};

export type AvisoDoPainel = Aviso & {
  publicado: boolean;
  criado_em: string;
};

/**
 * O mural, para quem é voluntário ativo.
 *
 * ORDENADO POR `publicado_em` DESCENDENTE: um mural é lido de cima, e o de
 * cima é o mais recente. `nulls last` porque um aviso publicado sem data
 * carimbada seria um defeito nosso, e o lugar dele é no fim, não no topo.
 */
export async function listarAvisos(): Promise<Degradavel<Aviso[]>> {
  return consultarComEstado<Aviso[]>('avisos (mural)', async () =>
    (await obterCliente())
      .from('avisos')
      .select('id, titulo, corpo, publicado_em')
      .eq('publicado', true)
      .order('publicado_em', { ascending: false, nullsFirst: false }),
  []);
}

/**
 * Todos os avisos — rascunho e no ar —, do mais novo ao mais antigo.
 *
 * ORDENADO POR `criado_em`, e não por `publicado_em` como o mural: aqui a
 * pessoa procura "o que eu escrevi por último", e um rascunho não tem
 * `publicado_em` nenhum — ordenar por ele jogaria todo rascunho para o fim,
 * que é exatamente onde quem está escrevendo não vai procurar.
 *
 * SEM `.limit()`, como as outras filas do painel.
 */
export async function listarAvisosDoPainel(): Promise<Degradavel<AvisoDoPainel[]>> {
  return consultarComEstado<AvisoDoPainel[]>('avisos (painel)', async () =>
    (await obterCliente())
      .from('avisos')
      .select('id, titulo, corpo, publicado, publicado_em, criado_em')
      .order('criado_em', { ascending: false }),
  []);
}

/** Um aviso pelo id, para a tela de edição e para as Actions. */
export async function buscarAviso(id: string): Promise<Degradavel<AvisoDoPainel | null>> {
  return consultarComEstado<AvisoDoPainel | null>('avisos (por id)', async () =>
    (await obterCliente())
      .from('avisos')
      .select('id, titulo, corpo, publicado, publicado_em, criado_em')
      .eq('id', id)
      .maybeSingle(),
  null);
}
