/**
 * compartilhado/avisos-da-conta.ts — as frases que /minha-conta mostra
 * depois de uma Server Action, escolhidas por um parâmetro da URL (RF11).
 *
 * ===================================================================
 * POR QUE O RESULTADO PASSA PELA URL, E NÃO PELO ESTADO DO FORMULÁRIO
 * ===================================================================
 *
 * `salvarMeusDados` (acoes/conta.ts) termina em `redirect()` no sucesso, e
 * isso NÃO é só o padrão POST-redirect-GET das Actions do painel. Aqui há um
 * motivo específico desta tela: o nome que a pessoa acabou de gravar é o que
 * o CABEÇALHO desenha, e o cabeçalho vive em `app/layout.tsx`. Devolver
 * estado de formulário re-renderiza a rota; uma navegação de verdade
 * re-renderiza o layout junto — que é a única forma de a pessoa VER o nome
 * novo no topo da tela no mesmo gesto em que o salvou.
 *
 * De quebra vem o que o redirect sempre dá: sem JavaScript é o comportamento
 * nativo do `<form>`, e atualizar a página depois não repete a gravação.
 *
 * A RECUSA continua voltando como `EstadoFormulario`, sem redirect — ela
 * precisa devolver o que a pessoa escreveu e o erro por campo, e nada disso
 * cabe numa lista fechada de frases.
 *
 * ===================================================================
 * E POR QUE A LISTA É FECHADA
 * ===================================================================
 *
 * Mesma disciplina de compartilhado/avisos-do-painel.ts: `?aviso=` é escrito
 * por quem quiser, basta mandar um link. Ecoar o texto recebido deixaria
 * qualquer pessoa escrever uma frase com a cara do site dentro da área de
 * conta de outra ("Sua conta foi bloqueada, ligue para..."). Aqui o
 * parâmetro só ESCOLHE uma das frases abaixo; qualquer outro valor não
 * mostra nada.
 *
 * ARQUIVO SEPARADO DO DO PAINEL, e não uma quarta lista dentro dele: as
 * frases são de assuntos diferentes e envelhecem separadamente. Um mapa
 * único convidaria a reaproveitar "salva" nas duas telas, e o dia em que uma
 * precisasse de outra palavra a mudança sairia na outra também — que é o
 * motivo escrito na própria avisos-do-painel.ts para as listas de lá serem
 * três.
 *
 * SEM NENHUM IMPORT, de propósito: assim `testes/minha-conta.test.mjs`
 * consegue importá-lo pelo runtime nativo do Node, que não resolve o alias
 * `@/...` do tsconfig.
 */

export type AvisoDaConta = { texto: string; ok: boolean };

const AVISOS: Record<string, AvisoDaConta> = {
  salvo: {
    texto: 'Seus dados foram atualizados. Se você mudou o nome, ele já aparece aqui em cima, '
      + 'no topo da tela.',
    ok: true
  },
  /**
   * O DESFECHO PARCIAL, e ele existe porque o nome é gravado em DOIS
   * lugares (ver acoes/conta.ts): a tabela `public.perfis`, que é o
   * registro, e o metadata da conta, que é de onde `servidor/sessao.ts` lê
   * o nome do cabeçalho.
   *
   * Se o segundo falhar depois de o primeiro dar certo, o dado ESTÁ
   * gravado e o cabeçalho continua com o nome antigo. Dizer só "salvo"
   * seria mentir por omissão sobre a única coisa que a pessoa vai
   * conferir olhando; dizer "não deu" seria mentir sobre a gravação e
   * fazê-la digitar tudo de novo à toa.
   */
  'salvo-cabecalho-velho': {
    texto: 'Seus dados foram atualizados. Só o nome no topo da tela continua sendo o antigo — '
      + 'ele volta ao normal na próxima vez que você entrar.',
    ok: true
  },
  /**
   * RF25. A confirmação da candidatura chega AQUI, e não na tela onde o
   * formulário estava, porque é aqui que ela existe: a lista logo abaixo
   * mostra a candidatura com a situação e as áreas escolhidas. Uma
   * confirmação que mostra o registro vale mais que uma que promete que ele
   * existe.
   *
   * NÃO PROMETE PRAZO (regra 2 do CLAUDE.md aplicada a uma confirmação): a
   * ONG é uma equipe pequena e a tela de gestão de voluntários (RF26) ainda
   * não existe. O que a frase diz é verdade — a candidatura está registrada
   * — e aponta para o único lugar onde a pessoa acompanha o resto.
   */
  candidatura: {
    texto: 'Candidatura registrada. Ela está aqui embaixo, com as áreas que você escolheu — '
      + 'e é neste mesmo lugar que a situação dela vai mudando conforme a gente conversa.',
    ok: true
  },
  /**
   * O DESFECHO PARCIAL, e ele existe pelo mesmo motivo do
   * 'salvo-cabecalho-velho' acima: a candidatura é gravada em DUAS tabelas
   * sem transação (`voluntarios` e `voluntario_areas`, ver
   * acoes/voluntariado.ts). Quando a segunda falha, a candidatura EXISTE e
   * a ONG a vê; o que falta é para qual área.
   *
   * Dizer só "registrada" seria mentir por omissão sobre a única coisa que
   * a pessoa escolheu; dizer "não deu" seria mentir sobre a gravação e
   * fazê-la mandar de novo — e mandar de novo bate na recusa de candidatura
   * duplicada, ou seja, ela leria duas mensagens que se contradizem.
   */
  'candidatura-sem-areas': {
    texto: 'Candidatura registrada, mas as áreas que você escolheu não foram guardadas. Não '
      + 'precisa mandar de novo: chame no WhatsApp (11) 95396-8344 e diga em qual área você '
      + 'quer ajudar, que a gente completa por aqui.',
    ok: true
  },
  /**
   * RF19. A confirmação da oferta chega AQUI, e não na tela onde o
   * formulário estava, pelo mesmo motivo da candidatura: é aqui que ela
   * existe. A lista logo abaixo mostra a doação com a situação escrita, e
   * uma confirmação que mostra o registro vale mais que uma que promete que
   * ele existe.
   *
   * NÃO PROMETE PRAZO e NÃO PROMETE ACEITE (regra 2 do CLAUDE.md aplicada a
   * uma confirmação): a ONG é uma equipe pequena, e a /doar deixa claro que
   * a resposta pode ser "não conseguimos receber" — há coisa que ela não
   * recebe, e está escrito lá. Dizer "obrigado pela sua doação" aqui seria
   * agradecer por algo que ainda não chegou e pode não ser aceito.
   *
   * E NÃO FALA EM PAGAMENTO NEM EM RECIBO: RN08, o site registra doação e
   * nunca processa pagamento.
   */
  doacao: {
    texto: 'Oferta registrada. Ela está aqui embaixo, como “ofertada” — e é neste mesmo lugar '
      + 'que vai aparecer a nossa resposta, dizendo se conseguimos receber e o que combinamos.',
    ok: true
  }
};

export function avisoDaConta(valor: unknown): AvisoDaConta | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn`, e não `AVISOS[valor]` direto: sem isto,
  // `?aviso=toString` (ou `constructor`, ou `__proto__`) devolveria algo
  // herdado do protótipo de Object em vez de `undefined`, e a tela tentaria
  // desenhar aquilo.
  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : null;
}
