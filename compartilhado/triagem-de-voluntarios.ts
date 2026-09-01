/**
 * compartilhado/triagem-de-voluntarios.ts — as decisões puras da tela de
 * gestão de voluntários da equipe (RF26): o que é uma situação válida, em
 * que ordem as candidaturas aparecem, e como cada valor de coluna vira
 * palavra na tela.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como compartilhado/triagem-de-contatos.ts, candidatura.ts,
 * permissao-de-equipe.ts e avisos-do-painel.ts: assim
 * `testes/voluntarios.test.mjs` consegue importá-lo pelo runtime nativo do
 * Node, que não resolve o alias `@/...` do tsconfig nem caminho relativo sem
 * extensão. Isso importa mais aqui do que numa página pública: a tela está
 * atrás de uma guarda que responde 404 para quem não é equipe, então o que
 * não estiver num módulo assim fica sem verificação nenhuma até alguém abrir
 * a tela autenticado — e ninguém abriu ainda (CLAUDE.md, "O que trava hoje",
 * itens 2 e 3).
 *
 * ===================================================================
 * POR QUE ESTE ARQUIVO NÃO É triagem-de-contatos.ts COM OUTRO NOME
 * ===================================================================
 *
 * As duas telas se parecem (uma fila, uma marca por item, botões que mudam
 * uma coluna `situacao`), e a tentação de generalizar é imediata. Fica
 * separado por três diferenças que NÃO são de nome:
 *
 *  1. as situações são OUTRAS. `public.contatos` tem três (`novo`,
 *     `em_contato`, `concluido`); `public.voluntarios` tem QUATRO (`novo`,
 *     `em_contato`, `ativo`, `inativo`) — dois `check` diferentes, em
 *     supabase/migrations/004_pessoas.sql, e cada teste reconcilia contra o
 *     seu;
 *  2. uma delas tem CONSEQUÊNCIA FORA DA TELA. Marcar uma candidatura como
 *     `inativo` devolve à pessoa o direito de se candidatar de novo —
 *     `SITUACOES_EM_ANDAMENTO` (compartilhado/candidatura.ts) deixa
 *     'inativo' de fora de propósito. Nenhuma situação de contato faz nada
 *     parecido, e um módulo comum esconderia justamente isso;
 *  3. a ORDEM da fila é outra. Em contatos, "concluído" desce para o fim
 *     porque o atendimento acabou. Aqui o fim da fila é `inativo`
 *     (encerrado), e `ativo` — que é o desfecho BOM — fica no meio, acima do
 *     encerrado e abaixo de quem ainda espera resposta.
 *
 * Generalizar as duas depois de ver a terceira tela igual é barato;
 * generalizar agora custaria um parâmetro para cada uma dessas três
 * diferenças, que é a mesma coisa com mais passos.
 *
 * ===================================================================
 * OS VALORES SÃO OS DA COLUNA, NÃO OS DA TELA
 * ===================================================================
 *
 * `novo`, `em_contato`, `ativo` e `inativo` são exatamente o `check` de
 * `public.voluntarios` (004_pessoas.sql). Estão no masculino porque a coluna
 * se chama `situacao` e foi escrita assim no banco; o que a equipe lê é o
 * `rotulo`, no feminino, porque na tela o sujeito é a CANDIDATURA ("Nova",
 * "Encerrada"). Trocar um pelo outro em qualquer direção quebraria o `check`
 * do banco ou a concordância da frase.
 *
 * E ELES NÃO SÃO OS RÓTULOS DE componentes/MinhaConta.ts, que traduz as
 * MESMAS quatro situações para a pessoa que se candidatou ("Recebida, ainda
 * sem resposta", "A ONG está falando com você"). São dois vocabulários de
 * propósito: lá o sujeito é a própria pessoa, aqui é a equipe olhando uma
 * fila de gente. `testes/voluntarios.test.mjs` reconcilia as duas listas
 * contra o `check` do banco — o que elas não podem é discordar sobre QUAIS
 * situações existem.
 */

export type SituacaoDeVoluntario = 'novo' | 'em_contato' | 'ativo' | 'inativo';

