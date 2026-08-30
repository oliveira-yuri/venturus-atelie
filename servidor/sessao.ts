import 'server-only';
import { obterCliente } from './supabase';
import { temSupabase, repassarSeForControleDoNext, descrever } from './dados/degradacao';

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
export type UsuarioDaSessao = { id: string; email: string | null };

export async function usuarioAtual(): Promise<UsuarioDaSessao | null> {
  // Sem projeto configurado não existe sessão para ler: é o modo offline
  // deliberado de `npm test` e também o deploy sem as variáveis no painel
  // da Netlify (CLAUDE.md, "O que trava hoje", item 0e). Perguntar mesmo
  // assim faria obterCliente() receber `undefined` como URL.
  if (!temSupabase()) return null;

  try {
    const supabase = await obterCliente();
    const { data, error } = await supabase.auth.getUser();

    // Sem sessão o Supabase responde com erro (AuthSessionMissingError), o
    // que é o caso NORMAL de quem só está navegando — não vira log, senão
    // toda visita anônima escreveria uma linha.
    if (error || !data.user) return null;

    return { id: data.user.id, email: data.user.email ?? null };
  } catch (erro) {
    repassarSeForControleDoNext(erro);
    // Rede, DNS, timeout: aqui sim vale registrar. A pessoa PODE estar
    // autenticada e ainda assim ser tratada como visitante — e nada na tela
    // distingue isso de "não entrou".
    console.warn('[sessao] não foi possível confirmar quem está autenticado: '
      + `${descrever(erro)}. A requisição segue como visitante.`);
    return null;
  }
}
