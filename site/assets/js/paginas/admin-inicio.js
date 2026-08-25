import { exigirSessao, autenticacaoDisponivel } from '../dados/auth.js';
import { contarDoMes } from '../dados/indicadores.js';
import { mensagemDeErro } from '../util/erros.js';

const aviso = document.getElementById('aviso');

function mostrarAviso(texto, tipo = 'erro') {
  aviso.className = `aviso aviso--${tipo}`;
  aviso.innerHTML = `<p>${texto}</p>`;
  aviso.hidden = false;
}

(async function iniciar() {
  if (!autenticacaoDisponivel()) {
    mostrarAviso(
      'O painel ainda não está conectado ao banco de dados. '
      + 'Assim que a configuração for concluída, ele funciona sem mais nenhuma mudança.'
    );
    return;
  }

  const perfil = await exigirSessao({ exigeEquipe: true });
  if (!perfil) return; // exigirSessao já redirecionou

  try {
    const numeros = await contarDoMes();
    for (const [chave, valor] of Object.entries(numeros)) {
      const alvo = document.querySelector(`[data-indicador="${chave}"]`);
      if (alvo) alvo.textContent = String(valor);
    }
  } catch (erro) {
    mostrarAviso(mensagemDeErro(erro, 'os números do mês').titulo);
  }
})();
