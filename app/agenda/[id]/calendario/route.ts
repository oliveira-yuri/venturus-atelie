import { buscarEvento } from '@/servidor/dados/eventos';
import { montarIcs } from '@/compartilhado/calendario';
import { enderecoAbsoluto } from '@/compartilhado/endereco-do-site';

/**
 * GET /agenda/<id>/calendario — o evento como arquivo .ics.
 *
 * Não tem conta nem formulário: é leitura pública do mesmo dado que /agenda
 * já mostra, e a RLS de `eventos` só devolve o que está publicado. Evento
 * que não existe (ou que o banco não entregou) é 404, sem arquivo vazio.
 */
export async function GET(_pedido: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evento = await buscarEvento(id);
  if (!evento) return new Response('Evento não encontrado', { status: 404 });

  const corpo = montarIcs(evento, enderecoAbsoluto(`/agenda#${evento.id}`));
  return new Response(corpo, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="evento.ics"',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
