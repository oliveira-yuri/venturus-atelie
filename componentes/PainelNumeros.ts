import { createElement } from 'react';
// SÓ O TIPO, e é isso que torna este arquivo importável por um teste do
// Node: `import type` é apagado antes de executar, então o alias `@/...`
// — que o runtime nativo do Node não resolve — nunca precisa ser resolvido.
// Um import de VALOR com o mesmo alias mataria o teste em
// ERR_MODULE_NOT_FOUND antes do primeiro assert (medido na Tarefa P4, e
// escrito no cabeçalho de compartilhado/triagem-de-contatos.ts).
import type { Indicador } from '@/compartilhado/indicadores';

/**
 * Os números da home do painel (RF30) — a seção "o que está acontecendo",
 * abaixo da lista de telas.
 *
 * ===================================================================
 * ELES FICAM DEPOIS DAS TELAS, E ISSO É A DECISÃO DE DESENHO
 * ===================================================================
 *
 * A tentação é abrir o painel com os números, como fazia o painel do site
 * antigo (`git show main:site/admin/index.html`, seção "Este mês"). Num
 * celular de 375px, o que está em cima é o que se vê sem rolar — e a
 * primeira coisa que a equipe precisa alcançar é a TELA onde ela vai
 * trabalhar, não o retrato do trabalho. Seis números no topo empurrariam os
 * quatro cartões para baixo da dobra, e a home passaria a exigir uma rolagem
 * para fazer aquilo que ela existe para fazer.
 *
 * Os números continuam valendo porque respondem a outra pergunta, que vem
 * DEPOIS: "tem alguém esperando?".
 *
 * ===================================================================
 * REGRA 1 DO CLAUDE.md, APLICADA A UM PAINEL DE NÚMEROS
 * ===================================================================
 *
 * O Ateliê é organização de arte, cultura e identidade do povo negro — não é
 * ONG assistencialista. Uma seção de indicadores é onde a estética errada
 * entra sem ninguém perceber, porque chega vestida de gestão: um contador
 * grande de "vidas impactadas", um número que sobe para comover.
 *
 * Aqui NENHUM número conta pessoa como resultado: todos contam item de
 * trabalho — mensagem por responder, texto por publicar, foto por pôr no
 * ar. A lista e os rótulos moram em compartilhado/indicadores.ts, e
 * `testes/indicadores.test.mjs` varre aqueles rótulos contra o mesmo
 * vocabulário que testes/paginas.test.mjs recusa nas páginas públicas.
 *
 * ===================================================================
 * ZERO É RESPOSTA. TRAÇO NÃO É ZERO.
 * ===================================================================
 *
 * "0 mensagens esperando" é informação boa: ninguém está esperando, pode
 * fechar o celular. Por isso o zero é desenhado como número, sem cara de
 * erro e sem esconder o item.
 *
 * `quantidade === null` é outra coisa — "não deu para contar" — e desenha um
 * traço, com o aviso abaixo da lista. A distinção existe porque um zero
 * inventado numa falha de banco faria a equipe deixar de responder gente que
 * está esperando. É a mesma lição do `degradou` de
 * componentes/ListaContatos.ts, aplicada a um número em vez de a uma lista.
 */

export type PropsPainelNumeros = {
  /** Os números já contados — o que servidor/dados/indicadores.ts devolve. */
  indicadores: Indicador[];
};

/**
 * O título da seção e a frase que explica o que estes números são.
 *
 * "Neste instante" importa: sem isso, a leitura natural de um painel é que
 * os números são de algum período ("Este mês", como no site antigo), e a
 * equipe começaria a comparar semanas com um dado que não é isso.
 */
export const TITULO_DOS_NUMEROS = 'Os números de agora';

export const EXPLICACAO_DOS_NUMEROS = 'Contados no banco de dados neste instante — não é '
  + 'total do mês. Toque num número para abrir a tela que resolve.';

/**
 * O que aparece no lugar do algarismo quando não deu para contar.
 *
 * Um traço, e não "0" nem "?": o zero seria mentira, e a interrogação parece
 * pergunta. O traço não afirma nada, e o aviso abaixo da lista é quem
 * explica — a diferença nunca fica só no símbolo.
 */
export const SEM_NUMERO = '—';

/**
 * O aviso de que algum número não foi contado.
 *
 * DIZ O QUE NÃO ACONTECEU ("nada se perdeu"), porque a leitura natural de um
 * traço na tela do painel é "quebrou, e talvez eu tenha perdido alguma
 * coisa". Nenhum destes números guarda estado: são contagem do que já está
 * no banco.
 */
