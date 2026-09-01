import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarEventoDoPainel } from '@/servidor/dados/eventos';
import { ehIdentificador } from '@/compartilhado/validacao';
import FormularioEvento from '@/componentes/FormularioEvento';

/**
 * `/admin/eventos/editar` — marcar um evento novo (sem `?id=`) ou abrir um
 * que já existe (`?id=<uuid>`). RF13/RF33.
 *
 * UMA ROTA PARA OS DOIS CASOS, e não duas — a mesma decisão de
 * /admin/publicacoes/editar, e o contrário de /admin/atividades/editar (que
 * exige `?id=` porque ali não existe "nova"). Aqui existe: eventos são
 * marcados o tempo todo, e é o gesto principal da tela anterior. Duas rotas
 * seriam duas telas para manter em paralelo e duas chances de uma ganhar um
 * campo que a outra não tem — que é como um formulário de edição começa a
 * perder dado ao salvar.
 *
 * A GUARDA É A MESMA DE TODA TELA DO PAINEL, nas duas funções (componente e
 * `generateMetadata`), pelo motivo medido na Tarefa P1 e escrito em
 * app/admin/layout.tsx. `testes/painel-guarda.test.mjs` varre `app/admin/**`
 * e falha se uma delas faltar.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Cadastrar evento — painel da equipe',
    description: 'Cadastrar e corrigir um evento da agenda do site.'
  };
}

export default async function PaginaDeEdicaoDeEvento(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  // Sem `?id=` é evento novo — o caso mais comum, e o que não custa consulta
  // nenhuma.
  if (!id) return <Tela evento={null} />;

  // `?id=` com lixo dentro nunca foi um identificador: 404 antes de perguntar
  // ao Postgres, que devolveria erro de sintaxe (22P02) e viraria uma falha
  // genérica na tela. Ver `ehIdentificador` em compartilhado/validacao.ts.
  if (!ehIdentificador(id)) notFound();

  const { valor: evento, degradou } = await buscarEventoDoPainel(id);

  // A DISTINÇÃO QUE ESTA TELA PRECISA FAZER, e por isso a camada de dados
  // devolve `Degradavel` aqui em vez do valor puro: "este evento não existe"
  // e "o banco não respondeu" chegariam os dois como `null`. Tratar o segundo
  // como 404 mostraria à equipe, no meio de uma queda do Supabase, uma tela
  // dizendo que o evento que ela marcou sumiu — e a reação natural a isso é
  // marcar tudo de novo, o que a agenda não tem como desfazer.
  if (degradou) {
    return (
      <Tela evento={null} semFormulario>
        <p className="estado estado--erro">
          Não deu para abrir este evento agora — o banco de dados não respondeu. Ele não foi
          perdido: volte à lista e tente de novo em alguns instantes.
        </p>
      </Tela>
    );
  }

  if (!evento) notFound();

  return <Tela evento={evento} />;
}

/**
 * O invólucro comum às três saídas acima — título, caminho de volta e
 * conteúdo. Escrito uma vez para que o `<main id="conteudo">` e o link de
 * volta não dependam de alguém lembrar de repeti-los em cada ramo.
 */
function Tela(
  { evento, semFormulario, children }: {
    evento: Awaited<ReturnType<typeof buscarEventoDoPainel>>['valor'];
    semFormulario?: boolean;
    children?: React.ReactNode;
  }
) {
  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/eventos">← Agenda</Link></p>

      <h1>{evento ? 'Corrigir evento' : 'Cadastrar evento'}</h1>

      {/* A regra mais importante desta tela, dita antes do formulário e não
          depois: guardar não publica. É o que impede uma data errada de ir
          para a agenda por acidente (nada aqui liga `publicado` — ver
          acoes/eventos.ts) e é a primeira pergunta de quem aperta "Guardar".

          A segunda frase é sobre o FUSO, e ela não é decoração: a equipe está
          escrevendo a hora em que as pessoas devem aparecer na porta do
          ateliê, e o servidor que grava isso roda em UTC. O código converte
          (compartilhado/validacao.ts); a frase existe para que ninguém tente
          "compensar" o fuso à mão, escrevendo 22:00 para dizer 19:00. */}
      {semFormulario
        ? null
        : (
          <>
            <p className="destaque">
              Guardar não coloca na agenda. O evento fica como rascunho e vai para o site quando
              você apertar "Publicar" na lista.
            </p>
            <p className="painel__aviso">
              Escreva a hora normal, a de São Paulo — a mesma que você diria por telefone. O
              site cuida do resto.
            </p>
          </>
        )}

      {children}

      {semFormulario ? null : <FormularioEvento evento={evento} />}
    </main>
  );
}
