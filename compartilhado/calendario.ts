/**
 * "Adicionar à agenda": um arquivo .ics (RFC 5545) por evento.
 *
 * Datas em UTC (`...Z`): o banco guarda `timestamptz`, então o instante é
 * exato e o aplicativo de calendário converte para o fuso de quem abre. Não
 * há VTIMEZONE para errar. Sem `termina_em`, o evento dura 2 horas — e isso
 * é uma suposição de EXIBIÇÃO, não um dado da ONG; por isso fica nomeada.
 */
export const DURACAO_PADRAO_EM_HORAS = 2;

/** Escapa texto de propriedade (RFC 5545 §3.3.11). */
export function escaparTextoIcs(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,');
}

/** 2026-11-05T22:00:00.000Z → 20261105T220000Z */
export function dataIcs(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Dobra linhas com mais de 75 octetos (RFC 5545 §3.1), contando bytes UTF-8. */
export function dobrarLinha(linha: string): string {
  const codificador = new TextEncoder();
  if (codificador.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = '';
  let bytes = 0;
  let limite = 75;
  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length;
    if (bytes + tamanho > limite) {
      partes.push(atual);
      atual = '';
      bytes = 0;
      limite = 74; // a continuação começa com um espaço
    }
    atual += caractere;
    bytes += tamanho;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

export type EventoParaCalendario = {
  id: string;
  titulo: string;
  descricao: string | null;
  comeca_em: string;
  termina_em: string | null;
  local: string | null;
};

export function montarIcs(evento: EventoParaCalendario, enderecoDaPagina: string, agora = new Date()): string {
  const fim = evento.termina_em
    ?? new Date(new Date(evento.comeca_em).getTime() + DURACAO_PADRAO_EM_HORAS * 3600_000).toISOString();

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atelie Afro Cultural//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evento.id}@atelieafrocultural.site`,
    `DTSTAMP:${dataIcs(agora.toISOString())}`,
    `DTSTART:${dataIcs(evento.comeca_em)}`,
    `DTEND:${dataIcs(fim)}`,
    `SUMMARY:${escaparTextoIcs(evento.titulo)}`
  ];
  if (evento.descricao) linhas.push(`DESCRIPTION:${escaparTextoIcs(evento.descricao)}`);
  if (evento.local) linhas.push(`LOCATION:${escaparTextoIcs(evento.local)}`);
  linhas.push(`URL:${enderecoDaPagina}`, 'END:VEVENT', 'END:VCALENDAR');
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n';
}
