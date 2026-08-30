import 'server-only';
import { obterCliente } from '../supabase';
import { consultarOuDegradar } from './degradacao';

/**
 * Eventos e agenda pública (RF13-RF18) — porte de
 * site/assets/js/dados/eventos.js.
 *
 * Consultas copiadas COMO ESTÃO — `select('*')`, sem enumerar coluna
 * (restrição global 1 desta fase). Diferente de servidor/dados/conteudo.ts,
 * este módulo não tem JSON local irmão para comparar contra: a tabela
 * `eventos` só existe no Postgres. Um nome de coluna inventado aqui não
 * teria como ser pego por nenhuma comparação — foi exatamente esse
 * mecanismo que mascarou seis nomes inventados no brief da fase 1.
 *
 * `inscrever()` (RF15, inscrição sem conta) fica de fora deste porte —
 * Bloco B.
 */

/**
 * Um evento da agenda pública. Os campos espelham as colunas de
 * public.eventos (migration 003_eventos.sql) que alguma tela portada até
 * agora de fato lê — não a tabela inteira: `vagas`, `imagem_caminho`,
 * `imagem_alt`, `exige_cpf` e `criado_em` existem na tabela e ficam de
 * fora daqui porque nenhum componente os usa (site/assets/js/paginas/
 * agenda.js também nunca os lia). `publicado` fica de fora pelo mesmo
 * motivo de `Atividade` em servidor/dados/conteudo.ts: é campo de filtro
 * da consulta, não de apresentação.
 */
export type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  comeca_em: string;
  termina_em: string | null;
  local: string | null;
  faixa_etaria: string | null;
};

/**
 * A GUARDA DE CONFIGURAÇÃO E A POLÍTICA DE ERRO MORAM EM
 * servidor/dados/degradacao.ts.
 *
 * Sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL no ambiente (é assim que
 * `npm test` roda de propósito — ver o comentário de "MODO OFFLINE" em
 * ferramentas/rodar-testes.mjs), não há fonte nenhuma para consultar: ao
 * contrário de atividades/clipping, a agenda não tem JSON versionado
 * irmão para servir de fallback (a tabela está vazia em produção hoje, sem
 * conteúdo real ainda para versionar). Devolver lista vazia aqui é o MESMO
 * comportamento que site/assets/js/dados/supabase.js já tinha
 * (supabaseConfigurado()) antes deste porte.
 *
 * O QUE MUDOU NA REVISÃO FINAL DO BLOCO A: as três funções abaixo faziam
 * `if (error) throw error`, e MEDIDO com o Supabase configurado e a
 * consulta falhando, /agenda respondia 500 com a página de erro embutida do
 * Next — sem cabeçalho, sem rodapé, sem `<main id="conteudo">`. Agora
 * degradam para lista vazia (o estado vazio da Tarefa A4 já está escrito e
 * aprovado) e avisam no log. Ver o cabeçalho de degradacao.ts para o
 * porquê da política e para o que ela custa.
 */

/** Próximos eventos publicados, do mais próximo ao mais distante. */
export async function listarProximos(): Promise<Evento[]> {
  return consultarOuDegradar<Evento[]>('eventos (próximos)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .eq('publicado', true)
      .gte('comeca_em', new Date().toISOString())
      .order('comeca_em', { ascending: true }),
  []);
}

/** Eventos que já aconteceram — o escopo pede que continuem acessíveis. */
export async function listarPassados(): Promise<Evento[]> {
  return consultarOuDegradar<Evento[]>('eventos (passados)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .eq('publicado', true)
      .lt('comeca_em', new Date().toISOString())
      .order('comeca_em', { ascending: false })
      .limit(20),
  []);
}

/**
 * Um evento pelo id — usada pela página de inscrição (RF15, Bloco B).
 *
 * NENHUM CHAMADOR HOJE: a página de inscrição é Bloco B. Fica, em vez de
 * ser apagada, porque a consulta é o porte literal de
 * site/assets/js/dados/eventos.js e reescrevê-la depois seria reinventar
 * uma linha que já existe funcionando em produção.
 *
 * O que a revisão final pegou: era a ÚNICA consulta do projeto sem guarda
 * de configuração — chamada sem SUPABASE_URL, ela ia direto para
 * obterCliente(), que passa `undefined` ao createServerClient e estoura.
 * Agora passa por consultarOuDegradar() como as outras: sem configuração
 * ou com a consulta falhando, devolve null, e quem chamar (Bloco B) trata
 * isso como "evento não encontrado" — que é a resposta honesta quando não
 * se conseguiu perguntar.
 */
export async function buscarEvento(id: string): Promise<Evento | null> {
  return consultarOuDegradar<Evento | null>('eventos (por id)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
  null);
}
