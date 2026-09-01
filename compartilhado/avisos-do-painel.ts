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

/**
 * Os avisos das ATIVIDADES (RF03/RF33, Tarefa P4) — lista separada das
 * outras duas, pelo mesmo motivo escrito acima: as frases são de assuntos
 * diferentes e envelhecem separadamente.
 *
 * DUAS FRASES DAQUI DIZEM ALGO QUE NENHUMA OUTRA TELA DO PAINEL PRECISA
 * DIZER, e é a armadilha desta tarefa: as atividades têm DUAS fontes. O
 * texto vive no banco E numa cópia versionada dentro do próprio site
 * (dados-iniciais/atividades.json), que é o que /projetos mostra quando o
 * banco não responde — ver o cabeçalho de servidor/dados/conteudo.ts. A
 * partir do momento em que a equipe corrige um texto por aqui, as duas
 * deixam de dizer a mesma coisa, e a cópia do site fica velha. Dizer isso
 * na tela é a única forma de a equipe entender o dia em que o texto antigo
 * reaparecer sozinho — sem esta frase, aquilo parece o painel ter perdido a
 * correção.
 */
const AVISOS_DE_ATIVIDADES: Record<string, AvisoDoPainel> = {
  salva: {
    texto: 'Correção guardada. A página de projetos já mostra o texto novo.',
    ok: true
  },
  publicada: {
    texto: 'De volta ao ar. A atividade aparece outra vez na página de projetos.',
    ok: true
  },
  retirada: {
    texto: 'Tirada do ar. A atividade sumiu da página de projetos e continua guardada aqui, com '
      + 'o texto inteiro. Atenção: se o banco de dados ficar fora do ar, o site mostra a cópia '
      + 'antiga guardada dentro dele, e nela esta atividade ainda aparece.',
    ok: true
  },
  erro: {
    texto: 'Não deu para fazer isso agora. Tente de novo em alguns instantes — se continuar, '
      + 'nenhum texto foi perdido.',
    ok: false
  }
};

export function avisoDeAtividades(valor: unknown): AvisoDoPainel | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn` pelo mesmo motivo de `avisoDaLista`.
  return Object.hasOwn(AVISOS_DE_ATIVIDADES, valor) ? AVISOS_DE_ATIVIDADES[valor] : null;
}

/**
 * Os avisos das MENSAGENS RECEBIDAS (RF29) — lista separada das outras
 * três, pelo mesmo motivo escrito acima: as frases são de assuntos
 * diferentes e envelhecem separadamente.
 *
 * O QUE ESTAS FRASES TÊM DE PRÓPRIO: nenhuma delas fala em "publicar",
 * "site" ou "ar". Esta é a única tela do painel que não muda nada do que o
 * público vê — o que ela muda é a marca do atendimento, para a equipe se
 * entender. Reaproveitar as palavras das outras telas aqui faria a pessoa
 * achar que acabou de mexer no site.
 *
 * E NENHUMA promete que a pessoa foi respondida: o que a tela registra é
 * que ALGUÉM DA EQUIPE marcou. Responder acontece no e-mail ou no WhatsApp,
 * fora daqui, e uma frase como "resposta enviada" seria o painel afirmando
 * o que não tem como saber.
 */
const AVISOS_DE_CONTATOS: Record<string, AvisoDoPainel> = {
  nova: {
    texto: 'Marcada como nova de novo. Ela volta para o começo da lista, com quem ainda '
      + 'espera resposta.',
    ok: true
  },
  'em-contato': {
    texto: 'Marcada como "em contato". Ela continua no começo da lista até alguém marcar como '
      + 'concluída.',
    ok: true
  },
  concluida: {
    texto: 'Marcada como concluída. Ela desce para o fim da lista e continua guardada aqui, '
      + 'com o texto inteiro — nada foi apagado.',
    ok: true
  },
  erro: {
    texto: 'Não deu para fazer isso agora. Tente de novo em alguns instantes — nenhuma '
      + 'mensagem foi perdida nem alterada.',
    ok: false
  }
};

export function avisoDeContatos(valor: unknown): AvisoDoPainel | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn` pelo mesmo motivo de `avisoDaLista`.
  return Object.hasOwn(AVISOS_DE_CONTATOS, valor) ? AVISOS_DE_CONTATOS[valor] : null;
}

/**
 * Os avisos das CANDIDATURAS AO VOLUNTARIADO (RF26) — lista separada das
 * outras quatro, pelo mesmo motivo escrito acima: as frases são de assuntos
 * diferentes e envelhecem separadamente.
 *
 * O QUE ESTAS FRASES TÊM DE PRÓPRIO, e não é só o assunto:
 *
 *  · como as de contatos, nenhuma fala em "publicar", "site" ou "ar" — esta
 *    tela não muda nada do que o público vê. E nenhuma promete que a pessoa
 *    foi procurada: o painel registra que ALGUÉM DA EQUIPE marcou. Falar com
 *    quem se candidatou acontece no e-mail ou no WhatsApp, fora daqui;
 *  · a de "encerrada" diz uma coisa que NENHUM outro aviso do painel precisa
 *    dizer: encerrar devolve à pessoa o direito de se candidatar de novo
 *    ('inativo' fica fora de `SITUACOES_EM_ANDAMENTO`, em
 *    compartilhado/candidatura.ts). É a única transição desta tela que muda
 *    o que outra pessoa pode fazer no site, e sem esta frase a segunda
 *    candidatura da mesma pessoa apareceria na fila como defeito.
 */
const AVISOS_DE_VOLUNTARIOS: Record<string, AvisoDoPainel> = {
  nova: {
    texto: 'Marcada como nova de novo. Ela volta para o começo da lista, com quem ainda '
      + 'espera resposta.',
    ok: true
  },
  'em-contato': {
    texto: 'Marcada como "em contato". Ela continua no começo da lista até alguém marcar de '
      + 'outro jeito.',
    ok: true
  },
  ativa: {
    texto: 'Marcada como voluntariando. A pessoa vê a mudança na conta dela, e a candidatura '
      + 'desce na lista — o que ainda espera resposta continua em cima.',
    ok: true
  },
  encerrada: {
    texto: 'Encerrada. A candidatura desce para o fim da lista e continua guardada aqui, com o '
      + 'texto e as áreas — nada foi apagado. Atenção: quem tem candidatura encerrada pode se '
      + 'candidatar de novo pelo site, e a nova aparece aqui em cima.',
    ok: true
  },
  erro: {
    texto: 'Não deu para fazer isso agora. Tente de novo em alguns instantes — nenhuma '
      + 'candidatura foi perdida nem alterada.',
    ok: false
  }
};

export function avisoDeVoluntarios(valor: unknown): AvisoDoPainel | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn` pelo mesmo motivo de `avisoDaLista`.
  return Object.hasOwn(AVISOS_DE_VOLUNTARIOS, valor) ? AVISOS_DE_VOLUNTARIOS[valor] : null;
}
