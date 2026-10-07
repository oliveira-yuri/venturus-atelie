import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComContagem, consultarOuDegradar, type Degradavel } from './degradacao';

/**
 * Depoimentos (014_depoimentos.sql). Duas leituras, duas políticas:
 *
 * · `listarAprovados` — o que o site mostra. Filtra `situacao = 'aprovado'`
 *   na consulta E a RLS filtra de novo: quem não é equipe só recebe aprovados
 *   de qualquer jeito, mas quem é equipe veria tudo sem o filtro daqui.
 * · `listarDoPainel` — a fila de moderação, só para a equipe (a página
 *   guarda com `ehEquipe()`; a RLS é a tranca de verdade).
 *
 * Sem a migration 014 aplicada a tabela não existe: a leitura pública
 * degrada para lista vazia (com aviso `[dados]` no log) e a página mostra o
 * estado vazio — nunca um 500.
 */
export type Depoimento = {
  id: string;
  nome: string;
  atividade: string | null;
  texto: string;
  situacao: string;
  criado_em: string;
  moderado_em: string | null;
};

export async function listarAprovados(): Promise<Depoimento[]> {
  return consultarOuDegradar<Depoimento[]>('depoimentos (aprovados)', async () =>
    (await obterCliente())
      .from('depoimentos')
      .select('id, nome, atividade, texto, situacao, criado_em, moderado_em')
      .eq('situacao', 'aprovado')
      .order('criado_em', { ascending: false })
      .limit(60),
  []);
}

export async function listarDoPainel(
  paginacao?: { de: number; ate: number }
): Promise<Degradavel<Depoimento[]> & { total: number | null }> {
  return consultarComContagem<Depoimento[]>('depoimentos (painel)', async () => {
    const consulta = (await obterCliente())
      .from('depoimentos')
      .select('*', { count: 'exact' })
      .order('criado_em', { ascending: false });
    return paginacao ? consulta.range(paginacao.de, paginacao.ate) : consulta;
  }, []);
}
