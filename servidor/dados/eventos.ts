import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, consultarOuDegradar, type Degradavel } from './degradacao';

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

// =====================================================================
// O que o PAINEL lê (RF13, Tarefa de eventos)
//
// A MESMA TABELA, DOIS LEITORES, E QUEM SEPARA OS DOIS É A RLS — o mesmo
// desenho de servidor/dados/publicacoes.ts, e vale palavra por palavra. A
// política do banco é
//
//     using (publicado or public.eh_equipe())
//
// (supabase/migrations/003_eventos.sql), ou seja, mesmo que alguém chamasse
// `listarEventosDoPainel()` de uma página pública, o Postgres devolveria só
// os publicados. O `.eq('publicado', true)` das duas funções lá em cima é
// INTENÇÃO escrita — "esta consulta é a da agenda pública" —, não a tranca.
//
// AS DUAS FUNÇÕES ABAIXO DEVOLVEM `Degradavel<T>`, e as de cima não. Não é
// inconsistência: na agenda, "não deu para perguntar" vira o estado vazio já
// escrito e ninguém se machuca. No painel, uma lista vazia numa tela onde a
// pessoa ACABOU de cadastrar um evento diria que o cadastro se perdeu, e a
// reação natural a isso é cadastrar de novo — dois eventos iguais na agenda,
// e nenhuma tela que apague um deles.
// =====================================================================

/**
 * Um evento como a EQUIPE o vê. É `Evento` mais as duas colunas que só a
 * tela de trabalho precisa desenhar.
 *
 * `publicado` está aqui, diferente de `Evento` (onde ele é só filtro de
 * consulta), pelo mesmo motivo de `Publicacao`: o estado de cada item é a
 * informação mais importante daquela lista, e é o que decide qual botão
 * aparece.
 *
 * `criado_em` está aqui e NÃO é desenhado hoje — está no tipo porque é o
 * critério de desempate da ordenação abaixo, e um campo que ordena a lista
 * sem aparecer no tipo é um campo que some na primeira refatoração.
 */
export type EventoDoPainel = Evento & {
  publicado: boolean;
  criado_em: string;
};

/**
 * Todos os eventos — rascunho e no ar —, do mais distante no futuro ao mais
 * antigo no passado.
 *
 * A ORDENAÇÃO É POR `comeca_em` DESCENDENTE, e não por `criado_em` como na
 * lista de notícias. A diferença vem do que a pessoa veio fazer: uma notícia
 * é procurada por "o que eu escrevi por último"; um evento é procurado por
 * QUANDO ELE ACONTECE. Descendente põe o que ainda vai acontecer no topo (as
 * datas futuras são as maiores) e empurra o que já passou para baixo, na
 * ordem em que aconteceu — que é a ordem em que se procura um arquivo.
 *
 * SEM `.limit()`, de propósito. Um corte silencioso numa agenda esconderia
 * evento sem dizer que escondeu — a mesma decisão da fila de
 * `servidor/dados/contatos.ts`. No dia em que a lista não couber numa
 * rolagem, o caminho é separar "em breve" de "já aconteceu" com o total
 * escrito na tela, nunca um `.limit(n)`.
 */
export async function listarEventosDoPainel(): Promise<Degradavel<EventoDoPainel[]>> {
  return consultarComEstado<EventoDoPainel[]>('eventos (painel)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .order('comeca_em', { ascending: false }),
  []);
}

/**
 * Um evento pelo id, para a tela de edição e para a Action de
 * publicar/tirar do ar.
 *
 * DEVOLVE `Degradavel`, e é isto que permite à tela de edição distinguir
 * "este evento não existe" (404 honesto) de "o banco não respondeu" (aviso
 * de falha, com o caminho de volta). Sem a distinção, uma queda do Supabase
 * apareceria para a equipe como se o evento tivesse sumido — e a reação
 * natural a isso é cadastrar tudo de novo.
 *
 * NÃO SUBSTITUI `buscarEvento()` acima, que continua existindo para o
 * caminho PÚBLICO (RF15, inscrição, quando existir): aquela devolve só o que
 * a agenda mostra e o valor puro; esta traz `publicado` junto, que é o que a
 * equipe precisa ver. Unificar as duas faria a página pública carregar o
 * estado de rascunho de um evento para dentro do HTML.
 */
export async function buscarEventoDoPainel(id: string): Promise<Degradavel<EventoDoPainel | null>> {
  return consultarComEstado<EventoDoPainel | null>('eventos (painel, por id)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
  null);
}

// =====================================================================
// O que a INSCRIÇÃO precisa saber do evento (RF15)
// =====================================================================

/**
 * Um evento como a tela de inscrição precisa vê-lo.
 *
 * `Evento` mais DUAS colunas, e as duas são regra de negócio, não
 * apresentação:
 *
 *  · `exige_cpf` (RN06) decide se o campo de CPF aparece E se ele é
 *    obrigatório. A tela desenha a partir daqui e `acoes/inscricoes.ts`
 *    VALIDA a partir daqui — a mesma fonte, lida duas vezes, porque a
 *    Action é alcançável sem passar pela tela (spec §4.5). Se este valor
 *    viesse do formulário, quem quisesse pular o campo mandaria `false`;
 *  · `vagas` é o que a tela usa para escrever "restam N" — o número em si
 *    vem de `vagasRestantes()`, que conta no banco; este campo é o que diz
 *    se HÁ limite.
 *
 * `publicado` NÃO entra: esta função já filtra por ele. Um evento em
 * rascunho não tem página de inscrição, e devolver `null` é a resposta
 * certa — quem tem o id de um rascunho não deve descobrir que ele existe.
 */
export type EventoParaInscricao = Evento & {
  exige_cpf: boolean;
  vagas: number | null;
};

/**
 * O evento de uma inscrição, se ele estiver PUBLICADO.
 *
 * SEPARADA DE `buscarEvento()` de propósito, e não é duplicação: aquela é
 * o porte literal do site antigo e não filtra por `publicado` — a RLS
 * filtra por ela (`using (publicado or eh_equipe())`), o que significa que
 * para QUEM É EQUIPE ela devolve rascunho. Uma página pública de inscrição
 * que usasse aquela função abriria inscrição em rascunho para a própria
 * equipe, que é justamente quem tem o link antes de todo mundo.
 *
 * O `.eq('publicado', true)` aqui é a intenção escrita: "esta consulta é a
 * do caminho público". A tranca continua sendo a RLS mais a
 * `reservar_vaga()` do banco, que confere de novo no instante de gravar.
 */
export async function buscarEventoParaInscricao(
  id: string
): Promise<Degradavel<EventoParaInscricao | null>> {
  return consultarComEstado<EventoParaInscricao | null>('eventos (inscrição)', async () =>
    (await obterCliente())
      .from('eventos')
      .select('*')
      .eq('id', id)
      .eq('publicado', true)
      .maybeSingle(),
  null);
}
