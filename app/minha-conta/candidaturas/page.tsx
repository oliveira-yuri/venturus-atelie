import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/servidor/sessao';
import { listarMinhasCandidaturas } from '@/servidor/dados/conta';
import { candidaturaEmAndamento } from '@/compartilhado/candidatura';
import { MinhasCandidaturas } from '@/componentes/MinhaConta';

/**
 * `/minha-conta/candidaturas` — as candidaturas da própria pessoa (RF11).
 *
 * ===================================================================
 * POR QUE VIROU PÁGINA PRÓPRIA
 * ===================================================================
 *
 * Pedido V1 (03/09/2026): "aba de minhas candidaturas ao voluntariado e
 * minhas doações devem ser dois botões que quando clicados abrem uma
 * página dedicada".
 *
 * A razão de fundo é a regra 4: `/minha-conta` tinha crescido para quatro
 * seções empilhadas, e num celular quem queria ver a própria candidatura
 * rolava por dados, senha e e-mail antes de chegar. Duas páginas curtas
 * são melhores que uma longa quando a pessoa já sabe o que veio buscar.
 *
 * ===================================================================
 * A GUARDA É A MESMA DE /minha-conta: REDIRECT, NÃO 404
 * ===================================================================
 *
 * `/admin` responde 404 porque a EXISTÊNCIA do painel é o que se recusa a
 * contar. Aqui não: que este site tem contas está escrito em toda página,
 * e o que falta a quem chega sem sessão é sessão. Um 404 esconderia de
 * quem tem conta o caminho para a própria candidatura.
 *
 * O ID VEM DA SESSÃO VERIFICADA, nunca da URL — e a RLS confere de novo:
 * `voluntarios: a pessoa le a propria candidatura`.
 */
export const metadata = {
  title: 'Minhas candidaturas — Ateliê Afro Cultural',
  // Fora do buscador, como o resto da área do usuário. Este `noindex` NÃO
  // sai no lançamento (CLAUDE.md, item 0c).
  robots: { index: false, follow: false }
};

export default async function MinhasCandidaturasPagina() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/entrar');

  const { valor: candidaturas, degradou } = await listarMinhasCandidaturas(usuario.id);

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/minha-conta">← Minha conta</Link></p>

      <h1>Minhas candidaturas ao voluntariado</h1>

      <MinhasCandidaturas candidaturas={candidaturas} degradou={degradou} />

      {/*
        O ÚNICO CAMINHO ATÉ O MURAL (RF27), e ele mora aqui pelo mesmo motivo
        de /minha-conta ficar atrás do nome no cabeçalho: o menu é o mesmo
        para toda visita, e um item "Avisos" ali só redirecionaria a maioria.

        O LINK APARECE PARA QUEM TEM QUALQUER CANDIDATURA, e não só para quem
        está `ativo`. É deliberado: quem se candidatou ontem precisa conseguir
        CHEGAR ao mural para ler, na própria página dele, que ele é para quem
        já está voluntariando. Esconder o link faria a pessoa nunca descobrir
        que o mural existe, e a explicação não teria onde aparecer.

        Quem não pode ler não lê: a política de `public.avisos` decide isso no
        banco, muito antes desta página.
      */}
      {candidaturas.length > 0 ? (
        <p className="chamada-final">
          <Link href="/avisos">Ver o mural de avisos</Link> — recados da equipe para quem está
          voluntariando.
        </p>
      ) : null}

      {/*
        O BOTÃO SÓ APARECE PARA QUEM NÃO TEM CANDIDATURA EM ANDAMENTO, e é a
        mesma regra que a tela de candidatura e a Server Action aplicam
        (compartilhado/candidatura.ts). Oferecer "Candidatar-se" a quem já se
        candidatou seria oferecer um gesto que o servidor recusa — e, pior,
        uma linha repetida que só a equipe do Ateliê consegue apagar.
      */}
      {candidaturaEmAndamento(candidaturas)
        ? (
          <p>
            As áreas em que o Ateliê precisa de gente estão na{' '}
            <Link href="/voluntariado">página de voluntariado</Link>.
          </p>
        )
        : (
          <p className="abertura__acoes">
            <Link className="botao" href="/voluntariado/candidatura">
              Candidatar-se ao voluntariado
            </Link>
          </p>
        )}
    </main>
  );
}
