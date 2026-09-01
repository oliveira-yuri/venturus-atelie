/**
 * compartilhado/avisos-do-painel.ts — as frases que o painel mostra depois
 * de uma Server Action, escolhidas por um parâmetro da URL.
 *
 * ===================================================================
 * POR QUE O RESULTADO DE UMA ACTION PASSA PELA URL
 * ===================================================================
 *
 * As Actions de acoes/publicacoes.ts terminam em `redirect()` — é o padrão
 * POST-redirect-GET, e é o que faz o botão de publicar funcionar SEM
 * JAVASCRIPT, com um POST comum de `<form>` (de quebra, atualizar a página
 * depois não repete a gravação: não há "reenviar formulário?"). Um redirect
 * não carrega estado de volta, então o único canal entre a Action e a tela é
 * o `?aviso=` que ela põe no destino.
 *
 * ===================================================================
 * E POR QUE A LISTA É FECHADA
 * ===================================================================
 *
 * `?aviso=` é escrito por quem quiser: basta mandar um link. Ecoar na tela o
 * texto recebido seria injeção de conteúdo dentro do painel da ONG — alguém
 * manda `?aviso=Sua conta foi bloqueada, ligue para (11) 0000-0000` e a
 * frase aparece com a cara do site, na tela de quem trabalha ali. Aqui o
 * parâmetro só ESCOLHE uma das frases escritas abaixo; qualquer outro valor
 * não mostra nada.
 *
 * É a mesma disciplina de `compartilhado/links-de-email.ts`, que trata o
 * `type` do link de e-mail por lista fechada pelo mesmo motivo: entrada de
 * usuário não decide o que o servidor faz nem o que a tela diz.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como compartilhado/permissao-de-equipe.ts: assim `testes/publicacoes
 * .test.mjs` consegue importá-lo pelo runtime nativo do Node, que não
 * resolve o alias `@/...` do tsconfig nem caminho relativo sem extensão.
 * Todo módulo de compartilhado/ que precise ser medido sem subir o Next
 * segue essa regra — foi ela que decidiu onde cada pedaço desta tarefa
 * ficou.
 */

export type AvisoDoPainel = { texto: string; ok: boolean };

const AVISOS: Record<string, AvisoDoPainel> = {
  criada: {
    texto: 'Notícia guardada como rascunho. Ela ainda NÃO está no site: para publicar, use o '
      + 'botão "Publicar" no item abaixo.',
    ok: true
  },
  salva: { texto: 'Alterações guardadas.', ok: true },
  publicada: { texto: 'Publicada. A notícia já aparece na página de notícias do site.', ok: true },
  retirada: {
    texto: 'Tirada do ar. A notícia sumiu do site e continua guardada aqui, com o texto inteiro.',
    ok: true
  },
  erro: {
    texto: 'Não deu para fazer isso agora. Tente de novo em alguns instantes — se continuar, '
      + 'a notícia está guardada e nada se perdeu.',
    ok: false
  }
};

export function avisoDaLista(valor: unknown): AvisoDoPainel | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn`, e não `AVISOS[valor]` direto: sem isto, `?aviso=toString`
  // (ou `constructor`, ou `__proto__`) devolveria algo herdado do protótipo
  // de Object em vez de `undefined`, e a tela tentaria desenhar aquilo.
  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : null;
}
