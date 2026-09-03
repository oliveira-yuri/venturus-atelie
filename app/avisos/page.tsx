import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/servidor/sessao';
import { ehVoluntarioAtivo } from '@/servidor/permissao';
import { listarAvisos } from '@/servidor/dados/avisos';
import { FUSO_DA_ONG } from '@/compartilhado/validacao';

/**
 * `/avisos` — o mural de quem é voluntário (RF27).
 *
 * ===================================================================
 * ELA RECUSA COM REDIRECT, COMO /minha-conta — E NÃO COM 404
 * ===================================================================
 *
 * `/admin` responde 404 porque a EXISTÊNCIA do painel é o que se recusa a
 * contar. Aqui é diferente: que o Ateliê tem voluntariado está escrito em
 * /voluntariado, numa página pública, com um botão para se candidatar. O
 * que falta a quem chega sem sessão é sessão, e a resposta certa para isso
 * é a tela de entrar.
 *
 * E quem TEM conta mas ainda não é voluntário ativo não recebe 404 nenhum:
 * recebe uma explicação e o caminho. Um 404 ali faria alguém que se
 * candidatou ontem achar que o mural não existe.
 *
 * ===================================================================
 * O CONTEÚDO É INTERNO, E TRÊS CAMADAS INDEPENDENTES DIZEM ISSO
 * ===================================================================
 *
 *  1. `anon` não tem grant nenhum em `public.avisos` (migration 012);
 *  2. a política exige `eh_voluntario_ativo()` ou `eh_equipe()`;
 *  3. esta página confirma antes de desenhar.
 *
 * A terceira NÃO é a tranca — ela existe para a tela conseguir dizer a
 * diferença entre "não há aviso" e "você ainda não é voluntário ativo",
 * que são duas listas vazias idênticas e dois caminhos diferentes.
 *
 * ELA TAMBÉM NÃO É ITEM DE MENU, pelo mesmo motivo de /minha-conta: o menu
 * é o mesmo para toda visita, e para a maioria aquele item só
 * redirecionaria. Chega-se aqui por /minha-conta.
 */
export const metadata = {
  // Sem descrição de conteúdo: a página é interna, e o robots.txt já a
  // mantém fora do buscador enquanto o site está em prévia.
  title: 'Mural de avisos — Ateliê Afro Cultural'
};

function data(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: FUSO_DA_ONG
  });
}

export default async function PaginaDoMural() {
  // Sem sessão: a tela de entrar, não um 404 — ver o cabeçalho.
  if (!await usuarioAtual()) redirect('/entrar?destino=/avisos');

  const ativo = await ehVoluntarioAtivo();

  if (!ativo) {
    return (
      <main id="conteudo" className="conteudo">
        <h1>Mural de avisos</h1>
        <p className="estado estado--vazio">
          Este mural é para quem já está voluntariando no Ateliê. Se você se candidatou e ainda
          aparece como "nova" ou "em contato", é só esperar — a equipe conversa com cada pessoa
          antes. Dá para acompanhar a situação da sua candidatura em{' '}
          <Link href="/minha-conta">Minha conta</Link>.
        </p>
        <p>
          Ainda não se candidatou?{' '}
          <Link href="/voluntariado">Veja as áreas e como participar</Link>.
        </p>
      </main>
    );
  }

  const { valor: avisos, degradou } = await listarAvisos();

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/minha-conta">← Minha conta</Link></p>

      <h1>Mural de avisos</h1>
      <p>Recados da equipe para quem está voluntariando.</p>

      <div className="af-stripe" aria-hidden="true" />

      {degradou ? (
        <p className="estado estado--erro">
          Não deu para carregar os avisos agora — o banco de dados não respondeu. Isto NÃO quer
          dizer que não há recados. Tente de novo em alguns instantes.
        </p>
      ) : avisos.length === 0 ? (
        <p className="estado estado--vazio">
          Nenhum aviso por enquanto. Quando a equipe publicar algo, aparece aqui.
        </p>
      ) : (
        <div className="lista-atividades">
          {avisos.map((aviso) => (
            <article className="atividade" key={aviso.id}>
              <h2 className="atividade__titulo">{aviso.titulo}</h2>
              {aviso.publicado_em ? (
                <p className="noticia__data">
                  <time dateTime={aviso.publicado_em}>{data(aviso.publicado_em)}</time>
                </p>
              ) : null}
              {/*
                Texto puro escrito pela equipe num celular. Linha em branco
                separa parágrafo — sem conversão de markdown nem de HTML,
                pelo mesmo motivo de /noticias/[id]: aceitar HTML aqui seria
                aceitar HTML de quem tem acesso ao painel.
              */}
              {aviso.corpo.split('\n\n').map((paragrafo, indice) => (
                <p key={indice}>{paragrafo}</p>
              ))}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
