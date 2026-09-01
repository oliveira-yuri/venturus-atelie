import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';

/**
 * Áreas de voluntariado (RF24). Porte de site/assets/js/dados/
 * voluntariado.js — só a LEITURA das áreas.
 *
 * A ESCRITA DA CANDIDATURA (RF25) NÃO MORA AQUI, e isso não é sobra do
 * porte: é a arquitetura do CLAUDE.md — "escrita fica em `acoes/`, leitura
 * em `servidor/dados/`". Quem grava em `public.voluntarios` e
 * `public.voluntario_areas` é `acoes/voluntariado.ts`, que é Server Action
 * e por isso pergunta sozinho quem está autenticado. Este módulo continua
 * só lendo — e desde a RF25 ele lê para DOIS públicos, o que é o motivo de
 * `listarAreasComEstado()` existir logo abaixo.
 *
 * Consulta copiada COMO ESTÁ — `select('*')`, sem enumerar coluna
 * (restrição global 1 desta fase): mesmo motivo de servidor/dados/
 * eventos.ts e acervo.ts.
 */

/**
 * Uma área de voluntariado. `ordem` (a coluna que a consulta usa para
 * ordenar) fica fora do tipo pelo mesmo motivo de `publicado` em `Evento`
 * (servidor/dados/eventos.ts): é campo de ORDENAÇÃO da consulta, não de
 * apresentação — nenhum componente portado até agora exibe um número de
 * ordem.
 */
export type Area = {
  id: string;
  nome: string;
  descricao: string;
};

/**
 * A GUARDA DE CONFIGURAÇÃO E A POLÍTICA DE ERRO MORAM EM
 * servidor/dados/degradacao.ts.
 *
 * Em modo offline (`npm test`, sem SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL)
 * não há fonte nenhuma para consultar. DIFERENTE de atividades/clipping:
 * esta tabela não tem JSON versionado irmão em dados-iniciais/ para servir
 * de fallback — as cinco áreas só existem no seed do Postgres (supabase/
 * seed.sql). Devolver lista vazia aqui é o MESMO comportamento que
 * site/assets/js/dados/voluntariado.js já tinha (supabaseConfigurado())
 * antes deste porte.
 *
 * ESTA É A TABELA ONDE DEGRADAR CUSTA MAIS CARO, e vale dizer em voz alta:
 * as cinco áreas EXISTEM de verdade no banco hoje (as outras duas tabelas
 * desta política, `eventos` e `acervo`, estão vazias). Então tanto a
 * consulta falhando quanto — o segundo modo de falha, achado na revisão
 * final — publicar na Netlify sem as variáveis de ambiente troca conteúdo
 * real da ONG pelo estado vazio, sem nada na tela denunciando. Os dois
 * casos agora avisam no log do servidor (avisarQueDegradou e
 * avisarQueNaoHaSupabase, em degradacao.ts); antes desta correção o
 * primeiro derrubava a página com 500 e o segundo era silêncio total.
 */

/**
 * As cinco áreas de atuação nomeadas pela ONG (RF24), na ordem que a equipe
 * definiu — E SE A CONSULTA DEGRADOU.
 *
 * A DISTINÇÃO NASCEU COM A RF25, e por um defeito que teria sido invisível.
 * `validarCandidatura` (compartilhado/validacao.ts) confere as áreas
 * escolhidas contra ESTA lista. Se a consulta falhar, ela volta vazia — e
 * uma lista vazia faria toda escolha virar "essa área não está mais na
 * lista", ou seja, o site acusaria a PESSOA de um defeito do SERVIDOR, logo
 * depois de ela ter marcado três caixas que a tela desenhou.
 *
 * Numa página institucional degradar em silêncio é a política certa (ver o
 * cabeçalho de servidor/dados/degradacao.ts): a seção fica vazia e o site
 * continua no ar. Numa GRAVAÇÃO não é — o desfecho seguro é dizer que não
 * deu para conferir agora e não gravar nada, que é o que
 * `acoes/voluntariado.ts` faz com esta bandeira.
 */
export async function listarAreasComEstado(): Promise<Degradavel<Area[]>> {
  return consultarComEstado<Area[]>('areas_voluntariado', async () =>
    (await obterCliente())
      .from('areas_voluntariado')
      .select('*')
      .order('ordem'),
  []);
}

/**
 * Idem, para quem só precisa desenhar a lista — que é o caso de
 * `/voluntariado` e da tela de candidatura.
 *
 * As duas telas continuam sem distinguir "não há área cadastrada" de "não
 * deu para perguntar", e isso é deliberado: o estado vazio de
 * componentes/ListaAreas.ts já é texto real da ONG, e o único lugar onde a
 * diferença aparece é o log do servidor (`avisarQueDegradou`).
 */
export async function listarAreas(): Promise<Area[]> {
  return (await listarAreasComEstado()).valor;
}
