import { supabaseConfigurado, obterCliente } from './supabase.js';

/**
 * Conteudo institucional com fonte dupla.
 *
 * Enquanto o projeto Supabase nao existe, le o JSON versionado em
 * dados-iniciais/. Quando existir, passa a consultar a tabela — e nenhuma
 * pagina precisa mudar, porque todas falam so com estas funcoes.
 *
 * O mesmo JSON e a origem do seed.sql da Fase 02, entao as duas fontes
 * nascem com o mesmo conteudo.
 */
async function buscar(tabela, arquivoLocal, ordenarPor) {
  if (!supabaseConfigurado()) {
    const resposta = await fetch(arquivoLocal);
    if (!resposta.ok) {
      throw new Error(`nao foi possivel ler ${arquivoLocal}`);
    }
    return resposta.json();
  }

  const { data, error } = await obterCliente()
    .from(tabela)
    .select('*')
    .eq('publicado', true)
    .order(ordenarPor);

  if (error) throw error;
  return data;
}

export function listarAtividades() {
  return buscar('atividades', '/assets/dados-iniciais/atividades.json', 'titulo');
}

export function listarClipping() {
  return buscar('clipping', '/assets/dados-iniciais/clipping.json', 'titulo');
}
