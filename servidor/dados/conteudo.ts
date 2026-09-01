import 'server-only';
import { obterCliente } from '../supabase';
import {
  temSupabase, descrever, repassarSeForControleDoNext, consultarComEstado, type Degradavel
} from './degradacao';
import atividadesLocais from '@/dados-iniciais/atividades.json';
import clippingLocal from '@/dados-iniciais/clipping.json';

/**
 * Uma das 11 atividades do catálogo (RF03).
 *
 * Os nomes de coluna espelham a tabela public.atividades (migration
 * 002_conteudo.sql) e o JSON versionado em dados-iniciais/atividades.json —
 * as duas fontes nascem com o mesmo formato, de propósito.
 *
 * `publicado` NÃO faz parte deste tipo, e isso é decisão, não esquecimento:
 * é campo de filtro, não de apresentação. A consulta remota nem o traz (a
 * RLS já filtrou); o JSON local traz, e por isso o caminho local o remove
 * antes de devolver — ver filtrarEOrdenarLocal(). Até a revisão final da
 * fase 1 o caminho local devolvia objetos COM `publicado` e o remoto SEM,
 * os dois anunciados como `Atividade[]`: o tipo mentia para um dos dois
 * lados, e quem escrevesse `atividade.publicado` na fase 2 teria código que
 * funciona offline e é `undefined` em produção.
 */
export type Atividade = {
  id: string;
  titulo: string;
  resumo: string | null;
  descricao: string | null;
  genero: string | null;
  duracao: string | null;
  elenco: string | null;
  classificacao: string | null;
  local: string | null;
  rider: string | null;
};

/**
 * Um registro de "prova social" (RF39): onde o Ateliê já se apresentou ou
 * foi noticiado. "midia" alimenta "Na mídia"; "instituicao" e "programacao"
 * alimentam "Onde já estivemos" em /para-escolas (ver
 * componentes/SecaoOndeEstivemos.ts).
 */
export type RegistroClipping = {
  id: string;
  tipo: 'midia' | 'instituicao' | 'programacao';
  titulo: string;
  detalhe: string | null;
  ano: number | null;
};

/** De onde a lista devolvida realmente veio. */
export type Origem = 'banco' | 'json';

/**
 * Lista + a procedência dela.
 *
 * ISTO É O CORAÇÃO DA CORREÇÃO DO CRÍTICO 1 DA REVISÃO FINAL. Antes, o
 * ramo `if (error) return filtrarEOrdenarLocal(...)` devolvia exatamente o
 * mesmo conteúdo do caminho de sucesso — de propósito, porque as duas
 * fontes espelham o mesmo conteúdo real da ONG (ferramentas/gerar-seed.mjs
 * gera o seed.sql a partir destes JSON). A consequência é que chave errada,
 * grant faltando, política de RLS apertada demais, coluna renomeada ou rede
 * fora produziam uma página IDÊNTICA à página certa. Dava para publicar
 * com o Supabase configurado, servindo JSON o tempo todo, e ninguém saber —
 * nem um teste, nem a equipe da ONG olhando a tela.
 *
 * Conteúdo não distingue: medido contra o banco real, os 11 ids de
 * atividades e os 14 de clipping são os mesmos dos dois lados, sem sobra de
 * nenhum. Contagem também não. Então a distinção precisa de um sinal
 * explícito, e `carimbo` é o que impede esse sinal de ser só uma palavra:
 * é o maior `criado_em` das linhas — coluna que existe na tabela
 * (002_conteudo.sql) e NÃO existe em nenhum dos JSON. Um resultado com
 * `origem: 'banco'` carrega um dado que o caminho local não teria como
 * fabricar.
 *
 * `criado_em` é lido e depois descartado: não entra em Atividade nem em
 * RegistroClipping, para que as duas fontes continuem devolvendo
 * exatamente a mesma forma.
 */
export type Resultado<T> = {
  origem: Origem;
  registros: T[];
  /** Maior `criado_em` das linhas, em ISO. Sempre null quando origem é 'json'. */
  carimbo: string | null;
};

