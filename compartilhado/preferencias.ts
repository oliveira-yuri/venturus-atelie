/**
 * Preferencias de acessibilidade: tamanho de fonte e alto contraste.
 *
 * Modulo puro, sem DOM. Nenhuma funcao aqui lanca: preferencia e conforto, e
 * conforto que derruba a pagina deixa de ser conforto.
 */
export const CHAVE_ARMAZENAMENTO = 'aac-preferencias';

/** Cinco degraus, de 87,5% a 137,5%. */
export const ESCALAS = [87.5, 100, 112.5, 125, 137.5] as const;

export type Preferencias = { escala: number; contraste: 'normal' | 'alto' };

export const PADRAO: Readonly<Preferencias> = Object.freeze({ escala: 100, contraste: 'normal' });

export function proximaEscala(atual: number, direcao: number): number {
  const posicao = (ESCALAS as readonly number[]).indexOf(atual);
  if (posicao === -1) return PADRAO.escala;
  const destino = posicao + direcao;
  if (destino < 0 || destino >= ESCALAS.length) return atual;
  return ESCALAS[destino];
}

export function lerPreferencias(armazenamento: Storage): Preferencias {
  try {
    const bruto = armazenamento.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return { ...PADRAO };
    const guardado = JSON.parse(bruto);
    return {
      escala: (ESCALAS as readonly number[]).includes(guardado.escala) ? guardado.escala : PADRAO.escala,
      contraste: guardado.contraste === 'alto' ? 'alto' : PADRAO.contraste
    };
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(armazenamento: Storage, preferencias: Preferencias): void {
  try {
    armazenamento.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(preferencias));
  } catch {
    // Modo anonimo com armazenamento bloqueado. A preferencia vale so nesta pagina.
  }
}
