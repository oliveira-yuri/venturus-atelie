import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarPublicacao, enderecoDaImagem } from '@/servidor/dados/publicacoes';

/**
 * A página de uma notícia (pedido V1).
 *
 * "Página de notícias do usuário deve ser assim: pequenos blocos, se a
 * pessoa quiser ver a notícia ela clica em 'saber mais' e abre uma página
 * dedicada à respectiva notícia."
 *
 * =====================================================================
 * SÓ O QUE ESTÁ PUBLICADO, E A GUARDA É NOSSA TAMBÉM
 * =====================================================================
 *
 * `buscarPublicacao` não filtra por `publicado` — ela serve à tela de
 * edição do painel, que precisa ler rascunho. Aqui a rota é PÚBLICA, então
 * a checagem é feita explicitamente.
 *
 * Não é a única barreira, e não deveria ser: a RLS de `publicacoes` é
 * `using (publicado or eh_equipe())`, ou seja, um rascunho nem chega a
 * este código para quem não é equipe. A checagem daqui existe para o caso
 * de QUEM É EQUIPE abrir o endereço de um rascunho — a RLS deixaria passar,
 * e a pessoa veria no site público uma notícia que ainda não foi ao ar.
 *
 * O desfecho é `notFound()`, e não uma tela "ainda não publicada": para
 * quem visita, um rascunho não existe.
 *
 * =====================================================================
 * DEGRADAÇÃO: "NÃO EXISTE" É DIFERENTE DE "NÃO DEU PARA PERGUNTAR"
 * =====================================================================
 *
 * `buscarPublicacao` devolve `Degradavel`, e as duas respostas caem em
 * lugares diferentes: notícia inexistente vira 404; banco fora do ar vira
 * uma página que DIZ que não deu para carregar, com o caminho de volta.
 * Responder 404 a uma falha de banco diria à pessoa que a notícia sumiu.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
) {
  const { valor: publicacao } = await buscarPublicacao((await params).id);
  if (!publicacao || !publicacao.publicado) {
    return { title: 'Notícia não encontrada — Ateliê Afro Cultural' };
  }

  return {
    title: `${publicacao.titulo} — Ateliê Afro Cultural`,
    description: publicacao.resumo ?? undefined
  };
}

export default async function PaginaDaNoticia(
  { params }: { params: Promise<{ id: string }> }
) {
  const { valor: publicacao, degradou } = await buscarPublicacao((await params).id);

  if (degradou) {
    return (
      <main id="conteudo" className="conteudo">
        <h1>Notícias</h1>
        <p className="estado estado--erro">
          Não deu para carregar esta notícia agora — o banco de dados não respondeu. Ela não foi
          perdida. Tente de novo em alguns instantes, ou{' '}
          <Link href="/noticias">volte para a lista</Link>.
        </p>
      </main>
    );
  }

  if (!publicacao || !publicacao.publicado) notFound();

  const imagem = publicacao.imagem_caminho
    ? await enderecoDaImagem(publicacao.imagem_caminho)
    : null;

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/noticias">← Notícias</Link></p>

      <h1>{publicacao.titulo}</h1>

      {publicacao.publicado_em ? (
        <p className="noticia__data">
          {/*
            `<time>` com `dateTime`: a data legível para quem lê, e a
            máquina-legível no atributo. `toLocaleDateString` com 'pt-BR'
            roda no SERVIDOR, então o resultado é o mesmo para todo mundo —
            formatar no cliente daria divergência de hidratação entre quem
            tem outro fuso.
          */}
          <time dateTime={publicacao.publicado_em}>
            {new Date(publicacao.publicado_em).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo'
            })}
          </time>
        </p>
      ) : null}

      {imagem ? (
        <img
          className="noticia__imagem"
          src={imagem}
          /* `alt` obrigatório quando há imagem — o `check` de
             002_conteudo.sql recusa a linha sem ele. */
          alt={publicacao.imagem_alt ?? ''}
          loading="eager"
          decoding="async"
        />
      ) : null}

      {publicacao.resumo ? <p className="destaque">{publicacao.resumo}</p> : null}

      {/*
        O corpo é texto puro escrito pela equipe num celular. Dividir por
        linha em branco é o mínimo que respeita o que ela escreveu — não há
        conversão de markdown nem de HTML, e é decisão: aceitar HTML aqui
        seria aceitar HTML de quem tem acesso ao painel, e o painel não é
        lugar de escrever marcação.
      */}
      {publicacao.corpo.split('\n\n').map((paragrafo, indice) => (
        <p key={indice}>{paragrafo}</p>
      ))}

      <p className="chamada-final">
        <Link href="/noticias">Ver todas as notícias</Link>
      </p>
    </main>
  );
}
