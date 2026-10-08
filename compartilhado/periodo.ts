/**
 * Períodos do relatório (mês, trimestre, semestre, ano) no calendário da ONG.
 *
 * O Brasil não tem horário de verão desde 2019, então São Paulo é UTC−03:00
 * o ano inteiro; o intervalo vira instantes UTC de meia-noite local. O fim é
 * EXCLUSIVO (`< fim`), para que 23:59:59.999 do último dia não escape.
 */
export const PERIODOS = ['mes', 'trimestre', 'semestre', 'ano'] as const;
export type Periodo = typeof PERIODOS[number];

export const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  mes: 'Mês', trimestre: 'Trimestre', semestre: 'Semestre', ano: 'Ano'
};

const MESES_POR_PERIODO: Record<Periodo, number> = { mes: 1, trimestre: 3, semestre: 6, ano: 12 };
const NOMES_DO_MES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export type IntervaloDoPeriodo = { periodo: Periodo; inicio: string; fim: string; rotulo: string };

/** Entrada de usuário (querystring): só passa o que está na lista. */
export function lerPeriodo(valor: unknown): Periodo | null {
  return typeof valor === 'string' && (PERIODOS as readonly string[]).includes(valor)
    ? (valor as Periodo)
    : null;
}

/** `deslocamento` 0 = o período de `hoje`; -1 = o anterior. Positivos são recusados (futuro não tem relatório). */
export function lerDeslocamento(valor: unknown): number {
  const n = typeof valor === 'string' && /^-?\d{1,3}$/.test(valor) ? Number(valor) : 0;
  return n > 0 ? 0 : n;
}

function mesDeSaoPaulo(hoje: Date): { ano: number; mes: number } {
  const local = new Date(hoje.getTime() - 3 * 3600_000);
  return { ano: local.getUTCFullYear(), mes: local.getUTCMonth() };
}

const instante = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 1, 3, 0, 0)).toISOString();

export function intervaloDoPeriodo(periodo: Periodo, deslocamento: number, hoje = new Date()): IntervaloDoPeriodo {
  const tamanho = MESES_POR_PERIODO[periodo];
  const { ano, mes } = mesDeSaoPaulo(hoje);
  // Começo do período corrente, alinhado ao calendário (jan/abr/jul/out; jan/jul), em meses absolutos.
  const base = ano * 12 + (periodo === 'ano' ? 0 : Math.floor(mes / tamanho) * tamanho);
  const inicioAbsoluto = base + deslocamento * tamanho;
  const fimAbsoluto = inicioAbsoluto + tamanho;
  const anoInicial = Math.floor(inicioAbsoluto / 12);
  const anoFinal = Math.floor(fimAbsoluto / 12);

  return {
    periodo,
    inicio: instante(anoInicial, inicioAbsoluto - anoInicial * 12),
    fim: instante(anoFinal, fimAbsoluto - anoFinal * 12),
    rotulo: rotuloDe(periodo, anoInicial, inicioAbsoluto - anoInicial * 12)
  };
}

function rotuloDe(periodo: Periodo, ano: number, mes: number): string {
  if (periodo === 'mes') return `${NOMES_DO_MES[mes]} de ${ano}`;
  if (periodo === 'trimestre') return `${Math.floor(mes / 3) + 1}º trimestre de ${ano}`;
  if (periodo === 'semestre') return `${Math.floor(mes / 6) + 1}º semestre de ${ano}`;
  return String(ano);
}

// ---------------------------------------------------------------------
// O resumo, a partir das linhas cruas (puro: testável sem banco)
// ---------------------------------------------------------------------

type Embutido<T> = T | T[] | null;
const primeiro = <T,>(e: Embutido<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

export type EventoCru = {
  id: string;
  inscricoes: { eh_menor: boolean; presencas: Embutido<{ presente: boolean }> }[] | null;
};
export type DoacaoCrua = { tipo: string; situacao: string; valor: number | string | null };

export type ResumoDoPeriodo = {
  atividades: number;
  inscritos: number;
  /** Inscrições de menores (RN02: feitas por responsável). Contam inscrições, não pessoas únicas. */
  criancasInscritas: number;
  presentes: number;
  criancasPresentes: number;
  /** Inscrições cuja presença ninguém conferiu — NÃO são faltas. */
  semConferir: number;
  doacoesRecebidas: number;
  itensRecebidos: number;
  /** Soma do campo `valor` das doações financeiras RECEBIDAS (fato, não promessa — RN08). */
  valorRecebidoEmCentavos: number;
};

export function resumirPeriodo(eventos: EventoCru[], doacoesRecebidas: DoacaoCrua[]): ResumoDoPeriodo {
  const resumo: ResumoDoPeriodo = {
    atividades: eventos.length, inscritos: 0, criancasInscritas: 0, presentes: 0,
    criancasPresentes: 0, semConferir: 0, doacoesRecebidas: doacoesRecebidas.length,
    itensRecebidos: 0, valorRecebidoEmCentavos: 0
  };

  for (const evento of eventos) {
    for (const inscricao of evento.inscricoes ?? []) {
      resumo.inscritos += 1;
      if (inscricao.eh_menor) resumo.criancasInscritas += 1;
      const presente = primeiro(inscricao.presencas)?.presente ?? null;
      if (presente === true) {
        resumo.presentes += 1;
        if (inscricao.eh_menor) resumo.criancasPresentes += 1;
      }
      if (presente === null) resumo.semConferir += 1;
    }
  }

  for (const doacao of doacoesRecebidas) {
    if (doacao.tipo === 'item') resumo.itensRecebidos += 1;
    if (doacao.tipo === 'recurso_financeiro' && doacao.valor !== null) {
      resumo.valorRecebidoEmCentavos += Math.round(Number(doacao.valor) * 100);
    }
  }
  return resumo;
}

export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
