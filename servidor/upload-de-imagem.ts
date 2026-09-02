import 'server-only';
import { obterCliente } from './supabase';
import { tipoDaImagem, BYTES_PARA_RECONHECER } from '@/compartilhado/validacao';

/**
 * Subir uma imagem institucional para o bucket `identidade`.
 *
 * =====================================================================
 * POR QUE ISTO EXISTE, E POR QUE NÃO REAPROVEITA `acoes/galeria.ts`
 * =====================================================================
 *
 * O pedido V1 quer imagem na NOTÍCIA e no PROJETO. As duas somam três
 * lugares que sobem arquivo (com a galeria), e a lógica é a mesma nos
 * três: ler o arquivo uma vez, reconhecer o tipo PELOS BYTES, montar um
 * caminho com uuid, subir sem sobrescrever.
 *
 * `acoes/galeria.ts` não serve como base porque ela faz mais: ela grava
 * uma linha em `public.midia`, com álbum, alt, legenda e a autorização de
 * uso de imagem — o ciclo inteiro da RN07. Chamá-la para pôr capa numa
 * notícia criaria uma linha de acervo fantasma.
 *
 * =====================================================================
 * BUCKET `identidade`, E A DIFERENÇA IMPORTA
 * =====================================================================
 *
 * `galeria` é PRIVADO desde a 008 e guarda foto de PESSOA — o acervo de
 * oficina, com crianças, sob a RN07. Lá o endereço é assinado e vence.
 *
 * `identidade` é PÚBLICO desde a 006 e foi criado para material
 * institucional: cartaz de espetáculo, ilustração de notícia, foto de
 * cena. É onde a capa vai. A migration 009 explica a escolha por inteiro.
 *
 * =====================================================================
 * O TIPO VEM DOS BYTES, NUNCA DA EXTENSÃO NEM DO Content-Type
 * =====================================================================
 *
 * O `accept` do input é sugestão para o seletor de arquivos, e
 * `arquivo.type` vem do cliente: os dois são entrada de usuário. Quem
 * monta a requisição à mão escolhe os três (nome, extensão, tipo
 * declarado). O que não dá para forjar sem de fato ser aquilo são os
 * primeiros bytes.
 *
 * É a mesma regra de `acoes/galeria.ts` e `acoes/acervo.ts`, e ela existe
 * porque Server Action é endpoint HTTP público (spec §4.5).
 */

export const BUCKET_INSTITUCIONAL = 'identidade';

export type ResultadoDoUpload =
  | { ok: true; caminho: string }
  | { ok: false; motivo: 'nao-e-imagem' | 'nao-deu-para-ler' | 'nao-deu-para-subir' };

/**
 * O caminho no bucket.
 *
 * NOME DE ARQUIVO É ENTRADA DE USUÁRIO E NÃO ENTRA AQUI, nem "limpo" —
 * mesma regra de `caminhoNoBucket` em compartilhado/validacao.ts. O
 * caminho é `<pasta>/<uuid>.<extensão>`, e a extensão sai do que os bytes
 * disseram, não do que o nome prometia.
 */
export function caminhoInstitucional(pasta: string, extensao: string, uuid: string): string {
  return `${pasta}/${uuid}.${extensao}`;
}

export async function subirImagemInstitucional(
  arquivo: File,
  pasta: string
): Promise<ResultadoDoUpload> {
  // Lê o arquivo INTEIRO uma vez só e reaproveita o buffer no upload: uma
  // segunda leitura de 4 MB não custa rede, mas custa memória de função —
  // e memória de função é o que a hospedagem cobra.
  let conteudo: ArrayBuffer;
  try {
    conteudo = await arquivo.arrayBuffer();
  } catch (erro) {
    console.error('[imagem] não deu para ler o arquivo recebido:', erro);
    return { ok: false, motivo: 'nao-deu-para-ler' };
  }

  const reconhecido = tipoDaImagem(new Uint8Array(conteudo.slice(0, BYTES_PARA_RECONHECER)));
  if (!reconhecido) return { ok: false, motivo: 'nao-e-imagem' };

  const caminho = caminhoInstitucional(pasta, reconhecido.extensao, crypto.randomUUID());

  try {
    const envio = await (await obterCliente()).storage
      .from(BUCKET_INSTITUCIONAL)
      .upload(caminho, conteudo, {
        contentType: reconhecido.tipo,
        // `upsert: false` de propósito: o caminho tem um uuid dentro, então
        // colisão só aconteceria por defeito nosso — e sobrescrever em
        // silêncio uma imagem que já está no ar seria o pior desfecho
        // possível de um defeito desses.
        upsert: false
      });

    if (envio.error) {
      console.error('[imagem] upload:', envio.error);
      return { ok: false, motivo: 'nao-deu-para-subir' };
    }

    return { ok: true, caminho };
  } catch (erro) {
    console.error('[imagem] exceção no upload:', erro);
    return { ok: false, motivo: 'nao-deu-para-subir' };
  }
}

/**
 * Apaga uma imagem institucional.
 *
 * Usada quando a gravação da linha FALHA depois de o arquivo ter subido —
 * sem isso, cada tentativa malsucedida deixaria um órfão no bucket. Não
 * lança: se a limpeza falhar, o órfão fica e o log diz qual. Perder o
 * arquivo é menos grave que transformar uma falha de gravação em exceção
 * não tratada.
 */
export async function apagarImagemInstitucional(caminho: string): Promise<void> {
  try {
    const limpeza = await (await obterCliente()).storage
      .from(BUCKET_INSTITUCIONAL).remove([caminho]);
    if (limpeza.error) {
      console.error(`[imagem] sobrou órfão em "${caminho}":`, limpeza.error);
    }
  } catch (erro) {
    console.error(`[imagem] sobrou órfão em "${caminho}":`, erro);
  }
}
