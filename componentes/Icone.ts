import { createElement } from 'react';

/**
 * Os ícones dos canais de contato e das redes (pedido V1).
 *
 * =====================================================================
 * SVG INLINE, DESENHADO À MÃO. SEM BIBLIOTECA, SEM ARQUIVO EXTERNO.
 * =====================================================================
 *
 * A regra 7 do CLAUDE.md proíbe biblioteca de componentes, e uma coleção
 * de ícones é exatamente isso. Um arquivo `.svg` por ícone custaria uma
 * requisição cada, em rede móvel (RNF11), para desenhos de trezentos
 * bytes. Inline, eles viajam com o HTML que já está sendo baixado.
 *
 * O handoff do design system diz, com todas as letras: "Não há ícones — o
 * sistema é tipográfico por decisão de design." O pedido V1 pede ícones
 * nas redes e nos canais. Os dois cabem porque estes ícones são
 * ORNAMENTO DE APOIO, não linguagem: eles acompanham um rótulo escrito,
 * herdam a cor do texto (`currentColor`) e nunca aparecem sozinhos.
 * Ninguém precisa reconhecer o desenho para usar a página.
 *
 * =====================================================================
 * `aria-hidden`, SEMPRE — E É POR ISSO QUE ELES PODEM EXISTIR
 * =====================================================================
 *
 * Todo ícone aqui é decoração de um texto que já diz a mesma coisa
 * ("Instagram", "WhatsApp"). Anunciá-lo faria o leitor de tela dizer a
 * palavra duas vezes. Um ícone que PRECISASSE ser anunciado seria um
 * ícone carregando informação sozinho — e aí ele não poderia ser
 * decorativo, nem existir sem rótulo.
 *
 * =====================================================================
 * `currentColor` E NADA DE `fill` FIXO
 * =====================================================================
 *
 * Em alto contraste os tokens viram preto e branco (estilos/tokens.css).
 * Um ícone com cor fixa sobreviveria à inversão e ficaria invisível —
 * ou pior, legível só para quem não precisa do alto contraste.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo de
 * QrCodeDeTeste.ts: o runtime nativo do Node o importa e o teste
 * renderiza de verdade, sem subir o Next.
 */

/**
 * Os traçados, em caixa de 24×24.
 *
 * São desenhos SIMPLIFICADOS, e isso é deliberado: as marcas do Instagram,
 * do TikTok e do YouTube são propriedade de terceiros, com regras de uso
 * próprias. O que está aqui é a forma genérica que se reconhece — uma
 * câmera, uma nota musical, um triângulo de "play" — e não o logotipo
 * deles. Copiar o logotipo exato seria usar marca alheia sem licença, num
 * site de uma ONG.
 */
const TRACOS: Record<string, string> = {
  // Fone de ouvido/telefone clássico.
  telefone: 'M6.6 3.5 4 6.1c-.6.6-.7 1.5-.3 2.2 2.4 4.6 6.2 8.4 10.8 10.8.7.4 1.6.3 2.2-.3'
    + 'l2.6-2.6c.5-.5.5-1.2 0-1.7l-2.7-2.7c-.5-.5-1.2-.5-1.7 0l-1 1c-1.9-1-3.5-2.6-4.5-4.5'
    + 'l1-1c.5-.5.5-1.2 0-1.7L8.3 3.5c-.5-.5-1.2-.5-1.7 0Z',
  // Balão de conversa.
  whatsapp: 'M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 2a7 7 0 1 1-3.6 13'
    + 'l-.4-.2-2.4.6.7-2.3-.2-.4A7 7 0 0 1 12 5Z',
  // Envelope.
  email: 'M3 6h18v12H3V6Zm2 2v.4l7 4.4 7-4.4V8H5Zm14 8v-5.2l-6.5 4.1a1 1 0 0 1-1 0L5 10.8V16h14Z',
  // Câmera quadrada com lente — a forma genérica, não o logotipo.
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 2'
    + 'a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7Zm5 3a4 4 0 1 1 0 8'
    + 'a4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5-3.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z',
  // Nota musical.
  tiktok: 'M10 4h2.2c.3 2 1.7 3.5 3.8 3.8V10c-1.5-.1-2.8-.6-3.8-1.4V15a5 5 0 1 1-5-5'
    + 'c.3 0 .7 0 1 .1v2.2A2.8 2.8 0 1 0 10 15V4Z',
  // Retângulo com "play".
  youtube: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Zm2 0v8'
    + 'a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1Zm5 1.5 5 2.5-5 2.5v-5Z',
  // Alfinete de mapa.
  endereco: 'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4.5A2.5 2.5 0 1 0'
    + ' 12 11.5a2.5 2.5 0 0 0 0-5Z'
};

export type NomeDeIcone = keyof typeof TRACOS;

/** Os nomes disponíveis, para o teste reconciliar contra quem os usa. */
export const ICONES_DISPONIVEIS = Object.keys(TRACOS);

export function Icone({ nome }: { nome: string }) {
  const traco = TRACOS[nome];

  // ÍCONE DESCONHECIDO NÃO DESENHA NADA, e não desenha um "?" nem um
  // quadrado: um placeholder visível seria um defeito de código virando
  // enfeite na tela da ONG. O teste de reconciliação é que pega isso, não
  // a página.
  if (!traco) return null;

  return createElement(
    'svg',
    {
      className: 'icone',
      viewBox: '0 0 24 24',
      width: 20,
      height: 20,
      fill: 'currentColor',
      'aria-hidden': 'true',
      focusable: 'false'
    },
    createElement('path', { d: traco })
  );
}
