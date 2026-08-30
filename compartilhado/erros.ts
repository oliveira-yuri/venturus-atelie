/**
 * Tradução de falha técnica em mensagem para pessoas.
 *
 * Regra da seção 11 do escopo: dizer o que houve e como resolver, sem pedir
 * desculpas e sem vaguidão. Código de erro e jargão nunca chegam à tela.
 */

export type MensagemErro = { titulo: string; acao: string | null };

export function mensagemDeErro(erro: unknown, contexto = 'esta página'): MensagemErro {
  const codigo = erro && typeof erro === 'object' ? (erro as { code?: string }).code : undefined;

  if (codigo === 'PGRST301' || codigo === '401') {
    return {
      titulo: 'Sua sessão terminou. É preciso entrar de novo para continuar.',
      acao: 'Entrar'
    };
  }

  if (codigo === '23505') {
    return { titulo: 'Este cadastro já existe.', acao: null };
  }

  if (codigo === '42501' || codigo === 'PGRST116') {
    return { titulo: 'Esta parte do sistema é da equipe do Ateliê.', acao: null };
  }

  if (erro instanceof TypeError || codigo === 'ECONNREFUSED') {
    return {
      titulo: `Não foi possível carregar ${contexto}. Verifique sua conexão.`,
      acao: 'Tentar de novo'
    };
  }

  return {
    titulo: `Não foi possível carregar ${contexto} agora.`,
    acao: 'Tentar de novo'
  };
}

// =====================================================================
// Autenticação (RF08–RF12)
//
// Separada de mensagemDeErro() de propósito: aquela traduz falha de LEITURA
// de conteúdo público ("não foi possível carregar a agenda"), esta traduz
// falha de uma tentativa de entrar, criar conta ou recuperar acesso — onde
// o certo a dizer depende do código e, em dois casos, de qual campo tem
// culpa.
//
// O erro do Supabase Auth NUNCA vai para a tela como veio. `error.message`
// é texto em inglês, escrito para quem programa, e às vezes carrega detalhe
// de infraestrutura. O que a pessoa lê é sempre uma destas mensagens.
// =====================================================================

/** Canais reais da ONG — os mesmos que já aparecem em /entrar e /contato. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

export type ErroDeAutenticacao = {
  /** O que a pessoa lê. */
  mensagem: string;
  /** `name` do input culpado, quando há um. Ausente quando é geral. */
  campo?: string;
  /**
   * Falso quando o código não estava previsto aqui.
   *
   * Existe para o chamador saber a diferença entre "aconteceu o esperado" e
   * "aconteceu algo que ninguém mapeou" — no segundo caso ele registra o
   * erro inteiro com console.error, que é a única cópia que sobra, já que a
   * tela recebe a mensagem genérica.
   */
  conhecido: boolean;
};

/**
 * O código do erro do Supabase Auth, se houver.
 *
 * Duas chaves porque o supabase-js mudou de nome no caminho: `code` é o
 * atual (AuthApiError), `error_code` aparece em respostas mais antigas e em
 * erro vindo por querystring do fluxo de e-mail.
 */
function codigoDeAutenticacao(erro: unknown): string {
  if (!erro || typeof erro !== 'object') return '';
  const objeto = erro as { code?: unknown; error_code?: unknown };
  const bruto = objeto.code ?? objeto.error_code;
  return typeof bruto === 'string' ? bruto : '';
}

function estadoHttp(erro: unknown): number | undefined {
  if (!erro || typeof erro !== 'object') return undefined;
  const status = (erro as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export function mensagemDeErroDeAutenticacao(erro: unknown): ErroDeAutenticacao {
  const codigo = codigoDeAutenticacao(erro);

  // O limite de envio do Supabase é o que trava o projeto hoje (CLAUDE.md,
  // "O que trava hoje", item 1): a cota do envio nativo é baixíssima e o
  // SMTP do Brevo ainda não entrou. Enquanto for assim, esta é a mensagem
  // que mais gente vai ver ao criar conta — e ela precisa ser honesta e
  // levar a pessoa a um canal que funciona de verdade, em vez de mandar
  // "tente de novo" para uma porta que vai continuar fechada.
  if (codigo === 'over_email_send_rate_limit'
      || codigo === 'over_request_rate_limit'
      || codigo === 'over_sms_send_rate_limit'
      || estadoHttp(erro) === 429) {
    return {
      mensagem: 'O limite de envio de e-mails deste site foi atingido. Tente de novo mais tarde '
        + `ou fale com a gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}.`,
      conhecido: true
    };
  }

  // Sem `campo`: apontar para o e-mail OU para a senha diria qual dos dois
  // está certo, e isso entrega quem tem conta aqui.
  if (codigo === 'invalid_credentials') {
    return { mensagem: 'E-mail ou senha não conferem.', conhecido: true };
  }

  if (codigo === 'email_not_confirmed') {
    return {
      mensagem: 'Falta confirmar seu e-mail. Abra o link que enviamos quando você criou a conta '
        + 'e volte para entrar.',
      conhecido: true
    };
  }

  if (codigo === 'user_already_exists' || codigo === 'email_exists') {
    return {
      mensagem: 'Já existe conta com esse e-mail. Entre com sua senha, ou use "Esqueci minha senha" '
        + 'para criar uma nova.',
      campo: 'email',
      conhecido: true
    };
  }

  if (codigo === 'weak_password') {
    return {
      mensagem: 'Escolha uma senha mais difícil de adivinhar: pelo menos 8 caracteres, '
        + 'misturando letras e números.',
      campo: 'senha',
      conhecido: true
    };
  }

  return {
    mensagem: 'Não foi possível concluir agora. Tente de novo em alguns minutos.',
    conhecido: false
  };
}
