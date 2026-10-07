/**
 * JSON-LD `Event` (schema.org) para a agenda: é o que faz o buscador mostrar
 * data, local e nome direto no resultado. Só entra dado que a equipe
 * publicou; campo sem valor é OMITIDO, nunca inventado (regra 2).
 */
type EventoLd = {
  id: string;
  titulo: string;
  descricao: string | null;
  comeca_em: string;
  termina_em: string | null;
  local: string | null;
};

/** `<` vira `<`: o JSON vai dentro de um <script>, e `</script>` no texto o fecharia. */
export function jsonSeguroParaScript(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

export function dadosEstruturadosDosEventos(
  eventos: EventoLd[],
  endereco: (caminho: string) => string
): string | null {
  if (eventos.length === 0) return null;
  const itens = eventos.map((evento) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: evento.titulo,
    startDate: evento.comeca_em,
    ...(evento.termina_em ? { endDate: evento.termina_em } : {}),
    ...(evento.descricao ? { description: evento.descricao } : {}),
    ...(evento.local ? { location: { '@type': 'Place', name: evento.local } } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: endereco(`/agenda#${evento.id}`),
    organizer: { '@type': 'Organization', name: 'Ateliê Afro Cultural' }
  }));
  return jsonSeguroParaScript(itens);
}
