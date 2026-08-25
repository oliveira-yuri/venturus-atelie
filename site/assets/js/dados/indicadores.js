import { obterCliente } from './supabase.js';

/**
 * Indicadores do painel (RF30).
 *
 * Sao consultas agregadas sobre as tabelas existentes — nao ha tabela de
 * indicadores, como o escopo determina (secao 10).
 *
 * Usa count exato com head: true, que traz so o total, sem trazer as linhas.
 * Importante aqui: o painel abre em rede movel e essas tabelas guardam dados
 * pessoais que nao precisam trafegar para virar um numero.
 */
function inicioDoMes() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
}

async function contar(tabela, aplicarFiltros) {
  let consulta = obterCliente().from(tabela).select('*', { count: 'exact', head: true });
  if (aplicarFiltros) consulta = aplicarFiltros(consulta);

  const { count, error } = await consulta;
  if (error) throw error;
  return count ?? 0;
}

export async function contarDoMes() {
  const desde = inicioDoMes();

  const [eventos, inscritos, contatos, doacoes] = await Promise.all([
    contar('eventos', (c) => c.gte('comeca_em', desde)),
    contar('inscricoes', (c) => c.gte('criado_em', desde)),
    contar('contatos', (c) => c.eq('situacao', 'novo')),
    contar('doacoes', (c) => c.eq('situacao', 'ofertada'))
  ]);

  return { eventos, inscritos, contatos, doacoes };
}
