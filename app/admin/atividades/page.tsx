import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarAtividadesDoPainel } from '@/servidor/dados/conteudo';
import { alternarAtividade } from '@/acoes/atividades';
import { avisoDeAtividades } from '@/compartilhado/avisos-do-painel';
import { ListaAtividades } from '@/componentes/ListaAtividades';

/**
 * `/admin/atividades` — as 11 atividades reais, para a equipe corrigir
 * (RF03/RF33).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas: o componente e o
 * `generateMetadata`. Não é repetição do que `app/admin/layout.tsx` já faz —
 * MEDIDO na Tarefa P1, com a guarda só no layout o servidor respondeu 404 E
 * mandou a página inteira do painel no payload de hidratação; e com o corpo
 * protegido mas um `export const metadata`, o TÍTULO ainda viajava. O bloco
 * inteiro da medição está no comentário do layout, e
 * `testes/painel-guarda.test.mjs` varre `app/admin/**` exigindo as duas.
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React.
 *
 * O `notFound()` fica FORA de qualquer `try`.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido e escrito é a RLS (`atividades: equipe gerencia`, com
 * `using` e `with check` em `public.eh_equipe()`, 002_conteudo.sql).
 *
 * ===================================================================
 * A LISTA DO PAINEL NÃO CAI PARA O JSON VERSIONADO
 * ===================================================================
 *
 * /projetos cai: banco fora do ar não pode derrubar a página institucional,
 * e a cópia em dados-iniciais/ tem o mesmo conteúdo real. Aqui, não —
 * `listarAtividadesDoPainel()` usa `consultarComEstado` e devolve
 * `degradou`, que a lista transforma em aviso de falha. Desenhar 11
 * atividades com "Editar" ao lado, sabendo que aqueles textos não são os do
 * banco, seria oferecer um gesto que não pode dar certo. O porquê inteiro
 * está em servidor/dados/conteudo.ts, na seção da leitura do painel.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Atividades — painel da equipe',
    description: 'Corrigir o texto das atividades que aparecem na página de projetos.'
  };
}

/** O estado vazio, o de falha e os dois avisos moram em componentes/ListaAtividades.ts. */
export default async function PaginaDeAtividades(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: atividades, degradou } = await listarAtividadesDoPainel();

  // O resultado da última Action chega pela URL (as Actions terminam em
  // redirect, que é o que as faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeAtividades((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Atividades</h1>

      {/*
        `role="status"` e não `role="alert"`, pelo mesmo motivo escrito em
        app/admin/publicacoes/page.tsx: esta caixa chega junto com uma página
        NOVA (a Action redireciona), não aparece no meio de uma que já estava
        aberta. E o mesmo limite conhecido vale: sem JavaScript, região viva
        nenhuma "dispara" — o que faz esta mensagem ser encontrada é a
        posição dela, logo abaixo do título.
      */}
      {aviso
        ? (
          <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
            <p>{aviso.texto}</p>
          </div>
        )
        : null}

      {/* O que esta tela faz, dito antes da lista: corrigir o que já existe.
          É o que responde a primeira pergunta de quem chega procurando um
          botão de "nova atividade" — que não existe, e o porquê está escrito
          no fim da lista. */}
      <p className="destaque">
        Estas são as atividades que aparecem na página de projetos do site. Aqui você corrige o
        texto de cada uma: o nome, o resumo, a sinopse e a ficha técnica.
      </p>

      <ListaAtividades
        atividades={atividades}
        degradou={degradou}
        acaoAlternar={alternarAtividade}
        caminhoEditar="/admin/atividades/editar"
      />
    </main>
  );
}
