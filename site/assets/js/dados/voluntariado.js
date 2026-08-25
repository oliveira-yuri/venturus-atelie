import { obterCliente, supabaseConfigurado } from './supabase.js';

/** As cinco areas de atuacao nomeadas pela ONG (RF24). */
export async function listarAreas() {
  if (!supabaseConfigurado()) return [];

  const { data, error } = await obterCliente()
    .from('areas_voluntariado').select('*').order('ordem');

  if (error) throw error;
  return data;
}

/** Candidatura ao voluntariado (RF25). Exige conta. */
export async function candidatar({ perfilId, mensagem, areas }) {
  const cliente = obterCliente();

  const { data, error } = await cliente
    .from('voluntarios')
    .insert({ perfil_id: perfilId, mensagem })
    .select('id')
    .single();

  if (error) throw error;

  const vinculos = areas.map((areaId) => ({ voluntario_id: data.id, area_id: areaId }));
  const { error: erroAreas } = await cliente.from('voluntario_areas').insert(vinculos);
  if (erroAreas) throw erroAreas;

  return data.id;
}
