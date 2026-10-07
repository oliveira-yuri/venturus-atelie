import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';
import {
  resumirPeriodo, type DoacaoCrua, type EventoCru, type IntervaloDoPeriodo, type ResumoDoPeriodo
} from '@/compartilhado/periodo';

/**
 * Os números de um período (relatório de prestação de contas).
 *
 * Quatro consultas, só do banco, nenhuma com dado pessoal: a de eventos traz
 * apenas booleanos (`eh_menor`, `presente`) embutidos, e a de doações só
 * tipo, situação e valor. Nome, e-mail, telefone e CPF nunca atravessam a
 * rede para desenhar um número.
 *
 * Cada metade pode falhar sozinha, e o que falhou NÃO vira zero: devolve
 * `null` naquela metade (a página escreve um traço). Um zero inventado
 * num relatório impresso sobrevive à causa.
 */
export type ResumoComFalhas = {
  agenda: Degradavel<EventoCru[]>;
  doacoes: Degradavel<DoacaoCrua[]>;
  novosVoluntarios: number | null;
  resumo: ResumoDoPeriodo;
};

export async function resumoDoPeriodo(intervalo: IntervaloDoPeriodo): Promise<ResumoComFalhas> {
  const [agenda, doacoes, voluntarios] = await Promise.all([
    consultarComEstado<EventoCru[]>(
      'eventos (relatório do período)',
      async () => (await obterCliente())
        .from('eventos')
        .select('id, inscricoes(eh_menor, presencas(presente))')
        .eq('publicado', true)
        .gte('comeca_em', intervalo.inicio)
        .lt('comeca_em', intervalo.fim),
      []
    ),
    consultarComEstado<DoacaoCrua[]>(
      'doacoes (relatório do período)',
      async () => (await obterCliente())
        .from('doacoes')
        .select('tipo, situacao, valor')
        .eq('situacao', 'recebida')
        .gte('recebida_em', intervalo.inicio)
        .lt('recebida_em', intervalo.fim),
      []
    ),
    contarVoluntarios(intervalo)
  ]);

  return {
    agenda,
    doacoes,
    novosVoluntarios: voluntarios,
    resumo: resumirPeriodo(agenda.valor, doacoes.valor)
  };
}

async function contarVoluntarios(intervalo: IntervaloDoPeriodo): Promise<number | null> {
  const resposta = await consultarComEstado<{ id: string }[] | null>(
    'voluntarios (relatório do período)',
    async () => (await obterCliente())
      .from('voluntarios')
      .select('id')
      .gte('criado_em', intervalo.inicio)
      .lt('criado_em', intervalo.fim),
    null
  );
  return resposta.degradou || resposta.valor === null ? null : resposta.valor.length;
}
