/**
 * Depoimentos — as três situações, a ordem da fila de moderação e as frases
 * de aviso. Uma lista só decide três coisas (os botões da tela, o que a
 * Action aceita e a ordem), como em `triagem-de-contatos.ts`. A lista TEM de
 * bater com o `check` de 014_depoimentos.sql: há teste que cobra isso.
 */
export const SITUACOES_DE_DEPOIMENTO = ['pendente', 'aprovado', 'recusado'] as const;
export type SituacaoDeDepoimento = typeof SITUACOES_DE_DEPOIMENTO[number];

export function ehSituacaoDeDepoimento(valor: unknown): valor is SituacaoDeDepoimento {
  return typeof valor === 'string' && (SITUACOES_DE_DEPOIMENTO as readonly string[]).includes(valor);
}

export const ROTULO_DE_SITUACAO: Record<SituacaoDeDepoimento, string> = {
  pendente: 'Esperando moderação',
  aprovado: 'No ar',
  recusado: 'Recusado'
};

/** Quem espera moderação vem primeiro; dentro de cada grupo, o mais novo em cima. */
export function ordenarParaModeracao<T extends { situacao: string; criado_em: string }>(itens: T[]): T[] {
  const peso = (situacao: string) => (situacao === 'pendente' ? 0 : situacao === 'aprovado' ? 1 : 2);
  return [...itens].sort((a, b) =>
    peso(a.situacao) - peso(b.situacao) || b.criado_em.localeCompare(a.criado_em));
}

export type AvisoDeDepoimento = { texto: string; ok: boolean };

const AVISOS_DO_FORMULARIO: Record<string, AvisoDeDepoimento> = {
  enviado: {
    texto: 'Depoimento recebido — obrigado! Ele passa pela leitura da equipe e só vai para o '
      + 'site depois de aprovado. Se não aparecer, é porque a equipe ainda não leu.',
    ok: true
  }
};

const AVISOS_DA_MODERACAO: Record<string, AvisoDeDepoimento> = {
  aprovado: { texto: 'Depoimento aprovado. Ele já aparece na página de depoimentos do site.', ok: true },
  recusado: { texto: 'Depoimento recusado. Ele não aparece no site e continua guardado aqui.', ok: true },
  pendente: { texto: 'Depoimento de volta para a fila de moderação. Saiu do site.', ok: true },
  erro: { texto: 'Não deu para guardar essa mudança. Nada foi alterado; tente de novo.', ok: false }
};

const avisoPorChave = (tabela: Record<string, AvisoDeDepoimento>, valor: unknown) =>
  typeof valor === 'string' && Object.hasOwn(tabela, valor) ? tabela[valor] : null;

export const avisoDoFormularioDeDepoimento = (valor: unknown) => avisoPorChave(AVISOS_DO_FORMULARIO, valor);
export const avisoDaModeracao = (valor: unknown) => avisoPorChave(AVISOS_DA_MODERACAO, valor);
