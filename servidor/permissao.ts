import 'server-only';
import { cache } from 'react';
import { obterCliente } from './supabase';
import { temSupabase, repassarSeForControleDoNext, descrever } from './dados/degradacao';
import { usuarioAtual } from './sessao';
import { comPrazo } from '@/compartilhado/prazo';
import { ehEquipeNaResposta } from '@/compartilhado/permissao-de-equipe';

/**
 * servidor/permissao.ts — "esta pessoa é da equipe da ONG?"
 *
 * Irmão de `servidor/sessao.ts`: lá se pergunta QUEM está do outro lado da
 * requisição, aqui se pergunta O QUE essa pessoa pode ver. Um lugar só,
 * pelo mesmo motivo que vale para a sessão: a página do painel e as Server
 * Actions que P2/P3/P4 vão escrever precisam responder à mesma pergunta, e
 * duas respostas diferentes para a mesma pergunta seriam exatamente o
 * buraco — tela que mostra o que a Action recusa, ou Action que aceita o
 * que a tela nem desenharia.
 *
 * ===================================================================
 * NO BANCO, NUNCA NO METADATA
 * ===================================================================
 *
 * `eh_equipe` é lido de `public.perfis`, com uma consulta. NÃO é lido do
 * `user_metadata` da conta, e a diferença não é de estilo: metadata é
 * editável pela própria pessoa (`supabase.auth.updateUser`), ou seja, é
 * dado do cliente com outro nome. `servidor/sessao.ts` carrega a mesma
 * advertência escrita, no ponto em que lê o `nome` de lá — o nome serve
 * para escrever na tela, e só.
 *
 * É a regra 6 do CLAUDE.md, e ela existe por causa de uma escalada de
 * privilégio REAL neste projeto, corrigida com trigger no banco
 * (`proteger_papel_equipe`, supabase/migrations/001_base.sql).
 *
 * A CONSULTA FUNCIONA PARA QUEM NÃO É EQUIPE, e isso é o que a torna
 * possível: a política de leitura de `perfis` é
 * `using (id = auth.uid() or public.eh_equipe())` — cada pessoa lê o
 * próprio registro. Sem essa metade, uma pessoa comum receberia zero linhas
 * e o resultado seria o mesmo `false`; com ela, o `false` vem do valor da
 * coluna, que é a resposta certa pelo motivo certo.
 *
 * O GRANT, que é a outra metade e vem antes da política: `grant select,
 * update on public.perfis to authenticated` (supabase/migrations/
 * 001_base.sql). O papel `anon` NÃO tem esse grant — MEDIDO contra o
 * Supabase real em 31/08/2026: uma consulta anônima a `perfis` volta com
 * `permission denied for table perfis` (código 42501), sem sequer chegar à
 * RLS. Este código nunca alcança esse caminho (sem sessão a função já
 * devolveu `false` lá em cima), e se alcançasse o desfecho seria o mesmo:
 * erro na consulta é falha fechada.
 *
 * ===================================================================
 * FALHA FECHADA (o comentário longo está em compartilhado/permissao-de-equipe.ts)
 * ===================================================================
 *
 * Toda dúvida vira `false`: sem sessão, sem Supabase configurado, erro do
 * PostgREST, prazo estourado, exceção de rede. É o CONTRÁRIO da política de
 * `servidor/dados/degradacao.ts`, que degrada para manter a página no ar —
 * e é deliberado, porque degradar aqui significaria abrir o painel quando o
 * banco não responde. Ler o cabeçalho de compartilhado/permissao-de-equipe.ts
 * antes de "corrigir" esta inconsistência aparente.
 *
 * O aviso `[dados]` segue o formato de `avisarQueDegradou()` mas é escrito
 * aqui, à mão, de propósito: aquela função anuncia "a página vai ao ar com
 * a seção VAZIA", frase que seria mentira neste caminho — aqui a página não
 * vai ao ar de jeito nenhum, vira 404. Reaproveitá-la deixaria no log uma
 * explicação errada do que aconteceu.
 *
 * ===================================================================
 * `cache()` DO REACT, E POR QUE ELE NÃO É OTIMIZAÇÃO PREMATURA
 * ===================================================================
 *
 * A mesma requisição pergunta DUAS vezes: `app/admin/layout.tsx` e
 * `app/admin/page.tsx` chamam esta função, de propósito (a medição que
 * obrigou as duas está escrita no layout). Sem `cache()` seriam duas
 * consultas ao Postgres por abertura de tela — e nas telas de P2/P3/P4,
 * que vão chamar de novo dentro das Server Actions, mais ainda.
 *
 * `cache()` deduplica DENTRO de uma requisição e só dela: não é cache entre
 * pessoas, não atravessa requisição, não guarda nada em disco. É o que
 * torna possível repetir a pergunta em toda camada — que é a política
 * certa para permissão — sem pagar rede por repetição.
 */

