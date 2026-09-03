/**
 * compartilhado/doacoes.ts — as decisões puras do ciclo de doações
 * (RF19–RF22): que tipos existem, que situações existem, em que ordem a
 * fila da equipe aparece, e como cada valor de coluna vira palavra na tela.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como compartilhado/triagem-de-contatos.ts, avisos-do-painel.ts e
 * permissao-de-equipe.ts: assim `testes/doacoes.test.mjs` consegue
 * importá-lo pelo runtime nativo do Node, que não resolve o alias `@/...`
 * do tsconfig nem caminho relativo sem extensão. Isso importa mais aqui do
 * que em quase todo o resto: as três telas da equipe estão atrás de uma
 * guarda que responde 404 para quem não é equipe, e o projeto ainda não
 * tem sessão de equipe utilizável (CLAUDE.md, "O que trava hoje", itens 1
 * e 2). O que não estiver num módulo assim fica sem verificação nenhuma.
 *
 * ===================================================================
 * POR QUE AS LISTAS FECHADAS MORAM AQUI, E NÃO DENTRO DE `lerAnalise`
 * ===================================================================
 *
 * Mesmo motivo de triagem-de-contatos.ts: a MESMA lista decide três
 * coisas —
 *
 *   1. as opções que o `<select>` da tela de resposta desenha;
 *   2. o que a Server Action aceita (`ehSituacaoDeDoacao`);
 *   3. em que ordem a fila aparece (`ordenarParaAnalise`).
 *
 * Duas cópias divergiriam no pior sentido possível: uma opção desenhada
 * que a Action recusa, ou seja, um gesto que não pode dar certo. Por isso
 * `compartilhado/validacao.ts` faz só a LEITURA dos campos (que é a regra
 * do projeto: FormData é lido campo a campo por nome, num lugar só) e a
 * DECISÃO fica aqui.
 *
 * ===================================================================
 * ESTE ARQUIVO É O VOCABULÁRIO DA EQUIPE. O DE QUEM DOOU É OUTRO.
 * ===================================================================
 *
 * `componentes/MinhaConta.ts` já tem `SITUACAO_DA_DOACAO` e
 * `TIPO_DA_DOACAO` desde a RF11, e eles NÃO foram unificados com os daqui.
 * Não é descuido: são os mesmos quatro valores de coluna ditos para
 * públicos diferentes, e as frases são diferentes de propósito —
 *
 *     coluna        quem doou (MinhaConta)            a equipe (aqui)
 *     ----------    ------------------------------    -------------------
 *     recusada      "A ONG não conseguiu receber"     "Recusada"
 *     aceita        "Aceita pela ONG"                 "Aceita"
 *
 * Quem lê "a ONG" é quem está de fora; para quem trabalha ali, "a ONG" é
 * ela mesma. É a mesma assimetria que triagem-de-contatos.ts explica no
 * bloco "os valores são os da coluna, não os da tela".
 *
 * O QUE AMARRA AS DUAS LISTAS: `testes/doacoes.test.mjs` lê
 * `supabase/migrations/004_pessoas.sql`, extrai os `check` de `situacao` e
 * de `tipo`, e reconcilia contra ESTE arquivo E contra
 * componentes/MinhaConta.ts. Um quinto valor criado no banco deixa as duas
 * vermelhas; uma lista que envelhece sozinha, também.
 */

/** Os dois valores de `check (tipo in (...))` — supabase/migrations/004_pessoas.sql. */
export type TipoDeDoacao = 'item' | 'recurso_financeiro';

export type DescricaoDeTipo = {
  /** O valor da coluna `tipo`, literal. */
  valor: TipoDeDoacao;
  /** Como o tipo aparece na tela — o mesmo texto para quem doa e para a equipe. */
  rotulo: string;
};

/**
 * OS DOIS TIPOS, e a razão de o formulário público ter esta escolha e
 * nenhuma outra.
 *
 * O escopo (RF19) pede a oferta em TEXTO LIVRE, e a descrição é livre. Mas
 * `tipo` é coluna `not null` com `check`: alguma das duas a linha tem de
 * ter. Não é categoria inventada por esta tarefa — é a divisão que a
 * própria /doar já faz em duas seções ("O que recebemos", com livros,
 * instrumentos, materiais e acervo; e "Doação em dinheiro").
 *
 * O que NÃO foi feito, e é a tentação óbvia: transformar a lista de /doar
 * ("livros", "instrumentos musicais", "materiais de arte", "itens de
 * acervo") em opções. Seria fechar em quatro gavetas o que a ONG descreve
 * como exemplos, e a primeira pessoa com algo fora da lista desistiria.
 * Filtrar depois custa menos que perder oferta por lista fechada — está
 * escrito na própria migration.
 */
