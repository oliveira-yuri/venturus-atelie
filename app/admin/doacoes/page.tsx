import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarDoacoesDoPainel } from '@/servidor/dados/doacoes';
import { avisoDeDoacoes } from '@/compartilhado/avisos-do-painel';
import { montarAnalise } from '@/compartilhado/doacoes';
import { ListaDoacoes } from '@/componentes/ListaDoacoes';

/**
 * `/admin/doacoes` — a fila de doações (RF19–RF22/RF33). O outro lado de
 * `/doar/ofertar`.
 *
 * POR QUE ESTA TELA EXISTE: desde esta tarefa o formulário de
 * /doar/ofertar grava de verdade em `public.doacoes`, e não havia tela
 * nenhuma para ler. Uma pessoa oferecia uma doação e a oferta sumia num
 * banco que ninguém abre — o mesmo defeito que /admin/contatos corrigiu
 * para o formulário de contato.
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas: o componente e o
 * `generateMetadata`. Não é repetição do que `app/admin/layout.tsx` já faz —
 * MEDIDO na Tarefa P1, com a guarda só no layout o servidor respondeu 404 E
 * mandou a página inteira do painel no payload de hidratação; e com o corpo
 * protegido mas um `export const metadata`, o TÍTULO ainda viajava.
 * `testes/painel-guarda.test.mjs` varre `app/admin/**` exigindo as duas.
 *
 * AQUI ISSO PESA COMO EM /admin/contatos: o que vazaria é nome, e-mail e o
 * texto que alguém escreveu à ONG oferecendo uma doação — mais o valor em
 * dinheiro que a ONG recebeu, que é prestação de contas.
 * `testes/doacoes.test.mjs` mede o não-vazamento com as marcas desta tela.
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React,
 * deduplicado por requisição (servidor/permissao.ts).
 *
 * O `notFound()` fica FORA de qualquer `try` — ele sinaliza por exceção, e
 * um catch em volta o transformaria em erro de dados.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido é a RLS — `doacoes: o doador le as proprias`, com
 * `or public.eh_equipe()` (004_pessoas.sql). Mesmo que este `if` fosse
 * contornado, o Postgres devolveria só as doações da própria pessoa; e
 * `anon` nem chega lá, porque não tem `grant` nenhum sobre a tabela
 * (MEDIDO — ver servidor/dados/doacoes.ts).
 *
 * SEM CONTADOR NO TOPO ("3 esperando"), de propósito. Indicador é
 * RF30–RF32, e a decisão da Tarefa P1 vale igual aqui: um número na tela
 * pede uma consulta, uma consulta pede uma política de erro, e a lista já
 * começa pelas ofertas que ainda esperam resposta — que é a informação que
 * o contador daria.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Doações — painel da equipe',
    description: 'Responder as doações oferecidas pelo site e registrar o que o Ateliê recebeu.'
  };
}

/** O estado vazio, o de falha e os avisos moram em componentes/ListaDoacoes.ts. */
export default async function PaginaDeDoacoes(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: doacoes, degradou } = await listarDoacoesDoPainel();

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeDoacoes((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Doações</h1>

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

      {/* O que esta tela é, dito antes da lista: uma fila de conversas sobre
          doação, e não um caixa. É o que responde a primeira pergunta de
          quem chega e o que explica por que as ofertas sem resposta vêm
          primeiro. */}
      <p className="destaque">
        Tudo que alguém oferece pelo site aparece aqui, com o que ainda espera resposta em cima.
        Responda dizendo se dá para receber, e marque como recebida quando a doação chegar.
      </p>

      {/*
        O BOTÃO DE REGISTRAR VEM ANTES DA LISTA, e é a única ação que não
        nasce de um item dela: a doação que chegou por fora do site (pelo
        WhatsApp, pelo e-mail, na porta da sede). É a outra ponta da decisão
        "ofertar exige conta" — o argumento inteiro está no cabeçalho de
        acoes/doacoes.ts.

        `.painel__acao-principal`, a mesma caixa de "Escrever notícia" em
        /admin/publicacoes: alvo de toque de 44px (RNF08, regra 4).
      */}
      <p className="painel__acoes">
        <Link className="painel__acao-principal" href="/admin/doacoes/registrar">
          Registrar doação recebida
        </Link>
      </p>

      {/*
        `montarAnalise` é quem ORDENA (o que espera resposta primeiro) e quem
        traduz cada valor de coluna em palavra. Ele roda aqui, e não dentro
        do componente, porque o componente é `.ts` para caber num teste do
        Node — e o Node não resolve o alias `@/...` num import de valor. O
        porquê inteiro, com as duas medições, está no cabeçalho daquela
        função.
      */}
      <ListaDoacoes itens={montarAnalise(doacoes)} degradou={degradou} />
    </main>
  );
}
