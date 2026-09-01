import 'server-only';
import { obterCliente } from '../supabase';
import {
  temSupabase, avisarQueNaoHaSupabase, repassarSeForControleDoNext, descrever
} from './degradacao';
import { comPrazo } from '@/compartilhado/prazo';
import { INDICADORES, type ChaveDeIndicador, type Indicador } from '@/compartilhado/indicadores';

/**
 * servidor/dados/indicadores.ts — as consultas por trás dos números da home
 * do painel (RF30).
 *
 * As DEFINIÇÕES (o que cada número quer dizer, para onde leva) moram em
 * compartilhado/indicadores.ts, que não importa nada e por isso cabe num
 * teste do Node. Aqui fica só o que precisa do banco.
 *
 * ===================================================================
 * `count` DO POSTGREST, NUNCA `data.length`
 * ===================================================================
 *
 * Toda consulta abaixo é `select(..., { count: 'exact', head: true })`. O
 * `head: true` faz o PostgREST responder SEM CORPO: o número vem no
 * cabeçalho `Content-Range`, e nenhuma linha atravessa a rede.
 *
 * A alternativa — buscar as linhas e contar em JavaScript — seria trazer o
 * texto de todas as mensagens recebidas para desenhar o algarismo "3", numa
 * página que a equipe abre do celular, no meio de um evento (regra 4 do
 * CLAUDE.md). E seria mais que lento: mensagem tem nome, telefone e texto
 * livre de terceiro, e esses bytes não têm nada que fazer numa contagem.
 * Nenhuma destas seis consultas devolve um dado pessoal sequer.
 *
 * ===================================================================
 * QUEM AUTORIZA CONTINUA SENDO A RLS
 * ===================================================================
 *
 * O `count` respeita a política: quem não é equipe conta ZERO em `contatos`
 * e `voluntarios`, porque a RLS filtra antes. Ou seja, este módulo não é a
 * tranca — ele nem precisaria de guarda para ser seguro. A guarda está na
 * PÁGINA que o chama (`app/admin/page.tsx`), e existe para que a página
 * inteira não exista para quem não é equipe, não para proteger a contagem.
 *
 * ===================================================================
 * A POLÍTICA DE ERRO É DIFERENTE DA DO PAINEL, E ISSO É DELIBERADO
 * ===================================================================
 *
 * `servidor/permissao.ts` falha FECHADA: erro de consulta vira 404. Aqui
 * não. Uma contagem que falha devolve `null` e a home continua de pé, com
 * os quatro cartões de tela funcionando — porque a home existe para LEVAR A
 * EQUIPE ÀS TELAS, e derrubá-la por causa de um número seria trocar a
 * função pelo enfeite.
 *
 * O que NÃO se faz é o contrário disso: devolver `0` quando a consulta
 * falhou. "0 mensagens esperando" faz a equipe fechar o celular; um traço
 * com o aviso ao lado faz ela voltar depois. A distinção inteira está em
 * `Indicador.quantidade`, em compartilhado/indicadores.ts.
 *
 * ===================================================================
 * PRAZO POR CONSULTA, E AS SEIS EM PARALELO
 * ===================================================================
 *
 * `comPrazo` pelo mesmo motivo de servidor/permissao.ts: o `AbortSignal` de
 * servidor/supabase.ts corta cada tentativa, não a soma delas (a medição de
 * 50,9 s está em compartilhado/prazo.ts). Sem prazo, o banco lento não
 * deixaria a home LENTA — deixaria a home INALCANÇÁVEL, e a equipe não
 * chegaria às telas por causa de um número.
 *
 * O prazo é mais curto que o da permissão (3 s contra 5 s) e a razão é a
 * hierarquia: sem a permissão não há página; sem o número há página com um
 * traço. Quem espera menos é o que importa menos.
 *
 * `Promise.all` porque as seis são independentes: em série o pior caso
 * seria 6 × 3 s.
 */

/** Ver o bloco acima. Mais curto que o prazo da permissão, de propósito. */
const PRAZO_DA_CONTAGEM_MS = 3_000;

type Cliente = Awaited<ReturnType<typeof obterCliente>>;

/** O que uma consulta de contagem devolve — a forma do PostgREST com `head`. */
type RespostaDeContagem = { count: number | null; error: unknown };

/**
 * A consulta de cada número, e a TABELA que ela toca (que é o que vai para o
 * log quando falha — sem isso, um aviso `[dados]` não diz qual das seis).
 *
 * `select('id', ...)` e não `select('*')`: com `head: true` nenhuma coluna é
 * transferida de qualquer forma, mas nomear uma só deixa escrito que aqui
 * ninguém quer o conteúdo.
 *
 * OS FILTROS SÃO OS VALORES DAS COLUNAS, literais, iguais aos `check` das
 * migrations: `situacao = 'novo'` é o mesmo de supabase/migrations/
 * 004_pessoas.sql, `publicado` é `boolean not null` em 002_conteudo.sql.
 *
 * `fotos-no-ar` cobra as DUAS condições (`publicado` E
 * `autorizacao_registrada`) porque é isso que a política de leitura pública
 * de `public.midia` exige — contar só `publicado` daria um número maior que
 * o de fotos que o site de fato mostra, e o número existe justamente para
 * conferir o que o site mostra. `fotos-fora-do-ar` é o complemento
 * operacional: o que foi enviado e ainda não está no ar.
 */
