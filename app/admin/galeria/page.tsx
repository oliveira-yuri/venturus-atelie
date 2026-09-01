import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarTodasAsMidias } from '@/servidor/dados/galeria';
import { porNoAr } from '@/acoes/galeria';
import { avisoDaGaleria } from '@/compartilhado/avisos-do-painel';
import { ListaMidia } from '@/componentes/ListaMidia';
import FormularioMidia from '@/componentes/FormularioMidia';

/**
 * `/admin/galeria` — subir foto e cuidar do que está no ar (RF05/RF33/RN07).
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
 * pode ser lido é a RLS — e nesta tela são DUAS políticas, de sistemas
 * diferentes: a de `public.midia` e a do Storage (006_storage.sql). Ver o
 * cabeçalho de acoes/galeria.ts.
 *
 * ===================================================================
 * O FORMULÁRIO FICA NESTA TELA, NÃO NUMA SEGUNDA
 * ===================================================================
 *
 * As notícias têm duas telas (a lista e `/admin/publicacoes/editar`) porque
 * escrever uma notícia é uma sessão longa: a pessoa senta, escreve, revisa.
 * Subir foto é o contrário — é um gesto de dez segundos, quase sempre com a
 * foto que a pessoa acabou de tirar, de pé, no meio de um evento (regra 4
 * do CLAUDE.md). Uma tela a mais é uma espera de rede a mais entre a
 * intenção e o gesto, num celular que pode estar em 3G. O formulário vem
 * ANTES da lista pelo mesmo motivo: é o que a pessoa veio fazer.
 *
 * E não há tela de EDITAR: trocar a foto de uma linha é o mesmo trabalho
 * que subir outra, e o texto sozinho quase nunca é o que está errado. A
 * frase que diz isso está em componentes/ListaMidia.ts, escrita, para que a
 * ausência não vire busca frustrada.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Galeria — painel da equipe',
    description: 'Subir fotos, escrever a descrição e cuidar do que está no ar.'
  };
}

/** O estado vazio e o de falha moram em componentes/ListaMidia.ts. */
export default async function PaginaDaGaleria(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: midias, degradou } = await listarTodasAsMidias();

  // O resultado da última Action chega pela URL (as Actions terminam em
  // redirect, que é o que as faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDaGaleria((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Galeria</h1>

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

      {/*
        RN07 DITA ANTES DO FORMULÁRIO, e não depois: é a regra que decide se
        a foto pode existir no site, e lê-la depois de já ter escolhido a
        foto é tarde. A frase é do escopo (RN07) e do CLAUDE.md (regra 9),
        não texto inventado sobre a ONG.
      */}
      <p className="destaque">
        Nenhuma foto vai ao ar sem autorização de uso de imagem registrada de quem aparece nela —
        e, no caso de crianças e adolescentes, de quem é responsável por elas. Subir não publica:
        a foto fica guardada até você apertar "Publicar".
      </p>

      <h2 className="painel__secao">Subir uma foto</h2>

      <FormularioMidia />

      <h2 className="painel__secao">Fotos já enviadas</h2>

      <ListaMidia
        midias={midias}
        degradou={degradou}
        acaoPorNoAr={porNoAr}
        caminhoApagar="/admin/galeria/apagar"
      />
    </main>
  );
}
