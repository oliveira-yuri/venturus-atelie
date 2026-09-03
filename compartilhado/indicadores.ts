/**
 * compartilhado/indicadores.ts — o RF30: os números da home do painel.
 *
 * ===================================================================
 * PARA QUE SERVE UM NÚMERO AQUI, E PARA QUE ELE NÃO SERVE
 * ===================================================================
 *
 * A home do painel do site antigo abria com uma seção "Este mês" e quatro
 * contadores (`git show main:site/admin/index.html`). Ela não foi portada, e
 * a Tarefa P1 escreveu por que: "um número na tela pede uma consulta, uma
 * consulta pede uma política de erro, e nada disso ajuda a equipe a fazer a
 * única coisa que ela veio fazer aqui: publicar". Esse argumento continua
 * inteiro — o que mudou é que agora existem QUATRO telas de trabalho, e a
 * pergunta que a equipe faz ao abrir o painel deixou de ser "o que eu faço?"
 * para ser "o que está me esperando?".
 *
 * Daí a regra que decidiu esta lista, e ela é a única defesa contra o painel
 * virar vitrine: UM NÚMERO SÓ ENTRA SE MUDAR O QUE A EQUIPE FAZ EM SEGUIDA.
 * "3 mensagens esperando resposta" muda: abre-se /admin/contatos. "12
 * visitas hoje" não muda nada, e nem é medido por este projeto.
 *
 * ===================================================================
 * O QUE ESTÁ PROIBIDO AQUI (regra 1 do CLAUDE.md)
 * ===================================================================
 *
 * O Ateliê é uma organização de ARTE, CULTURA E IDENTIDADE do povo negro —
 * não é ONG assistencialista. Um painel de indicadores é exatamente onde a
 * estética errada entra sem que ninguém perceba, porque ela chega vestida de
 * gestão: "vidas impactadas", "crianças atendidas", "sorrisos", um contador
 * subindo para comover quem olha.
 *
 * NADA DISSO EXISTE NESTA LISTA, e a diferença é verificável, não retórica:
 * todo número abaixo conta um ITEM DE TRABALHO — mensagem por responder,
 * texto por publicar, foto por pôr no ar. Nenhum conta pessoa como
 * resultado. `testes/indicadores.test.mjs` varre os rótulos contra o mesmo
 * vocabulário que testes/paginas.test.mjs recusa nas páginas públicas, e
 * quebra se algum dia um deles entrar aqui.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Mesma razão de compartilhado/avisos-do-painel.ts e triagem-de-contatos.ts:
 * a home do painel responde 404 para quem não é equipe, então o que não
 * couber num teste do Node fica sem verificação nenhuma. As DEFINIÇÕES
 * moram aqui (rótulo, para onde leva, o que dizer quando não há tela); as
 * CONSULTAS moram em servidor/dados/indicadores.ts, que é `server-only`.
 */

/**
 * As chaves. Uma por número, e o servidor precisa ter uma consulta para cada
 * uma — `testes/indicadores.test.mjs` reconcilia as duas listas e quebra se
 * uma chave nascer aqui sem consulta do outro lado.
 */
export type ChaveDeIndicador =
  | 'mensagens-esperando'
  | 'candidaturas-esperando'
  | 'noticias-rascunho'
  | 'fotos-fora-do-ar'
  | 'noticias-no-ar'
  | 'fotos-no-ar';

export type DefinicaoDeIndicador = {
  chave: ChaveDeIndicador;
  /** O que o número conta, na frase que a equipe lê. */
  rotulo: string;
  /**
   * A tela que resolve, quando existe. `null` quando não existe NENHUMA —
   * e aí `semTela` diz o que fazer, porque número sem saída é o beco que a
   * home do painel antigo abriu seis vezes.
   */
  caminho: string | null;
  /** O caminho de quem não tem tela. `null` quando `caminho` existe. */
  semTela: string | null;
};

