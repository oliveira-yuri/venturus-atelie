import Link from 'next/link';
import { PERGUNTAS, filtrarPerguntas } from '@/compartilhado/perguntas-frequentes';

export const metadata = {
  title: 'Perguntas frequentes — Ateliê Afro Cultural',
  description: 'Respostas rápidas sobre inscrição, imagem, atividades para escolas, voluntariado, apoio e privacidade.'
};

/**
 * A busca é um <form method="get">: funciona sem JavaScript, e o filtro roda
 * no servidor sobre uma lista curta e fixa. Todas as respostas já existem em
 * outras páginas (ver `origem` em compartilhado/perguntas-frequentes.ts).
 */
export default async function PerguntasFrequentes(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const bruto = (await searchParams).busca;
  const busca = typeof bruto === 'string' ? bruto.slice(0, 80) : '';
  const itens = filtrarPerguntas(busca);

  return (
    <main id="conteudo" className="conteudo">
      <h1>Perguntas frequentes</h1>
      <p className="destaque">
        Respostas rápidas para as dúvidas mais comuns. Não achou a sua? Fale com a gente pela
        página de <Link href="/contato">contato</Link>.
      </p>

      <form className="formulario" role="search" aria-label="Buscar nas perguntas"
            action="/perguntas-frequentes" method="get">
        <div className="campo">
          <label htmlFor="busca-perguntas">Buscar nas perguntas</label>
          <input type="search" id="busca-perguntas" name="busca" defaultValue={busca} maxLength={80} />
        </div>
        <button type="submit" className="botao">Buscar</button>
      </form>

      <div className="af-stripe" aria-hidden="true" />

      {itens.length === 0 ? (
        <p className="estado estado--vazio">
          Nenhuma pergunta com essas palavras. <Link href="/perguntas-frequentes">Ver todas</Link>{' '}
          ou <Link href="/contato">fale com a gente</Link>.
        </p>
      ) : (
        <div className="lista-perguntas">
          {itens.length < PERGUNTAS.length ? (
            <p role="status">{itens.length} {itens.length === 1 ? 'resposta' : 'respostas'}.</p>
          ) : null}
          {itens.map((item) => (
            <details key={item.id} id={item.id} className="pergunta" open={busca ? true : undefined}>
              <summary>{item.pergunta}</summary>
              <p>
                {item.resposta.map((trecho, i) => typeof trecho === 'string'
                  ? trecho
                  : <Link key={i} href={trecho.href}>{trecho.texto}</Link>)}
              </p>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
