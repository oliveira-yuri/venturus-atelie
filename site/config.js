/**
 * Configuracao publica do front.
 *
 * A anon key e publica por construcao: o site e estatico e ela aparece no
 * codigo-fonte de qualquer forma. O que protege os dados e a Row Level
 * Security no Postgres, nunca o sigilo desta chave. Ver secao 12 do escopo.
 *
 * A service role key NUNCA entra neste arquivo nem em qualquer outro do
 * repositorio. Ela existe apenas como secret da Edge Function.
 *
 * Preencher quando o projeto Supabase (regiao Sao Paulo) for criado.
 */
export const CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