export type DescricaoDeSituacaoDeVoluntario = {
  /** O valor da coluna `situacao`, literal. */
  valor: SituacaoDeVoluntario;
  /** Como a situação aparece marcada no cartão. */
  rotulo: string;
  /** O texto do botão que LEVA a esta situação — verbo, não substantivo. */
  botao: string;
};

/**
 * As quatro situações, NA ORDEM DA TRIAGEM: primeiro quem ninguém respondeu,
 * por último quem já encerrou.
 *
 * É esta ordem que `ordenarParaTriagemDeVoluntarios` usa — a lista é a fonte
 * única das duas, e não há um segundo lugar dizendo "novo vem antes".
 */
export const SITUACOES_DE_VOLUNTARIO: DescricaoDeSituacaoDeVoluntario[] = [
  { valor: 'novo', rotulo: 'Nova', botao: 'Marcar como nova' },
  { valor: 'em_contato', rotulo: 'Em contato', botao: 'Marcar "em contato"' },
  { valor: 'ativo', rotulo: 'Voluntariando', botao: 'Marcar como voluntariando' },
  { valor: 'inativo', rotulo: 'Encerrada', botao: 'Encerrar' }
];

/** A lista fechada, como guarda de tipo. Qualquer outra coisa é recusada. */
export function ehSituacaoDeVoluntario(valor: unknown): valor is SituacaoDeVoluntario {
  return typeof valor === 'string'
    && SITUACOES_DE_VOLUNTARIO.some((situacao) => situacao.valor === valor);
}

/**
 * O rótulo de uma situação. Valor desconhecido volta COMO VEIO, e isso é
 * decisão: o `check` do banco torna isso impossível hoje, mas se um dia
 * houver uma quinta situação, mostrar o valor cru ("em_analise") é honesto —
 * inventar um rótulo genérico ("Outra") esconderia da equipe que a tela
 * ficou velha. Mesma regra de componentes/MinhaConta.ts, do outro lado do
 * balcão.
 */
export function rotuloDaSituacaoDeVoluntario(valor: string): string {
  const encontrada = SITUACOES_DE_VOLUNTARIO.find((situacao) => situacao.valor === valor);
  return encontrada ? encontrada.rotulo : valor;
}

/**
 * Os botões que uma candidatura oferece: as OUTRAS três situações.
 *
 * TODAS as transições existem, em todos os sentidos — inclusive voltar de
 * "encerrada" para "nova". Não é generosidade: a operação acontece num
 * celular, de pé, no meio de um evento (regra 4 do CLAUDE.md), e um toque
 * errado que não tenha volta é o que faz a equipe parar de usar a tela.
 * Nenhum destes gestos destrói coisa alguma — o texto que a pessoa escreveu
 * e as áreas que ela marcou não são tocados por nenhum deles.
 *
 * Situação desconhecida devolve as quatro, para que a candidatura não fique
 * sem saída na tela.
 */
export function proximasSituacoesDeVoluntario(atual: string): DescricaoDeSituacaoDeVoluntario[] {
  return SITUACOES_DE_VOLUNTARIO.filter((situacao) => situacao.valor !== atual);
}

/** O mínimo que a ordenação precisa saber de uma linha. */
export type LinhaOrdenavelDeVoluntario = { situacao: string; criado_em: string };