/*
 * Conteudo institucional com fonte dupla.
 *
 * Enquanto o projeto Supabase nao esta configurado no ambiente, le o JSON
 * versionado em dados-iniciais/. Quando SUPABASE_URL e
 * SUPABASE_CHAVE_PUBLICAVEL existem, passa a consultar a tabela — e nenhuma
 * pagina precisa mudar, porque todas falam so com estas funcoes.
 *
 * O mesmo JSON e a origem do seed.sql (ferramentas/gerar-seed.mjs), entao as
 * duas fontes nascem com o mesmo conteudo real da ONG.
 *
 * =====================================================================
 * DESDE A TAREFA P4 DO PAINEL, AS DUAS FONTES PODEM DIVERGIR — E ISSO
 * MUDA O QUE "DEGRADAR" SIGNIFICA AQUI
 * =====================================================================
 *
 * Ate 31/08/2026 esta era uma afirmacao segura: as duas fontes dizem a
 * mesma coisa, entao cair para o JSON custava apenas a PROCEDENCIA do
 * dado, nunca o conteudo. A tela de /admin/atividades (RF03) e a primeira
 * coisa do projeto que quebra essa igualdade: quando a equipe corrige um
 * texto, o banco passa a ter a correcao e o JSON versionado continua com o
 * texto antigo — ninguem atualiza o arquivo a partir do painel, e nem
 * poderia (o repositorio nao e gravavel em producao).
 *
 * As tres consequencias, escritas porque nenhuma delas produz erro
 * visivel:
 *
 *  1. QUEDA DO BANCO passa a servir texto DESATUALIZADO em /projetos, e
 *     nao mais "o mesmo conteudo por outro caminho". O carimbo
 *     `data-origem-atividades="json"` no <main> continua sendo como se
 *     descobre isso de fora; o aviso [dados] no log, como se descobre de
 *     dentro.
 *  2. DEPLOY SEM AS VARIAVEIS do Supabase (CLAUDE.md, item 0e) tem o mesmo
 *     efeito, permanente e silencioso: o site sobe inteiro, bonito, com o
 *     texto de antes da correcao.
 *  3. `npm run seed` REGENERA supabase/seed.sql a partir do JSON. Rodado
 *     contra um banco onde a equipe ja editou, o `on conflict do nothing`
 *     protege as linhas existentes — mas o arquivo gerado passa a ser uma
 *     fotografia velha, e restaurar um banco a partir dele desfaz a
 *     correcao. O aviso esta escrito em ferramentas/gerar-seed.mjs, que o
 *     imprime a cada execucao.
 *
 * O QUE NAO SE FAZ AQUI, e e decisao: nada disso e "consertado" nesta
 * tarefa. Consertar de verdade e escolher UMA fonte (perder a rede de
 * seguranca offline) ou dar ao painel um caminho de exportacao de volta
 * para o JSON (que e commit no repositorio, coisa que a equipe da ONG nao
 * faz do celular). As duas sao decisao do grupo, nao de quem implementa —
 * o que esta tarefa faz e nao deixar a armadilha sem sinalizacao: aqui, em
 * acoes/atividades.ts, em ferramentas/gerar-seed.mjs, na tela da equipe
 * (componentes/ListaAtividades.ts) e no CLAUDE.md.
 *
 * temSupabase(), descrever() e repassarSeForControleDoNext() saíram deste
 * arquivo na revisão final do Bloco A e vivem em
 * servidor/dados/degradacao.ts, junto com a política de erro dos outros
 * três módulos: as três funções estavam copiadas aqui e nos outros
 * arquivos, e é a mesma decisão nos quatro.
 *
 * As funções PÚBLICAS deste módulo não usam consultarOuDegradar() de lá, de
 * propósito: o valor degradado delas não é uma lista vazia, é o JSON
 * versionado com o mesmo conteúdo real — mais o `carimbo` que prova a
 * procedência. É a única tabela do projeto que tem uma segunda fonte, e por
 * isso a única que pode degradar sem perder conteúdo.
 *
 * As duas funções do PAINEL, no fim do arquivo, usam consultarComEstado() e
 * NÃO caem para o JSON — o porquê está escrito lá, e é o outro lado desta
 * mesma decisão.
 */

/**
 * Aplica no JSON local o mesmo filtro e a mesma ordenação que a consulta
 * remota recebe da RLS (`publicado or eh_equipe()`, migration
 * 002_conteudo.sql) e do `.order('titulo')` — Rodada de correção 1 da
 * Tarefa 10 — e remove `publicado` do objeto devolvido, para que a forma
 * seja a mesma dos dois lados (ver o comentário do tipo Atividade).
 *
 * Sem o filtro, o fallback offline devolvia o arquivo cru: se a equipe
 * despublicasse um registro pelo painel e o Supabase caísse logo depois, o
 * JSON versionado (que ninguém atualiza automaticamente a partir do painel)
 * fazia esse registro "ressuscitar" na página pública.
 *
 * dados-iniciais/atividades.json carrega o campo `publicado` de verdade —
 * aqui o filtro faz diferença real assim que alguém marcar uma atividade
 * como `false` nesse arquivo. Já dados-iniciais/clipping.json NÃO modela
 * esse campo hoje (nenhum registro o carrega). Escolha, documentada aqui
 * porque é exatamente o tipo de decisão que se perde se só ficar no
 * histórico do commit: ausência do campo é tratada como "publicado" — o
 * mesmo default (`not null default true`) da coluna real —, não como
 * "esconder". Consequência aceita conscientemente: para o clipping
 * especificamente, a proteção contra "registro despublicado ressuscita"
 * só existe enquanto o Supabase estiver no ar (a RLS filtra lá); o JSON
 * local não tem como saber sozinho. Corrigir de verdade exigiria o JSON
 * também carregar `publicado` por registro, o que fica para quando/se
 * ferramentas/gerar-seed.mjs ganhar um caminho de exportação nesse sentido.
 */
