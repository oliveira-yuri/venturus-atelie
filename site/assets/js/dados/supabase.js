import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from '../../../config.js';

let cliente = null;

export function supabaseConfigurado() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

/**
 * Cliente unico do Supabase.
 *
 * Regra do projeto: nenhuma pagina chama este cliente diretamente. As paginas
 * usam os modulos de dados (eventos.js, doacoes.js, ...), que sao os unicos
 * consumidores daqui. Isso mantem uma mudanca de schema restrita a um arquivo
 * em vez de espalhada por quinze paginas.
 */
export function obterCliente() {
  if (!supabaseConfigurado()) {
    throw new Error('Supabase ainda nao configurado em site/config.js');
  }
  if (!cliente) {
    cliente = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return cliente;
}
