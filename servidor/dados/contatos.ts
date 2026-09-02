import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComContagem, type Degradavel } from './degradacao';

/**
 * As mensagens recebidas (RF29) — o "registro central de contatos".
 *
 * ===================================================================
 * ESTE MÓDULO NÃO TEM LEITOR PÚBLICO, E É O ÚNICO ASSIM
 * ===================================================================
 *
 * `servidor/dados/publicacoes.ts` tem duas leituras (a página pública e o
 * painel) separadas por intenção, com a RLS decidindo de verdade. Aqui não
 * existe a metade pública: a política do banco é
 *
 *     contatos: equipe gerencia — for all using (public.eh_equipe())
 *
 * (supabase/migrations/004_pessoas.sql) e `anon` recebe `grant insert` e
 * NADA MAIS — medido contra Postgres real em testes/rls.test.mjs: um
 * `select` anônimo responde `42501 permission denied`, sem sequer chegar à
 * RLS. Ou seja, uma função de leitura pública aqui não seria perigosa, seria
 * INÚTIL: devolveria erro sempre. A tranca continua sendo a RLS, não a
 * ausência da função (regras 5 e 6 do CLAUDE.md).
 *
 * ===================================================================
 * SEM JSON IRMÃO, E SEM QUEDA PARA LISTA VAZIA SILENCIOSA
 * ===================================================================
 *
 * Não há, e não pode haver, cópia versionada de mensagem de pessoa real em
 * `dados-iniciais/` — seria dado pessoal de terceiro dentro do repositório.
 * Então a degradação é para lista vazia, como em eventos/acervo, MAS a
 * função devolve `Degradavel<T>` para a tela poder DIZER que falhou.
 *
 * A indistinção que isso evita é a pior possível nesta tela: uma lista
 * vazia significaria "ninguém escreveu para a ONG", e a equipe fecharia o
 * celular. Com a falha declarada, ela sabe que as mensagens continuam lá e
 * volta depois. Mesmo motivo de `listarTodas()` em publicacoes.ts, com o
 * agravante de que aqui o que se perde de vista é gente esperando resposta.
 */

/**
 * Uma mensagem recebida. Os campos são as colunas de `public.contatos` —
 * TODAS elas, porque numa tela de atendimento não há coluna que "não
 * interessa": o telefone é como se responde, a instituição é o contexto, e
 * `consentimento_dados` é o que diz à equipe que pode responder.
 */
export type Contato = {
  id: string;
  origem: string;
  nome: string;
  email: string;
  telefone: string | null;
  instituicao: string | null;
  mensagem: string;
  situacao: string;
  consentimento_dados: boolean;
  criado_em: string;
};

/**
 * O que a tela da equipe mostra: TUDO.
 *
 * ===================================================================
 * A CONSULTA PEDE `criado_em desc`, E A ORDEM FINAL É OUTRA
 * ===================================================================
 *
 * O banco ordena pelo índice que existe (`contatos_criado_em_idx`, em
 * 004_pessoas.sql). A ordem da TELA — "não respondidas primeiro, e dentro
 * de cada grupo da mais nova para a mais antiga" — é decidida por
 * `montarTriagem`, em compartilhado/triagem-de-contatos.ts, e aplicada na
 * página. Duas etapas, e não um `.order('situacao')` no PostgREST, por dois
 * motivos:
 *
 *  1. ordenar por `situacao` no banco daria a ordem alfabética
 *     ('concluido', 'em_contato', 'novo'), que por acaso invertida é quase
 *     a ordem certa. Depender desse acaso é depender de nenhuma quarta
 *     situação nascer com a letra errada;
 *  2. em JavaScript a regra fica num módulo puro sem imports, que
 *     `testes/contatos.test.mjs` exercita sem subir o Next — e esta tela
 *     está atrás de uma guarda que responde 404 para todo mundo que não é
 *     equipe, então o que não for medido assim não é medido.
 *
 * PAGINADA DESDE O PEDIDO V1 — e o comentário que estava aqui antes já
 * dizia como teria de ser feito:
 *
 *     "SEM LIMITE, e isso é decisão, não esquecimento. Um `.limit(n)` numa
 *      fila de atendimento esconde mensagem sem dizer que escondeu (…). No
 *      dia em que não couber, o caminho é filtro por situação com o TOTAL
 *      ESCRITO NA TELA, nunca um corte silencioso."
 *
 * É o que existe agora. `{ count: 'exact' }` traz quantas mensagens há NO
 * TOTAL junto com o recorte, e `componentes/Paginacao.ts` é obrigado a
 * escrever esse número — uma paginação que só sabe "há mais" é o corte
 * silencioso com outra roupa.
 *
 * A ORDEM DA FILA NÃO MUDA: `ordenarParaAtendimento` continua pondo quem
 * espera resposta em cima. Ela ordena o que CHEGOU, e o recorte é feito
 * pelo banco — então a página 1 traz as vinte mais recentes, e a ordenação
 * de atendimento reorganiza essas vinte. É uma limitação conhecida e
 * aceita: ordenar por situação no banco exigiria um `order` por expressão,
 * e a fila cabe em poucas páginas.
 */
export async function listarContatos(
  paginacao?: { de: number; ate: number }
): Promise<Degradavel<Contato[]> & { total: number | null }> {
  return consultarComContagem<Contato[]>('contatos (painel)', async () => {
    const consulta = (await obterCliente())
      .from('contatos')
      .select('*', { count: 'exact' })
      .order('criado_em', { ascending: false });

    return paginacao ? consulta.range(paginacao.de, paginacao.ate) : consulta;
  }, []);
}
