import { createElement } from 'react';
// IMPORT RELATIVO, e não o alias `@/`, e a diferença não é de estilo.
// Este é um import de RUNTIME (`frasePaginacao` é função, não tipo), e o
// runtime nativo do Node — que é como os testes montam os componentes `.ts`
// deste projeto — não resolve o alias do tsconfig. Com `@/`, o teste morre
// com ERR_MODULE_NOT_FOUND antes de desenhar qualquer coisa, e a paginação
// ficaria sem verificação nenhuma. MEDIDO ao escrever este componente.
//
// Os `import type` de outros componentes podem usar `@/` porque o Node os
// apaga antes de resolver.
import { frasePaginacao, type NomeDaFila, type Paginacao } from '../compartilhado/paginacao.ts';

/**
 * A navegação entre páginas das filas do painel (pedido V1).
 *
 * =====================================================================
 * SÃO LINKS, E NÃO BOTÕES COM SCRIPT
 * =====================================================================
 *
 * `<a href="?pagina=2">`. Navegação comum: funciona sem JavaScript, o
 * botão voltar do navegador faz o que se espera, e a URL de uma página
 * específica pode ser mandada por WhatsApp para outra pessoa da equipe.
 * Um `onClick` que trocasse estado perderia as três coisas.
 *
 * =====================================================================
 * A FRASE COM O TOTAL VEM PRIMEIRO, E É OBRIGATÓRIA
 * =====================================================================
 *
 * `servidor/dados/contatos.ts` já dizia, antes de haver paginação, que um
 * corte só é aceitável "com o TOTAL ESCRITO NA TELA, nunca um corte
 * silencioso". Este componente é o lugar onde essa promessa se cumpre — e
 * por isso a frase não é opcional nem some quando há uma página só. Uma
 * paginação que diz apenas "próxima" é o corte silencioso com outra roupa.
 *
 * Quando há uma página só, os controles somem e a frase FICA: "12
 * mensagens, todas nesta tela" é informação, e é o que impede a equipe de
 * ficar procurando um botão de próxima que não existe.
 *
 * =====================================================================
 * O QUE ELE PRESERVA DA URL
 * =====================================================================
 *
 * `parametros` carrega o que mais estiver na URL (o filtro de situação, por
 * exemplo). Sem isso, ir para a página 2 apagaria o filtro — e a equipe
 * veria uma lista diferente da que estava lendo, sem entender por quê.
 *
 * Escrito com createElement (arquivo `.ts`, não `.tsx`) pelo mesmo motivo
 * de CardAtividade.ts e VerMais.ts: assim o runtime nativo do Node o
 * importa e o teste o renderiza de verdade, sem subir o Next.
 */
export function Paginacao(
  { paginacao, nome, parametros }: {
    paginacao: Paginacao;
    nome: NomeDaFila;
    /** O resto da URL a preservar entre páginas (filtros). */
    parametros?: Record<string, string>;
  }
) {
  function enderecoDaPagina(numero: number): string {
    const busca = new URLSearchParams(parametros ?? {});
    // A página 1 não leva `?pagina=1` — o endereço limpo é o que a equipe
    // copia e manda para outra pessoa.
    if (numero > 1) busca.set('pagina', String(numero));
    const texto = busca.toString();
    return texto ? `?${texto}` : '?';
  }

  const controles = paginacao.totalDePaginas > 1
    ? createElement(
      'div',
      { className: 'paginacao__controles' },

      paginacao.temAnterior
        ? createElement(
          'a',
          { className: 'paginacao__link', href: enderecoDaPagina(paginacao.pagina - 1),
            rel: 'prev' },
          '← Anteriores'
        )
        // Um `<span>` no lugar do link, e não nada: sem ele os dois
        // controles pulam de lugar entre a primeira página e as outras, e
        // o dedo que ia em "Próximas" acerta "Anteriores".
        : createElement('span', { className: 'paginacao__link paginacao__link--inerte' },
          '← Anteriores'),

      createElement(
        'span',
        { className: 'paginacao__onde' },
        `Página ${paginacao.pagina} de ${paginacao.totalDePaginas}`
      ),

      paginacao.temProxima
        ? createElement(
          'a',
          { className: 'paginacao__link', href: enderecoDaPagina(paginacao.pagina + 1),
            rel: 'next' },
          'Próximas →'
        )
        : createElement('span', { className: 'paginacao__link paginacao__link--inerte' },
          'Próximas →')
    )
    : null;

  return createElement(
    'nav',
    { className: 'paginacao', 'aria-label': `Páginas de ${nome.plural}` },
    createElement('p', { className: 'paginacao__frase' }, frasePaginacao(paginacao, nome)),
    controles
  );
}
