'use client';

/**
 * componentes/BotaoImprimir.tsx — o "Salvar em PDF" do relatório (RF32).
 *
 * ===================================================================
 * ELE É UMA CONVENIÊNCIA, NÃO O MECANISMO
 * ===================================================================
 *
 * Todo o trabalho de verdade está em `estilos/impressao.css`, que é
 * `@media print` puro. Este botão só chama `window.print()` — a mesma coisa
 * que o menu do navegador já faz. Sem JavaScript ele não aparece, e o
 * caminho continua existindo: imprimir pelo menu produz EXATAMENTE o mesmo
 * documento.
 *
 * Isso é o contrário do que uma biblioteca de PDF faria: ali o script SERIA
 * o mecanismo, e sem ele não haveria documento nenhum. Ver o cabeçalho de
 * estilos/impressao.css para a decisão da spec §9.
 *
 * ===================================================================
 * ELE SOME NA IMPRESSÃO
 * ===================================================================
 *
 * `nao-imprimir` é uma das classes que `impressao.css` esconde — e
 * `button` também está naquela lista, então são duas travas. Um botão
 * "Salvar em PDF" impresso dentro do PDF é a piada clássica desta técnica.
 *
 * ===================================================================
 * NO ANDROID, "IMPRIMIR" É "SALVAR EM PDF"
 * ===================================================================
 *
 * O rótulo diz "Salvar em PDF" e não "Imprimir" de propósito: a ONG não
 * tem computador nem impressora (regra 4), e o que o seletor do Android
 * oferece como primeira opção é justamente "Salvar como PDF". Escrever
 * "Imprimir" faria a equipe achar que precisa de uma impressora para
 * cumprir o que um edital pede.
 */
export function BotaoImprimir() {
  return (
    <button
      type="button"
      className="painel__acao-principal nao-imprimir"
      onClick={() => window.print()}
    >
      Salvar em PDF
    </button>
  );
}
