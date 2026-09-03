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
 * O QUE A FRASE PODE PROMETER, e o que ela não pode.
 *
 * PODE: que a inscrição ficou registrada. Isso é fato — a linha está em
 * `public.inscricoes`, e a equipe a vê em /admin/eventos/inscritos (RF16).
 *
 * NÃO PODE: prometer e-mail de confirmação. O RF18 depende de uma Edge
 * Function que ainda não existe (CLAUDE.md), e uma frase dizendo "você vai
 * receber um e-mail" faria a pessoa esperar por algo que não vem — e, pior,
 * duvidar da inscrição quando ele não chegasse. No dia em que o RF18
 * existir, ESTA frase muda junto, e há teste que a compara por igualdade.
 *
 * É a regra 2 do CLAUDE.md aplicada a uma confirmação.
 */
const AVISOS: Record<string, AvisoDeInscricao> = {
  inscrita: {
    texto: 'Inscrição registrada. Anote a data no seu calendário — não enviamos e-mail de '
      + 'confirmação ainda. Se precisar mudar alguma coisa ou desistir, chame no WhatsApp '
      + '(11) 95396-8344.',
    ok: true
  }
};

export function avisoDeInscricao(valor: unknown): AvisoDeInscricao | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn`, e não o acesso direto: sem isto, `?aviso=toString`
  // devolveria algo herdado do protótipo de Object.
  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : null;
}
