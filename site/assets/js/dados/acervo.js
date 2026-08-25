import { obterCliente, supabaseConfigurado } from './supabase.js';

/**
 * Acervo aberto (RF35-RF37). Download livre, sem cadastro.
 */
export async function listarMateriais({ tema, faixaEtaria, busca } = {}) {
  if (!supabaseConfigurado()) return [];

  let consulta = obterCliente()
    .from('acervo').select('*').eq('publicado', true);

  if (tema) consulta = consulta.eq('tema', tema);
  if (faixaEtaria) consulta = consulta.eq('faixa_etaria', faixaEtaria);

  // Full-text search em portugues, pela coluna gerada (RF35).
  if (busca && busca.trim()) {
    consulta = consulta.textSearch('busca', busca.trim(), {
      type: 'plain',
      config: 'portuguese'
    });
  }

  const { data, error } = await consulta.order('titulo');
  if (error) throw error;
  return data;
}

/** Endereco publico do arquivo no Storage. */
export function enderecoDoArquivo(caminho) {
  const { data } = obterCliente().storage.from('acervo').getPublicUrl(caminho);
  return data.publicUrl;
}
