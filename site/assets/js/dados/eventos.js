import { obterCliente, supabaseConfigurado } from './supabase.js';

/**
 * Eventos e inscricoes (RF13-RF18).
 */

/** Proximos eventos publicados, do mais proximo ao mais distante. */
export async function listarProximos() {
  if (!supabaseConfigurado()) return [];

  const { data, error } = await obterCliente()
    .from('eventos')
    .select('*')
    .eq('publicado', true)
    .gte('comeca_em', new Date().toISOString())
    .order('comeca_em', { ascending: true });

  if (error) throw error;
  return data;
}

/** Eventos que ja aconteceram — o escopo pede que continuem acessiveis. */
export async function listarPassados() {
  if (!supabaseConfigurado()) return [];

  const { data, error } = await obterCliente()
    .from('eventos')
    .select('*')
    .eq('publicado', true)
    .lt('comeca_em', new Date().toISOString())
    .order('comeca_em', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
}

export async function buscarEvento(id) {
  const { data, error } = await obterCliente()
    .from('eventos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Inscricao sem conta (RF15).
 *
 * ATENCAO: sem .select() de proposito. A politica permite inserir e proibe
 * ler; pedir a linha de volta faria a insercao PARECER que falhou mesmo tendo
 * gravado — e o diagnostico errado desse sintoma leva alguem a desligar a RLS.
 */
export async function inscrever(dados) {
  const { error } = await obterCliente().from('inscricoes').insert(dados);
  if (error) throw error;
}
