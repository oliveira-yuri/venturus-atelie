import Link from 'next/link';
import FormularioDepoimento from '@/componentes/FormularioDepoimento';
import { ListaDepoimentos } from '@/componentes/ListaDepoimentos';
import { listarAprovados } from '@/servidor/dados/depoimentos';
import { avisoDoFormularioDeDepoimento } from '@/compartilhado/depoimentos';

export const metadata = {
  title: 'Depoimentos — Ateliê Afro Cultural',
  description: 'O que dizem as pessoas que participaram das atividades do Ateliê Afro Cultural, e como contar a sua experiência.'
};

/**
 * Só aparece o que a equipe aprovou. O formulário é público e SEM conta
 * (acoes/depoimento.ts); o texto enviado fica `pendente` até alguém ler.
 * Nenhum depoimento é escrito por nós: com a tabela vazia a página mostra o
 * estado vazio (regra 2).
 */
export default async function Depoimentos(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const depoimentos = await listarAprovados();
  const aviso = avisoDoFormularioDeDepoimento((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo">
      <h1>Depoimentos</h1>
      <p className="destaque">
        O que dizem as pessoas que viveram uma atividade do Ateliê. Cada depoimento foi lido
        pela equipe e publicado com a autorização de quem escreveu.
      </p>

      {aviso ? (
        <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
          <p>{aviso.texto}</p>
        </div>
      ) : null}

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-depoimentos">
        <h2 id="titulo-depoimentos">Quem já participou</h2>
        <ListaDepoimentos depoimentos={depoimentos} />
      </section>

      <section aria-labelledby="titulo-contar">
        <h2 id="titulo-contar">Conte como foi</h2>
        <p>
          Participou de uma atividade? Escreva aqui. Não precisa de conta. Veja também as{' '}
          <Link href="/agenda">próximas atividades</Link>.
        </p>
        <FormularioDepoimento />
      </section>
    </main>
  );
}
