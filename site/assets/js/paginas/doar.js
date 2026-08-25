/**
 * Bloco de doacao em dinheiro.
 *
 * A chave Pix e decisao pendente (D7 do escopo): a ONG tem CNPJ, mas nao esta
 * confirmado se ha conta institucional vinculada. Enquanto nao houver, a
 * pagina NAO exibe chave nenhuma e diz isso com clareza — informar mal quem
 * recebe o dinheiro custa a confianca de quem doa, que e o ativo mais escasso
 * aqui (risco R8).
 */
const CHAVE_PIX = null;

const alvo = document.getElementById('dados-pix');

alvo.innerHTML = CHAVE_PIX
  ? `<div class="aviso aviso--sucesso">
       <p><strong>Chave Pix:</strong> ${CHAVE_PIX}</p>
       <p>Depois de transferir, avise a gente para registrarmos sua doação.</p>
     </div>`
  : `<div class="aviso">
       <p>
         Estamos organizando a conta institucional para receber doações em dinheiro
         com a transparência que o assunto merece.
       </p>
       <p>
         Enquanto isso, <a href="https://wa.me/5511953968344" rel="noopener">fale com a gente
         pelo WhatsApp</a> que explicamos exatamente para onde vai o recurso e quem recebe.
       </p>
     </div>`;
