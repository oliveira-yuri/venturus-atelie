import { notFound } from 'next/navigation';
import { PainelInicio, TELAS_DO_PAINEL } from '@/componentes/PainelInicio';
import { ehEquipe } from '@/servidor/permissao';

/**
 * `/admin` — a tela inicial do painel (RF33).
 *
 * A PRIMEIRA LINHA DESTA FUNÇÃO É A GUARDA, e não é repetição do que
 * `app/admin/layout.tsx` já faz: MEDIDO nesta tarefa, com a guarda só no
 * layout, o servidor respondeu 404 E mandou a página inteira do painel
 * dentro do payload de hidratação, em texto legível. O layout aborta a si
 * mesmo; ele não impede a página filha de rodar nem de ser serializada. O
 * bloco inteiro da medição está no comentário do layout.
 *
 * ENTÃO A REGRA, PARA P2/P3/P4: toda página nova sob `app/admin/` começa
 * chamando `ehEquipe()` e `notFound()`. Não é opcional e não é elegância —
 * é o que impede o dado de viajar. `testes/painel-guarda.test.mjs` varre
 * `app/admin/**` e falha se alguma página esquecer. E o mesmo vale para
 * cada Server Action do painel, por outro motivo: Action é endpoint HTTP
 * público (spec §4.5), não passa por página nem por layout.
 *
 * O `notFound()` fica FORA de qualquer `try`: ele sinaliza por exceção, e
 * um catch em volta o transformaria em erro de dados — mesma advertência
 * que acoes/autenticacao.ts carrega para o `redirect()`.
 *
 * SEM INDICADOR, SEM NÚMERO, de propósito. O painel do site antigo abria
 * com quatro contadores, e eles não foram portados: indicadores são
 * RF30–RF32, outro requisito, que o próprio escopo do bloco chama de
 * "primeiro candidato a corte". Um número na tela pede uma consulta, uma
 * consulta pede uma política de erro, e nada disso ajuda a equipe a fazer
 * a única coisa que ela veio fazer aqui: publicar.
 *
 * SEM MENU DE NAVEGAÇÃO DO PAINEL. A barra inferior fixa do painel antigo
 * (`.nav-admin`) só faz sentido com telas para alternar; com uma tela só,
 * ela seria uma barra que aponta para si mesma, ocupando a faixa mais
 * valiosa da tela do celular. Entra quando houver a segunda tela — P2.
 *
 * Quem chegou até aqui é equipe. Continua não sendo isso que autoriza
 * leitura nem escrita: quem decide é a RLS (regras 5 e 6 do CLAUDE.md).
 */
/**
 * O TÍTULO TAMBÉM PASSA PELA GUARDA — e isto foi medido, não previsto.
 *
 * Com `export const metadata = { title: 'Painel da equipe — ...' }`, a
 * resposta ANÔNIMA de `/admin` continha a string "Painel da equipe" no
 * payload, mesmo com a página já protegida e não renderizada: o Next
 * resolve o metadata por um caminho próprio, que não é a renderização do
 * componente. O `<title>` visível vinha certo (o do 404), mas o texto
 * viajava — e quem lê o corpo da resposta descobre que existe um painel
 * ali, que é exatamente o que a decisão de responder 404 (em vez de
 * "acesso negado") recusa contar.
 *
 * Por isso o metadata é `generateMetadata`, com a MESMA guarda. Não custa
 * consulta nova: `ehEquipe()` é `cache()` do React, deduplicado por
 * requisição — layout, metadata e página fazem UMA pergunta ao banco.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Painel da equipe — Ateliê Afro Cultural',
    description: 'Área de trabalho da equipe do Ateliê Afro Cultural.'
  };
}

export default async function PaginaDoPainel() {
  if (!await ehEquipe()) notFound();

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <h1>Painel da equipe</h1>

      <p className="destaque">O que você quer fazer?</p>

      <PainelInicio telas={TELAS_DO_PAINEL} />
    </main>
  );
}
