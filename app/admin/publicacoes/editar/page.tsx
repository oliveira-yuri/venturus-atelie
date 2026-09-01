import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarPublicacao } from '@/servidor/dados/publicacoes';
import { ehIdentificador } from '@/compartilhado/validacao';
import FormularioPublicacao from '@/componentes/FormularioPublicacao';

/**
 * `/admin/publicacoes/editar` — escrever uma notícia nova (sem `?id=`) ou
 * abrir uma que já existe (`?id=<uuid>`). RF04/RF33.
 *
 * UMA ROTA PARA OS DOIS CASOS, e não duas: o formulário é o mesmo, campo por
 * campo. Duas rotas seriam duas telas para manter em paralelo e duas chances
 * de uma delas ganhar um campo que a outra não tem — que é como um
 * formulário de edição começa a perder dado ao salvar.
 *
 * A GUARDA É A MESMA DE TODA TELA DO PAINEL, nas duas funções (componente e
 * `generateMetadata`), pelo motivo medido na Tarefa P1 e escrito em
 * app/admin/layout.tsx. `testes/painel-guarda.test.mjs` varre `app/admin/**`
 * e falha se uma delas faltar.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Escrever notícia — painel da equipe',
    description: 'Escrever e editar uma notícia do site.'
  };
}

export default async function PaginaDeEdicao(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  // Sem `?id=` é notícia nova — o caso mais comum, e o que não custa
  // consulta nenhuma.
  if (!id) return <Tela publicacao={null} />;

  // `?id=` com lixo dentro nunca foi um identificador: 404 antes de perguntar
  // ao Postgres, que devolveria erro de sintaxe (22P02) e viraria uma falha
  // genérica na tela. Ver `ehIdentificador` em compartilhado/validacao.ts.
  if (!ehIdentificador(id)) notFound();

  const { valor: publicacao, degradou } = await buscarPublicacao(id);

  // A DISTINÇÃO QUE ESTA TELA PRECISA FAZER, e por isso a camada de dados
  // devolve `Degradavel` aqui em vez do valor puro: "esta notícia não existe"
  // e "o banco não respondeu" chegariam as duas como `null`. Tratar a segunda
  // como 404 mostraria à equipe, no meio de uma queda do Supabase, uma tela
  // dizendo que o texto que ela escreveu sumiu — e a reação natural a isso é
  // escrever tudo de novo.
  if (degradou) {
    return (
      <Tela publicacao={null} semFormulario>
        <p className="estado estado--erro">
          Não deu para abrir esta notícia agora — o banco de dados não respondeu. Ela não foi
          perdida: volte à lista e tente de novo em alguns instantes.
        </p>
      </Tela>
    );
  }

  if (!publicacao) notFound();

  return <Tela publicacao={publicacao} />;
}

/**
 * O invólucro comum às três saídas acima — título, caminho de volta e
 * conteúdo. Escrito uma vez para que o `<main id="conteudo">` e o link de
 * volta não dependam de alguém lembrar de repeti-los em cada ramo.
 */
function Tela(
  { publicacao, semFormulario, children }: {
    publicacao: Awaited<ReturnType<typeof buscarPublicacao>>['valor'];
    semFormulario?: boolean;
    children?: React.ReactNode;
  }
) {
  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/publicacoes">← Notícias</Link></p>

      <h1>{publicacao ? 'Editar notícia' : 'Escrever notícia'}</h1>

      {/* A regra mais importante desta tela, dita antes do formulário e não
          depois: guardar não publica. É o que impede uma notícia de ir ao ar
          por acidente (nada aqui liga `publicado` — ver acoes/publicacoes.ts)
          e é a primeira pergunta de quem aperta "Guardar". */}
      {semFormulario
        ? null
        : (
          <p className="destaque">
            Guardar não coloca no ar. A notícia fica como rascunho e vai para o site quando você
            apertar "Publicar" na lista.
          </p>
        )}

      {children}

      {semFormulario ? null : <FormularioPublicacao publicacao={publicacao} />}
    </main>
  );
}
