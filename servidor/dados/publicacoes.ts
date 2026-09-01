import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, consultarOuDegradar, type Degradavel } from './degradacao';

/**
 * Publicações — notícias e campanhas (RF04). Tarefa P2 do painel.
 *
 * ===================================================================
 * A MESMA TABELA, DOIS LEITORES, E QUEM SEPARA OS DOIS É A RLS
 * ===================================================================
 *
 * `listarPublicadas()` serve /noticias, que é página pública; as outras duas
 * servem o painel da equipe. A diferença entre elas NÃO é o que autoriza
 * nada — a política do banco é
 *
 *     using (publicado or public.eh_equipe())
 *
 * (supabase/migrations/002_conteudo.sql), ou seja, mesmo que alguém chamasse
 * `listarTodas()` de uma página pública, o Postgres devolveria só as
 * publicadas. O `.eq('publicado', true)` de `listarPublicadas()` é INTENÇÃO
 * escrita — "esta consulta é a da página pública" —, não a tranca. A tranca
 * é a RLS (regras 5 e 6 do CLAUDE.md), e o cliente deste projeto usa a
 * sessão de quem pediu: não existe chave de serviço aqui (spec §4.1).
 *
 * ===================================================================
 * SEM JSON IRMÃO — E É O CASO CERTO
 * ===================================================================
 *
 * servidor/dados/conteudo.ts cai para o JSON versionado quando o banco não
 * responde, porque atividades e clipping têm conteúdo real versionado em
 * `dados-iniciais/`. Aqui não há: nenhuma notícia da ONG existe no
 * repositório, e a regra 2 do CLAUDE.md proíbe inventar uma. Então a
 * degradação é para LISTA VAZIA, como eventos/acervo/voluntariado — a página
 * fica no ar com o estado vazio escrito, e o aviso `[dados]` no log é o
 * único lugar onde "não há notícia" se distingue de "não deu para
 * perguntar" (ver o cabeçalho de servidor/dados/degradacao.ts).
 *
 * NO PAINEL essa indistinção não é aceitável, e por isso as duas funções da
 * equipe devolvem `Degradavel<T>` em vez do valor puro: uma lista vazia numa
 * tela onde a pessoa ACABOU de escrever uma notícia faria ela pensar que o
 * texto se perdeu e escrever tudo de novo. A tela mostra o aviso de falha
 * (app/admin/publicacoes/page.tsx) em vez do estado vazio.
 */

/**
 * Uma publicação. Os campos espelham as colunas de `public.publicacoes` que
 * alguma tela de fato lê.
 *
 * `publicado` ESTÁ AQUI, diferente do que acontece em `Evento` e `Atividade`
 * (onde ele é só filtro de consulta): a tela do painel precisa DESENHAR o
 * estado de cada item — é a informação mais importante daquela lista, e a
 * que decide qual botão aparece.
 *
 * `imagem_caminho` e `imagem_alt` ficam de fora: existem na tabela, ninguém
 * as escreve nem as lê até a Tarefa P3 (Supabase Storage). A consulta é
 * `select('*')` (mesma convenção de servidor/dados/eventos.ts), então elas
 * chegam do banco e são ignoradas aqui — quando P3 existir, é só acrescentar
 * ao tipo, sem tocar em consulta nenhuma.
 */
export type Publicacao = {
  id: string;
  titulo: string;
  resumo: string | null;
  corpo: string;
  publicado: boolean;
  publicado_em: string | null;
  criado_em: string;
};

/**
 * O que /noticias mostra: só o que está publicado, do mais recente ao mais
 * antigo.
 *
 * `nullsFirst: false` não é detalhe de gosto. No Postgres, `order by ... desc`
 * traz NULL PRIMEIRO por padrão, e `publicado_em` pode ser nulo numa linha
 * publicada — basta alguém ligar a coluna `publicado` direto pelo painel do
 * Supabase, sem passar pela Action que grava a data. Sem isto, essa linha sem
 * data ficaria eternamente no topo da página de notícias.
 */
export async function listarPublicadas(): Promise<Publicacao[]> {
  return consultarOuDegradar<Publicacao[]>('publicacoes (públicas)', async () =>
    (await obterCliente())
      .from('publicacoes')
      .select('*')
      .eq('publicado', true)
      .order('publicado_em', { ascending: false, nullsFirst: false }),
  []);
}

/**
 * O que o painel mostra: tudo — rascunho e publicado —, do mais novo ao mais
 * antigo POR CRIAÇÃO.
 *
 * Ordenar por `criado_em`, e não por `publicado_em`, porque na tela de
 * trabalho o que importa é "o que eu escrevi por último", e rascunho não tem
 * data de publicação nenhuma: por `publicado_em` todos os rascunhos —
 * justamente o que a pessoa veio terminar — cairiam juntos numa ponta só da
 * lista.
 */
export async function listarTodas(): Promise<Degradavel<Publicacao[]>> {
  return consultarComEstado<Publicacao[]>('publicacoes (painel)', async () =>
    (await obterCliente())
      .from('publicacoes')
      .select('*')
      .order('criado_em', { ascending: false }),
  []);
}

/**
 * Uma publicação pelo id — para a tela de edição e para a Action de
 * publicar, que precisa saber se `publicado_em` já existe.
 *
 * DEVOLVE `Degradavel`, e é isto que permite à tela de edição distinguir
 * "esta notícia não existe" (404 honesto) de "o banco não respondeu" (aviso
 * de falha, com o caminho de volta). Sem a distinção, uma queda do Supabase
 * apareceria para a equipe como se a notícia tivesse sumido — e a reação
 * natural a isso é escrever tudo de novo.
 */
export async function buscarPublicacao(id: string): Promise<Degradavel<Publicacao | null>> {
  return consultarComEstado<Publicacao | null>('publicacoes (por id)', async () =>
    (await obterCliente())
      .from('publicacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
  null);
}