function filtrarEOrdenarLocal<T extends { titulo: string }>(
  registros: Array<T & { publicado?: boolean }>
): T[] {
  return registros
    .filter((registro) => registro.publicado !== false)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    .map(({ publicado: _descartado, ...resto }) => resto as unknown as T);
}

/** Resultado local, com a procedência dita. */
function doJson<T extends { titulo: string }>(
  registros: Array<T & { publicado?: boolean }>
): Resultado<T> {
  return { origem: 'json', registros: filtrarEOrdenarLocal(registros), carimbo: null };
}

/**
 * O aviso que faltava.
 *
 * Cair para o JSON é a rede de segurança correta — banco fora do ar não
 * pode derrubar a página institucional. O que estava errado era cair em
 * SILÊNCIO. Isto aparece no log do servidor (Netlify Functions) toda vez
 * que o Supabase está configurado e mesmo assim não respondeu.
 */
function avisarQueCaiuParaOJson(tabela: string, motivo: unknown): void {
  console.warn(
    `[dados] "${tabela}": o Supabase está configurado mas a consulta não voltou — `
    + 'servindo o JSON versionado de dados-iniciais/. A página fica certa, o dado fica '
    + `velho. Motivo: ${descrever(motivo)}`
  );
}

/** Maior `criado_em` de um conjunto de linhas do banco. */
function maiorCarimbo(linhas: Array<{ criado_em?: string | null }>): string | null {
  const carimbos = linhas.map((linha) => linha.criado_em).filter((c): c is string => Boolean(c));
  return carimbos.length > 0 ? carimbos.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * As 11 atividades, com a procedência do que foi devolvido.
 *
 * Use esta função quando a procedência importar (diagnóstico, teste,
 * indicador na página). Para só listar, listarAtividades() abaixo.
 */
export async function listarAtividadesComOrigem(): Promise<Resultado<Atividade>> {
  const locais = atividadesLocais as Array<Atividade & { publicado?: boolean }>;
  if (!temSupabase()) return doJson(locais);

  try {
    const { data, error } = await (await obterCliente())
      .from('atividades')
      // criado_em entra na consulta só para virar `carimbo` e é retirado dos
      // registros logo abaixo: é a prova, impossível de fabricar a partir do
      // JSON, de que estas linhas vieram do Postgres.
      .select('id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider, criado_em')
      .order('titulo');

    // Banco fora do ar nao pode derrubar a pagina institucional: cai para o
    // JSON versionado, que e o mesmo conteudo real da ONG — agora dizendo
    // que caiu, no log e no campo `origem`.
    if (error || !data) {
      avisarQueCaiuParaOJson('atividades', error ?? 'a consulta voltou sem dados');
      return doJson(locais);
    }

    const linhas = data as Array<Atividade & { criado_em?: string | null }>;
    return {
      origem: 'banco',
      carimbo: maiorCarimbo(linhas),
      registros: linhas.map(({ criado_em: _descartado, ...resto }) => resto as Atividade)
    };
  } catch (erro) {
    repassarSeForControleDoNext(erro);
    // Falha de rede/DNS chega como excecao, nao como { error }: mesmo
    // tratamento, mesma rede de seguranca.
    avisarQueCaiuParaOJson('atividades', erro);
    return doJson(locais);
  }
}

/** O clipping (RF39), com a procedência do que foi devolvido. */
export async function listarClippingComOrigem(): Promise<Resultado<RegistroClipping>> {
  const locais = clippingLocal as Array<RegistroClipping & { publicado?: boolean }>;
  if (!temSupabase()) return doJson(locais);

  try {
    const { data, error } = await (await obterCliente())
      .from('clipping')
      .select('id, tipo, titulo, detalhe, ano, criado_em')
      .order('titulo');

    if (error || !data) {
      avisarQueCaiuParaOJson('clipping', error ?? 'a consulta voltou sem dados');
      return doJson(locais);
    }

    const linhas = data as Array<RegistroClipping & { criado_em?: string | null }>;
    return {
      origem: 'banco',
      carimbo: maiorCarimbo(linhas),
      registros: linhas.map(({ criado_em: _descartado, ...resto }) => resto as RegistroClipping)
    };
  } catch (erro) {
    repassarSeForControleDoNext(erro);
    avisarQueCaiuParaOJson('clipping', erro);
    return doJson(locais);
  }
}

export async function listarAtividades(): Promise<Atividade[]> {
  return (await listarAtividadesComOrigem()).registros;
}

export async function listarClipping(): Promise<RegistroClipping[]> {
  return (await listarClippingComOrigem()).registros;
}

// =====================================================================
// A LEITURA DO PAINEL (RF03/RF33, Tarefa P4)
//
// As duas funções abaixo são as únicas deste arquivo que NÃO caem para o
// JSON versionado. É a decisão mais importante da tarefa, e ela é o
// contrário da política do resto do módulo:
//
//   · /projetos é página pública. Se o banco não responde, servir o JSON
//     com o mesmo conteúdo real é melhor que servir uma página vazia;
//   · o PAINEL é a tela de edição. Servir o JSON ali seria desenhar uma
//     lista de 11 atividades com botão "Editar" ao lado de cada uma,
//     sabendo que nenhum daqueles textos é o que está no banco e que o
//     `update` da Action não tem linha para acertar. A equipe corrigiria o
//     texto, a Action responderia "esta atividade não está mais no banco",
//     e a explicação estaria a três camadas de distância.
//
// Então aqui a falha é DECLARADA: `Degradavel<T>`, com `degradou` chegando
// à tela, que mostra o aviso de falha em vez do estado vazio — a mesma
// escolha (e o mesmo motivo) de servidor/dados/publicacoes.ts e
// servidor/dados/galeria.ts para as listas da equipe.
//
// `publicado` VEM NA CONSULTA, ao contrário de `listarAtividadesComOrigem`:
// a tela do painel precisa DESENHAR se a atividade está no ar, e é essa
// informação que decide qual botão aparece. Na página pública ele é só
// filtro, e quem filtra é a RLS.
//
// QUEM AUTORIZA CONTINUA SENDO A RLS: a política de `atividades` é
// `using (publicado or public.eh_equipe())` (002_conteudo.sql). Estas
// funções não têm `.eq('publicado', ...)` nenhum — para quem não é equipe o
// Postgres devolveria só as publicadas, mesmo que a página fosse aberta.
// =====================================================================

/**
 * Uma atividade como o PAINEL precisa dela: tudo o que a página pública
 * mostra, mais o estado de publicação.
 */
export type AtividadeDoPainel = Atividade & { publicado: boolean };

/** Os campos da tabela que alguma tela do painel de fato lê. */
const COLUNAS_DO_PAINEL =
  'id, titulo, resumo, descricao, genero, duracao, elenco, classificacao, local, rider, publicado';

/**
 * As atividades para a lista da equipe — publicadas e fora do ar, em ordem
 * de título.
 *
 * Ordena por `titulo` como a consulta pública, e não por data: a lista é
 * fechada (11 registros que a ONG escreveu, sem criar nem apagar), então o
 * que a equipe faz aqui é PROCURAR uma pela outra, e ordem alfabética é o
 * que torna isso possível numa tela de celular.
 */
export async function listarAtividadesDoPainel(): Promise<Degradavel<AtividadeDoPainel[]>> {
  return consultarComEstado<AtividadeDoPainel[]>('atividades (painel)', async () =>
    (await obterCliente())
      .from('atividades')
      .select(COLUNAS_DO_PAINEL)
      .order('titulo'),
  []);
}

/**
 * Uma atividade pelo id, para a tela de edição.
 *
 * DEVOLVE `Degradavel` pelo mesmo motivo de `buscarPublicacao`: sem a
 * distinção, uma queda do Supabase apareceria para a equipe como se a
 * atividade tivesse sumido — e a reação natural a isso é achar que o
 * painel apagou conteúdo da ONG.
 */
export async function buscarAtividadeDoPainel(
  id: string
): Promise<Degradavel<AtividadeDoPainel | null>> {
  return consultarComEstado<AtividadeDoPainel | null>('atividades (por id)', async () =>
    (await obterCliente())
      .from('atividades')
      .select(COLUNAS_DO_PAINEL)
      .eq('id', id)
      .maybeSingle(),
  null);
}
