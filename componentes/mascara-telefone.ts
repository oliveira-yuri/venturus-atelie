import type { ChangeEvent } from 'react';
import { formatarTelefone } from '@/compartilhado/validacao';

/**
 * Monta o telefone conforme se digita, em QUALQUER formulário que tenha um
 * campo `name="telefone"`.
 *
 * =====================================================================
 * POR QUE ISTO VIROU UM MÓDULO
 * =====================================================================
 *
 * A função morava, copiada e colada, em `componentes/AbasEntrar.tsx` e em
 * `componentes/FormularioMeusDados.tsx` — e NÃO existia em
 * `componentes/FormularioContato.tsx`, que é o formulário público. Foi isso
 * que o pedido V1 relatou: "máscara de telefone onde tem o campo de
 * telefone (página de contato por exemplo não está aplicando a máscara)".
 *
 * Duas cópias divergem; três divergiriam mais rápido. Aqui é uma só, e
 * `testes/mascara-telefone.test.mjs` reconcilia a lista de formulários que
 * a usam contra a lista dos que têm campo de telefone — o dia em que
 * alguém criar um quarto formulário com telefone e esquecer o `onChange`,
 * a suíte fica vermelha.
 *
 * =====================================================================
 * O HANDLER VAI NO <form>, NÃO NO <input>
 * =====================================================================
 *
 * O evento chega por borbulhamento, então um `onChange` no formulário
 * cobre o campo de telefone onde quer que ele esteja, inclusive dentro de
 * `CampoFormulario`, que não expõe `onChange` próprio. `instanceof` em vez
 * de cast porque este handler recebe TODOS os controles do formulário,
 * inclusive as caixas de marcar.
 *
 * =====================================================================
 * SÓ FORMATA COM O CURSOR NO FIM, E ISSO É O CONSERTO DE UM DEFEITO REAL
 * =====================================================================
 *
 * Escrever em `input.value` joga o cursor para o fim sozinho. Formatar
 * sempre faria quem corrige um dígito no MEIO do número ser atirado para o
 * fim a cada tecla. Formatando só quando o cursor já está no fim, quem
 * edita no meio segue digitando sem nada pular — e o valor sai formatado
 * na próxima digitação no fim.
 *
 * COLAR CONTINUA VALENDO: colar deixa o cursor no fim do que foi colado.
 *
 * E a máscara é ENFEITE DE DIGITAÇÃO, não regra: sem JavaScript o campo
 * aceita o telefone como a pessoa escrever, e o servidor lê só os dígitos
 * (`apenasDigitos`, em `compartilhado/validacao.ts`). Quem valida é lá.
 */
export function mascararTelefone(evento: ChangeEvent<HTMLFormElement>) {
  const alvo: unknown = evento.target;
  if (!(alvo instanceof HTMLInputElement) || alvo.name !== 'telefone') return;

  const noFim = alvo.selectionStart === null || alvo.selectionStart === alvo.value.length;
  if (!noFim) return;

  const formatado = formatarTelefone(alvo.value);
  if (formatado !== alvo.value) alvo.value = formatado;
}
