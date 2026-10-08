import { createElement, type ReactNode } from 'react';

/**
 * O topo de toda página do novo layout: sobretítulo → H1 → lead.
 *
 * Análise UX-UI, "Anatomia padrão de página" (2b): até aqui cada página
 * montava o próprio `<h1>` + `<p class="destaque">` com espaçamento e
 * tamanho seus — e a borda à esquerda do `.destaque` repetia, em quarenta
 * páginas, um enfeite que não dizia nada. Um componente só faz as quarenta
 * falarem igual, e é a primeira coisa que a Fase 5 do plano aplica.
 *
 * O SOBRETÍTULO É A SEÇÃO DO MENU a que a página pertence ("Conhecer",
 * "Participar", "Ler" — os grupos de componentes/MenuMovel.tsx), e não um
 * texto novo: ele diz à pessoa onde ela está sem inventar frase nenhuma
 * (regra 2). Opcional, como o lead: página sem lead não ganha um.
 *
 * O `id` vai no <h1> para `aria-labelledby` de quem quiser apontar para
 * ele. `FocoNaNavegacao` acha o <h1> sozinho, sem precisar do id.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo de
 * CampoFormulario: o runtime nativo do Node o importa, e os testes o
 * renderizam sem subir o Next.
 */
export function CabecalhoDaPagina({ sobretitulo, titulo, lead, id, children }: {
  sobretitulo?: string | null;
  titulo: ReactNode;
  lead?: ReactNode;
  id?: string;
  /** Ação principal da página, quando há (anatomia: logo abaixo do lead). */
  children?: ReactNode;
}) {
  return createElement(
    'header',
    { className: 'af-cabecalho-pagina' },
    sobretitulo
      ? createElement('p', { className: 'af-overline af-cabecalho-pagina__sobre' }, sobretitulo)
      : null,
    createElement('h1', { className: 'af-h1', id }, titulo),
    lead ? createElement('p', { className: 'af-cabecalho-pagina__lead' }, lead) : null,
    children ? createElement('div', { className: 'af-cabecalho-pagina__acao' }, children) : null
  );
}
