import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarMidia } from '@/servidor/dados/galeria';
import { apagarMidia } from '@/acoes/galeria';
import { ehIdentificador } from '@/compartilhado/validacao';

/**
 * `/admin/galeria/apagar?id=<uuid>` — a pergunta antes do gesto sem
 * desfazer (RF05/RF33/RN07).
 *
 * ===================================================================
 * POR QUE UMA TELA INTEIRA PARA CONFIRMAR
 * ===================================================================
 *
 * Apagar é o único gesto deste painel que não tem volta, e ele acontece num
 * celular, de pé, no meio de um evento (regra 4 do CLAUDE.md). O caminho
 * curto seria um `confirm()` do navegador — e ele NÃO EXISTE sem
 * JavaScript: sem script, o botão apagaria direto, ou seja, a proteção
 * sumiria exatamente para quem tem menos recurso. Uma tela é o único
 * caminho que se comporta igual nos dois casos.
 *
 * Ela também é o lugar onde a pessoa VÊ a foto que está prestes a apagar.
 * Numa lista de dez miniaturas pequenas, "Apagar" no item errado é um erro
 * de um pixel.
 *
 * A GUARDA ESTÁ NAS DUAS FUNÇÕES, como em toda tela do painel — o motivo
 * medido está em app/admin/layout.tsx.
 *
 * ===================================================================
 * ESTA TELA NÃO CONTA SE UMA FOTO EXISTE
 * ===================================================================
 *
 * `?id=` com lixo dentro e `?id=` com uuid inexistente respondem os dois
 * 404, igual à tela de edição de notícia — e igual ao que anônimo recebe.
 * Um "esta foto não existe" distinguível de um 404 transformaria esta rota
 * num verificador de identificadores.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Apagar foto — painel da equipe',
    description: 'Confirmar a remoção de uma foto da galeria.'
  };
}

export default async function PaginaDeApagar(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  // `?id=` com lixo dentro nunca foi um identificador: 404 antes de
  // perguntar ao Postgres, que devolveria erro de sintaxe (22P02).
  if (!ehIdentificador(id)) notFound();

  const { valor: midia, degradou } = await buscarMidia(id);

  // A distinção que esta tela precisa fazer, e por isso a camada de dados
  // devolve `Degradavel`: "esta foto não existe" e "o banco não respondeu"
  // chegariam as duas como `null`. Tratar a segunda como 404 diria à equipe,
  // no meio de uma queda do Supabase, que a foto já sumiu — e a reação a
  // isso é parar de procurar.
  if (degradou) {
    return (
      <Tela>
        <p className="estado estado--erro">
          Não deu para abrir esta foto agora — o banco de dados não respondeu. Ela não foi
          apagada: volte à galeria e tente de novo em alguns instantes.
        </p>
      </Tela>
    );
  }

  if (!midia) notFound();

  return (
    <Tela>
      <p className="destaque">
        Isto apaga a foto de vez: a linha do banco e o arquivo. Não dá para desfazer e não há
        lixeira. Se você só quer que ela saia do site, volte e use "Tirar do ar".
      </p>

      <figure className="apagar__previa">
        {/* `alt=""` com a descrição escrita logo abaixo: repeti-la no `alt`
            faria o leitor de tela ler a mesma frase duas vezes seguidas. O
            que a pessoa precisa aqui é CONFERIR que é esta foto mesmo. */}
        <img className="apagar__foto" src={midia.url} alt="" aria-hidden="true" />
        <figcaption className="apagar__ficha">
          <p><strong>Álbum:</strong> {midia.album}</p>
          <p><strong>Descrição:</strong> {midia.alt}</p>
          {midia.legenda ? <p><strong>Legenda:</strong> {midia.legenda}</p> : null}
          <p>
            <strong>Situação:</strong>{' '}
            {midia.publicado && midia.autorizacao_registrada
              ? 'está no ar, aparecendo na galeria do site'
              : midia.autorizacao_registrada
                ? 'guardada, fora do site'
                : 'guardada e sem autorização de uso de imagem — não pode ir ao ar'}
          </p>
        </figcaption>
      </figure>

      {/*
        `<form>` com Server Action, e não um botão de JavaScript: é o mesmo
        mecanismo que faz o resto do painel funcionar sem script. O `id` vai
        num campo escondido — e ele NÃO AUTORIZA NADA: quem manda o corpo da
        requisição escolhe este valor, e o que impede alguém de apagar o que
        não pode é `ehEquipe()` na Action e a RLS no banco (regras 5 e 6 do
        CLAUDE.md).
      */}
      <form action={apagarMidia} className="apagar__form">
        <input type="hidden" name="id" value={midia.id} />
        <button type="submit" className="apagar__botao">Apagar esta foto para sempre</button>
      </form>

      {/* O caminho de recuo é um LINK, e fica depois do botão: quem chegou
          até aqui e mudou de ideia precisa de uma saída que não seja o botão
          do navegador. */}
      <p className="apagar__desistir">
        <Link href="/admin/galeria">Não apagar — voltar para a galeria</Link>
      </p>
    </Tela>
  );
}

/** O invólucro comum às três saídas — título, caminho de volta e conteúdo. */
function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/galeria">← Galeria</Link></p>

      <h1>Apagar esta foto?</h1>

      {children}
    </main>
  );
}
