import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarContatos } from '@/servidor/dados/contatos';
import { paginar, MENSAGENS } from '@/compartilhado/paginacao';
import { Paginacao } from '@/componentes/Paginacao';
import { mudarSituacao } from '@/acoes/contatos';
import { avisoDeContatos } from '@/compartilhado/avisos-do-painel';
import { montarTriagem } from '@/compartilhado/triagem-de-contatos';
import { ListaContatos } from '@/componentes/ListaContatos';

/**
 * `/admin/contatos` — as mensagens que chegam pelo formulário do site
 * (RF29/RF33). A outra metade do RF07.
 *
 * POR QUE ESTA TELA EXISTE: desde 01/09/2026 o formulário de /contato grava
 * de verdade em `public.contatos` (acoes/contato.ts), e não havia tela
 * nenhuma para ler. Uma pessoa escrevia para a ONG e a mensagem sumia num
 * banco que ninguém abre — foi por isso que a confirmação do formulário
 * aponta para o WhatsApp em vez de prometer resposta.
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
 * AQUI ISSO PESA MAIS QUE NAS OUTRAS TRÊS TELAS. O que vazaria de
 * /admin/publicacoes é um título de notícia que a ONG quer publicar; o que
 * vazaria daqui é nome, e-mail, telefone e o texto que uma pessoa escreveu
 * para a ONG. `testes/contatos.test.mjs` mede o não-vazamento com as marcas
 * desta tela.
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React,
 * deduplicado por requisição (servidor/permissao.ts).
 *
 * O `notFound()` fica FORA de qualquer `try` — ele sinaliza por exceção, e um
 * catch em volta o transformaria em erro de dados.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido é a RLS — `contatos: equipe gerencia`, `for all using
 * (public.eh_equipe())` (004_pessoas.sql). Mesmo que este `if` fosse
 * contornado, o Postgres devolveria zero linha para quem não é equipe, e
 * `anon` nem chega lá: ele tem `grant insert` e nada mais (medido em
 * testes/rls.test.mjs).
 *
 * SEM CONTADOR NO TOPO ("3 novas"), de propósito. Indicador é RF30–RF32, e a
 * decisão da Tarefa P1 vale igual aqui: um número na tela pede uma consulta,
 * uma consulta pede uma política de erro, e a lista já começa pelas
 * mensagens que ainda esperam resposta — que é a informação que o contador
 * daria.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Mensagens — painel da equipe',
    description: 'Ler as mensagens recebidas pelo site e marcar o andamento do atendimento.'
  };
}

/** O estado vazio, o de falha e os avisos moram em componentes/ListaContatos.ts. */
export default async function PaginaDeContatos(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  // PAGINAÇÃO (pedido V1). Duas leituras da URL, e a ordem importa: o
  // `searchParams` é lido UMA vez e reaproveitado — `await` duas vezes na
  // mesma Promise funciona, mas ler o mesmo objeto duas vezes num arquivo
  // convida alguém a mudar um lado só.
  const parametros = await searchParams;

  // A CONTAGEM VEM ANTES DO RECORTE, e não há como escapar disso: para
  // saber qual é a página 2 é preciso saber quantas existem. O PostgREST
  // devolve as duas coisas na mesma consulta (`count: 'exact'`), então é
  // uma ida ao banco, não duas — mas a primeira chamada usa um recorte
  // provisório da página pedida, e o `paginar` abaixo corrige o número se
  // ele passar do fim.
  const provisoria = paginar(Number.MAX_SAFE_INTEGER, parametros.pagina);
  const primeira = await listarContatos({ de: provisoria.de, ate: provisoria.ate });
  const paginacao = paginar(primeira.total ?? 0, parametros.pagina);

  // Se a página pedida passou do fim, `paginar` a trouxe para a última — e
  // o recorte que já buscamos é o errado. Buscar de novo é o preço de não
  // mostrar uma tela vazia a quem digitou `?pagina=999`; acontece só nesse
  // caso, que é raro e é erro de digitação.
  const { valor: contatos, degradou } = paginacao.de === provisoria.de
    ? primeira
    : await listarContatos({ de: paginacao.de, ate: paginacao.ate });

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeContatos(parametros.aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Mensagens</h1>

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

      {/* O que esta tela é, dito antes da lista: uma fila de atendimento, e
          não um lugar de escrever. É o que responde a primeira pergunta de
          quem chega — "isto é o formulário do site?" — e o que explica por
          que as mensagens ainda sem resposta vêm primeiro. */}
      <p className="destaque">
        Tudo que chega pelo formulário da página de contato do site aparece aqui, com as
        mensagens que ainda esperam resposta em cima. Responda pelo e-mail ou pelo telefone da
        pessoa e marque em que pé está o atendimento.
      </p>

      {/*
        `montarTriagem` é quem ORDENA (não respondidas primeiro) e quem
        traduz cada valor de coluna em palavra. Ele roda aqui, e não dentro
        do componente, porque o componente é `.ts` para caber num teste do
        Node — e o Node não resolve o alias `@/...` num import de valor. O
        porquê inteiro, com as duas medições, está no cabeçalho daquela
        função.
      */}
      <ListaContatos
        itens={montarTriagem(contatos)}
        degradou={degradou}
        acaoSituacao={mudarSituacao}
      />

      {/*
        A PAGINAÇÃO FICA DEPOIS DA LISTA, e não antes: ela é o que se
        procura DEPOIS de rolar até o fim e não achar o que se queria. E ela
        não aparece quando a leitura degradou — dizer "página 1 de 1" sobre
        uma lista que não pôde ser carregada seria afirmar uma contagem que
        não se tem.
      */}
      {degradou ? null : <Paginacao paginacao={paginacao} nome={MENSAGENS} />}
    </main>
  );
}
