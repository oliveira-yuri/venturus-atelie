import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarDoPainel } from '@/servidor/dados/depoimentos';
import { paginar, DEPOIMENTOS } from '@/compartilhado/paginacao';
import { Paginacao } from '@/componentes/Paginacao';
import { moderarDepoimento } from '@/acoes/depoimentos';
import { avisoDaModeracao } from '@/compartilhado/depoimentos';
import { ListaDepoimentosDoPainel } from '@/componentes/ListaDepoimentosDoPainel';
import { Instrucoes } from '@/componentes/Instrucoes';

/**
 * `/admin/depoimentos` — a fila de moderação. A guarda é a primeira linha
 * das DUAS funções (corpo e metadata), como em toda página do painel.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Depoimentos — painel da equipe',
    description: 'Ler os depoimentos enviados pelo site e decidir quais vão ao ar.'
  };
}

export default async function PaginaDeDepoimentos(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const parametros = await searchParams;
  const provisoria = paginar(Number.MAX_SAFE_INTEGER, parametros.pagina);
  const primeira = await listarDoPainel({ de: provisoria.de, ate: provisoria.ate });
  const paginacao = paginar(primeira.total ?? 0, parametros.pagina);
  const { valor: itens, degradou } = paginacao.de === provisoria.de
    ? primeira
    : await listarDoPainel({ de: paginacao.de, ate: paginacao.ate });

  const aviso = avisoDaModeracao(parametros.aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Depoimentos</h1>

      {aviso ? (
        <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
          <p>{aviso.texto}</p>
        </div>
      ) : null}

      <Instrucoes
        resumo="Depoimentos enviados pela página de depoimentos do site."
        itens={[
          <><strong>Nada vai ao ar sozinho.</strong> Quem espera moderação fica em cima; só o que
            você aprovar aparece no site.</>,
          <>Leia antes de aprovar: <strong>não publique sobrenome nem escola de criança</strong>.
            Quem escreveu declarou ter 18 anos ou ser responsável, mas a leitura é sua.</>,
          <>Dá para <strong>tirar do ar</strong> e voltar atrás a qualquer momento.</>
        ]}
      />

      <ListaDepoimentosDoPainel itens={itens} degradou={degradou} acaoModerar={moderarDepoimento} />

      {degradou ? null : <Paginacao paginacao={paginacao} nome={DEPOIMENTOS} />}
    </main>
  );
}
