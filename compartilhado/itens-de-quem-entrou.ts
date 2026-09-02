/**
 * compartilhado/itens-de-quem-entrou.ts — quais itens de menu existem além
 * dos 11 que valem para toda visita, e para quem.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como `triagem-de-contatos.ts`, `avisos-do-painel.ts` e
 * `permissao-de-equipe.ts`: assim os testes conseguem importá-lo pelo
 * runtime nativo do Node, que despe tipos de `.ts` mas NÃO transforma JSX.
 *
 * Isso importa mais aqui do que parece. `componentes/MenuMovel.tsx` é
 * `.tsx`, e o Node recusa importá-lo — então a decisão "quem vê o quê"
 * ficaria sem verificação nenhuma se morasse lá dentro, justamente numa
 * parte do menu que a suíte não alcança pelo caminho normal (não há sessão
 * de equipe nela). Aqui ela é função pura e se prova com uma tabela.
 *
 * ===================================================================
 * ESTES ITENS NÃO ESTÃO EM `ITENS`, E ISSO É DECISÃO
 * ===================================================================
 *
 * `ITENS`, em MenuMovel, é a navegação que vale para TODA visita — é ela
 * que `testes/links-menu.test.mjs` reconcilia contra as rotas do projeto e
 * que `testes/cabecalho.test.mjs` conta como 11. Um item condicional ali
 * dentro faria os dois testes medirem um número que muda conforme quem
 * olha, e o número deixaria de significar alguma coisa.
 *
 * ===================================================================
 * NADA AQUI AUTORIZA COISA ALGUMA
 * ===================================================================
 *
 * Esta função decide o que DESENHAR. Quem decide o que pode ser lido ou
 * gravado é `ehEquipe()` na própria página do painel e a RLS no banco
 * (regras 5 e 6 do CLAUDE.md). Um `true` forjado aqui daria à pessoa um
 * link para uma tela que responde 404 para ela — e mais nada.
 */

export type ItemDeMenu = {
  texto: string;
  href: string;
  /** Classe extra, para o CSS distinguir os dois. */
  classe: string;
};

/**
 * "Minha conta" já é alcançável pelo nome de quem entrou, no cabeçalho, e
 * continua sendo — aqui ela ganha o segundo caminho que o pedido V1 pede.
 *
 * Para quem NÃO tem sessão ela não aparece: aquela rota só redirecionaria
 * para /entrar, e "Entrar" já está no topo de toda página.
 */
export const ITEM_MINHA_CONTA: ItemDeMenu = {
  texto: 'Minha conta',
  href: '/minha-conta',
  classe: 'af-navlink--conta'
};

/**
 * "Painel da equipe" só existe para quem é equipe — e isso é o que mantém
 * a promessa de `/admin`, que responde 404 para quem não é justamente para
 * não contar que existe. Um link no menu de toda visita desfaria isso.
 */
export const ITEM_PAINEL: ItemDeMenu = {
  texto: 'Painel da equipe',
  href: '/admin',
  classe: 'af-navlink--painel'
};

/**
 * A tabela inteira, em uma linha:
 *
 *   sem sessão            → nada
 *   com sessão            → Minha conta
 *   com sessão + equipe   → Minha conta, Painel da equipe
 *
 * SER EQUIPE SEM SESSÃO É IMPOSSÍVEL, e a função trata isso: `ehEquipe`
 * sozinho não desenha nada. Não é defensivo à toa — `app/layout.tsx` só
 * pergunta `ehEquipe()` quando há sessão, e se um dia essa ordem mudar, o
 * menu não passa a oferecer o painel a quem não entrou.
 */
export function itensDeQuemEntrou(temSessao: boolean, ehEquipe: boolean): ItemDeMenu[] {
  if (!temSessao) return [];
  return ehEquipe ? [ITEM_MINHA_CONTA, ITEM_PAINEL] : [ITEM_MINHA_CONTA];
}
