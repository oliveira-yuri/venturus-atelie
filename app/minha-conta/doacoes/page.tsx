import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/servidor/sessao';
import { listarMinhasDoacoes } from '@/servidor/dados/conta';
import { MinhasDoacoes } from '@/componentes/MinhaConta';

/**
 * `/minha-conta/doacoes` — as doações da própria pessoa (RF22).
 *
 * Página irmã de `/minha-conta/candidaturas`, criada pelo mesmo pedido V1 e
 * com a mesma guarda: redirect para `/entrar`, nunca 404. O motivo está no
 * cabeçalho daquela.
 *
 * O ID VEM DA SESSÃO VERIFICADA, e a RLS confere de novo — MEDIDO contra
 * Postgres real: quem doou lê a resposta da ONG e NÃO consegue mudar a
 * própria situação nem o texto da resposta.
 */
export const metadata = {
  title: 'Minhas doações — Ateliê Afro Cultural',
  robots: { index: false, follow: false }
};

export default async function MinhasDoacoesPagina() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/entrar');

  const { valor: doacoes, degradou } = await listarMinhasDoacoes(usuario.id);

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/minha-conta">← Minha conta</Link></p>

      <h1>Minhas doações</h1>

      <MinhasDoacoes doacoes={doacoes} degradou={degradou} />

      {/*
        O BOTÃO APARECE SEMPRE, ao contrário do de candidatar-se — e a
        assimetria é decisão, não descuido.

        Lá o botão some para quem já tem candidatura em andamento, porque
        candidatar-se duas vezes é um gesto que o servidor recusa. Aqui doar
        duas vezes são DUAS doações, as duas legítimas: quem doou livros em
        março e um tambor em agosto fez duas coisas. Esconder o botão de quem
        já doou seria esconder o caminho justamente de quem mais apoia a ONG.
      */}
      <p className="abertura__acoes">
        <Link className="botao" href="/doar/ofertar">Oferecer uma doação</Link>
      </p>

      <p>As formas de doar estão na <Link href="/doar">página de apoio</Link>.</p>
    </main>
  );
}
