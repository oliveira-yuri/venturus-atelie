/**
 * Validação de formulários de conta.
 *
 * Módulo puro, sem DOM: é o miolo testável dos formulários de cadastro e
 * entrada. As mensagens seguem a seção 11 do escopo — dizem o que houve e o
 * que fazer, sem vaguidão e sem pedir desculpas.
 *
 * Toda validação devolve TODOS os erros de uma vez. Formulário que revela um
 * erro por vez faz a pessoa tentar várias vezes até acertar.
 */

const SENHA_MINIMA = 8;

/** Papéis que alguém pode escolher para si. "equipe" nunca está aqui. */
const PAPEIS_PERMITIDOS = ['voluntario', 'doador'];

/**
 * Aceita o que é endereço de e-mail na prática: algo, arroba, domínio com
 * ponto e extensão de ao menos duas letras. Não tenta ser a RFC inteira —
 * validação rígida demais recusa endereço legítimo, o que custa mais caro.
 */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function apenasDigitos(texto: unknown): string {
  return String(texto || '').replace(/\D/g, '');
}

/**
 * Monta o telefone brasileiro conforme se digita: (11) 95396-8344 para
 * celular, (11) 3233-4455 para fixo.
 */
export function formatarTelefone(valor: unknown): string {
  const digitos = apenasDigitos(valor).slice(0, 11);

  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);

  // Celular brasileiro começa com 9 e tem 9 dígitos; fixo tem 8. Decidir pelo
  // primeiro dígito, e não pela quantidade, evita o hífen mudar de lugar no
  // meio da digitação — que faz o campo parecer quebrado.
  const corte = resto[0] === '9' ? 5 : 4;

  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export type DadosCadastro = {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  maioridade?: boolean;
  consentimento?: boolean;
  papeis?: string[];
};

export type ResultadoValidacao = { valido: boolean; erros: Record<string, string> };

export function validarCadastro(dados: DadosCadastro): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!dados.nome || dados.nome.trim().length === 0) {
    erros.nome = 'Escreva seu nome.';
  }

  if (!dados.email || !FORMATO_EMAIL.test(dados.email.trim())) {
    erros.email = 'Confira o e-mail: ele precisa ter um endereço completo, como nome@exemplo.com.';
  }

  if (!dados.senha || dados.senha.length < SENHA_MINIMA) {
    erros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }

  // Telefone é opcional (coleta mínima), mas se vier, vem completo.
  if (dados.telefone && dados.telefone.trim().length > 0) {
    const digitos = apenasDigitos(dados.telefone);
    if (digitos.length < 10 || digitos.length > 11) {
      erros.telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344.';
    }
  }

  // RN01 e RF12: somente maiores de 18 anos criam conta.
  if (!dados.maioridade) {
    erros.maioridade = 'Só quem tem 18 anos ou mais pode criar uma conta. '
      + 'Crianças e adolescentes participam das atividades por inscrição feita por um responsável.';
  }

  if (!dados.consentimento) {
    erros.consentimento = 'Para criar a conta, precisamos que você concorde com o uso dos seus dados. '
      + 'Explicamos tudo na política de privacidade.';
  }

  const papeis = Array.isArray(dados.papeis) ? dados.papeis : [];
  const papeisValidos = papeis.filter((papel) => PAPEIS_PERMITIDOS.includes(papel));

  if (papeisValidos.length === 0) {
    erros.papeis = 'Escolha ao menos uma forma de participar: voluntariado, doação, ou as duas.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

export type DadosEntrada = { email?: string; senha?: string };

export function validarEntrada(dados: DadosEntrada): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!dados.email || !FORMATO_EMAIL.test(dados.email.trim())) {
    erros.email = 'Confira o e-mail.';
  }

  if (!dados.senha || dados.senha.length === 0) {
    erros.senha = 'Escreva sua senha.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}
