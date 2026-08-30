import 'server-only';
import { obterCliente } from '../supabase';
import { consultarOuDegradar } from './degradacao';

/**
 * Áreas de voluntariado (RF24). Porte de site/assets/js/dados/
 * voluntariado.js — só `listarAreas()`.
 *
 * `candidatar()` (RF25, candidatura ao voluntariado) FICA DE FORA deste
 * porte: exige perfil autenticado (perfil_id) e grava em duas tabelas
 * (`voluntarios`, `voluntario_areas`) — é Bloco B, quando a autenticação
 * chegar ao app novo. Portá-la agora sem ter onde chamá-la (nenhum
 * formulário desta tarefa registra candidatura) deixaria função morta no
 * módulo.
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

/** As cinco áreas de atuação nomeadas pela ONG (RF24), na ordem que a equipe definiu. */
export async function listarAreas(): Promise<Area[]> {
  return consultarOuDegradar<Area[]>('areas_voluntariado', async () =>
    (await obterCliente())
      .from('areas_voluntariado')
      .select('*')
      .order('ordem'),
  []);
}
