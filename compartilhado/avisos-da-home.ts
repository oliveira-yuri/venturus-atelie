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

export type AvisoDaHome = { texto: string; ok: boolean };

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
