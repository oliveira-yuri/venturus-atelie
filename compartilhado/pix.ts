/**
 * Pix "copia e cola" estático (BR Code, EMV MPM do Banco Central).
 *
 * O site NÃO cobra nem confere pagamento (RN08): isto só monta o texto que o
 * aplicativo do banco lê, para a pessoa não digitar a chave. Valor e
 * identificador ficam de fora de propósito — quem doa escolhe a quantia, e um
 * QR sem valor é o que o Pix chama de "QR estático".
 */

function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`Pix: campo ${id} com ${valor.length} caracteres (máximo 99).`);
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) em 4 hexadecimais maiúsculos. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** O BR Code pede maiúsculas sem acento e só ASCII imprimível. */
export function paraBrCode(texto: string, maximo: number): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').trim().slice(0, maximo);
}

export function montarPix({ chave, nome, cidade }: { chave: string; nome: string; cidade: string }): string {
  const chaveLimpa = chave.trim();
  if (chaveLimpa.length === 0 || chaveLimpa.length > 77) throw new Error('Pix: chave vazia ou com mais de 77 caracteres.');
  const nomeLimpo = paraBrCode(nome, 25);
  const cidadeLimpa = paraBrCode(cidade, 15);
  if (!nomeLimpo || !cidadeLimpa) throw new Error('Pix: nome e cidade do recebedor são obrigatórios.');

  const semCrc =
    campo('00', '01') +
    campo('01', '11') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chaveLimpa)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('58', 'BR') +
    campo('59', nomeLimpo) +
    campo('60', cidadeLimpa) +
    campo('62', campo('05', '***')) +
    '6304';
  return semCrc + crc16(semCrc);
}
