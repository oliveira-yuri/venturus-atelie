import '../componentes/aac-form-campo.js';
import { validarCadastro, validarEntrada, formatarTelefone } from '../util/validacao.js';
import { mensagemDeErro } from '../util/erros.js';
import {
  cadastrar, entrar, sessaoAtual, autenticacaoDisponivel
} from '../dados/auth.js';

const abaEntrar = document.getElementById('aba-entrar');
const abaCriar = document.getElementById('aba-criar');
const painelEntrar = document.getElementById('painel-entrar');
const painelCriar = document.getElementById('painel-criar');
const aviso = document.getElementById('aviso');

const formEntrar = document.getElementById('form-entrar');
const formCriar = document.getElementById('form-criar');

/** Para onde levar depois de entrar. Só aceita caminho interno. */
function destinoSeguro() {
  const pedido = new URLSearchParams(window.location.search).get('destino');
  // Sem esta checagem, /entrar.html?destino=https://site-falso vira
  // redirecionamento aberto — a porta de entrada de golpe de phishing.
  return pedido && pedido.startsWith('/') && !pedido.startsWith('//')
    ? pedido
    : '/minha-area.html';
}

function mostrarAviso(texto, tipo = 'erro') {
  aviso.className = `aviso aviso--${tipo}`;
  aviso.innerHTML = `<p>${texto}</p>`;
  aviso.hidden = false;
}

function limparAviso() {
  aviso.hidden = true;
  aviso.innerHTML = '';
}

function trocarAba(destino) {
  const entrando = destino === 'entrar';

  abaEntrar.setAttribute('aria-selected', String(entrando));
  abaCriar.setAttribute('aria-selected', String(!entrando));
  painelEntrar.hidden = !entrando;
  painelCriar.hidden = entrando;

  limparAviso();
  (entrando ? painelEntrar : painelCriar).querySelector('aac-form-campo')?.focar();
}

abaEntrar.addEventListener('click', () => trocarAba('entrar'));
abaCriar.addEventListener('click', () => trocarAba('criar'));

/** Aplica os erros aos campos e leva o foco ao primeiro deles. */
function aplicarErros(formulario, erros) {
  let primeiro = null;

  formulario.querySelectorAll('aac-form-campo').forEach((campo) => {
    const nome = campo.getAttribute('nome');
    campo.erro = erros[nome] || null;
    if (erros[nome] && !primeiro) primeiro = campo;
  });

  primeiro?.focar();
  return primeiro;
}

function campos(formulario) {
  const encontrados = {};
  formulario.querySelectorAll('aac-form-campo').forEach((campo) => {
    encontrados[campo.getAttribute('nome')] = campo;
  });
  return encontrados;
}

// ---------------------------------------------------------------------
// Máscara de telefone
// ---------------------------------------------------------------------
const campoTelefone = formCriar.querySelector('aac-form-campo[nome="telefone"]');
campoTelefone?.addEventListener('input', (evento) => {
  const posicaoNoFim = evento.target.selectionStart === evento.target.value.length;
  const formatado = formatarTelefone(evento.target.value);
  evento.target.value = formatado;
  // Só devolve o cursor ao fim se ele já estava lá: reposicionar sempre
  // atrapalharia quem estivesse corrigindo um dígito no meio.
  if (posicaoNoFim) {
    evento.target.setSelectionRange(formatado.length, formatado.length);
  }
});

// ---------------------------------------------------------------------
// Entrar
// ---------------------------------------------------------------------
formEntrar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparAviso();

  const c = campos(formEntrar);
  const dados = { email: c.email.valor.trim(), senha: c.senha.valor };

  const { valido, erros } = validarEntrada(dados);
  if (!valido) {
    aplicarErros(formEntrar, erros);
    return;
  }
  aplicarErros(formEntrar, {});

  const botao = formEntrar.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Entrando…';

  try {
    await entrar(dados);
    window.location.assign(destinoSeguro());
  } catch (erro) {
    // Mensagem igual para e-mail inexistente e senha errada: dizer qual dos
    // dois está errado revela quem tem conta no site.
    const credencial = /invalid login|invalid_credentials/i.test(erro?.message || '');
    mostrarAviso(credencial
      ? 'E-mail ou senha não conferem. Confira os dois e tente de novo.'
      : mensagemDeErro(erro, 'sua entrada').titulo);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});

// ---------------------------------------------------------------------
// Criar conta
// ---------------------------------------------------------------------
formCriar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparAviso();

  const c = campos(formCriar);
  const papeis = [];
  if (c.voluntario.valor) papeis.push('voluntario');
  if (c.doador.valor) papeis.push('doador');

  const dados = {
    nome: c.nome.valor.trim(),
    email: c.email.valor.trim(),
    telefone: c.telefone.valor.trim(),
    senha: c.senha.valor,
    maioridade: c.maioridade.valor,
    consentimento: c.consentimento.valor,
    papeis
  };

  const { valido, erros } = validarCadastro(dados);

  // Os erros de papéis e de caixas de marcar não têm campo próprio nomeado
  // "papeis": mostramos no aviso, além de marcar os campos que existem.
  aplicarErros(formCriar, erros);
  if (!valido) {
    if (erros.papeis) mostrarAviso(erros.papeis);
    return;
  }

  const botao = formCriar.querySelector('button[type="submit"]');
  botao.disabled = true;
  botao.textContent = 'Criando…';

  try {
    await cadastrar({ ...dados, tipoPessoa: 'fisica' });
    mostrarAviso(
      'Conta criada. Enviamos um e-mail para confirmar seu endereço — '
      + 'abra a mensagem e clique no link para entrar.',
      'sucesso'
    );
    formCriar.reset();
  } catch (erro) {
    const jaExiste = /already registered|already exists/i.test(erro?.message || '');
    mostrarAviso(jaExiste
      ? 'Já existe uma conta com este e-mail. Entre pela aba "Entrar", '
        + 'ou use "Esqueci minha senha" se não lembrar.'
      : mensagemDeErro(erro, 'seu cadastro').titulo);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Criar conta';
  }
});

// ---------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------
(async function iniciar() {
  if (!autenticacaoDisponivel()) {
    mostrarAviso(
      'As contas ainda não estão disponíveis neste site. '
      + 'Fale com a gente pelo WhatsApp (11) 95396-8344 ou por atelieafro@gmail.com.'
    );
    formEntrar.querySelectorAll('input, button').forEach((e) => { e.disabled = true; });
    formCriar.querySelectorAll('input, button').forEach((e) => { e.disabled = true; });
    return;
  }

  // Quem já está autenticado não precisa ver esta página.
  if (await sessaoAtual()) {
    window.location.replace(destinoSeguro());
  }
})();
