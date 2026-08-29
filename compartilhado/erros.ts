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
