/**
 * compartilhado/triagem-de-contatos.ts — as decisões puras da tela de
 * mensagens da equipe (RF29): o que é uma situação válida, em que ordem as
 * mensagens aparecem, e como cada valor de coluna vira palavra na tela.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como compartilhado/permissao-de-equipe.ts e compartilhado/
 * avisos-do-painel.ts: assim `testes/contatos.test.mjs` consegue importá-lo
 * pelo runtime nativo do Node, que não resolve o alias `@/...` do tsconfig
 * nem caminho relativo sem extensão. Isso importa mais aqui do que nas
 * outras telas do painel: a página está atrás de uma guarda que responde
 * 404 para quem não é equipe, então o que não estiver num módulo assim fica
 * sem verificação nenhuma até alguém abrir a tela autenticado.
 *
 * ===================================================================
 * POR QUE A LISTA FECHADA MORA AQUI, E NÃO DENTRO DE lerMudancaDeSituacao
 * ===================================================================
 *
 * `lerAlternancia` (publicações, galeria, atividades) aplica a lista fechada
 * na hora de LER o FormData, e nada mais precisa dela. Aqui é diferente: a
 * MESMA lista decide três coisas —
 *
 *   1. quais botões a tela desenha em cada mensagem (`proximasSituacoes`);
 *   2. o que a Action aceita (`ehSituacaoDeContato`);
 *   3. em que ordem a lista aparece (`ordenarParaTriagem`).
 *
 * Duas cópias divergiriam no pior sentido possível: um botão desenhado para
 * uma situação que a Action recusa, ou seja, um gesto que não pode dar
 * certo. Por isso `compartilhado/validacao.ts` faz só a LEITURA dos campos
 * (que é a regra do projeto: FormData é lido campo a campo por nome, num
 * lugar só) e a DECISÃO fica aqui.
 *
 * ===================================================================
 * OS VALORES SÃO OS DA COLUNA, NÃO OS DA TELA
 * ===================================================================
 *
 * `novo`, `em_contato` e `concluido` são exatamente o `check` de
 * `public.contatos` (supabase/migrations/004_pessoas.sql). Estão no
 * masculino porque a coluna se chama `situacao` e foi escrita assim no
 * banco; o que a equipe lê é o `rotulo`, no feminino, porque na tela o
 * sujeito é a MENSAGEM ("Nova", "Concluída"). Trocar um pelo outro em
 * qualquer direção quebraria o `check` do banco ou a concordância da frase.
 */

export type SituacaoDeContato = 'novo' | 'em_contato' | 'concluido';

export type DescricaoDeSituacao = {
  /** O valor da coluna `situacao`, literal. */
  valor: SituacaoDeContato;
  /** Como a situação aparece marcada no cartão. */
  rotulo: string;
  /** O texto do botão que LEVA a esta situação — verbo, não substantivo. */
  botao: string;
};

/**
 * As três situações, NA ORDEM DA TRIAGEM: primeiro o que ninguém tocou,
 * por último o que já acabou.
 *
 * É esta ordem que `ordenarParaTriagem` usa — a lista é a fonte única dos
 * dois, e não há um segundo lugar dizendo "novo vem antes".
 */
export const SITUACOES: DescricaoDeSituacao[] = [
  { valor: 'novo', rotulo: 'Nova', botao: 'Marcar como nova' },
  { valor: 'em_contato', rotulo: 'Em contato', botao: 'Marcar "em contato"' },
  { valor: 'concluido', rotulo: 'Concluída', botao: 'Marcar como concluída' }
];

/** A lista fechada, como guarda de tipo. Qualquer outra coisa é recusada. */
export function ehSituacaoDeContato(valor: unknown): valor is SituacaoDeContato {
  return typeof valor === 'string'
    && SITUACOES.some((situacao) => situacao.valor === valor);
}

/**
 * O rótulo de uma situação. Valor desconhecido volta COMO VEIO, e isso é
 * decisão: o `check` do banco torna isso impossível hoje, mas se um dia
 * houver uma quarta situação, mostrar o valor cru ("arquivado") é honesto —
 * inventar um rótulo genérico ("Outra") esconderia da equipe que a tela
 * ficou velha.
 */
export function rotuloDaSituacao(valor: string): string {
  const encontrada = SITUACOES.find((situacao) => situacao.valor === valor);
  return encontrada ? encontrada.rotulo : valor;
}

