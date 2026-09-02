import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarAtividade, enderecoDaCapa } from '@/servidor/dados/conteudo';

/**
 * A página de uma atividade (pedido V1).
 *
 * "Na página de projetos do usuário deve ser assim: pequenos blocos, se a
 * pessoa quiser ver o projeto ela clica em 'saber mais' e abre uma página
 * dedicada ao respectivo projeto."
 *
 * =====================================================================
 * O TEXTO NÃO MUDOU DE LUGAR, ELE MUDOU DE TELA — E O TESTE SABE DISSO
 * =====================================================================
 *
 * `/projetos` deixou de mostrar sinopse e ficha técnica; elas passaram a
 * viver aqui. Para `testes/paridade-texto.test.mjs` isso seria "frase da
 * ONG que sumiu de /projetos" — e é por isso que aquele arquivo ganhou
 * `destinos`: a rota declara em quais telas o seu texto original pode
 * estar. Mover texto é decisão, e decisão fica escrita.
 *
 * =====================================================================
 * `notFound()` PARA ID QUE NÃO EXISTE, E NÃO UMA PÁGINA "NÃO ACHEI"
 * =====================================================================
 *
 * Um id de atividade é `text` e vem do seed — "banzo", "cafu-e-o-cafe".
 * Alguém digitando `/projetos/qualquer-coisa` na barra de endereços recebe
 * o 404 do site, com o layout inteiro e o caminho de volta
 * (`app/not-found.tsx`). Uma tela "esta atividade não existe" seria uma
 * segunda página de erro para dizer a mesma coisa.
 *
 * LIMITE CONHECIDO, e o mesmo do item 0f(c) do CLAUDE.md: `notFound()` em
 * tempo de execução responde 404 com o `<body>` vazio, e o conteúdo do 404
 * só aparece depois de hidratar. Sem JavaScript, tela branca. Não é
 * defeito desta página — é do Next, está medido, e o caminho normal (clicar
 * em "Saber mais") nunca passa por aqui.
 */

/*
 * SEM `generateStaticParams`, E ISSO FOI MEDIDO.
 *
 * A primeira versão desta página o tinha, para pré-gerar as onze rotas. O
 * resultado foi `500 DYNAMIC_SERVER_USAGE` em toda elas: declarar
 * `generateStaticParams` faz o Next TENTAR pré-renderizar a rota, e a
 * leitura das atividades monta o cliente do Supabase, que lê `cookies()` —
 * API dinâmica. As duas coisas não convivem.
 *
 * E o ganho seria zero de qualquer jeito: TODAS as rotas de `app/` já são
 * `ƒ (Dynamic)` neste projeto, porque `app/layout.tsx` lê `headers()` para
 * pegar o nonce da política de conteúdo. A única `○ (Static)` é
 * `/robots.txt`, que não passa por aquele layout.
 *
 * Ou seja: pré-gerar aqui não tornaria nada estático, só quebraria a
 * página. Fica dinâmica, como o resto do site.
 */

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
) {
  const atividade = await buscarAtividade((await params).id);
  if (!atividade) return { title: 'Atividade não encontrada — Ateliê Afro Cultural' };

  return {
    title: `${atividade.titulo} — Ateliê Afro Cultural`,
    // O resumo da própria ONG como descrição; sem resumo, a frase genérica
    // da página de projetos. Nada inventado (regra 2).
    description: atividade.resumo
      ?? 'Contação de história performática do Ateliê Afro Cultural, na Casa Verde, São Paulo.'
  };
}

export default async function PaginaDaAtividade(
  { params }: { params: Promise<{ id: string }> }
) {
  const atividade = await buscarAtividade((await params).id);
  if (!atividade) notFound();

  const capa = atividade.imagem_caminho ? await enderecoDaCapa(atividade.imagem_caminho) : null;

  // A MESMA ORDEM DE CAMPOS DE `componentes/CardAtividade.ts`, e campo sem
  // valor é OMITIDO, não desenhado vazio: várias das onze atividades reais
  // não têm resumo nem sinopse (regra 2 aplicada ao campo).
  const camposFicha: Array<[string, string | null]> = [
    ['Gênero', atividade.genero],
    ['Duração', atividade.duracao],
    ['Elenco', atividade.elenco],
    ['Classificação', atividade.classificacao],
    ['Local', atividade.local],
    ['Precisa de', atividade.rider]
  ];
  const ficha = camposFicha.filter((campo): campo is [string, string] => Boolean(campo[1]));

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/projetos">← Projetos e atividades</Link></p>

      <h1>{atividade.titulo}</h1>

      {capa ? (
        <img
          className="atividade__capa"
          src={capa}
          /*
            O `alt` vem do banco e é OBRIGATÓRIO quando há imagem — o
            `check` da migration 009 recusa a linha sem ele. O `??` existe
            só para o TypeScript: uma linha sem alt não chega até aqui.
          */
          alt={atividade.imagem_alt ?? ''}
          loading="eager"
          decoding="async"
        />
      ) : null}

      {atividade.resumo ? <p className="destaque">{atividade.resumo}</p> : null}

      {atividade.descricao
        ? atividade.descricao.split('\n\n').map((paragrafo, indice) => (
          <p key={indice}>{paragrafo}</p>
        ))
        : null}

      {ficha.length > 0 ? (
        <section aria-labelledby="titulo-ficha">
          <h2 id="titulo-ficha">Ficha técnica</h2>
          <dl className="atividade__ficha">
            {ficha.map(([rotulo, valor]) => (
              <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}

      <p className="chamada-final">
        Quer levar esta atividade para a sua escola ou instituição?{' '}
        <Link href="/para-escolas">Veja como funciona</Link> ou{' '}
        <Link href="/contato">fale com a gente</Link>.
      </p>
    </main>
  );
}
