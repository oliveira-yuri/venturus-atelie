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
 * componentes/SecaoOndeEstivemos.ts).
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

/**
 * Aplica no JSON local o mesmo filtro e a mesma ordenação que a consulta
 * remota recebe da RLS (`publicado or eh_equipe()`, migration
 * 002_conteudo.sql) e do `.order('titulo')` — Rodada de correção 1 da
 * Tarefa 10.
 *
 * Sem isto, o fallback offline devolvia o arquivo cru: se a equipe
 * despublicasse um registro pelo painel e o Supabase caísse logo depois, o
 * JSON versionado (que ninguém atualiza automaticamente a partir do painel)
 * fazia esse registro "ressuscitar" na página pública.
 *
 * dados-iniciais/atividades.json carrega o campo `publicado` de verdade —
 * aqui o filtro faz diferença real assim que alguém marcar uma atividade
 * como `false` nesse arquivo. Já dados-iniciais/clipping.json NÃO modela
 * esse campo hoje (nenhum registro o carrega). Escolha, documentada aqui
 * porque é exatamente o tipo de decisão que se perde se só ficar no
 * histórico do commit: ausência do campo é tratada como "publicado" — o
 * mesmo default (`not null default true`) da coluna real —, não como
 * "esconder". Consequência aceita conscientemente: para o clipping
 * especificamente, a proteção contra "registro despublicado ressuscita"
 * só existe enquanto o Supabase estiver no ar (a RLS filtra lá); o JSON
 * local não tem como saber sozinho. Corrigir de verdade exigiria o JSON
 * também carregar `publicado` por registro, o que fica para quando/se
 * ferramentas/gerar-seed.mjs ganhar um caminho de exportação nesse sentido.
 */
function filtrarEOrdenarLocal<T extends { titulo: string; publicado?: boolean }>(
  registros: T[]
): T[] {
  return registros
    .filter((registro) => registro.publicado !== false)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export async function listarAtividades(): Promise<Atividade[]> {
  if (!temSupabase()) {
    return filtrarEOrdenarLocal(atividadesLocais as Array<Atividade & { publicado?: boolean }>);
  }

  try {
    const { data, error } = await (await obterCliente())
      .from('atividades')
      .select('id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider')
      .order('titulo');

    // Banco fora do ar nao pode derrubar a pagina institucional: cai para o
    // JSON versionado, que e o mesmo conteudo real da ONG.
    if (error) return filtrarEOrdenarLocal(atividadesLocais as Array<Atividade & { publicado?: boolean }>);
    return data as Atividade[];
  } catch {
    // Falha de rede/DNS chega como excecao, nao como { error }: mesmo
    // tratamento, mesma rede de seguranca.
    return filtrarEOrdenarLocal(atividadesLocais as Array<Atividade & { publicado?: boolean }>);
  }
}

export async function listarClipping(): Promise<RegistroClipping[]> {
  if (!temSupabase()) {
    return filtrarEOrdenarLocal(clippingLocal as Array<RegistroClipping & { publicado?: boolean }>);
  }

  try {
    const { data, error } = await (await obterCliente())
      .from('clipping')
      .select('id, tipo, titulo, detalhe, ano')
      .order('titulo');

    if (error) return filtrarEOrdenarLocal(clippingLocal as Array<RegistroClipping & { publicado?: boolean }>);
    return data as RegistroClipping[];
  } catch {
    return filtrarEOrdenarLocal(clippingLocal as Array<RegistroClipping & { publicado?: boolean }>);
  }
}