export const TIPOS_DE_DOACAO: DescricaoDeTipo[] = [
  { valor: 'item', rotulo: 'Um item' },
  { valor: 'recurso_financeiro', rotulo: 'Dinheiro' }
];

/** A lista fechada, como guarda de tipo. Qualquer outra coisa é recusada. */
export function ehTipoDeDoacao(valor: unknown): valor is TipoDeDoacao {
  return typeof valor === 'string' && TIPOS_DE_DOACAO.some((tipo) => tipo.valor === valor);
}

/**
 * As opções do `<select>` de tipo, na forma que `CampoFormulario` espera
 * (`{ valor, texto }`) — DERIVADAS da lista acima, nunca escritas duas
 * vezes.
 *
 * ===================================================================
 * A OPÇÃO VAZIA SAIU EM 03/09/2026, E O QUE ELA PROTEGIA CONTINUA
 * PROTEGIDO — POR OUTRO MECANISMO
 * ===================================================================
 *
 * Ela existia por um motivo real, escrito aqui: sem ela o navegador já vem
 * com "Um item" selecionado, e quem quer doar dinheiro enviaria "item" sem
 * perceber que havia escolha.
 *
 * O que mudou foi o formulário. Os dois tipos agora abrem CAMPOS
 * DIFERENTES — item abre um campo de texto, dinheiro abre um campo de
 * quantia. Escolher errado deixou de ser invisível: a pessoa vê o campo
 * errado na frente dela antes de enviar.
 *
 * Com duas opções só, o placeholder passou a atrapalhar mais do que
 * proteger: era um toque a mais num celular, e a recusa por "não escolheu"
 * era um erro que a tela podia ter evitado.
 *
 * A VALIDAÇÃO DO SERVIDOR NÃO MUDOU. `validarOferta` continua recusando
 * tipo vazio e tipo fora da lista — a tela nunca foi a guarda.
 */
export const OPCOES_DE_TIPO: Array<{ valor: string; texto: string }> =
  TIPOS_DE_DOACAO.map((tipo) => ({ valor: tipo.valor, texto: tipo.rotulo }));

/**
 * O rótulo de um tipo. Valor desconhecido volta COMO VEIO — mesma regra de
 * `rotuloDaSituacao` em triagem-de-contatos.ts: o `check` do banco torna
 * isso impossível hoje, e mostrar o valor cru é honesto, enquanto inventar
 * um rótulo genérico esconderia da equipe que a tela ficou velha.
 */
export function rotuloDoTipo(valor: string): string {
  const encontrado = TIPOS_DE_DOACAO.find((tipo) => tipo.valor === valor);
  return encontrado ? encontrado.rotulo : valor;
}

/** Os quatro valores de `check (situacao in (...))` — 004_pessoas.sql. */
export type SituacaoDeDoacao = 'ofertada' | 'aceita' | 'recusada' | 'recebida';

export type DescricaoDeSituacaoDeDoacao = {
  /** O valor da coluna `situacao`, literal. */
  valor: SituacaoDeDoacao;
  /** Como a situação aparece marcada no cartão da equipe. */
  rotulo: string;
  /** O que escolher essa situação SIGNIFICA — texto da opção no `<select>`. */
  escolha: string;
};

/**
 * As quatro situações, NA ORDEM DA FILA: primeiro o que ainda espera uma
 * resposta da ONG, por último o que já acabou.
 *
 * É esta ordem que `ordenarParaAnalise` usa — a lista é a fonte única das
 * duas coisas, e não há um segundo lugar dizendo "ofertada vem antes".
 *
 * `aceita` vem em SEGUNDO, e não junto de `recebida`, porque ela é a
 * situação que ainda pede alguma coisa da equipe: a ONG disse que aceita e
 * a entrega ainda não aconteceu. Uma fila que jogasse "aceita" para o fim
 * junto com "recebida" esconderia exatamente as combinações que ficaram
 * pelo caminho — que é como uma doação prometida se perde.
 */
