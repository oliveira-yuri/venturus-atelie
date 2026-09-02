import { createElement } from 'react';

/**
 * O mapa da sede (pedido V1: "a parte de onde estamos colocar o mapa do
 * google também, igual na página inicial").
 *
 * =====================================================================
 * ISTO É A PRIMEIRA DEPENDÊNCIA DE TERCEIRO DO SITE FORA DO VLIBRAS
 * =====================================================================
 *
 * Quem abre uma página com este componente passa a fazer uma requisição ao
 * Google. É uma escolha com preço, tomada pelo dono do projeto, e ela
 * aparece em três lugares que precisam andar juntos:
 *
 *   1. aqui, no componente;
 *   2. `frame-src https://www.google.com` na política de conteúdo
 *      (middleware.ts) — sem ela o iframe é bloqueado e fica em branco,
 *      sem erro nenhum na tela;
 *   3. `/privacidade`, que passa a dizer que isso acontece — a política
 *      promete contar quem recebe dado de quem visita, e um mapa que
 *      chama o Google em silêncio quebraria a promessa.
 *
 * Há teste que falha se a linha da privacidade sumir enquanto o mapa
 * existir.
 *
 * =====================================================================
 * `loading="lazy"` NÃO É OTIMIZAÇÃO AQUI — É REDUÇÃO DE EXPOSIÇÃO
 * =====================================================================
 *
 * O iframe só é buscado quando a pessoa rola até ele. Quem abre /contato,
 * lê o WhatsApp no topo e sai NUNCA faz a requisição ao Google. O ganho de
 * banda em rede móvel (RNF11) é real, mas o motivo principal é esse.
 *
 * =====================================================================
 * O ENDEREÇO EM TEXTO CONTINUA, E VEM ANTES
 * =====================================================================
 *
 * O mapa é ACRÉSCIMO, nunca substituição. Quem está sem JavaScript, com o
 * iframe bloqueado por uma extensão, ou usando leitor de tela, precisa do
 * endereço escrito — que já está nas duas páginas, e continua acima do
 * mapa. Por isso o `<iframe>` é `aria-hidden`: ele não acrescenta
 * informação nenhuma a quem não vê, e anunciá-lo como "quadro" no meio da
 * leitura só atrapalha.
 *
 * `title` no iframe mesmo assim: é exigência de HTML para iframe, e alguns
 * navegadores o expõem no menu de contexto.
 */

/**
 * O endereço da sede, codificado para a URL do embed.
 *
 * É o MESMO endereço que /contato e /quem-somos escrevem em texto —
 * "Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP". Divergir aqui
 * poria a ONG num lugar errado no mapa sem que ninguém percebesse, e há
 * teste que reconcilia os dois.
 */
export const ENDERECO_DA_SEDE = 'Rua Dr. Paulo Gatti, 135 - Vila Romero, São Paulo - SP, 02468-030';

/**
 * O embed SEM CHAVE DE API, de propósito.
 *
 * `google.com/maps?output=embed&q=<endereço>` funciona sem credencial
 * nenhuma. A alternativa (`/maps/embed/v1/place`) exige uma chave de API
 * que teria de ser embutida no HTML — ou seja, pública — e este projeto
 * não põe credencial no cliente, por regra (spec §4.1).
 */
export function enderecoDoMapa(endereco = ENDERECO_DA_SEDE): string {
  return `https://www.google.com/maps?output=embed&q=${encodeURIComponent(endereco)}`;
}

export function Mapa({ endereco = ENDERECO_DA_SEDE }: { endereco?: string }) {
  return createElement(
    'div',
    { className: 'mapa' },
    createElement('iframe', {
      className: 'mapa__quadro',
      src: enderecoDoMapa(endereco),
      title: 'Mapa da sede do Ateliê Afro Cultural',
      loading: 'lazy',
      referrerPolicy: 'no-referrer-when-downgrade',
      'aria-hidden': 'true',
      // `tabIndex={-1}` junto com `aria-hidden`: sem ele o iframe continua
      // recebendo Tab, e quem navega por teclado cai dentro de um quadro
      // que o leitor de tela não anuncia — sai sem saber onde está.
      tabIndex: -1
    }),
    createElement(
      'p',
      { className: 'mapa__aviso' },
      'O mapa acima é carregado pelo Google. Se ele não aparecer, o endereço está escrito '
      + 'logo acima.'
    )
  );
}
