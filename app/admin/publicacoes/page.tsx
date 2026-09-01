import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarTodas } from '@/servidor/dados/publicacoes';
import { alternarPublicacao } from '@/acoes/publicacoes';
import { avisoDaLista } from '@/compartilhado/avisos-do-painel';
import { ListaPublicacoes } from '@/componentes/ListaPublicacoes';

/**
 * `/admin/publicacoes` — a lista de notícias da equipe (RF04/RF33).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas: o componente e o
 * `generateMetadata`. Não é repetição do que `app/admin/layout.tsx` já faz —
 * MEDIDO na Tarefa P1, com a guarda só no layout o servidor respondeu 404 E
 * mandou a página inteira do painel no payload de hidratação; e com o corpo
 * protegido mas um `export const metadata`, o TÍTULO ainda viajava, porque o
 * Next resolve metadata por um caminho que não é a renderização do
 * componente. O bloco inteiro da medição está no comentário do layout, e
 * `testes/painel-guarda.test.mjs` varre `app/admin/**` exigindo as duas.
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React,
 * deduplicado por requisição (servidor/permissao.ts).
 *
 * O `notFound()` fica FORA de qualquer `try` — ele sinaliza por exceção, e um
 * catch em volta o transformaria em erro de dados.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido é a RLS (`publicado or eh_equipe()`), e é por isso que
 * `listarTodas()` pode existir sem medo: para quem não é equipe o Postgres
 * devolveria só as publicadas, mesmo que esta página fosse aberta.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Notícias — painel da equipe',
    description: 'Escrever, editar e publicar as notícias do site.'
  };
}

/** O estado vazio e o de falha moram em componentes/ListaPublicacoes.ts. */
export default async function PaginaDePublicacoes(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: publicacoes, degradou } = await listarTodas();

  // O resultado da última Action chega pela URL (ver o cabeçalho de
  // acoes/publicacoes.ts: as Actions terminam em redirect, que é o que as faz
  // funcionar sem JavaScript, e um redirect não carrega estado). `?aviso=` é
  // escrito por quem quiser, então passa por LISTA FECHADA — o parâmetro
  // escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDaLista((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Notícias</h1>

      {/*
        `role="status"` e não `role="alert"`: esta caixa chega junto com uma
        página NOVA (a Action redireciona), não aparece no meio de uma que já
        estava aberta. Um `alert` anuncia interrupções; aqui o texto está no
        começo do conteúdo e é lido na ordem natural, e `status` é o papel
        honesto para uma confirmação do que acabou de acontecer.

        DITO EM VOZ ALTA, porque é limite conhecido: sem JavaScript, região
        viva nenhuma "dispara" — o que faz esta mensagem ser encontrada é a
        posição dela, logo abaixo do título. É por isso que ela fica ANTES da
        lista, e não ao lado do item que mudou.
      */}
      {aviso
        ? (
          <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
            <p>{aviso.texto}</p>
          </div>
        )
        : null}

      {/* O caminho mais importante da tela, e por isso o primeiro depois do
          título: escrever. Alvo grande, uma coluna, no alcance do polegar
          (regra 4 — a ONG opera isto de pé, no celular). */}
      <p className="painel__acoes">
        <Link className="painel__acao-principal" href="/admin/publicacoes/editar">
          Escrever notícia
        </Link>
      </p>

      <ListaPublicacoes
        publicacoes={publicacoes}
        degradou={degradou}
        acaoAlternar={alternarPublicacao}
        caminhoEditar="/admin/publicacoes/editar"
      />
    </main>
  );
}
