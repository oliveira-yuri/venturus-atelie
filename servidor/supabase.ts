import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente do Supabase, sempre com a sessao da pessoa lida do cookie.
 *
 * Nao existe cliente com chave que ignora o RLS neste projeto: nenhum caso de
 * uso precisou furar as politicas. Enquanto for assim, o codigo da rota e a
 * politica do banco sao um E — a requisicao precisa sobreviver aos dois, e o
 * efetivo e o mais restritivo. Ver spec §4.2.
 */
export async function obterCliente() {
  const armazenamento = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_CHAVE_PUBLICAVEL!,
    {
      cookies: {
        getAll: () => armazenamento.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) =>
              armazenamento.set(name, value, options));
          } catch {
            // Chamado de um Server Component, onde nao se escreve cookie.
            // O middleware renova a sessao; aqui pode ignorar.
          }
        }
      }
    }
  );
}
