import 'server-only';
import { obterCliente } from '../supabase';

/**
 * Áreas de voluntariado (RF24). Porte de site/assets/js/dados/
 * voluntariado.js — só `listarAreas()`.
 *
 * `candidatar()` (RF25, candidatura ao voluntariado) FICA DE FORA deste
 * porte: exige perfil autenticado (perfil_id) e grava em duas tabelas
 * (`voluntarios`, `voluntario_areas`) — é Bloco B, quando a autenticação
 * chegar ao app novo. Portá-la agora sem ter onde chamá-la (nenhum
 * formulário desta tarefa registra candidatura) deixaria função morta no
 * módulo.
 *
 * Consulta copiada COMO ESTÁ — `select('*')`, sem enumerar coluna
 * (restrição global 1 desta fase): mesmo motivo de servidor/dados/
 * eventos.ts e acervo.ts.
 */

/**
 * Uma área de voluntariado. `ordem` (a coluna que a consulta usa para
 * ordenar) fica fora do tipo pelo mesmo motivo de `publicado` em `Evento`
 * (servidor/dados/eventos.ts): é campo de ORDENAÇÃO da consulta, não de
 * apresentação — nenhum componente portado até agora exibe um número de
 * ordem.
 */
export type Area = {
  id: string;
  nome: string;
  descricao: string;
};

/**
 * Mesmo motivo de temSupabase() em servidor/dados/eventos.ts: em modo
 * offline (`npm test`, sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL) não há
 * fonte nenhuma para consultar. DIFERENTE de atividades/clipping: esta
 * tabela não tem JSON versionado irmão em dados-iniciais/ para servir de
 * fallback — as cinco áreas só existem no seed do Postgres (supabase/
 * seed.sql). Devolver lista vazia aqui é o MESMO comportamento que
 * site/assets/js/dados/voluntariado.js já tinha (supabaseConfigurado())
 * antes deste porte.
 */
function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

/** As cinco áreas de atuação nomeadas pela ONG (RF24), na ordem que a equipe definiu. */
export async function listarAreas(): Promise<Area[]> {
  if (!temSupabase()) return [];

  const { data, error } = await (await obterCliente())
    .from('areas_voluntariado')
    .select('*')
    .order('ordem');

  if (error) throw error;
  return data as Area[];
}
