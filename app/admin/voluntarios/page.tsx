import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { listarCandidaturas } from '@/servidor/dados/voluntarios';
import { listarAreasComEstado } from '@/servidor/dados/voluntariado';
import { paginar, CANDIDATURAS } from '@/compartilhado/paginacao';
import {
  lerFiltro, filtrarCandidaturas, parametrosDoFiltro, filtroAtivo, TIPOS_DE_PESSOA_DO_FILTRO
} from '@/compartilhado/filtro-de-voluntarios';
import { Paginacao } from '@/componentes/Paginacao';
import { mudarSituacaoDaCandidatura } from '@/acoes/voluntarios';
import { avisoDeVoluntarios } from '@/compartilhado/avisos-do-painel';
import {
  montarTriagemDeVoluntarios, ehSituacaoDeVoluntario, SITUACOES_DE_VOLUNTARIO
} from '@/compartilhado/triagem-de-voluntarios';
import { FiltroDaFila } from '@/componentes/FiltroDaFila';
import { ListaVoluntarios } from '@/componentes/ListaVoluntarios';
import { Instrucoes } from '@/componentes/Instrucoes';

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

  // PAGINAÇÃO (pedido V1) — ver o mesmo bloco em app/admin/contatos/page.tsx
  // para o porquê da contagem vir antes do recorte.
  const parametros = await searchParams;

  /*
    QUATRO CAMPOS DE FILTRO (pedido V1), e todos por `GET`.
    ===================================================================

    Por `GET` porque isso dá três coisas de graça: funciona SEM JavaScript,
    o botão voltar desfaz o filtro, e o endereço filtrado é um link que a
    equipe manda para outra pessoa.

    A SITUAÇÃO passa por lista fechada — `?situacao=` é escrito por quem
    quiser, e um valor inventado vira "todas". Os outros três não precisam
    de lista: eles alimentam uma comparação de texto em memória, não uma
    consulta, então o pior que um valor estranho faz é não casar com nada.

    O FILTRO VEM ANTES DO RECORTE, e é essa ordem que mantém a contagem
    honesta. Filtrar depois de paginar daria vinte linhas das quais três
    apareceriam — e a tela escreveria "3 de 47" para uma busca que achou 3.
  */
  const filtro = lerFiltro(parametros);
  if (filtro.situacao && !ehSituacaoDeVoluntario(filtro.situacao)) filtro.situacao = '';

  // As áreas do select vêm do BANCO, não de uma lista escrita aqui: a ONG
  // pode criar uma sexta, e um filtro que não a oferecesse esconderia
  // candidaturas sem dizer que escondeu. `listarAreasComEstado` degrada para
  // lista vazia, e aí o campo de área some — ver componentes/FiltroDaFila.ts.
  const [{ valor: todas, degradou }, { valor: areas }] = await Promise.all([
    listarCandidaturas(),
    listarAreasComEstado()
  ]);
  const encontradas = filtrarCandidaturas(todas, filtro);

  const paginacao = paginar(encontradas.length, parametros.pagina);
  const candidaturas = encontradas.slice(paginacao.de, paginacao.ate + 1);

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeVoluntarios(parametros.aviso);

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
      <Instrucoes
        resumo="Quem se candidata pela página de voluntariado do site aparece aqui."
        itens={[
          <><strong>Quem ainda não teve resposta fica em cima.</strong></>,
          <><strong>Fale com a pessoa pelo e-mail ou pelo telefone dela</strong> — o site não
            manda e-mail por você.</>,
          <>Depois, <strong>marque em que pé está</strong>: nova, em contato, voluntariando ou
            encerrada.</>,
          <><strong>Encerrar devolve à pessoa o direito de se candidatar de novo.</strong> É a
            única ação daqui que muda o que outra pessoa pode fazer no site.</>
        ]}
      />

      {/*
        `montarTriagemDeVoluntarios` é quem ORDENA (sem resposta primeiro) e
        quem traduz cada valor de coluna em palavra. Ele roda aqui, e não
        dentro do componente, porque o componente é `.ts` para caber num
        teste do Node — e o Node não resolve o alias `@/...` num import de
        valor. O porquê inteiro, com as duas medições, está no cabeçalho
        daquela função.
      */}
      {/*
        O FILTRO FICA ANTES DA LISTA — é o que se usa para chegar nela. A
        paginação, que é o que se usa depois de rolar até o fim, fica
        depois. Ele não aparece quando a leitura degradou: oferecer filtro
        sobre uma lista que não pôde ser carregada é oferecer um gesto que
        não pode dar certo.
      */}
      {degradou ? null : (
          <FiltroDaFila
            filtro={filtro}
            ativo={filtroAtivo(filtro)}
            nomePlural="candidaturas"
            areas={areas.map((area) => area.nome)}
            situacoes={SITUACOES_DE_VOLUNTARIO.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
          />
      )}

      <ListaVoluntarios
        itens={montarTriagemDeVoluntarios(candidaturas)}
        degradou={degradou}
        acaoSituacao={mudarSituacaoDaCandidatura}
      />

      {/*
        A PAGINAÇÃO FICA DEPOIS DA LISTA — ver o mesmo bloco em
        app/admin/contatos/page.tsx. Ela não aparece quando a leitura
        degradou: dizer "página 1 de 1" sobre uma lista que não pôde ser
        carregada seria afirmar uma contagem que não se tem.
      */}
      {degradou ? null : (
        <Paginacao
          paginacao={paginacao}
          nome={CANDIDATURAS}
          /* O filtro viaja com a página: sem isto, ir para a página 2
             devolveria a lista inteira, e a equipe veria uma lista
             diferente da que estava lendo. */
          parametros={parametrosDoFiltro(filtro)}
        />
      )}
    </main>
  );
}
