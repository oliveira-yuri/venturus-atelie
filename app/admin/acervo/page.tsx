import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarMateriaisDoPainel, enderecoDoArquivo } from '@/servidor/dados/acervo';
import { alternarMaterial } from '@/acoes/acervo';
import { avisoDoAcervo } from '@/compartilhado/avisos-do-painel';
import {
  ListaMateriaisDoPainel, type MaterialDoPainelComUrl
} from '@/componentes/ListaMateriaisDoPainel';
import FormularioMaterial from '@/componentes/FormularioMaterial';

/**
 * `/admin/acervo` — subir material e cuidar do que está no ar (RF36/RF37).
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
 * pode ser lido e escrito é a RLS — e nesta tela são DUAS políticas, de
 * sistemas diferentes: a de `public.acervo` e a do Storage
 * (006_storage.sql). Ver o cabeçalho de acoes/acervo.ts.
 *
 * ===================================================================
 * O FORMULÁRIO FICA NESTA TELA, NÃO NUMA SEGUNDA
 * ===================================================================
 *
 * Mesma decisão de /admin/galeria, e pelo mesmo motivo: subir um arquivo é
 * um gesto curto, e uma tela a mais é uma espera de rede a mais entre a
 * intenção e o gesto, num celular que pode estar em 3G (regra 4 do
 * CLAUDE.md). O formulário vem ANTES da lista porque é o que a pessoa veio
 * fazer.
 *
 * E não há tela de EDITAR: trocar o arquivo de uma linha é o mesmo trabalho
 * que subir outro. A frase que diz isso está em
 * componentes/ListaMateriaisDoPainel.ts, escrita, para que a ausência não
 * vire busca frustrada.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Acervo — painel da equipe',
    description: 'Subir material, escrever a ficha e cuidar do que está no ar.'
  };
}

/** O estado vazio e o de falha moram em componentes/ListaMateriaisDoPainel.ts. */
export default async function PaginaDoAcervo(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: linhas, degradou } = await listarMateriaisDoPainel();

  // `enderecoDoArquivo()` é assíncrona só por causa de `obterCliente()` (que
  // lê `cookies()`) — `getPublicUrl` em si é síncrono e não faz requisição
  // nenhuma (ver o comentário de servidor/dados/acervo.ts). Resolvido aqui,
  // no servidor, para a lista continuar um componente puro e síncrono,
  // testável sem o Next. É o contrário da galeria, onde assinar custa uma
  // requisição de verdade — e é uma das consequências práticas de o bucket
  // `acervo` continuar público.
  const materiais: MaterialDoPainelComUrl[] = await Promise.all(
    linhas.map(async (material) => ({
      ...material,
      url: await enderecoDoArquivo(material.arquivo_caminho)
    }))
  );

  // O resultado da última Action chega pela URL (as Actions terminam em
  // redirect, que é o que as faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDoAcervo((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Acervo</h1>

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
        O QUE PRECISA SER LIDO ANTES DE ESCOLHER O ARQUIVO, e por isso está
        aqui e não no rodapé: o endereço é público (o material existe para
        ser baixado por qualquer pessoa) e subir não publica. Ler isso depois
        de já ter subido o arquivo errado é tarde.
      */}
      <p className="destaque">
        O que entra aqui é material para as pessoas baixarem — cartilha, ficha técnica,
        portfólio. O arquivo fica num endereço público desde que sobe, então confira que
        escolheu o certo. Subir não publica: o material fica guardado até você apertar
        "Publicar".
      </p>

      {/* Mesmo desenho de /admin/galeria — ver o comentário de lá para o
          porquê de `<details>` e não JavaScript. */}
      <details className="painel__envio">
        <summary className="painel__envio-botao">Subir um material</summary>
        <FormularioMaterial />
      </details>

      <h2 className="painel__secao">Materiais já enviados</h2>

      <ListaMateriaisDoPainel
        materiais={materiais}
        degradou={degradou}
        acaoAlternar={alternarMaterial}
        caminhoApagar="/admin/acervo/apagar"
      />
    </main>
  );
}
