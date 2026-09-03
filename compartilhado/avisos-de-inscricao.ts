/**
 * compartilhado/avisos-de-inscricao.ts — a frase que a página de inscrição
 * mostra depois de uma inscrição que deu certo (RF15).
 *
 * MESMA MECÂNICA de compartilhado/avisos-de-contato.ts, e separada dele
 * pelo mesmo critério que separa aquele do painel: o texto tem um público e
 * um assunto próprios. Quem acabou de inscrever um filho numa oficina de
 * sábado precisa saber coisas diferentes de quem mandou uma mensagem.
 *
 * A LISTA É FECHADA porque `?aviso=` é escrito por quem quiser: basta
 * mandar um link. Ecoar na tela o texto recebido seria injeção de conteúdo
 * no site da ONG. Aqui o parâmetro só ESCOLHE uma das frases abaixo.
 *
 * ARQUIVO SEM NENHUM IMPORT, de propósito, para `testes/inscricoes.test.mjs`
 * conseguir importá-lo pelo runtime nativo do Node, que não resolve o alias
 * `@/...` do tsconfig.
 */

export type AvisoDeInscricao = { texto: string; ok: boolean };

/**
 * DUAS FRASES, PORQUE HÁ DOIS DESFECHOS — e a diferença é visível para
 * quem se inscreveu.
 *
 * O QUE AS DUAS PODEM PROMETER: que a inscrição ficou registrada. Isso é
 * fato nos dois casos — a linha está em `public.inscricoes`, e a equipe a
 * vê em /admin/eventos/inscritos (RF16).
 *
 * O QUE SÓ A PRIMEIRA PODE: dizer que a confirmação foi enviada. Ela só
 * aparece quando a Edge Function CONFIRMOU o envio (`servidor/email.ts`
 * devolveu true). Prometer o e-mail sem essa confirmação faria a pessoa
 * esperar por algo que não vem — e, pior, duvidar da própria inscrição
 * quando ele não chegasse.
 *
 * A SEGUNDA É O CAMINHO DE HOJE ATÉ ALGUÉM PUBLICAR A FUNÇÃO, e ela não
 * pede desculpa nem esconde: diz que a inscrição está guardada, que o
 * e-mail não sai, e o que fazer com isso (anotar a data). É a regra 2 do
 * CLAUDE.md aplicada a uma confirmação — nada de "você receberá um e-mail
 * em breve", que ninguém prometeu.
 *
 * NENHUMA DAS DUAS REPETE O ENDEREÇO DE E-MAIL DA PESSOA. Ele viajaria na
 * URL (`?aviso=`), ficaria no histórico do navegador e no log do servidor,
 * e não acrescenta nada: quem acabou de digitá-lo sabe qual é.
 */
const AVISOS: Record<string, AvisoDeInscricao> = {
  inscrita: {
    texto: 'Inscrição registrada, e a confirmação foi enviada para o seu e-mail. Se ela não '
      + 'aparecer em alguns minutos, confira o lixo eletrônico. Para mudar alguma coisa ou '
      + 'desistir, chame no WhatsApp (11) 95396-8344.',
    ok: true
  },
  'inscrita-sem-email': {
    texto: 'Inscrição registrada. Anote a data no seu calendário: a confirmação por e-mail não '
      + 'saiu desta vez, e isso NÃO afeta sua inscrição — ela está guardada. Para mudar alguma '
      + 'coisa ou desistir, chame no WhatsApp (11) 95396-8344.',
    ok: true
  }
};

export function avisoDeInscricao(valor: unknown): AvisoDeInscricao | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn`, e não o acesso direto: sem isto, `?aviso=toString`
  // devolveria algo herdado do protótipo de Object.
  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : null;
}