/**
 * A ORDEM DA TELA: primeiro quem ainda não teve resposta.
 *
 * ===================================================================
 * A DECISÃO, E O PORQUÊ
 * ===================================================================
 *
 * A alternativa era só `criado_em desc`, uma linha a menos. Fica assim mesmo
 * porque numa tela de 375px o primeiro cartão é o único que se vê sem rolar,
 * e esta tela existe para responder UMA pergunta: "quem se ofereceu para
 * ajudar e ainda não teve resposta?". Com a ordem só por data, uma semana
 * movimentada empurra a candidatura nova para baixo de dez voluntários que
 * já estão ativos há meses.
 *
 * DENTRO de cada grupo é `criado_em desc`, da mais nova para a mais antiga —
 * o mesmo critério da lista de mensagens e da de notícias do painel.
 *
 * O QUE ISTO NÃO FAZ: esconder. "Encerrada" desce, nunca some — a
 * candidatura de quem já foi voluntário é o registro de que aquela pessoa
 * ajudou, e a política de privacidade não promete apagá-la. Uma tela que
 * some com o que foi encerrado seria outra coisa, e uma coisa que ninguém
 * pediu.
 *
 * ===================================================================
 * SITUAÇÃO DESCONHECIDA VAI PARA O TOPO, NÃO PARA O FIM
 * ===================================================================
 *
 * O `check` do banco torna isso impossível hoje. Se um dia acontecer
 * (situação nova criada direto no painel do Supabase), a tela não entende
 * aquela linha — e a resposta certa para "não entendi" numa fila de pessoas
 * é mostrar primeiro, não empurrar para baixo de tudo, onde ninguém rola. O
 * cartão ainda desenha o valor cru (`rotuloDaSituacaoDeVoluntario`), então
 * dá para ver o que é.
 *
 * ORDENA UMA CÓPIA. `Array.prototype.sort` ordena no lugar, e o argumento
 * aqui é o `data` que veio do PostgREST — mexer nele é mexer em algo que
 * quem chamou pode estar usando para outra coisa.
 */
export function ordenarParaTriagemDeVoluntarios<T extends LinhaOrdenavelDeVoluntario>(
  candidaturas: T[]
): T[] {
  const posicao = (situacao: string): number => {
    const indice = SITUACOES_DE_VOLUNTARIO.findIndex((conhecida) => conhecida.valor === situacao);
    return indice === -1 ? -1 : indice;
  };

  return [...candidaturas].sort((uma, outra) => {
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
 * UM COMPONENTE `.ts` NÃO CONSEGUE IMPORTAR ESTE MÓDULO
 * ===================================================================
 *
 * componentes/ListaVoluntarios.ts é `.ts` com `createElement` justamente
 * para ser renderizado por `react-dom/server` dentro de um teste do Node — é
 * a única forma de a tela ter verificação enquanto a página responde 404
 * para quem não é equipe. Só que o runtime nativo do Node NÃO resolve o
 * alias `@/...` do tsconfig, e um `import` de valor com o alias faz o teste
 * morrer em `ERR_MODULE_NOT_FOUND` antes do primeiro assert; caminho
 * relativo com extensão `.ts` também não serve, porque o `next build` recusa
 * com `TS5097` enquanto `allowImportingTsExtensions` estiver desligado. As
 * duas medições estão no cabeçalho de `montarTriagem`, em
 * compartilhado/triagem-de-contatos.ts, e valem palavra por palavra aqui.
 *
 * A saída é a mesma de lá: as decisões saem daqui já resolvidas e o
 * componente recebe uma lista de itens PRONTOS, importando deste módulo só o
 * TIPO (`import type`, que o Node apaga antes de executar).
 */
export type ItemDeTriagemDeVoluntario<T> = {
  candidatura: T;
  /** "Nova" / "Em contato" / "Voluntariando" / "Encerrada" — ou o valor cru. */
  situacaoRotulo: string;
  /**
   * Ainda espera resposta? Decide o destaque da marca E se a dobra da
   * mensagem nasce aberta.
   */
  nova: boolean;
  /** Os botões: as outras situações, com o texto de cada um. */
  destinos: DescricaoDeSituacaoDeVoluntario[];
};

/**
 * A lista da tela: ordenada para a triagem e com cada decisão já tomada.
 *
 * ORDENA AQUI, e não em servidor/dados/voluntarios.ts, para que a ordem e os
 * rótulos saiam do MESMO lugar — o que a tela mostra e a ordem em que mostra
 * são a mesma decisão, e separá-las em duas camadas é o começo de duas
 * respostas para a mesma pergunta.
 */
export function montarTriagemDeVoluntarios<T extends LinhaOrdenavelDeVoluntario>(
  candidaturas: T[]
): ItemDeTriagemDeVoluntario<T>[] {
  return ordenarParaTriagemDeVoluntarios(candidaturas).map((candidatura) => ({
    candidatura,
    situacaoRotulo: rotuloDaSituacaoDeVoluntario(candidatura.situacao),
    nova: candidatura.situacao === 'novo',
    destinos: proximasSituacoesDeVoluntario(candidatura.situacao)
  }));
}
