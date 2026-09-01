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

/**
 * Os avisos da GALERIA (RF05/RF33, Tarefa P3) — lista separada da de
 * notícias, e não um mapa só.
 *
 * Poderiam conviver: os nomes das chaves não colidem hoje. Ficam separados
 * porque as frases são de assuntos diferentes e envelhecem separadamente —
 * um mapa único convidaria a reaproveitar "salva" nas duas telas, e o dia em
 * que uma delas precisar de outra palavra a mudança sairia na outra também,
 * em silêncio. E há o caso RN07, que só existe aqui e não tem paralelo em
 * notícia nenhuma.
 *
 * Mesma disciplina de lista fechada, pelo mesmo motivo escrito lá em cima:
 * `?aviso=` é escrito por quem quiser.
 */
const AVISOS_DA_GALERIA: Record<string, AvisoDoPainel> = {
  enviada: {
    texto: 'Foto guardada. Ela ainda NÃO está no site: para publicar, use o botão "Publicar" '
      + 'no item abaixo.',
    ok: true
  },
  'enviada-sem-autorizacao': {
    texto: 'Foto guardada, e ela NÃO pode ir ao ar: a autorização de uso de imagem não foi '
      + 'declarada. Quando a autorização estiver registrada, suba a foto de novo marcando a '
      + 'caixa — ou apague esta, se ela não puder ser usada.',
    ok: true
  },
  publicada: { texto: 'Publicada. A foto já aparece na galeria do site.', ok: true },
  retirada: {
    texto: 'Tirada do ar. A foto sumiu da galeria do site e continua guardada aqui.',
    ok: true
  },
  /**
   * RN07 na tela. Este desfecho existe porque a Action recusa publicar sem
   * autorização registrada mesmo que o botão tenha sido montado à mão —
   * ver acoes/galeria.ts.
   */
  'sem-autorizacao': {
    texto: 'Esta foto não pode ir ao ar: não há autorização de uso de imagem declarada para '
      + 'ela. É a regra do projeto (RN07) e o banco de dados também recusa. Suba a foto de novo '
      + 'marcando a caixa de autorização, ou apague esta.',
    ok: false
  },
  apagada: {
    texto: 'Apagada. A foto saiu do site e o arquivo foi removido — não dá para recuperar.',
    ok: true
  },
  erro: {
    texto: 'Não deu para fazer isso agora. Tente de novo em alguns instantes — se continuar, '
      + 'nenhuma foto foi perdida.',
    ok: false
  }
};

export function avisoDaGaleria(valor: unknown): AvisoDoPainel | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn` pelo mesmo motivo de `avisoDaLista`.
  return Object.hasOwn(AVISOS_DA_GALERIA, valor) ? AVISOS_DA_GALERIA[valor] : null;
}
