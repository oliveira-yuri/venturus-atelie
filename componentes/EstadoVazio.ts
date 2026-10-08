import { createElement, type ReactNode } from 'react';

export type AcaoDoVazio = { texto: string; href: string; externo?: boolean };

/**
 * O estado vazio padrão do novo layout (Análise UX-UI, 2b).
 *
 * "Estado vazio com botões, não texto com instrução": em vez de "acompanhe
 * nossas redes sociais para saber das novidades", os dois botões que levam
 * às redes. Quem chegou numa lista vazia ganha um próximo passo tocável.
 *
 * O TEXTO É DE QUEM CHAMA. O componente não traz frase pronta, de propósito:
 * cada página já tem o próprio texto de estado vazio, escrito com a ONG e
 * travado por `paridade-texto` — um texto padrão aqui o substituiria em
 * silêncio (regra 2).
 *
 * `role="status"` NÃO entra: o vazio é o conteúdo da página quando ela
 * carrega, não uma mudança que precise ser anunciada.
 */
export function EstadoVazio({ titulo, texto, acoes = [] }: {
  titulo: ReactNode;
  texto?: ReactNode;
  acoes?: AcaoDoVazio[];
}) {
  return createElement(
    'div',
    { className: 'af-vazio' },
    createElement('p', { className: 'af-vazio__titulo' }, titulo),
    texto ? createElement('p', { className: 'af-vazio__texto' }, texto) : null,
    acoes.length > 0
      ? createElement(
        'p',
        { className: 'af-vazio__acoes' },
        acoes.map((acao) => createElement('a', {
          key: acao.href,
          className: 'af-btn af-btn--outline af-vazio__acao',
          href: acao.href,
          rel: acao.externo ? 'noopener' : undefined
        }, acao.texto))
      )
      : null
  );
}
