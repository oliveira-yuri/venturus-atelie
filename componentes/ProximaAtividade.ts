import { createElement } from 'react';
import type { Evento } from '@/servidor/dados/eventos';
import { quando } from './ListaEventos.ts';

/**
 * A faixa "Próxima atividade" da home.
 *
 * A inscrição em evento é o que a ONG chamou de indispensável, e até
 * 06/10/2026 o caminho dela passava por DOIS toques: home → Agenda →
 * "Quero me inscrever". Aqui são um só, na primeira dobra do conteúdo.
 *
 * NÃO DESENHA NADA SEM EVENTO. Uma faixa "Próxima atividade: em breve" seria
 * texto inventado (regra 2) e, pior, ocuparia o lugar mais caro da home
 * dizendo que não há o que fazer. `listarProximos()` só devolve evento
 * PUBLICADO e FUTURO, então "existe evento" e "dá para se inscrever" são a
 * mesma coisa — a mesma conta de `inscricoesAbertas` em /agenda.
 *
 * Escrito com createElement (arquivo `.ts`): testável com react-dom/server
 * pelo runtime nativo do Node, como ListaEventos.ts.
 */
export function ProximaAtividade({ evento }: { evento: Evento | null | undefined }) {
  if (!evento) return null;

  return createElement(
    'section',
    { 'aria-labelledby': 'titulo-proxima-atividade', className: 'proxima-atividade' },
    createElement('h2', { id: 'titulo-proxima-atividade' }, 'Próxima atividade'),
    createElement(
      'div',
      { className: 'proxima-atividade__cartao' },
      createElement('p', { className: 'proxima-atividade__quando' },
        createElement('time', { dateTime: evento.comeca_em }, quando(evento.comeca_em)),
        evento.local ? ` · ${evento.local}` : null
      ),
      createElement('h3', { className: 'proxima-atividade__titulo' }, evento.titulo),
      evento.faixa_etaria
        ? createElement('p', { className: 'proxima-atividade__para' }, `Para: ${evento.faixa_etaria}`)
        : null,
      createElement(
        'p',
        { className: 'proxima-atividade__acoes' },
        createElement('a', { className: 'botao', href: `/agenda/${evento.id}/inscricao` },
          'Quero me inscrever',
          createElement('span', { className: 'apenas-leitor-de-tela' }, ` em ${evento.titulo}`)
        ),
        ' ',
        createElement('a', { className: 'botao botao--secundario', href: '/agenda' }, 'Ver a agenda')
      )
    )
  );
}
