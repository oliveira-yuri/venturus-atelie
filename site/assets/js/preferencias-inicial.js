/* Aplica a preferencia de acessibilidade antes da primeira pintura.
   Script classico e sincrono de proposito: um modulo ES seria adiado e a
   pagina piscaria no tamanho errado a cada navegacao. Duplica a leitura
   minima do armazenamento pelo mesmo motivo - nao pode usar import. */
(function () {
  try {
    var guardado = window.localStorage.getItem('aac-preferencias');
    if (!guardado) return;
    var preferencias = JSON.parse(guardado);
    var escalas = [87.5, 100, 112.5, 125, 137.5];
    if (escalas.indexOf(preferencias.escala) !== -1) {
      document.documentElement.style.setProperty('--escala-fonte', preferencias.escala + '%');
    }
    if (preferencias.contraste === 'alto') {
      document.documentElement.setAttribute('data-contraste', 'alto');
    }
  } catch (erro) {
    /* Armazenamento indisponivel: segue no padrao. */
  }
})();
