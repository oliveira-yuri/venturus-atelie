/**
 * compartilhado/avisos-da-home.ts — as frases que a home pode desenhar
 * depois de um redirect.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como `avisos-de-contato.ts`, `avisos-do-painel.ts` e
 * `permissao-de-equipe.ts`: assim os testes conseguem importá-lo pelo
 * runtime nativo do Node, que não resolve o alias `@/...` do tsconfig.
 *
 * ===================================================================
 * LISTA FECHADA, E É POR ISSO QUE ELE EXISTE
 * ===================================================================
 *
 * `?aviso=` é escrito por quem quiser — basta digitar na barra de
 * endereços. O parâmetro ESCOLHE uma frase nossa; ele nunca TRAZ uma. Sem
 * esta lista, `/?aviso=<qualquer coisa>` viraria um jeito de fazer o site
 * exibir texto de terceiro com a nossa cara.
 *
 * Mesma mecânica de `avisoDeContato`, e pelo mesmo motivo.
 */

export type AvisoDaHome = {
  texto: string;
  ok: boolean;
  /**
   * O caminho para VER o que acabou de acontecer.
   *
   * A confirmação da candidatura e a da doação moravam em /minha-conta, com
   * um argumento bom escrito em `avisos-da-conta.ts`: uma confirmação que
   * MOSTRA o registro vale mais que uma que promete que ele existe.
   *
   * O pedido V1 pede o contrário — popup e volta para a home. As duas
   * coisas cabem: o popup aparece na home, e este link leva ao registro em
   * um toque. O argumento antigo não foi jogado fora; virou um link.
   */
  link?: { href: string; texto: string };
};

const AVISOS: Record<string, AvisoDaHome> = {
  /**
   * Vem de `criarConta` (acoes/autenticacao.ts) quando o Supabase devolve
   * sessão no próprio cadastro — ou seja, quando a pessoa JÁ ENTROU.
   *
   * Pedido V1: "usuário criou sua conta, em seguida ele deve ser logado
   * instantaneamente". Antes ela ficava parada em /entrar lendo uma frase,
   * com o formulário ainda na tela, como se faltasse alguma coisa.
   *
   * A frase aponta para o nome no topo porque é ali que a prova de que
   * deu certo aparece — e é dali que se chega a /minha-conta.
   */
  /**
   * RF25, redirecionada para cá pelo pedido V1 ("popup assim que uma
   * candidatura for feita, e ser redirecionado para a home"). O texto é o
   * mesmo de `avisos-da-conta.ts`, adaptado: lá ele dizia "está aqui
   * embaixo" porque a lista ficava logo abaixo; aqui a lista está a um
   * toque, no link.
   *
   * NÃO PROMETE PRAZO (regra 2 aplicada a uma confirmação): a ONG é uma
   * equipe pequena. O que a frase diz é verdade — a candidatura está
   * registrada — e aponta para onde a pessoa acompanha o resto.
   */
  candidatura: {
    texto: 'Candidatura registrada. É na sua conta que a situação dela vai mudando conforme '
      + 'a gente conversa.',
    ok: true,
    link: { href: '/minha-conta', texto: 'Ver minha candidatura' }
  },
  /**
   * O DESFECHO PARCIAL: a candidatura é gravada em DUAS tabelas sem
   * transação (`voluntarios` e `voluntario_areas`). Quando a segunda falha,
   * a candidatura EXISTE e a ONG a vê; o que falta é para qual área.
   *
   * Dizer só "registrada" seria mentir por omissão sobre a única coisa que
   * a pessoa escolheu; dizer "não deu" a faria mandar de novo — e o segundo
   * envio bate na recusa de candidatura duplicada.
   */
  'candidatura-sem-areas': {
    texto: 'Candidatura registrada, mas as áreas que você escolheu não foram guardadas. Não '
      + 'precisa mandar de novo: chame no WhatsApp (11) 95396-8344 e diga em qual área você '
      + 'quer ajudar, que a gente completa por aqui.',
    ok: true,
    link: { href: '/minha-conta', texto: 'Ver minha candidatura' }
  },
  /**
   * RF19, redirecionada para cá pelo mesmo pedido V1 ("mostrar popup/na
   * página agradecimento pela doação").
   *
   * AGRADECE SEM PROMETER: o site registra doação, não cobra (RN08). A
   * frase não diz "recebemos" — a ONG ainda não recebeu nada; ela recebeu
   * uma OFERTA, e quem confirma o recebimento é a equipe, depois do fato.
   */
  doacao: {
    texto: 'Obrigado. Sua oferta chegou e a equipe vai responder dizendo se dá para receber. '
      + 'O site não cobra nada e não recebe pagamento — quem combina o resto é a gente, '
      + 'com você.',
    ok: true,
    link: { href: '/minha-conta', texto: 'Acompanhar minha oferta' }
  },
  'conta-criada': {
    texto: 'Conta criada e pronta para usar. Você já está dentro — seu nome aparece no '
      + 'topo da página, e é por ele que se chega à sua conta.',
    ok: true
  }
};

export function avisoDaHome(bruto: unknown): AvisoDaHome | null {
  if (typeof bruto !== 'string') return null;
  return AVISOS[bruto] ?? null;
}

/** Os nomes válidos, para os testes reconciliarem contra quem os emite. */
export const AVISOS_DA_HOME = Object.keys(AVISOS);
