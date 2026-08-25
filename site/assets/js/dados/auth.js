import { obterCliente, supabaseConfigurado } from './supabase.js';

/**
 * Autenticacao (RF08-RF12).
 *
 * Como toda a camada de dados, as paginas falam so com estas funcoes — nunca
 * com o supabase-js direto.
 *
 * O papel de equipe NAO e enviado no cadastro. Ele so existe se alguem da
 * equipe conceder pelo painel; o banco tambem recusa a alteracao vinda da
 * API publica (ver supabase/migrations/001_base.sql).
 */

export function autenticacaoDisponivel() {
  return supabaseConfigurado();
}

export async function cadastrar({ nome, email, telefone, senha, papeis, tipoPessoa }) {
  const { data, error } = await obterCliente().auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome,
        telefone: telefone || null,
        tipo_pessoa: tipoPessoa || 'fisica',
        eh_voluntario: papeis.includes('voluntario'),
        eh_doador: papeis.includes('doador'),
        maioridade_confirmada: true
      }
    }
  });

  if (error) throw error;
  return data.user;
}

export async function entrar({ email, senha }) {
  const { data, error } = await obterCliente().auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) throw error;
  return data.user;
}

export async function sair() {
  const { error } = await obterCliente().auth.signOut();
  if (error) throw error;
}

/**
 * Envia o e-mail de recuperacao de senha.
 *
 * Este e o unico uso legitimo do envio nativo do Supabase Auth. Confirmacao
 * de inscricao e resposta a doacao vao pela Edge Function com provedor
 * externo: o limite do envio nativo e baixo demais (secao 3.2 do escopo).
 */
export async function recuperarAcesso(email) {
  const { error } = await obterCliente().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/nova-senha.html`
  });
  if (error) throw error;
}

export async function definirNovaSenha(senha) {
  const { error } = await obterCliente().auth.updateUser({ password: senha });
  if (error) throw error;
}

/** Sessao atual, ou null. */
export async function sessaoAtual() {
  if (!supabaseConfigurado()) return null;
  const { data } = await obterCliente().auth.getSession();
  return data.session;
}

/** Perfil da pessoa autenticada, com os papeis. Null se nao houver sessao. */
export async function perfilAtual() {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const { data, error } = await obterCliente()
    .from('perfis')
    .select('*')
    .eq('id', sessao.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ehEquipe() {
  const perfil = await perfilAtual();
  return Boolean(perfil?.eh_equipe);
}

/** Atualiza os proprios dados (RF11). eh_equipe nunca entra aqui. */
export async function atualizarPerfil({ nome, telefone, tipoPessoa }) {
  const sessao = await sessaoAtual();
  if (!sessao) throw new Error('sem sessao');

  const { error } = await obterCliente()
    .from('perfis')
    .update({ nome, telefone: telefone || null, tipo_pessoa: tipoPessoa })
    .eq('id', sessao.user.id);

  if (error) throw error;
}

/** Observa entrada e saida, para as paginas reagirem. */
export function aoMudarSessao(callback) {
  if (!supabaseConfigurado()) return () => {};
  const { data } = obterCliente().auth.onAuthStateChange((_evento, sessao) => callback(sessao));
  return () => data.subscription.unsubscribe();
}

/**
 * Protege uma pagina: manda para /entrar.html quem nao estiver autenticado,
 * e para a area do usuario quem nao for da equipe, quando exigido.
 */
export async function exigirSessao({ exigeEquipe = false } = {}) {
  const perfil = await perfilAtual();

  if (!perfil) {
    const destino = encodeURIComponent(window.location.pathname);
    window.location.replace(`/entrar.html?destino=${destino}`);
    return null;
  }

  if (exigeEquipe && !perfil.eh_equipe) {
    window.location.replace('/minha-area.html');
    return null;
  }

  return perfil;
}
