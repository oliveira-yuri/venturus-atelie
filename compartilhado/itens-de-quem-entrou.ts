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
 * "Mural de avisos" só existe para quem JÁ É voluntário — `situacao =
 * 'ativo'`, o mesmo recorte de `public.eh_voluntario_ativo()` (migration
 * 012), que é o mesmo que a política da tabela usa.
 *
 * NÃO É `temSessao` que decide, e a diferença é o item inteiro. Qualquer
 * pessoa com conta pode se candidatar, e a maioria das candidaturas está
 * em `novo` esperando a equipe conversar. Um item de menu para essas
 * pessoas levaria a uma tela que diz "isto ainda não é para você" — que é
 * pior que não ter item nenhum: parece uma porta fechada na cara.
 *
 * O PREÇO ESTÁ NO LAYOUT, e é uma consulta a mais por página para quem
 * está autenticado. Está escrita lá, ao lado da de `ehEquipe()`, e roda em
 * paralelo com ela.
 */
export const ITEM_AVISOS: ItemDeMenu = {
  texto: 'Mural de avisos',
  href: '/avisos',
  classe: 'af-navlink--avisos'
};

/**
 * A tabela inteira, em uma linha:
 *
 *   sem sessão                  → nada
 *   com sessão                  → Minha conta
 *   com sessão + voluntário     → Minha conta, Mural de avisos
 *   com sessão + equipe         → Minha conta, Painel da equipe
 *   com sessão + os dois        → Minha conta, Mural de avisos, Painel
 *
 * A ORDEM É DELIBERADA e vai do que alcança mais gente para o que alcança
 * menos: a conta é de qualquer pessoa autenticada, o mural é de quem
 * voluntaria, o painel é da equipe. Num celular a gaveta é lida de cima
 * para baixo (regra 4), e é o item mais provável que precisa estar no topo.
 *
 * SER EQUIPE OU VOLUNTÁRIO SEM SESSÃO É IMPOSSÍVEL, e a função trata isso:
 * os dois booleanos sozinhos não desenham nada. Não é defensivo à toa —
 * `app/layout.tsx` só faz as duas perguntas quando há sessão, e se um dia
 * essa ordem mudar, o menu não passa a oferecer o painel nem a comunicação
 * interna a quem não entrou.
 *
 * O TERCEIRO PARÂMETRO TEM PADRÃO `false` de propósito: quem chamar com
 * dois argumentos continua recebendo a tabela de antes, e o item novo é
 * omitido — que é o lado seguro de errar num menu que mostra o que existe.
 */
export function itensDeQuemEntrou(
  temSessao: boolean, ehEquipe: boolean, ehVoluntario = false
): ItemDeMenu[] {
  if (!temSessao) return [];

  const itens = [ITEM_MINHA_CONTA];
  if (ehVoluntario) itens.push(ITEM_AVISOS);
  if (ehEquipe) itens.push(ITEM_PAINEL);
  return itens;
}