export const SITUACOES_DA_DOACAO: DescricaoDeSituacaoDeDoacao[] = [
  {
    valor: 'ofertada',
    rotulo: 'Ofertada',
    escolha: 'Ofertada — ainda sem resposta nossa'
  },
  {
    valor: 'aceita',
    rotulo: 'Aceita',
    escolha: 'Aceita — conseguimos receber, falta combinar a entrega'
  },
  {
    valor: 'recebida',
    rotulo: 'Recebida',
    escolha: 'Recebida — já está com o Ateliê'
  },
  {
    valor: 'recusada',
    rotulo: 'Recusada',
    escolha: 'Recusada — não conseguimos receber desta vez'
  }
];

/** A lista fechada, como guarda de tipo. Qualquer outra coisa é recusada. */
export function ehSituacaoDeDoacao(valor: unknown): valor is SituacaoDeDoacao {
  return typeof valor === 'string'
    && SITUACOES_DA_DOACAO.some((situacao) => situacao.valor === valor);
}

/**
 * As opções do `<select>` de situação, na forma que `CampoFormulario`
 * espera — DERIVADAS da lista acima, nunca escritas duas vezes.
 *
 * O TEXTO É `escolha`, NÃO `rotulo`, e a diferença é o que a equipe está
 * fazendo em cada lugar: no cartão ela LÊ um estado ("Aceita"); no
 * formulário ela ESCOLHE uma ação, e precisa saber o que a escolha
 * significa ("Aceita — conseguimos receber, falta combinar a entrega"). Um
 * `<select>` de quatro substantivos soltos, num celular, é adivinhação.
 *
 * SEM OPÇÃO VAZIA, ao contrário de `OPCOES_DE_TIPO`: aqui a doação SEMPRE
 * tem uma situação (a coluna é `not null default 'ofertada'`), e o campo
 * nasce com a atual já selecionada. Uma opção vazia seria oferecer à equipe
 * apagar um estado que não pode ficar vazio.
 *
 * ===================================================================
 * A PRIMEIRA OPÇÃO NÃO É UMA SITUAÇÃO — É A AUSÊNCIA DE MUDANÇA
 * ===================================================================
 *
 * "Não mudar por enquanto" conserta o defeito que o pedido V1 relatou:
 * responder e mudar o andamento eram o MESMO gesto, então a equipe não
 * conseguia mandar um recado ("dá para trazer na terça?") sem declarar a
 * doação aceita, recusada ou recebida.
 *
 * Ela vem PRIMEIRO, e é o padrão de quem só quer escrever. O valor
 * `MANTER_SITUACAO` não existe no `check` de 004_pessoas.sql e nunca
 * chega ao banco: `colunasDaAnalise` deixa a coluna fora do update.
 */
/**
 * A MESMA string de `compartilhado/validacao.ts`, repetida aqui porque este
 * arquivo NÃO TEM IMPORT NENHUM, de propósito (ver o cabeçalho): é assim
 * que os testes o importam pelo runtime nativo do Node.
 *
 * Duas cópias de uma string é exatamente o tipo de coisa que diverge — por
 * isso `testes/doacoes.test.mjs` reconcilia as duas e falha se elas se
 * separarem.
 */
export const MANTER_SITUACAO = 'manter';

export const OPCOES_DE_SITUACAO: Array<{ valor: string; texto: string }> = [
  { valor: MANTER_SITUACAO, texto: 'Não mudar por enquanto — só responder' },
  ...SITUACOES_DA_DOACAO.map((situacao) => ({ valor: situacao.valor, texto: situacao.escolha }))
];

/** O rótulo de uma situação. Valor desconhecido volta como veio (ver `rotuloDoTipo`). */
export function rotuloDaSituacaoDeDoacao(valor: string): string {
  const encontrada = SITUACOES_DA_DOACAO.find((situacao) => situacao.valor === valor);
  return encontrada ? encontrada.rotulo : valor;
}

/**
 * As situações em que a doação AINDA ESPERA ALGUMA COISA da equipe.
 *
 * Decide duas coisas na tela: o destaque da marca no cartão e se a
 * descrição da pessoa nasce aberta na dobra. Não decide nada no servidor —
 * quem faz isso são as listas fechadas acima.
 */
