import { createElement } from 'react';

// O mesmo fuso de componentes/ListaEventos.ts: a data é a da ONG, não a do
// aparelho de quem lê — uma oficina às 22h de sábado em São Paulo não pode
// virar "domingo" para quem abre o site de fora do fuso.
const FUSO_DA_ONG = 'America/Sao_Paulo';

/**
 * As três partes do selo — "SÁB", "18", "OUT" — e a frase inteira para o
 * leitor de tela. Função pura, exportada para os testes.
 */
export function partesDaData(iso: string) {
  const data = new Date(iso);
  const parte = (opcoes: Intl.DateTimeFormatOptions) =>
    data.toLocaleDateString('pt-BR', { ...opcoes, timeZone: FUSO_DA_ONG });

  const semPonto = (texto: string) => texto.replace('.', '').toUpperCase();

  return {
    semana: semPonto(parte({ weekday: 'short' })).slice(0, 3),
    dia: parte({ day: 'numeric' }),
    mes: semPonto(parte({ month: 'short' })).slice(0, 3),
    porExtenso: parte({ weekday: 'long', day: 'numeric', month: 'long' })
  };
}

/**
 * O selo de data do novo layout (Análise UX-UI: "Próxima atividade",
 * cartão de evento, inscrição).
 *
 * OCRE SÓ NO DESTAQUE. A regra de cor do layout novo diz que o ocre é de
 * "ação, estado ativo, contagem e DATA" — mas, numa lista de dez eventos,
 * dez quadrados ocre voltariam a ser o topo ocre que a análise tirou.
 * `destaque` (o próximo evento) é ocre; os demais são creme.
 *
 * O que se VÊ ("SÁB 18 OUT") é `aria-hidden`; o leitor de tela ouve a data
 * por extenso ("sábado, 18 de outubro"), que é o que se diria em voz alta.
 */
export function SeloDeData({ iso, destaque = false, grande = false }: {
  iso: string;
  destaque?: boolean;
  grande?: boolean;
}) {
  const { semana, dia, mes, porExtenso } = partesDaData(iso);
  const classes = ['af-selo', destaque ? 'af-selo--destaque' : null, grande ? 'af-selo--grande' : null]
    .filter(Boolean).join(' ');

  return createElement(
    'time',
    { className: classes, dateTime: iso },
    createElement('span', { className: 'af-selo__semana', 'aria-hidden': 'true' }, semana),
    createElement('span', { className: 'af-selo__dia', 'aria-hidden': 'true' }, dia),
    createElement('span', { className: 'af-selo__mes', 'aria-hidden': 'true' }, mes),
    createElement('span', { className: 'apenas-leitor-de-tela' }, porExtenso)
  );
}
