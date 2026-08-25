import '../componentes/aac-form-campo.js';
import { recuperarAcesso, autenticacaoDisponivel } from '../dados/auth.js';
import { validarEntrada } from '../util/validacao.js';
import { mensagemDeErro } from '../util/erros.js';

const formulario = document.getElementById('form-recuperar');
const aviso = document.getElementById('aviso');
const campo = formulario.querySelector('aac-form-campo[nome="email"]');

function mostrar(texto, tipo = 'erro') {
  aviso.className = `aviso aviso--${tipo}`;
  aviso.innerHTML = `<p>${texto}</p>`;
  aviso.hidden = false;
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  aviso.hidden = true;

  const email = campo.valor.trim();
  const { valido, erros } = validarEntrada({ email, senha: 'ignorada' });

  if (!valido) {
    campo.erro = erros.email;
    campo.focar();
    return;
  }
  campo.erro = null;

  const botao = formulario.querySelector('button[type="submit"]');
  botao.disabled = true;

  try {
    await recuperarAcesso(email);
  } catch (erro) {
    // Só reporta falha técnica. Erro de "e-mail não existe" NÃO é mostrado:
    // revelaria quem tem conta no site.
    if (!/user not found|not found/i.test(erro?.message || '')) {
      mostrar(mensagemDeErro(erro, 'o pedido de recuperação').titulo);
      botao.disabled = false;
      return;
    }
  }

  // Mensagem igual tendo a conta ou não, pelo mesmo motivo.
  mostrar(
    'Se existir uma conta com esse e-mail, o link para criar uma senha nova acabou de ser '
    + 'enviado. Confira também a caixa de spam.',
    'sucesso'
  );
  botao.disabled = false;
});

if (!autenticacaoDisponivel()) {
  mostrar('As contas ainda não estão disponíveis neste site. '
    + 'Fale com a gente pelo WhatsApp (11) 95396-8344.');
  formulario.querySelectorAll('input, button').forEach((e) => { e.disabled = true; });
}
