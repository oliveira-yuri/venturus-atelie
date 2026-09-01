/**
 * compartilhado/avisos-de-contato.ts — a frase que /contato mostra depois
 * de um envio que deu certo, escolhida por um parâmetro da URL.
 *
 * ===================================================================
 * POR QUE NÃO ESTÁ EM compartilhado/avisos-do-painel.ts
 * ===================================================================
 *
 * A mecânica é a mesma (lista fechada, `Object.hasOwn`, o resultado da
 * Action viajando pelo `?aviso=` do redirect) e a tentação de juntar é
 * real. O que separa é o PÚBLICO: aquele arquivo é lido por quem trabalha
 * na ONG, dentro de uma tela que responde 404 para o resto do mundo; este é
 * lido por qualquer visitante. Frases para públicos diferentes envelhecem
 * em ritmos diferentes, e o dia em que alguém "melhorar" a palavra
 * "guardada" no painel não pode ser o dia em que a confirmação do
 * formulário público muda de sentido sem ninguém olhar.
 *
 * ===================================================================
 * POR QUE O RESULTADO PASSA PELA URL
 * ===================================================================
 *
 * `enviarContato` (acoes/contato.ts) termina em `redirect()` quando dá
 * certo — POST-redirect-GET. Isso resolve um problema concreto desta tela:
 * sem o redirect, atualizar a página depois de enviar reenvia a mensagem, e
 * a ONG recebe a mesma coisa duas vezes (e a pessoa gasta duas vezes o
 * limite de envio). Um redirect não carrega estado, então o único canal
 * entre a Action e a tela é o `?aviso=` que ela põe no destino.
 *
 * A RECUSA NÃO PASSA POR AQUI, e a assimetria é deliberada: quando o envio
 * falha, a Action devolve `EstadoFormulario` com os erros E com o que a
 * pessoa escreveu, e não redireciona — um redirect ali apagaria a mensagem
 * inteira que ela acabou de digitar.
 *
 * ===================================================================
 * E POR QUE A LISTA É FECHADA
 * ===================================================================
 *
 * `?aviso=` é escrito por quem quiser: basta mandar um link. Ecoar na tela o
 * texto recebido seria injeção de conteúdo no site da ONG — alguém manda
 * `?aviso=Deposite na chave Pix ...` e a frase aparece com a cara do site.
 * Aqui o parâmetro só ESCOLHE uma das frases escritas abaixo; qualquer
 * outro valor não mostra nada.
 *
 * ARQUIVO SEM NENHUM IMPORT, de propósito, como os outros de
 * compartilhado/ que precisam ser medidos sem subir o Next: assim
 * testes/contato.test.mjs consegue importá-lo pelo runtime nativo do Node,
 * que não resolve o alias `@/...` do tsconfig.
 */

export type AvisoDeContato = { texto: string; ok: boolean };

/**
 * UMA FRASE SÓ, e o que ela pode prometer é limitado de propósito.
 *
 * A mensagem fica gravada em `public.contatos` — isso é fato e pode ser
 * dito. O que NÃO se pode prometer é prazo de resposta: a ONG é uma equipe
 * pequena, e a tela da equipe para ler estes registros (RF29) ainda não
 * existe nesta branch — hoje quem lê precisa abrir o painel do Supabase.
 * Por isso a frase termina nos canais que funcionam com certeza hoje, que
 * são os mesmos que estão logo acima dela na página.
 *
 * É a regra 2 do CLAUDE.md aplicada a uma confirmação: nada de "responderemos
 * em até 48 horas", que ninguém prometeu.
 */
const AVISOS: Record<string, AvisoDeContato> = {
  enviada: {
    texto: 'Mensagem recebida — ela ficou registrada com o Ateliê. Se for urgente, chame '
      + 'no WhatsApp (11) 95396-8344: é o caminho mais rápido.',
    ok: true
  }
};

export function avisoDeContato(valor: unknown): AvisoDeContato | null {
  if (typeof valor !== 'string') return null;

  // `Object.hasOwn`, e não `AVISOS[valor]` direto: sem isto, `?aviso=toString`
  // (ou `constructor`, ou `__proto__`) devolveria algo herdado do protótipo
  // de Object em vez de `undefined`, e a tela tentaria desenhar aquilo.
  return Object.hasOwn(AVISOS, valor) ? AVISOS[valor] : null;
}
