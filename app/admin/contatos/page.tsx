import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarContatos } from '@/servidor/dados/contatos';
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

  const { valor: contatos, degradou } = await listarContatos();

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeContatos((await searchParams).aviso);

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
    </main>
  );
}
