import 'server-only';
import { obterCliente } from '../supabase';
import atividadesLocais from '@/dados-iniciais/atividades.json';
import clippingLocal from '@/dados-iniciais/clipping.json';

/**
 * Uma das 11 atividades do catálogo (RF03).
 *
 * Os nomes de coluna espelham a tabela public.atividades (migration
 * 002_conteudo.sql) e o JSON versionado em dados-iniciais/atividades.json —
 * as duas fontes nascem com o mesmo formato, de propósito.
 */
export type Atividade = {
  id: string;
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  genero: string | null;
  duracao: string | null;
  elenco: string | null;
  classificacao: string | null;
  local: string | null;
  rider: string | null;
};

/**
 * Um registro de "prova social" (RF39): onde o Ateliê já se apresentou ou
 * foi noticiado. "midia" alimenta "Na mídia"; "instituicao" e "programacao"
 * alimentam "Onde já estivemos" em /para-escolas (ver
 * servidor/dados/prova-social.ts).
 */
export type RegistroClipping = {
  id: string;
  tipo: 'midia' | 'instituicao' | 'programacao';
  titulo: string;
  detalhe: string | null;
  ano: number | null;
};

/**
 * Conteudo institucional com fonte dupla.
 *
 * Enquanto o projeto Supabase nao esta configurado no ambiente, le o JSON
 * versionado em dados-iniciais/. Quando SUPABASE_URL e
 * SUPABASE_CHAVE_PUBLICAVEL existem, passa a consultar a tabela — e nenhuma
 * pagina precisa mudar, porque todas falam so com estas funcoes.
 *
 * O mesmo JSON e a origem do seed.sql (ferramentas/gerar-seed.mjs), entao as
 * duas fontes nascem com o mesmo conteudo real da ONG.
 */
function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

export async function listarAtividades(): Promise<Atividade[]> {
  if (!temSupabase()) return atividadesLocais as Atividade[];

  try {
    const { data, error } = await (await obterCliente())
      .from('atividades')
      .select('id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider')
      .order('titulo');

    // Banco fora do ar nao pode derrubar a pagina institucional: cai para o
    // JSON versionado, que e o mesmo conteudo real da ONG.
    if (error) return atividadesLocais as Atividade[];
    return data as Atividade[];
  } catch {
    // Falha de rede/DNS chega como excecao, nao como { error }: mesmo
    // tratamento, mesma rede de seguranca.
    return atividadesLocais as Atividade[];
  }
}

export async function listarClipping(): Promise<RegistroClipping[]> {
  if (!temSupabase()) return clippingLocal as RegistroClipping[];

  try {
    const { data, error } = await (await obterCliente())
      .from('clipping')
      .select('id, tipo, titulo, detalhe, ano')
      .order('titulo');

    if (error) return clippingLocal as RegistroClipping[];
    return data as RegistroClipping[];
  } catch {
    return clippingLocal as RegistroClipping[];
  }
}
