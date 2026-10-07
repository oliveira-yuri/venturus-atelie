/**
 * Gerador de QR Code (modo byte, correção de erro M, versões 1 a 10).
 *
 * Escrito aqui, sem biblioteca (regra 7), seguindo o algoritmo da ISO/IEC
 * 18004. Cobre até 213 bytes, o que sobra para um código Pix estático (~100
 * a 180 caracteres). Além disso, `gerarQr` LANÇA em vez de truncar: um QR
 * cortado que parece de verdade e não paga é pior que nenhum.
 *
 * COMO FOI CONFERIDO (e como se confere de novo): `testes/qrcode.test.mjs`
 * compara a matriz com a de uma implementação independente (segno, Python)
 * para os mesmos dados e a mesma máscara, e o QR renderizado foi decodificado
 * com um leitor (jsQR) devolvendo o texto original.
 */

// Índice = versão. Nível M.
const CODEWORDS_DE_CORRECAO_POR_BLOCO = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUMERO_DE_BLOCOS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const VERSAO_MAXIMA = 10;
const BITS_DO_FORMATO_M = 0;

export type Matriz = boolean[][];

function modulosDeDados(versao: number): number {
  let total = (16 * versao + 128) * versao + 64;
  if (versao >= 2) {
    const n = Math.floor(versao / 7) + 2;
    total -= (25 * n - 10) * n - 55;
    if (versao >= 7) total -= 36;
  }
  return total;
}

function codewordsDeDados(versao: number): number {
  return Math.floor(modulosDeDados(versao) / 8)
    - CODEWORDS_DE_CORRECAO_POR_BLOCO[versao] * NUMERO_DE_BLOCOS[versao];
}

// --- Reed-Solomon sobre GF(2^8), polinômio 0x11D ---------------------------

function multiplicarGf(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisorRs(grau: number): number[] {
  const resultado = new Array(grau).fill(0);
  resultado[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < resultado.length; j++) {
      resultado[j] = multiplicarGf(resultado[j], raiz);
      if (j + 1 < resultado.length) resultado[j] ^= resultado[j + 1];
    }
    raiz = multiplicarGf(raiz, 0x02);
  }
  return resultado;
}

function restoRs(dados: number[], divisor: number[]): number[] {
  const resultado = divisor.map(() => 0);
  for (const b of dados) {
    const fator = b ^ (resultado.shift() as number);
    resultado.push(0);
    divisor.forEach((coef, i) => { resultado[i] ^= multiplicarGf(coef, fator); });
  }
  return resultado;
}

// --- Dados -------------------------------------------------------------------

function codificarBytes(texto: string): number[] {
  return Array.from(new TextEncoder().encode(texto));
}