export const SITUACOES_EM_ABERTO: SituacaoDeDoacao[] = ['ofertada', 'aceita'];

/** O mínimo que `ordenarParaAnalise` precisa saber de uma linha. */
export type LinhaOrdenavelDeDoacao = { situacao: string; criado_em: string };

/**
 * A ORDEM DA TELA: primeiro o que ainda não foi respondido.
 *
 * Mesma decisão de `ordenarParaTriagem` (contatos), e pelo mesmo motivo
 * medido: numa tela de 375px o primeiro cartão é o único que se vê sem
 * rolar, e esta tela existe para responder UMA pergunta — "o que ainda
 * falta responder?". Com a ordem só por data, uma semana movimentada
 * empurra a oferta não respondida para o fim, atrás de dez doações já
 * recebidas.
 *
 * DENTRO de cada grupo é `criado_em desc`, o mesmo critério da lista de
 * notícias e da de mensagens.
 *
 * O QUE ISTO NÃO FAZ: esconder. "Recusada" desce, nunca some — é o
 * histórico que a pessoa vê em /minha-conta, e sumir com ele aqui deixaria
 * a equipe sem saber o que já foi respondido.
 *
 * Situação desconhecida (impossível pelo `check`, possível se alguém criar
 * uma quinta) vai para o FIM, e não para o começo: uma linha que a tela não
 * entende não deve ocupar o lugar da que espera resposta.
 */
export function ordenarParaAnalise<T extends LinhaOrdenavelDeDoacao>(doacoes: T[]): T[] {
  const posicao = (situacao: string) => {
    const indice = SITUACOES_DA_DOACAO.findIndex((s) => s.valor === situacao);
    return indice === -1 ? SITUACOES_DA_DOACAO.length : indice;
  };

  return [...doacoes].sort((uma, outra) => {
    const diferenca = posicao(uma.situacao) - posicao(outra.situacao);
    if (diferenca !== 0) return diferenca;

    // Comparação de string ISO 8601 em UTC é comparação cronológica — é o
    // formato que o Postgres devolve em `timestamptz` pelo PostgREST.
    return uma.criado_em < outra.criado_em ? 1 : uma.criado_em > outra.criado_em ? -1 : 0;
  });
}

/**
 * O que um cartão da fila precisa saber, já decidido.
 *
 * MESMO MOTIVO DE `montarTriagem` (contatos), e a medição está lá: o
 * componente da lista é `.ts` com `createElement` para ser renderizado por
 * `react-dom/server` dentro de um teste do Node — e o Node NÃO resolve o
 * alias `@/...` num import de VALOR (ERR_MODULE_NOT_FOUND antes do
 * primeiro assert), nem o `next build` aceita import relativo com extensão
 * `.ts` (TS5097). Então as decisões saem daqui prontas e o componente
 * importa só o TIPO, que é apagado antes de executar.
 */
export type ItemDeDoacao<T> = {
  doacao: T;
  /** "Ofertada" / "Aceita" / "Recebida" / "Recusada" — ou o valor cru. */
  situacaoRotulo: string;
  /** "Um item" / "Dinheiro" — ou o valor cru. */
  tipoRotulo: string;
  /** Ainda espera alguma coisa da equipe? Decide o destaque e a dobra aberta. */
  emAberto: boolean;
};

/** O mínimo que `montarAnalise` precisa de uma linha. */
export type LinhaDeDoacao = LinhaOrdenavelDeDoacao & { tipo: string };

/**
 * A lista da tela: ordenada para a análise e com cada decisão já tomada.
 *
 * ORDENA AQUI, e não em servidor/dados/doacoes.ts, para que a ordem e os
 * rótulos saiam do MESMO lugar — o que a tela mostra e a ordem em que
 * mostra são a mesma decisão, e separá-las em duas camadas é o começo de
 * duas respostas para a mesma pergunta.
 */
export function montarAnalise<T extends LinhaDeDoacao>(doacoes: T[]): ItemDeDoacao<T>[] {
  return ordenarParaAnalise(doacoes).map((doacao) => ({
    doacao,
    situacaoRotulo: rotuloDaSituacaoDeDoacao(doacao.situacao),
    tipoRotulo: rotuloDoTipo(doacao.tipo),
    emAberto: (SITUACOES_EM_ABERTO as string[]).includes(doacao.situacao)
  }));
}
