import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarCandidaturas } from '@/servidor/dados/voluntarios';
import { mudarSituacaoDaCandidatura } from '@/acoes/voluntarios';
import { avisoDeVoluntarios } from '@/compartilhado/avisos-do-painel';
import { montarTriagemDeVoluntarios } from '@/compartilhado/triagem-de-voluntarios';
import { ListaVoluntarios } from '@/componentes/ListaVoluntarios';

/**
 * `/admin/voluntarios` — a gestão de voluntários (RF26/RF33). A outra metade
 * da RF25.
 *
 * POR QUE ESTA TELA EXISTE: desde 01/09/2026 o formulário de
 * /voluntariado/candidatura grava de verdade em `public.voluntarios` e
 * `public.voluntario_areas` (acoes/voluntariado.ts), e não havia tela
 * nenhuma para ler. Uma pessoa se oferecia para ajudar e a candidatura sumia
 * num banco que ninguém abre — o mesmo buraco que o formulário de contato
 * teve pela manhã e que /admin/contatos fechou no mesmo dia.
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
 * AQUI ISSO PESA COMO EM /admin/contatos, e por um motivo a mais: o que
 * vazaria daqui é nome, e-mail e telefone tirados de `public.perfis` — o
 * CADASTRO de quem tem conta no site —, junto com o que a pessoa escreveu
 * sobre por que quer ajudar. `testes/voluntarios.test.mjs` mede o
 * não-vazamento com as marcas desta tela, inclusive o e-mail da candidatura
 * real que existe hoje na tabela (CLAUDE.md, item 0q).
 *
 * As duas chamadas custam UMA consulta: `ehEquipe()` é `cache()` do React,
 * deduplicado por requisição (servidor/permissao.ts).
 *
 * O `notFound()` fica FORA de qualquer `try` — ele sinaliza por exceção, e um
 * catch em volta o transformaria em erro de dados.
 *
 * A GUARDA NÃO AUTORIZA NADA. Ela decide o que DESENHAR; quem decide o que
 * pode ser lido é a RLS — `voluntarios: a pessoa le a propria candidatura`
 * (`using (perfil_id = auth.uid() or public.eh_equipe())`) e `voluntarios:
 * equipe gerencia` (004_pessoas.sql). Mesmo que este `if` fosse contornado,
 * o Postgres devolveria só as PRÓPRIAS candidaturas de quem pediu, e `anon`
 * nem chega lá: ele não tem `grant` nenhum nesta tabela (MEDIDO em
 * 01/09/2026 contra o PostgREST de produção — `42501 permission denied`).
 *
 * SEM CONTADOR NO TOPO ("3 novas"), de propósito. Indicador é RF30–RF32, e a
 * decisão da Tarefa P1 vale igual aqui: um número na tela pede uma consulta,
 * uma consulta pede uma política de erro, e a lista já começa pelas
 * candidaturas que ainda esperam resposta — que é a informação que o
 * contador daria.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Voluntários — painel da equipe',
    description: 'Ler as candidaturas ao voluntariado e marcar em que pé está cada uma.'
  };
}

/** O estado vazio, o de falha e os avisos moram em componentes/ListaVoluntarios.ts. */
export default async function PaginaDeVoluntarios(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const { valor: candidaturas, degradou } = await listarCandidaturas();

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeVoluntarios((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin">← Painel</Link></p>

      <h1>Voluntários</h1>

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

      {/* O que esta tela é, dito antes da lista: uma fila de pessoas que se
          ofereceram, e não um lugar de cadastrar voluntário. É o que responde
          a primeira pergunta de quem chega — "isto é o formulário do site?" —
          e o que explica por que quem ainda não teve resposta vem primeiro. */}
      <p className="destaque">
        Quem se candidata pela página de voluntariado do site aparece aqui, com quem ainda não
        teve resposta em cima. Fale com a pessoa pelo e-mail ou pelo telefone dela e marque em
        que pé está.
      </p>

      {/*
        `montarTriagemDeVoluntarios` é quem ORDENA (sem resposta primeiro) e
        quem traduz cada valor de coluna em palavra. Ele roda aqui, e não
        dentro do componente, porque o componente é `.ts` para caber num
        teste do Node — e o Node não resolve o alias `@/...` num import de
        valor. O porquê inteiro, com as duas medições, está no cabeçalho
        daquela função.
      */}
      <ListaVoluntarios
        itens={montarTriagemDeVoluntarios(candidaturas)}
        degradou={degradou}
        acaoSituacao={mudarSituacaoDaCandidatura}
      />
    </main>
  );
}