/**
 * Os botões que uma mensagem oferece: as OUTRAS duas situações.
 *
 * TODAS as transições existem, nos dois sentidos — inclusive voltar de
 * "concluída" para "nova". Não é generosidade: a operação acontece num
 * celular, de pé, no meio de um evento (regra 4 do CLAUDE.md), e um toque
 * errado que não tenha volta é o que faz a equipe parar de usar a tela.
 * Nenhum destes gestos destrói coisa alguma — o texto da pessoa não é
 * tocado por nenhum deles.
 *
 * Situação desconhecida devolve as três, para que a mensagem não fique sem
 * saída na tela.
 */
export function proximasSituacoes(atual: string): DescricaoDeSituacao[] {
  return SITUACOES.filter((situacao) => situacao.valor !== atual);
}

/**
 * `origem` — a mesma tabela vai receber mais do que o formulário de
 * contato.
 *
 * Os quatro valores são o `check` da coluna (004_pessoas.sql). Hoje só
 * entra `contato`: `acoes/contato.ts` escreve esse literal, e as outras
 * três esperam RF25 (voluntariado), RF19 (doação) e o caminho de escolas.
 * A equipe precisa distinguir desde já — quando a primeira candidatura de
 * voluntariado cair na mesma lista, a diferença entre "quer se voluntariar"
 * e "quer agendar uma apresentação" é a primeira coisa a saber.
 */
const ORIGENS: Record<string, string> = {
  contato: 'Formulário de contato',
  escola: 'Escola',
  doacao: 'Doação',
  voluntariado: 'Voluntariado'
};

/**
 * O rótulo de uma origem. Mesma regra do rótulo de situação: valor
 * desconhecido volta como veio.
 *
 * `Object.hasOwn`, e não `ORIGENS[valor]` direto: sem isto, uma linha com
 * `origem` valendo "toString" (ou "constructor", ou "__proto__") devolveria
 * algo herdado do protótipo de Object em vez de `undefined`, e a tela
 * tentaria desenhar aquilo. É a mesma precaução de
 * compartilhado/avisos-do-painel.ts.
 */
export function rotuloDaOrigem(valor: string): string {
  return Object.hasOwn(ORIGENS, valor) ? ORIGENS[valor] : valor;
}

/** O mínimo que `ordenarParaTriagem` precisa saber de uma linha. */
export type LinhaOrdenavel = { situacao: string; criado_em: string };

/**
 * A ORDEM DA TELA: primeiro o que ainda não foi respondido.
 *
 * ===================================================================
 * A DECISÃO, E O PORQUÊ
 * ===================================================================
 *
 * A alternativa era só `criado_em desc` — o índice existe no banco
 * (`contatos_criado_em_idx`) e seria uma linha a menos. Fica assim mesmo
 * porque numa tela de 375px o primeiro cartão é o único que se vê sem
 * rolar, e esta tela existe para responder UMA pergunta: "o que ainda
 * falta responder?". Com a ordem só por data, uma semana movimentada
 * empurra a mensagem não respondida para o fim, atrás de dez conversas já
 * concluídas.
 *
 * DENTRO de cada grupo continua sendo da mais nova para a mais antiga —
 * exceto... nada. Não há exceção: é `criado_em desc`, o mesmo critério da
 * lista de notícias do painel.
 *
 * O QUE ISTO NÃO FAZ: esconder. "Concluída" desce, nunca some. É o
 * "registro central de contatos" (RF29) — a mensagem respondida em março é
 * a prova de que houve atendimento, e a política de privacidade promete
 * guardá-la "um tempo depois como histórico do contato". Uma tela que
 * some com o que foi concluído seria outra coisa, e uma coisa que ninguém
 * pediu.
 *
 * ===================================================================
 * SITUAÇÃO DESCONHECIDA VAI PARA O TOPO, NÃO PARA O FIM
 * ===================================================================
 *
 * O `check` do banco torna isso impossível hoje. Se um dia acontecer
 * (situação nova criada direto no painel do Supabase, por exemplo), a tela
 * não entende aquela linha — e a resposta certa para "não entendi" numa
 * fila de atendimento é mostrar primeiro, não empurrar para baixo de tudo,
 * onde ninguém rola. O cartão ainda desenha o valor cru
 * (`rotuloDaSituacao`), então dá para ver o que é.
 *
 * ORDENA UMA CÓPIA. `Array.prototype.sort` ordena no lugar, e o argumento
 * aqui é o `data` que veio do PostgREST — mexer nele é mexer em algo que
 * quem chamou pode estar usando para outra coisa.
 */
