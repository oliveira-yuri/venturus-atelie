import type { ChangeEvent } from 'react';

/**
 * Monta o valor em reais conforme se digita, em qualquer formulário que
 * tenha um campo `name="quantia"`.
 *
 * =====================================================================
 * ELA É IRMÃ DE `mascara-telefone.ts`, E PELO MESMO MOTIVO
 * =====================================================================
 *
 * O handler vai no `<form>`, não no `<input>`: o evento chega por
 * borbulhamento e alcança o campo onde quer que ele esteja, inclusive
 * dentro de `CampoFormulario`, que não expõe `onChange` próprio.
 *
 * =====================================================================
 * ELA DIGITA DA DIREITA PARA A ESQUERDA
 * =====================================================================
 *
 * É como toda maquininha de cartão e todo caixa eletrônico funcionam:
 * digitar "2" mostra `0,02`; "25" mostra `0,25`; "2500" mostra `25,00`.
 *
 * A alternativa — deixar a pessoa digitar a vírgula — quebra num celular,
 * onde o teclado numérico às vezes não tem vírgula e às vezes tem ponto.
 * Quem digita "250.00" acabaria com "25000". Contando os centavos da
 * direita, não existe separador para errar.
 *
 * NÃO ESCREVE O "R$" no campo. O símbolo mora no rótulo do campo, e assim
 * o que a pessoa vê no controle é só o número — o que também deixa o valor
 * pronto para `numeroDoValor`, que lê o formato brasileiro.
 *
 * =====================================================================
 * O TETO DE DÍGITOS É DA COLUNA, NÃO DE GOSTO
 * =====================================================================
 *
 * `doacoes.valor` é `numeric(12, 2)`: dez dígitos antes da vírgula. Passar
 * disso é sempre erro de digitação (ninguém oferta dez bilhões), e o corte
 * evita que o campo aceite um número que o banco recusaria depois.
 */

const DIGITOS_MAXIMOS = 12;

/** Os centavos vêm da direita: "2500" → "25,00". */
export function formatarDinheiro(bruto: string): string {
  const digitos = String(bruto).replace(/\D/g, '').slice(0, DIGITOS_MAXIMOS);
  if (digitos.length === 0) return '';

  // `padStart(3)` garante que "5" vire "005" → "0,05" em vez de quebrar.
  const cheio = digitos.padStart(3, '0');
  const centavos = cheio.slice(-2);
  const inteiros = cheio.slice(0, -2).replace(/^0+(?=\d)/, '');

  // O ponto de milhar é o que torna "1.500,00" legível de relance — e é a
  // forma que `numeroDoValor` aceita.
  return `${inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

export function mascararDinheiro(evento: ChangeEvent<HTMLFormElement>): void {
  const alvo = evento.target;
  if (!(alvo instanceof HTMLInputElement) || alvo.name !== 'quantia') return;

  alvo.value = formatarDinheiro(alvo.value);
}
