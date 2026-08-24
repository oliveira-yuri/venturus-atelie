/**
 * Preferências de acessibilidade: tamanho de fonte e alto contraste.
 *
 * Módulo puro, sem DOM — quem aplica no documento é aac-acessibilidade.js.
 * Nenhuma função aqui lança: preferência é conforto, e conforto que derruba
 * a página deixa de ser conforto.
 */

export const CHAVE_ARMAZENAMENTO = 'aac-preferencias';

/** Cinco degraus, de 87,5% a 137,5%. */
export const ESCALAS = [87.5, 100, 112.5, 125, 137.5];

export const PADRAO = Object.freeze({ escala: 100, contraste: 'normal' });

export function proximaEscala(atual, direcao) {
  const posicao = ESCALAS.indexOf(atual);
  if (posicao === -1) return PADRAO.escala;
  const destino = posicao + direcao;
  if (destino < 0 || destino >= ESCALAS.length) return atual;
  return ESCALAS[destino];
}

export function lerPreferencias(armazenamento) {
  try {
    const bruto = armazenamento.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return { ...PADRAO };
    const guardado = JSON.parse(bruto);
    return {
      escala: ESCALAS.includes(guardado.escala) ? guardado.escala : PADRAO.escala,
      contraste: guardado.contraste === 'alto' ? 'alto' : PADRAO.contraste
    };
  } catch {
    return { ...PADRAO };
  }
}

export function gravarPreferencias(armazenamento, preferencias) {
  try {
    armazenamento.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(preferencias));
  } catch {
    // Modo anônimo com armazenamento bloqueado. A preferência vale só nesta página.
  }
}