/**
 * Quanto tempo o painel espera para saber se a pessoa é equipe.
 *
 * Mesmo número e mesmo motivo do prazo de `servidor/sessao.ts`: o
 * `AbortSignal` de 5 s de `servidor/supabase.ts` corta cada tentativa, mas
 * a soma das tentativas já foi medida em 50,9 s neste projeto (ver
 * compartilhado/prazo.ts). Aqui o desfecho do prazo estourado é 404, não
 * "seguir como visitante" — mais um motivo para ele ser curto: quem está
 * esperando é a equipe, de pé, no meio de um evento (regra 4).
 */
const PRAZO_DA_PERMISSAO_MS = 5_000;

export const ehEquipe = cache(async function ehEquipe(): Promise<boolean> {
  // Sem projeto configurado não há o que consultar. É o modo offline
  // deliberado de `npm test` e também o deploy sem as variáveis no painel
  // da Netlify (CLAUDE.md, "O que trava hoje", item 0e). Nesse estado o
  // painel simplesmente não abre para ninguém — que é o desfecho seguro, e
  // o mesmo da falha fechada.
  if (!temSupabase()) return false;

  const usuario = await usuarioAtual();
  if (!usuario) return false;

  try {
    const supabase = await obterCliente();

    // A função assíncrona em volta existe por tipo, não por gosto: o
    // builder do PostgREST é um "thenable", não um Promise, e `comPrazo`
    // recebe Promise. Envolvendo, a consulta continua sendo disparada pelo
    // `await` (é isso que executa um builder) e o prazo passa a valer sobre
    // uma promessa de verdade.
    const resposta = await comPrazo(
      (async () => supabase
        .from('perfis')
        .select('eh_equipe')
        .eq('id', usuario.id)
        .maybeSingle())(),
      PRAZO_DA_PERMISSAO_MS
    );

    if (resposta === null) {
      console.warn(
        `[dados] "perfis": passou de ${PRAZO_DA_PERMISSAO_MS}ms para saber se quem pediu o `
        + 'painel é da equipe — a guarda falha FECHADA e a resposta é 404, igual à de quem '
        + 'não tem permissão. Se isto aparecer para a equipe da ONG, o problema é o banco, '
        + 'não a conta.'
      );
      return false;
    }

    if (resposta.error) {
      console.warn(
        '[dados] "perfis": o Supabase está configurado mas a consulta de eh_equipe não voltou '
        + '— a guarda falha FECHADA e o painel responde 404 para quem talvez seja da equipe. '
        + `Motivo: ${descrever(resposta.error)}`
      );
      return false;
    }

    return ehEquipeNaResposta(resposta);
  } catch (erro) {
    // NEXT_NOT_FOUND, NEXT_REDIRECT, DYNAMIC_SERVER_USAGE: erro de controle
    // do Next não é falha de dados e não pode ser engolido aqui — o motivo
    // completo está em servidor/dados/degradacao.ts.
    repassarSeForControleDoNext(erro);

    // Rede, DNS, timeout do fetch: chegam como exceção, não como
    // `{ error }`. Mesmo desfecho, mesmo aviso.
    console.warn(
      '[dados] "perfis": não foi possível saber se quem pediu o painel é da equipe: '
      + `${descrever(erro)}. A guarda falha FECHADA e a resposta é 404.`
    );
    return false;
  }
});
