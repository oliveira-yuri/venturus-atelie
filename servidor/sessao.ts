import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { obterCliente } from './supabase';
import { temSupabase, repassarSeForControleDoNext, descrever } from './dados/degradacao';
import { temCookieDeSessao } from '@/compartilhado/cookies-de-sessao';
import { comPrazo } from '@/compartilhado/prazo';

/**
 * servidor/sessao.ts — "quem está do outro lado desta requisição?"
 *
 * Um lugar só, porque a resposta é usada em dois contextos que não podem
 * divergir: a PÁGINA /nova-senha (decide se mostra o formulário ou a
 * explicação) e a AÇÃO `definirNovaSenha` (decide se troca a senha). Se a
 * página perguntasse de um jeito e a ação de outro, a diferença entre os
 * dois seria exatamente o buraco: tela que aceita o que o servidor recusa,
 * ou pior, servidor que aceita o que a tela nem mostraria.
 *
 * `getUser()` E NÃO `getSession()`, e isto não é preferência de estilo:
 * `getSession()` lê o cookie e devolve o que estiver escrito nele, SEM
 * verificar assinatura nenhuma — o cookie é dado do navegador, ou seja,
 * controlado por quem chama. `getUser()` pergunta ao servidor de
 * autenticação do Supabase e só devolve usuário se o token for válido de
 * verdade. Numa página é a diferença entre desenhar bonito e proteger; numa
 * Server Action, que é endpoint HTTP público (spec §4.5), é a diferença
 * entre autorizar e fingir que autorizou.
 *
 * NUNCA LANÇA. Mesma política de servidor/dados/degradacao.ts: sem sessão e
 * "não deu para perguntar" chegam os dois como `null`, e quem chama trata
 * como não autenticado — que é o desfecho seguro nos dois casos. A diferença
 * entre eles aparece no log, e só lá.
 */
/**
 * Quanto tempo uma PÁGINA espera para saber quem está autenticado.
 *
 * Existe pelo mesmo defeito medido que o prazo do middleware (leia
 * compartilhado/prazo.ts): o `AbortSignal` de 5 s de servidor/supabase.ts
 * corta cada tentativa, mas o `@supabase/auth-js` repete a renovação com
 * espera exponencial por até 30 s, e a soma foi medida em 50,9 s. Numa
 * página isso seria pior que no middleware — a pessoa fica olhando para o
 * navegador girando enquanto a única coisa em jogo é qual palavra aparece no
 * cabeçalho.
 */
const PRAZO_DA_SESSAO_MS = 5_000;

export type UsuarioDaSessao = { id: string; email: string | null; nome: string | null };

/**
 * `cache()` DO REACT — acrescentado na RF11, e por medição, não por gosto.
 *
 * A MESMA REQUISIÇÃO já perguntava DUAS vezes antes desta tarefa: o layout
 * raiz (por `sessaoParaOCabecalho`) e, em `/admin`, `ehEquipe()` — que é
 * `cache()` desde a Tarefa P1 justamente porque a pergunta dele se repete.
 * `/minha-conta` acrescenta uma terceira: a página chama `usuarioAtual()` no
 * corpo E no `generateMetadata`, que é a regra de guarda deste projeto (ver
 * app/admin/layout.tsx). Sem `cache()`, abrir a área do usuário custaria
 * QUATRO chamadas de rede a `getUser()` — e cada uma tem prazo de 5 s.
 *
 * `cache()` deduplica DENTRO de uma requisição e só dela: não é cache entre
 * pessoas, não atravessa requisição, não guarda nada em disco. Server Action
 * é outra requisição, então a guarda de `acoes/conta.ts` continua perguntando
 * de verdade — que é exatamente o que precisa acontecer.
 */