export const AVISO_DE_CONTAGEM_FALHA = 'Os números marcados com um traço não puderam ser '
  + 'contados agora — o banco de dados não respondeu a essa pergunta. Nada se perdeu, e as '
  + 'telas acima continuam funcionando: tente de novo daqui a pouco.';

export function PainelNumeros({ indicadores }: PropsPainelNumeros) {
  // Nenhum número para desenhar é nenhuma seção. Não acontece hoje (a lista
  // é fixa), mas uma seção com título e nada embaixo é pior que ausência.
  if (indicadores.length === 0) return null;

  const algumFalhou = indicadores.some((indicador) => indicador.quantidade === null);

  return createElement(
    'section',
    { className: 'painel__numeros', 'aria-labelledby': 'numeros-do-painel' },
    createElement('h2', { className: 'painel__secao', id: 'numeros-do-painel' }, TITULO_DOS_NUMEROS),
    createElement('p', { className: 'painel__numeros-explicacao' }, EXPLICACAO_DOS_NUMEROS),
    createElement(
      'ul',
      { className: 'numeros' },
      indicadores.map((indicador) => createElement(
        'li',
        {
          // `--largo` marca o item que ocupa a LINHA INTEIRA da grade: quem
          // não tem tela carrega uma frase explicando onde a coisa se
          // resolve, e essa frase não cabe numa coluna de ~190px a 375px.
          //
          // A marca está no `<li>`, e não deduzida no CSS a partir do
          // conteúdo, porque `:has()` NÃO PODE SER ANINHADO — medido nesta
          // tarefa: `.numeros__item:has(+ .numeros__item:has(.numeros__sem-tela))`
          // é seletor inválido, não aplica nada, e o buraco na grade
          // continuava lá sem erro nenhum. Com a classe, a regra do vizinho
          // (em estilos/admin.css) usa um `:has()` de um nível só.
          className: indicador.caminho ? 'numeros__item' : 'numeros__item numeros__item--largo',
          key: indicador.chave
        },
        indicador.caminho
          // O CARTÃO INTEIRO É O ALVO, como na lista de telas: no celular, de
          // pé, o dedo não pode precisar acertar o algarismo (regra 4). E o
          // número vem ANTES do rótulo no HTML porque é a ordem em que se
          // lê — inclusive em leitor de tela, que anuncia "3, mensagens
          // esperando resposta".
          ? createElement(
            'a',
            { className: 'numeros__alvo', href: indicador.caminho },
            createElement('span', { className: 'numeros__valor' }, textoDoNumero(indicador)),
            createElement('span', { className: 'numeros__rotulo' }, indicador.rotulo)
          )
          // SEM <a> E SEM href quando não há tela — é a mesma regra de
          // componentes/PainelInicio.ts, e pelo mesmo motivo: um link que
          // devolve 404 dentro do painel foi o defeito do site antigo. O
          // caminho que existe de verdade está escrito na frase abaixo do
          // rótulo (hoje, o arquivo em CSV desta mesma tarefa).
          : createElement(
            'div',
            { className: 'numeros__alvo numeros__alvo--sem-tela' },
            createElement('span', { className: 'numeros__valor' }, textoDoNumero(indicador)),
            createElement('span', { className: 'numeros__rotulo' }, indicador.rotulo),
            indicador.semTela
              ? createElement('span', { className: 'numeros__sem-tela' }, indicador.semTela)
              : null
          )
      ))
    ),
    // O aviso aparece UMA VEZ, abaixo da lista, e só quando algum número
    // falhou — repetir "não deu para contar" em cada traço é ruído para quem
    // enxerga e uma leitura a mais, por item, para quem usa leitor de tela.
    // Mesma decisão do aviso de componentes/PainelInicio.ts.
    algumFalhou
      ? createElement('p', { className: 'painel__aviso' }, AVISO_DE_CONTAGEM_FALHA)
      : null
  );
}

/**
 * O que aparece no lugar do algarismo.
 *
 * A comparação é com `null`, explicitamente. Um `indicador.quantidade || '—'`
 * transformaria ZERO em traço — que é exatamente o engano que este
 * componente existe para não cometer.
 */
function textoDoNumero(indicador: Indicador): string {
  return indicador.quantidade === null ? SEM_NUMERO : String(indicador.quantidade);
}
