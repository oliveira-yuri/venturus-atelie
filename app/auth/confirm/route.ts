import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase } from '@/servidor/dados/degradacao';
import {
  ehTipoDeLinkAceito, destinoDepoisDeConfirmar, caminhoDeFalha, MOTIVOS_DE_FALHA
} from '@/compartilhado/links-de-email';

/**
 * app/auth/confirm/route.ts — a porta de entrada dos links que o site manda
 * por e-mail. Sem ela, RECUPERAÇÃO DE SENHA NÃO EXISTE.
 *
 * O motivo está inteiro em compartilhado/links-de-email.ts (leia antes de
 * mexer aqui), em uma frase: no fluxo implícito o token chega no FRAGMENTO
 * da URL, que o navegador nunca envia ao servidor — e este site é todo
 * renderizado no servidor. O fluxo PKCE manda `?token_hash=...&type=...` na
 * query, que chega. Esta rota vive disso.
 *
 * ROUTE HANDLER, E NÃO PÁGINA, por uma razão mecânica: `verifyOtp()` GRAVA O
 * COOKIE DE SESSÃO, e escrever cookie de dentro da renderização de um Server
 * Component é impossível — a resposta já começou, não há mais cabeçalho para
 * escrever, e o `catch` de servidor/supabase.ts (bloco `setAll`) engoliria a
 * gravação em silêncio. A pessoa voltaria de /auth/confirm sem sessão
 * nenhuma, e /nova-senha diria que o link não vale. Route Handler pode
 * escrever cookie; é o que o comentário daquele `catch` já documentava como
 * um dos dois lugares em que a gravação de fato acontece.
 *
 * O TOKEN NUNCA VAI PARA LOG. `token_hash` é credencial de uso único: quem
 * lê o log do servidor (Netlify Functions, que a equipe da ONG não controla
 * sozinha) passaria a poder trocar a senha da pessoa. Os `console.warn`
 * abaixo registram o TIPO e o motivo, nunca o parâmetro — e nunca a URL
 * inteira, que carrega o token dentro.
 *
 * NADA AQUI RESPONDE 500. Toda saída é um redirect para uma tela que explica
 * em português o que aconteceu (`caminhoDeFalha`) — mesma política de
 * servidor/dados/degradacao.ts, e pelo mesmo motivo prático: quem chega aqui
 * chegou clicando num link do próprio e-mail, muitas vezes no celular, e uma
 * tela de erro do framework não diz o que fazer em seguida. Ver o cabeçalho
 * de app/nova-senha/page.tsx para o porquê de o destino ser /nova-senha.
 */

/**
 * Nunca em cache, nem por acidente. A resposta depende do `token_hash` de
 * uma pessoa específica e GRAVA COOKIE DE SESSÃO — uma cópia guardada por
 * CDN seria uma sessão servida para outra pessoa.
 */
export const dynamic = 'force-dynamic';

export async function GET(requisicao: NextRequest) {
  const parametros = requisicao.nextUrl.searchParams;
  const tipo = parametros.get('type');
  const tokenHash = parametros.get('token_hash');

  // A LISTA FECHADA DE TIPOS, antes de qualquer outra coisa. `type` é
  // entrada de usuário numa URL pública; o SDK aceita `magiclink`, `invite`,
  // `email_change` e outros que este site não emite. A string crua não passa
  // daqui — ver compartilhado/links-de-email.ts.
  if (!ehTipoDeLinkAceito(tipo)) {
    console.warn('[auth/confirm] link com type fora da lista aceita — nada foi verificado.');
    redirect(caminhoDeFalha(MOTIVOS_DE_FALHA.invalido));
  }

  if (!tokenHash) {
    console.warn(`[auth/confirm] link do tipo "${tipo}" chegou sem token_hash.`);
    redirect(caminhoDeFalha(MOTIVOS_DE_FALHA.invalido));
  }

  // Sem projeto Supabase configurado não há o que verificar, e dizer "seu
  // link venceu" seria mentira: o link pode estar perfeito. É o item 0e de
  // "O que trava hoje" — publicar sem as variáveis no painel da Netlify não
  // dá erro nenhum, e este é um dos lugares onde o estrago apareceria.
  if (!temSupabase()) {
    console.error('[auth/confirm] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no '
      + 'ambiente: nenhum link de e-mail pode ser verificado neste endereço.');
    redirect(caminhoDeFalha(MOTIVOS_DE_FALHA.indisponivel));
  }

  // redirect() lança para funcionar — nada de chamá-lo dentro do try, ou o
  // catch o trataria como falha de verificação (mesma armadilha registrada
  // em acoes/autenticacao.ts).
  let verificou = false;

  try {
    const supabase = await obterCliente();
    // É ESTA CHAMADA que troca o token pela sessão e grava o cookie. `type`
    // já é 'recovery' | 'signup' aqui, não a string que veio na URL.
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

    if (error) {
      // `error.message` é do Supabase (inglês, para quem programa) e não
      // contém o token. Serve para distinguir "expirou" de "chave errada"
      // no log; para a pessoa, o texto é o de app/nova-senha/page.tsx.
      console.warn(`[auth/confirm] link do tipo "${tipo}" recusado: ${error.message}`);
    } else {
      verificou = true;
    }
  } catch (erro) {
    // Rede, DNS, timeout: o link pode estar ótimo e ainda assim não dá para
    // confirmar. Cai na mesma tela — que oferece pedir outro link, o único
    // caminho útil de qualquer forma.
    console.error(`[auth/confirm] exceção ao verificar link do tipo "${tipo}":`, erro);
  }

  if (!verificou) {
    // Dois motivos diferentes para o mesmo acidente, porque a saída da
    // pessoa é diferente: quem tentava trocar a senha pede outro link de
    // recuperação; quem tentava confirmar o cadastro precisa entrar (e
    // /entrar é quem diz "falta confirmar seu e-mail", via
    // compartilhado/erros.ts).
    redirect(caminhoDeFalha(
      tipo === 'signup' ? MOTIVOS_DE_FALHA.confirmacao : MOTIVOS_DE_FALHA.expirado
    ));
  }

  redirect(destinoDepoisDeConfirmar(tipo));
}