/**
 * OS SEIS NÚMEROS, NA ORDEM EM QUE A EQUIPE PRECISA DELES.
 *
 * A ordem é a decisão mais importante desta lista, porque num celular de
 * 375px o que está em cima é o que se vê sem rolar:
 *
 *   1-2. GENTE ESPERANDO. Uma pessoa escreveu, ou se candidatou, e está do
 *        outro lado sem resposta. É o único grupo em que a demora custa a
 *        alguém de fora;
 *   3-4. TRABALHO PELA METADE. Texto escrito que não foi ao ar, foto
 *        enviada que não foi ao ar. Ninguém está esperando, mas o esforço
 *        já foi gasto e está parado;
 *   5-6. O QUE O SITE MOSTRA AGORA. Não pede gesto nenhum — existe para a
 *        equipe conferir de relance que o site não está vazio, e para
 *        flagrar o "tirei do ar sem querer" no dia seguinte, que é um risco
 *        real deste painel (os botões de publicar/tirar do ar ficam ao lado
 *        um do outro, num celular, operado de pé).
 *
 * ===================================================================
 * `eventos` FICOU DE FORA, e é a ausência que precisa de explicação
 * ===================================================================
 *
 * A tabela existe, a página /agenda existe e está vazia. Um "Eventos no ar:
 * 0" seria um zero permanente apontando para lugar nenhum: não há tela de
 * cadastro de evento (RF13 não existe), e nem o arquivo em CSV ajudaria —
 * não há o que exportar de uma tabela vazia. Um número que nunca muda e não
 * leva a lugar nenhum é ruído; quando o RF13 existir, a linha entra aqui e
 * ganha `caminho`.
 *
 * `atividades` também ficou de fora, e por outro motivo: as 11 vêm do seed e
 * a tela de /admin/atividades já lista todas com a marca de "no ar" ao lado.
 * O número seria a mesma informação, uma tela antes.
 */
export const INDICADORES: DefinicaoDeIndicador[] = [
  {
    chave: 'mensagens-esperando',
    rotulo: 'Mensagens esperando resposta',
    caminho: '/admin/contatos',
    semTela: null
  },
  {
    chave: 'candidaturas-esperando',
    rotulo: 'Candidaturas de voluntariado sem resposta',
    // A TELA PASSOU A EXISTIR com o RF26 (01/09/2026), e este campo ficou
    // apontando para lugar nenhum por um dia. O texto antigo dizia "não
    // existe tela para ler as candidaturas ainda" — e a tela estava
    // listada na mesma página, três cartões acima.
    //
    // O defeito só apareceu quando alguém OLHOU a home do painel com uma
    // sessão de equipe de verdade, em 03/09/2026. É a regra 10 do
    // CLAUDE.md acontecendo: 1249 testes verdes não pegam uma frase que
    // envelheceu, porque nenhum deles sabe o que a frase deveria dizer.
    caminho: '/admin/voluntarios',
    semTela: null
  },
  {
    chave: 'noticias-rascunho',
    rotulo: 'Notícias escritas e ainda fora do ar',
    caminho: '/admin/publicacoes',
    semTela: null
  },
  {
    chave: 'fotos-fora-do-ar',
    rotulo: 'Fotos enviadas e ainda fora do ar',
    caminho: '/admin/galeria',
    semTela: null
  },
  {
    chave: 'noticias-no-ar',
    rotulo: 'Notícias no ar agora',
    caminho: '/admin/publicacoes',
    semTela: null
  },
  {
    chave: 'fotos-no-ar',
    rotulo: 'Fotos no ar agora',
    caminho: '/admin/galeria',
    semTela: null
  }
];

/**
 * Um indicador com o número já contado.
 *
 * `quantidade: null` NÃO É ZERO, e a distinção é a coisa mais importante
 * deste tipo. Zero é uma resposta — "não há mensagem esperando" — e a equipe
 * fecha o celular tranquila. `null` é "não deu para contar agora", e a
 * equipe precisa saber a diferença: no primeiro caso não há ninguém
 * esperando; no segundo pode haver dez, e o painel só não conseguiu
 * perguntar.
 *
 * É a mesma lição do `degradou` de servidor/dados/contatos.ts, aplicada a um
 * número em vez de a uma lista: uma lista vazia e um zero mentem do mesmo
 * jeito quando a causa é o banco não ter respondido.
 */
export type Indicador = DefinicaoDeIndicador & { quantidade: number | null };

/*
 * O TRAÇO E O AVISO DE FALHA NÃO MORAM AQUI, e a ausência é decisão.
 *
 * Eles são texto de TELA — o símbolo que substitui o algarismo e a frase que
 * explica —, e vivem em componentes/PainelNumeros.ts, junto do desenho. Este
 * módulo carrega o que a tela e o servidor precisam CONCORDAR: quais números
 * existem, o que cada um quer dizer e para onde leva.
 *
 * A regra prática por trás disso é a mesma que vale para todo componente
 * `.ts` deste projeto: um import de VALOR com o alias `@/...` mata o teste
 * do Node em ERR_MODULE_NOT_FOUND (medido na Tarefa P4). Tudo que o
 * componente precisa em tempo de execução tem de estar DENTRO dele; daqui
 * ele importa só o tipo.
 */
