/**
 * "Ouvir esta página" usa a voz do próprio aparelho (Web Speech API): zero
 * custo, zero dado enviado a terceiro. Os navegadores cortam falas longas
 * (o Chrome para em ~15 s), então o texto vai em trechos de frases.
 */
export const TAMANHO_MAXIMO_DO_TRECHO = 220;

export function dividirParaLeitura(texto: string, maximo = TAMANHO_MAXIMO_DO_TRECHO): string[] {
  const frases = texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…:])\s+/)
    .filter(Boolean);

  const trechos: string[] = [];
  let atual = '';
  for (const frase of frases) {
    if (frase.length > maximo) {
      if (atual) { trechos.push(atual); atual = ''; }
      // Frase gigante: quebra em palavras, nunca no meio de uma.
      let pedaco = '';
      for (const palavra of frase.split(' ')) {
        if ((pedaco + ' ' + palavra).trim().length > maximo && pedaco) {
          trechos.push(pedaco);
          pedaco = palavra;
        } else {
          pedaco = (pedaco + ' ' + palavra).trim();
        }
      }
      if (pedaco) trechos.push(pedaco);
    } else if ((atual + ' ' + frase).trim().length > maximo) {
      trechos.push(atual);
      atual = frase;
    } else {
      atual = (atual + ' ' + frase).trim();
    }
  }
  if (atual) trechos.push(atual);
  return trechos;
}
