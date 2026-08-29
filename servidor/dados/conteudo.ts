import 'server-only';
import { obterCliente } from '../supabase';
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

/**
 * Conteudo institucional com fonte dupla.
 *
 * Enquanto o projeto Supabase nao esta configurado no ambiente, le o JSON
 * versionado em dados-iniciais/. Quando SUPABASE_URL e
 * SUPABASE_CHAVE_PUBLICAVEL existem, passa a consultar a tabela — e nenhuma
 * pagina precisa mudar, porque todas falam so com estas funcoes.
 *
 * O mesmo JSON e a origem do seed.sql (ferramentas/gerar-seed.mjs), entao as
 * duas fontes nascem com o mesmo conteudo real da ONG.
 */
function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

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

/**
 * Erro do PostgREST NÃO é um Error: é um objeto simples com message/code/
 * details/hint. `String(motivo)` nele imprime "[object Object]" — um aviso
 * que não diz qual das causas ocorreu (chave errada, grant faltando, RLS,
 * coluna renomeada) é quase tão inútil quanto não avisar.
 */
function descrever(motivo: unknown): string {
  if (motivo instanceof Error) return motivo.message;
  if (motivo && typeof motivo === 'object') {
    const e = motivo as { message?: string; code?: string; hint?: string; details?: string };
    const partes = [e.message, e.code && `código ${e.code}`, e.details, e.hint].filter(Boolean);
    if (partes.length > 0) return partes.join(' | ');
    return JSON.stringify(motivo);
  }
  return String(motivo);
}

/**
 * Erros de CONTROLE do Next não podem ser engolidos por este catch.
 *
 * Achado ao rodar o modo degradado (`npm run test:supabase-degradado`) e ler
 * o log do build: durante `next build` o Next tenta renderizar a página
 * estaticamente, `cookies()` (dentro de obterCliente()) lança
 * DynamicServerError para avisar "esta rota é dinâmica", e o catch abaixo
 * tratava isso como "o Supabase não respondeu" — avisando errado no log e,
 * pior, ABAFANDO o sinal que faz o Next marcar a rota como dinâmica. Hoje
 * não deu prejuízo porque app/layout.tsx usa headers() para o nonce da CSP,
 * o que já torna toda rota dinâmica; no dia em que isso mudar, /para-escolas
 * seria pré-renderizada com o JSON e serviria conteúdo congelado para
 * sempre, sem erro nenhum.
 *
 * Todo erro de controle do Next carrega `digest` (DYNAMIC_SERVER_USAGE,
 * NEXT_REDIRECT, NEXT_NOT_FOUND, NEXT_HTTP_ERROR_FALLBACK...). Falha de
 * rede, DNS e timeout não carregam. Então a regra é: com digest, repassa.
 */
function repassarSeForControleDoNext(erro: unknown): void {
  if (erro && typeof erro === 'object' && typeof (erro as { digest?: unknown }).digest === 'string') {
    throw erro;
  }
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
