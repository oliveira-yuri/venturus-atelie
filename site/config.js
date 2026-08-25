/**
 * Configuracao publica do front.
 *
 * A anon key e publica por construcao: o site e estatico e ela aparece no
 * codigo-fonte de qualquer forma. O que protege os dados e a Row Level
 * Security no Postgres, nunca o sigilo desta chave. Ver secao 12 do escopo.
 *
 * A service role key NUNCA entra neste arquivo nem em qualquer outro do
 * repositorio. Ela existe apenas como secret da Edge Function.
 */
export const CONFIG = {
  supabaseUrl: 'https://lubsufltidrbmganftux.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1YnN1Zmx0aWRyYm1nYW5mdHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MzU3NDIsImV4cCI6MjEwMzIxMTc0Mn0.ZL7Qea0EctyLSUvTlGhbxLQsw_qNo_QVqPUS9KhVdno'
};
