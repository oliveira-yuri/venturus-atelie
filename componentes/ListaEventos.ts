import { createElement } from 'react';
import type { Evento } from '@/servidor/dados/eventos';

/**
 * Lista de eventos de uma seção da agenda (RF14) — "Em breve" ou "Já
 * aconteceu" — ou o estado vazio.
 *
 * Porta a parte de apresentação de site/assets/js/paginas/agenda.js
 * (desenharEventos + a mensagem de estado vazio de cada seção): a busca
 * dos dados agora mora em servidor/dados/eventos.ts, chamada direto pelo
 * servidor em app/agenda/page.tsx — sem round-trip no navegador.
 *
 * DECISÃO DA TAREFA A4, DIFERENTE DE componentes/SecaoNaMidia.ts E
 * componentes/SecaoOndeEstivemos.ts: aqueles dois componentes OMITEM a
 * seção inteira quando a lista vem vazia (regra 2 do CLAUDE.md: "campo sem
 * dado fica null e a página omite a seção"). Aqui a tabela `eventos` está
 * vazia hoje e continua assim até o Bloco B/C — a lista vazia é o caso
 * NORMAL, não uma exceção. Omitir a seção deixaria a página com só um
 * <h2> "Em breve" e nada embaixo, o mesmo defeito ("título sem conteúdo")
 * que motivou aquela regra, só que ao contrário: aqui é a AUSÊNCIA da
 * seção que ficaria estranha, porque o título continua fazendo sentido
 * sozinho ("ainda não agendamos nada, mas a seção existe"). Por isso este
 * componente sempre desenha algo — os cartões, ou um parágrafo
 * `.estado.estado--vazio` com texto real (os quatro textos do relatório da
 * Tarefa A4, aprovados por quem coordena antes de fechar a tarefa) — nunca
 * nada.
 *
 * NÃO PORTA o botão "Quero me inscrever" (RF15): no site antigo ele
 * apontava para `/inscricao.html?evento=...`. RF15 é Bloco B — a página de
 * inscrição ainda não existe no app novo, e um link para ela quebraria a
 * regra "next/link só para rota que existe" (restrição global 4) assim
 * que o primeiro evento for publicado. Decisão: o botão nasce junto com a
 * página de inscrição, não antes.
 *
 * Escrito com createElement, não JSX — mesmo motivo de CardAtividade.ts:
 * fica um .ts puro, sem nada que só funcione dentro de uma requisição do
 * Next, testável com react-dom/server pelo runtime nativo do Node (que
 * despe os tipos mas não transforma JSX) — ver testes/lista-eventos.test.mjs.
 */

/**
 * Data e hora por extenso, como uma pessoa escreveria — mesma função de
 * site/assets/js/paginas/agenda.js. Usa o fuso do processo que renderiza
 * (sem `timeZone` explícito, igual ao original): NÃO MEDIDO qual fuso o
 * servidor de produção usa: assumir UTC do host seria inventar um dado que
 * este porte não verificou.
 */
function quando(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, às ${hora}`;
}

export function ListaEventos({ eventos, mensagemVazio }: { eventos: Evento[]; mensagemVazio: string }) {
  if (eventos.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  return createElement(
    'div',
    { className: 'lista-atividades' },
    eventos.map((evento) =>
      createElement(
        'article',
        { className: 'atividade', id: evento.id, key: evento.id },
        createElement('h3', { className: 'atividade__titulo' }, evento.titulo),
        createElement(
          'p',
          { className: 'atividade__resumo' },
          createElement('time', { dateTime: evento.comeca_em }, quando(evento.comeca_em)),
          evento.local ? ` · ${evento.local}` : null
        ),
        evento.descricao ? createElement('p', null, evento.descricao) : null,
        evento.faixa_etaria
          ? createElement('p', null, createElement('strong', null, 'Para:'), ` ${evento.faixa_etaria}`)
          : null
      )
    )
  );
}