export const usuarioAtual = cache(async function usuarioAtual(): Promise<UsuarioDaSessao | null> {
  // Sem projeto configurado não existe sessão para ler: é o modo offline
  // deliberado de `npm test` e também o deploy sem as variáveis no painel
  // da Netlify (CLAUDE.md, "O que trava hoje", item 0e). Perguntar mesmo
  // assim faria obterCliente() receber `undefined` como URL.
  if (!temSupabase()) return null;

  // Sem cookie de sessão não há o que verificar, e a partir da Tarefa 4 esta
  // função roda no LAYOUT RAIZ — ou seja, em toda página, para todo mundo,
  // inclusive a esmagadora maioria anônima. `getUser()` já devolve
  // AuthSessionMissingError sem sair para a rede quando não há sessão
  // (MEDIDO lendo node_modules/@supabase/auth-js — `_getUser` só chama
  // `/user` se houver access_token), então esta guarda não economiza uma
  // requisição de rede: economiza montar o cliente e ler o armazenamento a
  // cada visita, e diz em uma linha o que antes dependia de conhecer o
  // interior da biblioteca.
  const armazenamento = await cookies();
  if (!temCookieDeSessao(armazenamento.getAll().map(({ name }) => name))) return null;

  try {
    const supabase = await obterCliente();
    const resposta = await comPrazo(supabase.auth.getUser(), PRAZO_DA_SESSAO_MS);

    if (resposta === null) {
      console.warn(`[sessao] passou de ${PRAZO_DA_SESSAO_MS}ms para confirmar quem está `
        + 'autenticado; a página segue como visitante em vez de continuar esperando.');
      return null;
    }

    const { data, error } = resposta;

    // Sem sessão o Supabase responde com erro (AuthSessionMissingError), o
    // que é o caso NORMAL de quem só está navegando — não vira log, senão
    // toda visita anônima escreveria uma linha.
    if (error || !data.user) return null;

    // `nome` vem do metadata que `criarConta` gravou em `options.data`
    // (acoes/autenticacao.ts) — o mesmo lugar de onde o trigger
    // public.criar_perfil() lê para montar `public.perfis`. Ler daqui, e não
    // da tabela, poupa UMA CONSULTA POR PÁGINA de quem está autenticado, e
    // as duas fontes dizem a mesma coisa hoje porque nada edita
    // `perfis.nome` ainda.
    //
    // ESSE DIA CHEGOU — RF11, 01/09/2026 — E A ARMADILHA ESTÁ FECHADA,
    // MAS NÃO POR ESTA LINHA. O aviso que vivia aqui era: "se RF11 permitir
    // trocar o nome gravando só em `perfis`, o cabeçalho mostraria o nome
    // antigo para sempre, sem erro nenhum", e oferecia duas saídas —
    // atualizar o metadata junto, ou trocar esta linha por uma consulta a
    // `perfis`.
    //
    // A TAREFA ESCOLHEU A PRIMEIRA. `acoes/conta.ts` grava o nome nos DOIS
    // lugares: em `public.perfis`, que é o registro, e aqui no metadata, que
    // é a cópia que o cabeçalho desenha. A segunda saída foi recusada porque
    // esta função roda no LAYOUT RAIZ, ou seja, em toda página de quem está
    // autenticado: consultar `perfis` custaria uma ida ao Postgres por
    // página e acrescentaria um caminho de falha no layout, para desenhar
    // uma palavra. O porquê completo, com a ordem das duas gravações e o que
    // acontece se só uma der certo, está no cabeçalho de acoes/conta.ts.
    //
    // O QUE PRECISA CONTINUAR VERDADE PARA ISTO SEGUIR VALENDO: existe UM
    // ÚNICO escritor de `perfis.nome` no código. `testes/minha-conta.test.mjs`
    // falha se `acoes/conta.ts` parar de gravar o metadata junto — e no dia
    // em que RF26 (gestão de voluntários) criar um segundo escritor, é essa
    // decisão que precisa ser tomada de novo, não este comentário que
    // precisa ser lido.
    //
    // NÃO SERVE PARA AUTORIZAR NADA. Metadata é editável pela própria
    // pessoa (`updateUser`), então é dado do cliente com outro nome — por
    // isso `eh_equipe` não está aqui e nunca pode estar (regra 6 do
    // CLAUDE.md). Serve para escrever um nome na tela, e só.
    const metadata = data.user.user_metadata as { nome?: unknown } | null;
    const nome = typeof metadata?.nome === 'string' && metadata.nome.trim()
      ? metadata.nome.trim()
      : null;

    return { id: data.user.id, email: data.user.email ?? null, nome };
  } catch (erro) {
    repassarSeForControleDoNext(erro);
    // Rede, DNS, timeout: aqui sim vale registrar. A pessoa PODE estar
    // autenticada e ainda assim ser tratada como visitante — e nada na tela
    // distingue isso de "não entrou".
    console.warn('[sessao] não foi possível confirmar quem está autenticado: '
      + `${descrever(erro)}. A requisição segue como visitante.`);
    return null;
  }
});

/**
 * O MÍNIMO que o cabeçalho precisa saber: quem está aí, para escrever um
 * nome na tela.
 *
 * Existe separada de `usuarioAtual()` por causa de uma fronteira que importa:
 * `componentes/Cabecalho.tsx` é Client Component (usa `usePathname`), e tudo
 * que chega nele por prop VAI PARAR NO HTML SERVIDO, em texto legível, no
 * payload de hidratação. `usuarioAtual()` devolve `id` e `email` — nenhum
 * dos dois precisa aparecer no HTML de toda página só para desenhar um
 * cabeçalho. Esta função é o filtro: sai um campo, `nome`, que é
 * exatamente o que a tela mostra.
 *
 * `null` significa "desenhe o cabeçalho de visitante" — e cobre os três
 * casos de uma vez: não há sessão, não há Supabase configurado, e não deu
 * para perguntar. Os três levam à mesma tela, de propósito; a diferença
 * entre eles aparece no log (ver `usuarioAtual` acima).
 */
export type SessaoNoCabecalho = { nome: string };

export async function sessaoParaOCabecalho(): Promise<SessaoNoCabecalho | null> {
  const usuario = await usuarioAtual();
  if (!usuario) return null;

  // A ordem é a do requisito: o nome; o e-mail quando não há nome (conta
  // criada à mão no painel do Supabase, como a de administrador do item 2 de
  // "O que trava hoje", não passa pelo formulário e pode não ter `nome` no
  // metadata); e um rótulo genérico se nem e-mail houver — que não é
  // conteúdo institucional inventado (regra 2), é o texto de um controle,
  // e sem ele o cabeçalho ficaria com um espaço em branco ao lado de "Sair".
  return { nome: usuario.nome || usuario.email || 'Sua conta' };
}
