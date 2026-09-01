import { notFound } from 'next/navigation';
import { PainelInicio, TELAS_DO_PAINEL } from '@/componentes/PainelInicio';
import { PainelNumeros } from '@/componentes/PainelNumeros';
import { PainelExportacoes } from '@/componentes/PainelExportacoes';
import { ehEquipe } from '@/servidor/permissao';
import { listarIndicadores } from '@/servidor/dados/indicadores';
import { CONJUNTOS_EXPORTAVEIS } from '@/compartilhado/exportacao';
import { avisoDaExportacao } from '@/compartilhado/avisos-do-painel';

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
 * OS NÚMEROS ENTRARAM NO RF30, e o parágrafo que estava aqui — "sem
 * indicador, sem número, de propósito" — foi cumprido antes de ser
 * substituído, não abandonado. Ele dizia: "um número na tela pede uma
 * consulta, uma consulta pede uma política de erro, e nada disso ajuda a
 * equipe a fazer a única coisa que ela veio fazer aqui: publicar". As três
 * exigências estão pagas:
 *
 *   · a consulta é `count` com `head: true` — nenhuma linha atravessa a
 *     rede para desenhar um algarismo (servidor/dados/indicadores.ts);
 *   · a política de erro existe e é a INVERSA da guarda: contagem que falha
 *     vira um traço, nunca um zero, e NUNCA derruba a home. A equipe chega
 *     às telas mesmo com o banco meio fora do ar;
 *   · e os números ficam DEPOIS dos cartões, para não empurrar o trabalho
 *     para baixo da dobra num celular (componentes/PainelNumeros.ts).
 *
 * O que continua valendo do parágrafo antigo é a régua: nenhum número entra
 * aqui se não mudar o que a equipe faz em seguida — e nenhum conta pessoa
 * como resultado, que é a regra 1 do CLAUDE.md aplicada a um painel.
 *
 * O RF32 (PDF) NÃO ESTÁ AQUI e não deve ser inventado junto: esta tarefa
 * entrega RF30 e RF31.
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

export default async function PaginaDoPainel(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  // A CONTAGEM VEM DEPOIS DA GUARDA, e a ordem é o que impede a consulta de
  // sair para quem não é equipe. `listarIndicadores()` nunca lança: todo
  // desfecho ruim vira `quantidade: null` (servidor/dados/indicadores.ts), e
  // é por isso que ela pode ficar fora de qualquer try aqui sem derrubar a
  // home junto.
  const indicadores = await listarIndicadores();

  // O único aviso desta tela vem da rota de exportação, que redireciona para
  // cá quando recusa gerar um arquivo (a consulta falhou). `?aviso=` é
  // escrito por quem quiser, então passa por LISTA FECHADA — o parâmetro
  // escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDaExportacao((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <h1>Painel da equipe</h1>

      {/*
        `role="status"` e não `role="alert"`, pelo mesmo motivo das outras
        telas do painel: esta caixa chega junto com uma página NOVA (a rota
        de exportação redireciona), não aparece no meio de uma que já estava
        aberta. O mesmo limite conhecido vale: sem JavaScript, região viva
        nenhuma "dispara" — o que faz a mensagem ser encontrada é a posição
        dela, logo abaixo do título.
      */}
      {aviso
        ? (
          <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
            <p>{aviso.texto}</p>
          </div>
        )
        : null}

      <p className="destaque">O que você quer fazer?</p>

      <PainelInicio telas={TELAS_DO_PAINEL} />

      {/* Os números depois das telas, e os downloads depois dos números: a
          ordem é "onde eu trabalho", "o que está me esperando", "o que eu
          levo daqui". O porquê de cada corte está nos dois componentes. */}
      <PainelNumeros indicadores={indicadores} />

      <PainelExportacoes conjuntos={CONJUNTOS_EXPORTAVEIS} />
    </main>
  );
}