function montarCodewords(bytes: number[], versao: number): number[] {
  const bits: number[] = [];
  const empurrar = (valor: number, tamanho: number) => {
    for (let i = tamanho - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  empurrar(0b0100, 4); // modo byte
  empurrar(bytes.length, versao <= 9 ? 8 : 16);
  bytes.forEach((b) => empurrar(b, 8));

  const capacidadeEmBits = codewordsDeDados(versao) * 8;
  empurrar(0, Math.min(4, capacidadeEmBits - bits.length));
  empurrar(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacidadeEmBits; pad ^= 0xec ^ 0x11) empurrar(pad, 8);

  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    dados.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  return dados;
}

function intercalarComCorrecao(dados: number[], versao: number): number[] {
  const blocos = NUMERO_DE_BLOCOS[versao];
  const correcao = CODEWORDS_DE_CORRECAO_POR_BLOCO[versao];
  const totalBrutos = Math.floor(modulosDeDados(versao) / 8);
  const blocosCurtos = blocos - (totalBrutos % blocos);
  const tamanhoCurto = Math.floor(totalBrutos / blocos);

  const divisor = divisorRs(correcao);
  const lista: number[][] = [];
  for (let i = 0, k = 0; i < blocos; i++) {
    const tamanho = tamanhoCurto - correcao + (i < blocosCurtos ? 0 : 1);
    const parte = dados.slice(k, k + tamanho);
    k += tamanho;
    const ecc = restoRs(parte, divisor);
    if (i < blocosCurtos) parte.push(0); // marcador, removido ao intercalar
    lista.push(parte.concat(ecc));
  }

  const resultado: number[] = [];
  for (let i = 0; i < lista[0].length; i++) {
    lista.forEach((bloco, j) => {
      if (i !== tamanhoCurto - correcao || j >= blocosCurtos) resultado.push(bloco[i]);
    });
  }
  return resultado;
}

// --- Matriz ------------------------------------------------------------------

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

class Construtor {
  readonly versao: number;
  readonly tamanho: number;
  modulos: Matriz;
  funcao: Matriz;

  constructor(versao: number) {
    this.versao = versao;
    this.tamanho = versao * 4 + 17;
    this.modulos = Array.from({ length: this.tamanho }, () => new Array(this.tamanho).fill(false));
    this.funcao = Array.from({ length: this.tamanho }, () => new Array(this.tamanho).fill(false));
    this.desenharPadroesDeFuncao();
  }

  private definir(x: number, y: number, escuro: boolean) {
    this.modulos[y][x] = escuro;
    this.funcao[y][x] = true;
  }

  private desenharPadroesDeFuncao() {
    const n = this.tamanho;
    for (let i = 0; i < n; i++) {
      this.definir(6, i, i % 2 === 0);
      this.definir(i, 6, i % 2 === 0);
    }
    this.localizador(3, 3);
    this.localizador(n - 4, 3);
    this.localizador(3, n - 4);

    const posicoes = this.posicoesDeAlinhamento();
    const k = posicoes.length;
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === k - 1) || (i === k - 1 && j === 0))) {
          this.alinhamento(posicoes[i], posicoes[j]);
        }
      }
    }
    this.desenharFormato(0);
    this.desenharVersao();
  }

  private localizador(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.tamanho && y >= 0 && y < this.tamanho) {
          this.definir(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private alinhamento(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.definir(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  private posicoesDeAlinhamento(): number[] {
    if (this.versao === 1) return [];
    const n = Math.floor(this.versao / 7) + 2;
    const passo = Math.ceil((this.versao * 4 + 4) / (n * 2 - 2)) * 2;
    const resultado = [6];
    for (let pos = this.tamanho - 7; resultado.length < n; pos -= passo) resultado.splice(1, 0, pos);
    return resultado;
  }

  desenharFormato(mascara: number) {
    const dados = (BITS_DO_FORMATO_M << 3) | mascara;
    let resto = dados;
    for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
    const bits = ((dados << 10) | resto) ^ 0x5412;
    const n = this.tamanho;
    for (let i = 0; i <= 5; i++) this.definir(8, i, bit(bits, i));
    this.definir(8, 7, bit(bits, 6));
    this.definir(8, 8, bit(bits, 7));
    this.definir(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.definir(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.definir(n - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.definir(8, n - 15 + i, bit(bits, i));
    this.definir(8, n - 8, true);
  }

  private desenharVersao() {
    if (this.versao < 7) return;
    let resto = this.versao;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
    const bits = (this.versao << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const escuro = bit(bits, i);
      const a = this.tamanho - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.definir(a, b, escuro);
      this.definir(b, a, escuro);
    }
  }

  colocarDados(codewords: number[]) {
    let i = 0;
    for (let direita = this.tamanho - 1; direita >= 1; direita -= 2) {
      if (direita === 6) direita = 5;
      for (let vert = 0; vert < this.tamanho; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = direita - j;
          const subindo = ((direita + 1) & 2) === 0;
          const y = subindo ? this.tamanho - 1 - vert : vert;
          if (!this.funcao[y][x] && i < codewords.length * 8) {
            this.modulos[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  aplicarMascara(mascara: number) {
    for (let y = 0; y < this.tamanho; y++) {
      for (let x = 0; x < this.tamanho; x++) {
        let inverter: boolean;
        switch (mascara) {
          case 0: inverter = (x + y) % 2 === 0; break;
          case 1: inverter = y % 2 === 0; break;
          case 2: inverter = x % 3 === 0; break;
          case 3: inverter = (x + y) % 3 === 0; break;
          case 4: inverter = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inverter = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inverter = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inverter = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!this.funcao[y][x] && inverter) this.modulos[y][x] = !this.modulos[y][x];
      }
    }
  }

  penalidade(): number {
    const n = this.tamanho;
    let total = 0;
    const linhas = [...this.modulos, ...Array.from({ length: n }, (_, x) => this.modulos.map((l) => l[x]))];

    for (const linha of linhas) {
      let corrida = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && linha[i] === linha[i - 1]) corrida++;
        else {
          if (corrida >= 5) total += 3 + (corrida - 5);
          corrida = 1;
        }
      }
      // Padrão 1:1:3:1:1 com 4 claros de um lado (N3)
      for (let i = 0; i + 11 <= n; i++) {
        const w = linha.slice(i, i + 11).map((v) => (v ? 1 : 0)).join('');
        if (w === '10111010000' || w === '00001011101') total += 40;
      }
    }
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = this.modulos[y][x];
        if (c === this.modulos[y][x + 1] && c === this.modulos[y + 1][x] && c === this.modulos[y + 1][x + 1]) total += 3;
      }
    }
    const escuros = this.modulos.flat().filter(Boolean).length;
    const percentual = (escuros * 100) / (n * n);
    total += Math.floor(Math.abs(percentual - 50) / 5) * 10;
    return total;
  }
}

/** A matriz do QR (true = módulo escuro), sem a borda de silêncio. */
export function gerarQr(texto: string, mascaraForcada?: number): Matriz {
  const bytes = codificarBytes(texto);
  let versao = 1;
  // 4 bits de modo + 8/16 de comprimento + dados
  const cabecalho = (v: number) => 4 + (v <= 9 ? 8 : 16);
  while (versao <= VERSAO_MAXIMA && cabecalho(versao) + bytes.length * 8 > codewordsDeDados(versao) * 8) versao++;
  if (versao > VERSAO_MAXIMA) {
    throw new Error(`QR: ${bytes.length} bytes não cabem na versão ${VERSAO_MAXIMA} (limite ${codewordsDeDados(VERSAO_MAXIMA) - 3}).`);
  }

  const codewords = intercalarComCorrecao(montarCodewords(bytes, versao), versao);

  let melhor: Matriz | null = null;
  let menor = Infinity;
  const mascaras = mascaraForcada === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [mascaraForcada];
  for (const mascara of mascaras) {
    const c = new Construtor(versao);
    c.colocarDados(codewords);
    c.aplicarMascara(mascara);
    c.desenharFormato(mascara);
    const pontos = c.penalidade();
    if (pontos < menor) { menor = pontos; melhor = c.modulos; }
  }
  return melhor as Matriz;
}
