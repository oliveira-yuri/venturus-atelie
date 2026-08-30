import 'server-only';
import { obterCliente } from '../supabase';

/**
 * Acervo aberto (RF35-RF37). Download livre, sem cadastro. Porte de
 * site/assets/js/dados/acervo.js.
 *
 * Consultas copiadas COMO ESTÃO — `select('*')`, sem enumerar coluna
 * (restrição global 1 desta fase) — mesmo motivo de servidor/dados/
 * eventos.ts: sem JSON local irmão, nenhuma comparação pegaria um nome de
 * coluna inventado.
 */

/**
 * Um material do acervo. Os campos espelham as colunas de public.acervo
 * (migration 002_conteudo.sql) que site/assets/js/paginas/acervo.js de
 * fato lê — `downloads` e `criado_em` existem na tabela e ficam de fora
 * daqui pelo mesmo motivo do `Evento` em servidor/dados/eventos.ts: nada
 * portado até agora os usa. `publicado` fica de fora por ser campo de
 * filtro, não de apresentação (mesma decisão de `Atividade`).
 */
export type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  tema: string | null;
  faixa_etaria: string | null;
  arquivo_caminho: string;
  tamanho_bytes: number | null;
};

export type FiltrosAcervo = {
  tema?: string;
  faixaEtaria?: string;
  busca?: string;
};

/** Mesmo motivo de temSupabase() em servidor/dados/eventos.ts. */
function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

export async function listarMateriais(filtros: FiltrosAcervo = {}): Promise<Material[]> {
  if (!temSupabase()) return [];

  let consulta = (await obterCliente()).from('acervo').select('*').eq('publicado', true);

  if (filtros.tema) consulta = consulta.eq('tema', filtros.tema);
  if (filtros.faixaEtaria) consulta = consulta.eq('faixa_etaria', filtros.faixaEtaria);

  // Full-text search em português, pela coluna gerada (RF35).
  if (filtros.busca && filtros.busca.trim()) {
    consulta = consulta.textSearch('busca', filtros.busca.trim(), {
      type: 'plain',
      config: 'portuguese'
    });
  }

  const { data, error } = await consulta.order('titulo');
  if (error) throw error;
  return data as Material[];
}

/**
 * Endereço público do arquivo no Storage.
 *
 * MEDIDO (lendo node_modules/@supabase/storage-js/src/packages/
 * StorageFileApi.ts, método getPublicUrl): a chamada é SÍNCRONA e só
 * concatena string (URL do projeto + bucket + caminho, com encodeURI) —
 * não faz requisição de rede, não lê sessão nem cookie, e a documentação
 * do próprio método diz que não exige permissão nenhuma de RLS ("buckets
 * table permissions: none", "objects table permissions: none"). O bucket
 * `acervo` é público (supabase/migrations/006_storage.sql). Funciona a
 * partir do servidor sem nenhuma ressalva — o único motivo de esta função
 * precisar ser `async` aqui é obterCliente() exigir `await` (por causa de
 * `cookies()`, que só existe dentro de uma requisição do Next); a chamada
 * a getPublicUrl em si não espera nada.
 */
export async function enderecoDoArquivo(caminho: string): Promise<string> {
  const { data } = (await obterCliente()).storage.from('acervo').getPublicUrl(caminho);
  return data.publicUrl;
}
