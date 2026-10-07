/**
 * Reduz uma foto grande NO CELULAR, antes de ela ser enviada.
 *
 * Foto de celular tem de 3 a 8 MB e o teto da tela é 4 MB. Até 06/10/2026 a
 * pessoa recebia um aviso ("procure a opção de enviar em tamanho médio") e
 * tinha de voltar ao seletor, no meio de um evento, de pé. Aqui o script
 * faz isso por ela: redesenha a foto numa dimensão menor e a regrava em
 * JPEG, e o formulário segue com o arquivo novo.
 *
 * É ENFEITE ÚTIL, NUNCA REQUISITO: devolve `null` em qualquer dúvida —
 * formato que não é JPEG/PNG/WebP (GIF animado perderia a animação), navegador
 * sem `createImageBitmap`, falha ao decodificar, resultado ainda grande — e
 * aí o formulário cai no aviso de antes. O servidor continua conferindo o
 * tamanho e a assinatura do arquivo (`validarMidia`).
 *
 * Fundo branco antes de desenhar: PNG com transparência virava preto ao
 * passar para JPEG.
 */

const TIPOS_REDUZIVEIS = /^image\/(jpeg|png|webp)$/;

/** Do maior para o menor: para na primeira que couber, para perder o mínimo. */
const QUALIDADES = [0.88, 0.8, 0.7, 0.6];

/** Lado maior, em px, de cada tentativa: 2000 ainda é nítido numa tela de celular. */
const LADOS_MAXIMOS = [2000, 1600, 1200];

export async function reduzirFoto(arquivo: File, limiteBytes: number): Promise<File | null> {
  if (!TIPOS_REDUZIVEIS.test(arquivo.type)) return null;
  if (typeof createImageBitmap !== 'function') return null;

  try {
    const imagem = await createImageBitmap(arquivo);
    try {
      for (const ladoMaximo of LADOS_MAXIMOS) {
        const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
        const largura = Math.max(1, Math.round(imagem.width * escala));
        const altura = Math.max(1, Math.round(imagem.height * escala));

        const tela = document.createElement('canvas');
        tela.width = largura;
        tela.height = altura;
        const contexto = tela.getContext('2d');
        if (!contexto) return null;
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, largura, altura);
        contexto.drawImage(imagem, 0, 0, largura, altura);

        for (const qualidade of QUALIDADES) {
          const blob = await new Promise<Blob | null>((resolver) => {
            tela.toBlob(resolver, 'image/jpeg', qualidade);
          });
          if (blob && blob.size <= limiteBytes) {
            const nome = arquivo.name.replace(/\.[^.]+$/, '') || 'foto';
            return new File([blob], `${nome}.jpg`, { type: 'image/jpeg' });
          }
        }
      }
      return null;
    } finally {
      imagem.close();
    }
  } catch {
    return null;
  }
}
