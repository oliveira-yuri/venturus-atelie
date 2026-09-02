import { createElement } from 'react';
import { Icone } from './Icone.ts';

/**
 * O botão flutuante de WhatsApp (pedido do grupo, `docs/Correções Web
 * Ateliê.txt`).
 *
 * =====================================================================
 * POR QUE ELE VALE A PENA NESTE SITE
 * =====================================================================
 *
 * O WhatsApp é o canal que a ONG lê HOJE, todos os dias — é o argumento
 * que `app/contato/page.tsx` já usa para pôr os canais diretos ACIMA do
 * formulário: "a fila do painel depende de alguém abrir o painel, e o
 * WhatsApp toca no bolso".
 *
 * Um botão fixo tira de quem quer falar a obrigação de achar a página de
 * contato. Numa ONG que opera do celular, isso é a diferença entre a
 * mensagem chegar e não chegar.
 *
 * =====================================================================
 * ELE NÃO PODE COBRIR O VLIBRAS — E O CANTO É COMPARTILHADO
 * =====================================================================
 *
 * A nota do grupo avisa: "o VLibras já ocupa esse canto; empilhar ou
 * trocar de lado, nunca remover o VLibras". Tirar a tradução para caber um
 * botão de conversa seria trocar acessibilidade por conveniência, e a
 * regra 8 não permite.
 *
 * MEDIDO em 02/09/2026, a 390×844: o botão do VLibras fica na borda
 * DIREITA, na altura do meio da tela — não no canto inferior. O canto
 * inferior direito está livre. Ainda assim este botão sobe 1rem além do
 * necessário, e o CSS carrega a conta: se o widget mudar de posição numa
 * versão futura, é a margem que absorve.
 *
 * =====================================================================
 * É UM `<a>`, NÃO UM BOTÃO COM SCRIPT
 * =====================================================================
 *
 * `wa.me` é um endereço comum. Sem JavaScript ele funciona igual, abre o
 * aplicativo no celular e o WhatsApp Web no computador. Um `onClick` que
 * chamasse `window.open` perderia as duas coisas e o "abrir em nova aba".
 *
 * O ÍCONE É DECORATIVO (`aria-hidden`, em componentes/Icone.ts) e o texto
 * acessível está no `aria-label`: sem ele, quem usa leitor de tela ouviria
 * "link" e mais nada. O rótulo VISÍVEL some abaixo de 26rem — não o
 * acessível.
 */
export const WHATSAPP_DA_ONG = 'https://wa.me/5511953968344';

export function BotaoWhatsApp() {
  return createElement(
    'a',
    {
      className: 'zap',
      href: WHATSAPP_DA_ONG,
      rel: 'noopener',
      'aria-label': 'Falar com o Ateliê pelo WhatsApp'
    },
    createElement(Icone, { nome: 'whatsapp' }),
    // O rótulo é escondido por CSS na tela estreita, e não removido do
    // HTML: `display: none` tira do leitor de tela junto, e é por isso que
    // o `aria-label` acima existe — ele é o que sobra em qualquer largura.
    createElement('span', { className: 'zap__texto' }, 'WhatsApp')
  );
}
