/**
 * compartilhado/paginacao.ts — a aritmética de paginar as filas do painel.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como `triagem-de-contatos.ts`, `avisos-do-painel.ts` e
 * `itens-de-quem-entrou.ts`: assim os testes o importam pelo runtime
 * nativo do Node. Paginação errada esconde registro, e esconder registro
 * é o defeito mais caro que uma fila de atendimento pode ter — então a
 * conta precisa de teste, e o teste precisa poder rodar sem servidor.
 *
 * ===================================================================
 * O CORTE NÃO PODE SER SILENCIOSO — É A REGRA QUE O PRÓPRIO CÓDIGO JÁ
 * TINHA ESCRITO
 * ===================================================================
 *
 * `servidor/dados/contatos.ts` dizia, antes desta paginação existir:
 *
 *     "SEM LIMITE, e isso é decisão, não esquecimento. Um `.limit(n)` numa
 *      fila de atendimento esconde mensagem sem dizer que escondeu: a de
 *      número n+1 simplesmente não existe na tela, e ninguém descobre. (…)
 *      No dia em que não couber, o caminho é filtro por situação com o
 *      TOTAL ESCRITO NA TELA, nunca um corte silencioso."
 *
 * Este módulo é aquele dia. Por isso `Paginacao` carrega `total` e
 * `totalDePaginas`, e não só o recorte: a tela é obrigada a poder dizer
 * "20 de 47". Uma paginação que sabe apenas "há mais" é o corte silencioso
 * com outra roupa.
 *
 * ===================================================================
 * O NÚMERO DA PÁGINA VEM DA URL, OU SEJA, DE QUEM QUISER
 * ===================================================================
 *
 * `?pagina=` é escrito por qualquer pessoa. `lerPagina` trata tudo o que
 * não é um inteiro dentro da faixa como a primeira página — nunca lança,
 * nunca devolve `NaN`, e nunca deixa passar um número que viraria um
 * `range()` inválido no PostgREST. É a mesma disciplina de
 * `avisoDeContato` e da lista fechada de `?aviso=`.
 */

/** Quantos itens por página. */
export const POR_PAGINA = 20;

export type Paginacao = {
  /** 1-based, como a pessoa lê. */
  pagina: number;
  totalDePaginas: number;
  /** Quantos registros existem NO TOTAL, e não nesta página. */
  total: number;
  /** O recorte para o `range()` do PostgREST — 0-based, inclusivo nas duas pontas. */
  de: number;
  ate: number;
  /** Para a tela escrever "mostrando 21–40 de 47". 1-based. */
  primeiroDaPagina: number;
  ultimoDaPagina: number;
  temAnterior: boolean;
  temProxima: boolean;
};

/**
 * O número de página pedido, saneado.
 *
 * Aceita string (o que vem de `searchParams`) e número. Qualquer coisa que
 * não seja inteiro >= 1 vira 1 — inclusive `'abc'`, `'-3'`, `'2.5'` e
 * `undefined`.
 *
 * ELA NÃO LIMITA PELO FIM, e não poderia: aqui não se sabe quantas páginas
 * existem. Quem limita é `paginar`, que recebe o total — e lá `?pagina=999`
 * aterrissa na ÚLTIMA página, não na primeira.
 */
export function lerPagina(bruto: unknown): number {
  const texto = typeof bruto === 'string' ? bruto : String(bruto ?? '');
  // `Number()` e não `parseInt`: `parseInt('1abc')` daria 1, e um número
  // com lixo colado é entrada errada, não um 1.
  const numero = Number(texto.trim());
  if (!Number.isInteger(numero) || numero < 1) return 1;
  return numero;
}

/**
 * A paginação inteira, a partir do total que o banco contou.
 *
 * `total` é o `count` da consulta, não o tamanho do recorte — é o que
 * permite à tela escrever quantos registros existem de verdade.
 */
export function paginar(total: number, paginaPedida: unknown, porPagina = POR_PAGINA): Paginacao {
  const contagem = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const totalDePaginas = Math.max(1, Math.ceil(contagem / porPagina));

  // A página pedida é limitada ao que existe. Passar do fim aterrissa na
  // ÚLTIMA página, e não na primeira: aqui já sabemos quantas há, e mandar
  // quem clicou "próxima" de volta ao começo seria perder o lugar.
  const pagina = Math.min(lerPagina(paginaPedida), totalDePaginas);

  const de = (pagina - 1) * porPagina;
  const ate = de + porPagina - 1;

  return {
    pagina,
    totalDePaginas,
    total: contagem,
    de,
    ate,
    primeiroDaPagina: contagem === 0 ? 0 : de + 1,
    ultimoDaPagina: Math.min(de + porPagina, contagem),
    temAnterior: pagina > 1,
    temProxima: pagina < totalDePaginas
  };
}

/**
 * O substantivo da fila, nas duas formas.
 *
 * AS DUAS SÃO PEDIDAS, e não deduzidas de uma. A primeira versão desta
 * função tirava o singular do plural com `replace(/s$/, '')` — e produzia
 * "Nenhuma mensagen por aqui." O português não faz plural só com "s"
 * ("mensagem/mensagens", "voluntário/voluntários"), e adivinhar morfologia
 * dentro de um utilitário de string é a esperteza que quebra em silêncio
 * no dia em que alguém passa uma palavra nova.
 *
 * `artigo` existe pelo mesmo motivo: "Nenhuma mensagem" e "Nenhum
 * material" — o gênero não se deduz da terminação com segurança.
 */
export type NomeDaFila = {
  singular: string;
  plural: string;
  /** 'a' para feminino, 'o' para masculino. */
  artigo: 'a' | 'o';
};

/**
 * A frase que a tela escreve. Mora aqui, e não no componente, porque é ela
 * que cumpre a promessa de "o total escrito na tela" — e porque um teste de
 * unidade prova todas as formas dela sem subir navegador.
 */
export function frasePaginacao(paginacao: Paginacao, nome: NomeDaFila): string {
  if (paginacao.total === 0) {
    return `Nenhum${nome.artigo === 'a' ? 'a' : ''} ${nome.singular} por aqui.`;
  }
  if (paginacao.totalDePaginas === 1) {
    return paginacao.total === 1
      ? `1 ${nome.singular}.`
      : `${paginacao.total} ${nome.plural}, tod${nome.artigo}s nesta tela.`;
  }
  return `Mostrando ${paginacao.primeiroDaPagina}–${paginacao.ultimoDaPagina} `
    + `de ${paginacao.total} ${nome.plural}.`;
}

/** Os nomes das filas do painel, num lugar só. */
export const MENSAGENS: NomeDaFila = { singular: 'mensagem', plural: 'mensagens', artigo: 'a' };
export const CANDIDATURAS: NomeDaFila =
  { singular: 'candidatura', plural: 'candidaturas', artigo: 'a' };
export const DOACOES: NomeDaFila = { singular: 'doação', plural: 'doações', artigo: 'a' };