export function ordenarParaTriagem<T extends LinhaOrdenavel>(contatos: T[]): T[] {
  const posicao = (situacao: string): number => {
    const indice = SITUACOES.findIndex((conhecida) => conhecida.valor === situacao);
    return indice === -1 ? -1 : indice;
  };

  return [...contatos].sort((uma, outra) => {
    const diferenca = posicao(uma.situacao) - posicao(outra.situacao);
    if (diferenca !== 0) return diferenca;

    // Da mais nova para a mais antiga. Comparação de string ISO 8601 em UTC
    // é comparação cronológica — é o formato que o Postgres devolve em
    // `timestamptz` pelo PostgREST.
    return uma.criado_em < outra.criado_em ? 1 : uma.criado_em > outra.criado_em ? -1 : 0;
  });
}

/**
 * O que um cartão da lista precisa saber, já decidido — e o motivo de esta
 * função existir.
 *
 * ===================================================================
 * UM COMPONENTE `.ts` NÃO CONSEGUE IMPORTAR ESTE MÓDULO, E ISSO É MEDIDO
 * ===================================================================
 *
 * componentes/ListaContatos.ts é `.ts` com `createElement` justamente para
 * ser renderizado por `react-dom/server` dentro de um teste do Node — é a
 * única forma de a tela ter verificação enquanto a página responde 404 para
 * quem não é equipe. Só que o runtime nativo do Node NÃO resolve o alias
 * `@/...` do tsconfig, e um `import` de valor com o alias faz o teste
 * morrer em `ERR_MODULE_NOT_FOUND` antes do primeiro assert (MEDIDO nesta
 * tarefa). Caminho relativo com extensão `.ts` também não serve: o
 * `next build` recusa com `TS5097` enquanto `allowImportingTsExtensions`
 * estiver desligado (MEDIDO também).
 *
 * As saídas eram três, e duas são piores:
 *
 *  · duplicar a lista fechada dentro do componente — é o que este arquivo
 *    inteiro existe para evitar (um botão desenhado para uma situação que a
 *    Action recusa);
 *  · passar três funções como prop — ruído, e o teste passaria funções de
 *    mentira, medindo a si mesmo.
 *
 * A terceira é esta: as decisões saem daqui já resolvidas, e o componente
 * recebe uma lista de itens PRONTOS. Ele importa deste módulo só o TIPO —
 * `import type`, que o Node apaga antes de executar. O teste chama
 * `montarTriagem` de verdade e passa o resultado ao componente, então o
 * mapeamento continua sendo medido, e não fingido.
 */
export type ItemDeTriagem<T> = {
  contato: T;
  /** "Nova" / "Em contato" / "Concluída" — ou o valor cru, se for desconhecido. */
  situacaoRotulo: string;
  /** "Formulário de contato", "Voluntariado"... — ou o valor cru. */
  origemRotulo: string;
  /**
   * Ainda espera resposta? Decide o destaque da marca E se a dobra da
   * mensagem nasce aberta.
   */
  nova: boolean;
  /** Os botões: as outras situações, com o texto de cada um. */
  destinos: DescricaoDeSituacao[];
};

/** O mínimo que `montarTriagem` precisa de uma linha. */
export type LinhaDeContato = LinhaOrdenavel & { origem: string };

/**
 * A lista da tela: ordenada para a triagem e com cada decisão já tomada.
 *
 * ORDENA AQUI, e não em servidor/dados/contatos.ts, para que a ordem e os
 * rótulos saiam do MESMO lugar — o que a tela mostra e a ordem em que
 * mostra são a mesma decisão, e separá-las em duas camadas é o começo de
 * duas respostas para a mesma pergunta.
 */
export function montarTriagem<T extends LinhaDeContato>(contatos: T[]): ItemDeTriagem<T>[] {
  return ordenarParaTriagem(contatos).map((contato) => ({
    contato,
    situacaoRotulo: rotuloDaSituacao(contato.situacao),
    origemRotulo: rotuloDaOrigem(contato.origem),
    nova: contato.situacao === 'novo',
    destinos: proximasSituacoes(contato.situacao)
  }));
}
