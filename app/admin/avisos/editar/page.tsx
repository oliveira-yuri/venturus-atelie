import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarAviso } from '@/servidor/dados/avisos';
import { ehIdentificador } from '@/compartilhado/validacao';
import FormularioAviso from '@/componentes/FormularioAviso';

/**
 * `/admin/avisos/editar` — escrever um aviso novo (sem `?id=`) ou corrigir
 * um que existe (com `?id=`).
 *
 * UMA ROTA PARA OS DOIS CASOS, como em publicações e eventos: o formulário
 * é o mesmo, e duas rotas seriam duas guardas para esquecer.
 *
 * A GUARDA EM CADA FUNÇÃO, nas duas.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  // SEM O TÍTULO DO AVISO na aba do navegador: o `generateMetadata` do
  // painel é o caminho por onde um título vazou uma vez (Tarefa P1), e o
  // conteúdo aqui é comunicação interna.
  return { title: 'Escrever aviso — painel da equipe' };
}

export default async function PaginaDeEditarAviso(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const busca = await searchParams;
  const id = typeof busca.id === 'string' ? busca.id : '';

  // Sem `?id=` é um aviso NOVO — não é erro.
  if (!id) {
    return (
      <main id="conteudo" className="conteudo painel__conteudo">
        <p className="painel__voltar"><Link href="/admin/avisos">← Avisos</Link></p>
        <h1>Escrever aviso</h1>
        <p>
          Ele fica guardado como rascunho: não aparece no mural e não vai por e-mail para
          ninguém até você publicar.
        </p>
        <FormularioAviso />
      </main>
    );
  }

  if (!ehIdentificador(id)) notFound();

  const { valor: aviso, degradou } = await buscarAviso(id);

  if (degradou) {
    return (
      <main id="conteudo" className="conteudo painel__conteudo">
        <p className="painel__voltar"><Link href="/admin/avisos">← Avisos</Link></p>
        <h1>Corrigir aviso</h1>
        <p className="estado estado--erro">
          Não deu para carregar este aviso agora — o banco de dados não respondeu. Nada foi
          perdido. Tente de novo em alguns instantes.
        </p>
      </main>
    );
  }

  if (!aviso) notFound();

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/avisos">← Avisos</Link></p>
      <h1>Corrigir aviso</h1>

      {aviso.publicado ? (
        <p className="aviso aviso--erro" role="status">
          Este aviso está <strong>no mural</strong>. O que você guardar aqui muda o que as
          pessoas leem — e não muda o e-mail de quem já recebeu.
        </p>
      ) : null}

      <FormularioAviso id={aviso.id} titulo={aviso.titulo} corpo={aviso.corpo} />
    </main>
  );
}