const CONSULTAS: Record<ChaveDeIndicador, { tabela: string; contar: (cliente: Cliente) => PromiseLike<RespostaDeContagem> }> = {
  'mensagens-esperando': {
    tabela: 'contatos',
    contar: (cliente) => cliente
      .from('contatos')
      .select('id', { count: 'exact', head: true })
      .eq('situacao', 'novo')
  },
  'candidaturas-esperando': {
    tabela: 'voluntarios',
    contar: (cliente) => cliente
      .from('voluntarios')
      .select('id', { count: 'exact', head: true })
      .eq('situacao', 'novo')
  },
  'noticias-rascunho': {
    tabela: 'publicacoes',
    contar: (cliente) => cliente
      .from('publicacoes')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', false)
  },
  'fotos-fora-do-ar': {
    tabela: 'midia',
    contar: (cliente) => cliente
      .from('midia')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', false)
  },
  'noticias-no-ar': {
    tabela: 'publicacoes',
    contar: (cliente) => cliente
      .from('publicacoes')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true)
  },
  'fotos-no-ar': {
    tabela: 'midia',
    contar: (cliente) => cliente
      .from('midia')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true)
      .eq('autorizacao_registrada', true)
  }
};

/**
 * Uma contagem, com todo desfecho ruim virando `null`.
 *
 * `count` nulo SEM erro também vira `null`, e não zero: o PostgREST só
 * devolve `count` quando a opção foi pedida, então nulo aqui significa que a
 * resposta veio com outra forma — o que é "não sei", não "nenhum".
 */
async function contar(chave: ChaveDeIndicador, cliente: Cliente): Promise<number | null> {
  const { tabela, contar: consultar } = CONSULTAS[chave];

  try {
    // A função assíncrona em volta existe por TIPO, não por gosto, e é a
    // mesma de servidor/permissao.ts: o builder do PostgREST é um
    // "thenable", não um Promise, e `comPrazo` recebe Promise. Envolvendo,
    // a consulta continua sendo disparada pelo `await` — é ele que executa
    // um builder — e o prazo passa a valer sobre uma promessa de verdade.
    const resposta = await comPrazo(
      (async () => consultar(cliente))(),
      PRAZO_DA_CONTAGEM_MS
    );

    if (resposta === null) {
      console.warn(
        `[dados] "${tabela}": a contagem de "${chave}" passou de ${PRAZO_DA_CONTAGEM_MS}ms. `
        + 'A home do painel vai ao ar com um traço no lugar do número — nunca com zero, que '
        + 'seria uma resposta que ninguém deu.'
      );
      return null;
    }

    if (resposta.error) {
      console.warn(
        `[dados] "${tabela}": a contagem de "${chave}" não voltou. A home do painel mostra um `
        + `traço no lugar do número. Motivo: ${descrever(resposta.error)}`
      );
      return null;
    }

    return typeof resposta.count === 'number' ? resposta.count : null;
  } catch (erro) {
    // Erro de controle do Next (NEXT_NOT_FOUND, DYNAMIC_SERVER_USAGE...) não
    // é falha de dados e não pode ser engolido aqui — o motivo inteiro está
    // em servidor/dados/degradacao.ts.
    repassarSeForControleDoNext(erro);

    console.warn(
      `[dados] "${tabela}": exceção ao contar "${chave}": ${descrever(erro)}. `
      + 'A home do painel mostra um traço no lugar do número.'
    );
    return null;
  }
}

/**
 * Os seis números da home do painel, na ordem de compartilhado/indicadores.ts.
 *
 * SEM SUPABASE, TODOS VOLTAM `null` — e não zero. Acontece no modo offline
 * de `npm test` e num deploy sem as variáveis no painel da Netlify
 * (CLAUDE.md, item 0e). Na prática ninguém vê esta tela nesse estado, porque
 * sem Supabase `ehEquipe()` já respondeu 404; o `null` existe para que, se
 * a ordem mudar um dia, o painel não invente seis zeros tranquilizadores
 * para um banco que ninguém consultou.
 */
export async function listarIndicadores(): Promise<Indicador[]> {
  if (!temSupabase()) {
    avisarQueNaoHaSupabase('indicadores do painel');
    return INDICADORES.map((definicao) => ({ ...definicao, quantidade: null }));
  }

  const cliente = await obterCliente();

  const quantidades = await Promise.all(
    INDICADORES.map((definicao) => contar(definicao.chave, cliente))
  );

  return INDICADORES.map((definicao, indice) => ({
    ...definicao,
    quantidade: quantidades[indice]
  }));
}
