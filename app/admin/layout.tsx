import { notFound } from 'next/navigation';
import '@/estilos/admin.css';
// SÓ TEM `@media print`: nenhuma regra dela vale na tela, e é por isso que
// ela pode ficar aqui, no layout do painel inteiro, em vez de só na página
// de relatório. O efeito é que imprimir QUALQUER tela do painel passa a dar
// um documento legível — sem nenhuma delas mudar de aparência (RF32).
import '@/estilos/impressao.css';
// A pele v1 (estilos/sistema-aplicado.css) já entra pelo layout raiz, que
// envolve o painel. Ela alcança as classes do painel por seletor escopado
// em `.painel` — especificidade maior que a das regras de admin.css —,
// então não precisa (nem deve) ser reimportada aqui.
import { ehEquipe } from '@/servidor/permissao';
// A confirmação das ações (pedido V1). Montada UMA vez, aqui, e não em cada
// lista: ela escuta o `submit` no documento e intercepta todo <form> com
// `data-confirmar` — inclusive os que ainda não existem. Fica no layout do
// PAINEL, não no raiz, para não mandar este JavaScript às páginas públicas,
// que não têm ação a confirmar. Ver o cabeçalho do componente.
import ConfirmacaoDeAcoes from '@/componentes/ConfirmacaoDeAcoes';

/**
 * A GUARDA DO PAINEL (RF33/RF34/RN05). Tudo que estiver sob `app/admin/`
 * passa por aqui antes de existir na tela.
 *
 * ===================================================================
 * 404, NÃO "ACESSO NEGADO"
 * ===================================================================
 *
 * Quem não é equipe recebe exatamente a mesma resposta que receberia por
 * um endereço inventado: o 404 de `app/not-found.tsx`, com cabeçalho,
 * rodapé, `<main id="conteudo">` e caminho de volta. Negar com explicação
 * ("você não tem permissão") CONTA que o painel existe, e a lista de quem
 * pode entrar nele tem cinco pessoas — não há o que ganhar dizendo isso ao
 * resto da internet. Decisão registrada no plano do bloco
 * (docs/superpowers/plans/2026-08-31-painel-administrativo.md, item 4).
 *
 * ===================================================================
 * A GUARDA FICA AQUI, E NÃO NO middleware.ts
 * ===================================================================
 *
 * O middleware já é o maior risco de deploy desta branch (CLAUDE.md, "O
 * que trava hoje", item 0: na Netlify ele roda como Edge Function, nunca
 * exercitada, e está deprecado no Next 16) e acabou de ganhar uma chamada
 * de rede na Tarefa 4 da autenticação. Empilhar a permissão do painel ali
 * seria pendurar dado pessoal no componente menos testado do projeto.
 * Aqui, é um Server Component comum: mesmo runtime, mesmos testes, mesma
 * `usuarioAtual()` que todo o resto usa.
 *
 * ===================================================================
 * ESTA GUARDA NÃO BASTA SOZINHA — MEDIDO, NÃO SUPOSTO
 * ===================================================================
 *
 * A primeira versão da Tarefa P1 tinha a guarda SÓ aqui. O que o servidor
 * respondeu a uma requisição anônima em `/admin` (Next 16.3.3,
 * `next build && next start`, 31/08/2026):
 *
 *   · status 404, correto;
 *   · e o HTML carregando, dentro do payload de hidratação, A PÁGINA DO
 *     PAINEL INTEIRA: "Painel da equipe", "O que você quer fazer?", os
 *     três caminhos de P2/P3/P4, tudo em texto legível.
 *
 * O motivo é a arquitetura do App Router: `children` já é um elemento
 * renderizado ao lado do layout, não depois dele. O `notFound()` daqui
 * aborta a subárvore DESTE arquivo — não impede a página filha de ter
 * rodado, nem impede o resultado dela de ser serializado na resposta.
 * Hoje o vazamento seria de três títulos de tela; nas tarefas P2/P3/P4 é
 * nome, telefone e responsável de criança.
 *
 * POR ISSO A GUARDA ESTÁ NOS DOIS LUGARES, e a ordem de importância é o
 * contrário da intuição: quem de fato impede o vazamento é a chamada
 * dentro de `app/admin/page.tsx` — esta aqui é a SEGUNDA tranca, que
 * garante que nenhuma tela nova apareça sem passar por alguma verificação.
 * Toda página criada sob `app/admin/` PRECISA chamar `ehEquipe()` na
 * primeira linha; `testes/painel-guarda.test.mjs` tem um teste que varre
 * `app/admin/**` e falha se alguma esquecer. As duas chamadas custam uma
 * consulta só: `ehEquipe()` é `cache()` do React, deduplicado por
 * requisição.
 *
 * O QUE O 404 ENTREGA HOJE, e é preciso dizer porque é defeito conhecido:
 * `notFound()` chamado em tempo de execução (aqui ou na página) devolve
 * 404 com o `<body>` VAZIO — só `<div hidden>` e scripts —, e o conteúdo
 * do 404 (cabeçalho, rodapé, `<main id="conteudo">`) só aparece depois de
 * hidratar. SEM JAVASCRIPT, TELA BRANCA. Medido nesta tarefa nas três
 * formas: `notFound()` no layout, na página, e com um `not-found.tsx`
 * local dentro de `app/admin/` — as três iguais. Não é o mesmo caminho de
 * um endereço inexistente (`/rota-que-nao-existe`), que continua vindo com
 * a página inteira no HTML, porque ali o Next RENDERIZA a rota
 * `/_not-found` em vez de tratar uma exceção no meio da renderização. É a
 * mesma família do que o CLAUDE.md registra no item 0f sobre
 * `app/error.tsx`.
 *
 * ===================================================================
 * O QUE ESTA GUARDA NÃO É
 * ===================================================================
 *
 * Ela não autoriza nada — decide o que DESENHAR. Quem autoriza é a RLS
 * (regras 5 e 6 do CLAUDE.md): mesmo que alguém contornasse este `if`, o
 * Postgres continuaria devolvendo só o que a política permite, porque o
 * cliente do projeto usa a sessão da pessoa e não existe chave de serviço
 * neste repositório (spec §4.1/§4.2, servidor/supabase.ts). E ela NÃO
 * substitui a verificação dentro das Server Actions de P2/P3/P4: Server
 * Action é endpoint HTTP público (spec §4.5) e não passa por layout
 * nenhum — cada uma revalida permissão chamando a MESMA `ehEquipe()`.
 *
 * O `notFound()` fica fora de qualquer `try`, pelo mesmo motivo que o
 * `redirect()` de acoes/autenticacao.ts: os dois sinalizam por exceção, e
 * um catch em volta os transformaria em erro de dados.
 *
 * O VLIBRAS CONTINUA AQUI, e é decisão tomada com o risco à vista
 * (dono do projeto, 31/08/2026). Ele é montado no layout RAIZ, que envolve
 * também o painel, e a CSP usa `strict-dynamic` — ou seja, código de
 * terceiro com confiança em cadeia numa tela que vai mostrar nome,
 * telefone e responsável de crianças. Tirá-lo daqui excluiria de Libras
 * justamente a tela de trabalho da equipe, e acessibilidade é requisito da
 * ONG (regra 8), não enfeite. O item 0h do CLAUDE.md registra a decisão e
 * o risco que ela aceita.
 */

/**
 * `noindex` do painel inteiro, herdado por toda tela de P2/P3/P4.
 *
 * Não confundir com o `noindex` de PRÉVIA que sai no lançamento em três
 * lugares (CLAUDE.md, item 0c): este NÃO sai nunca. O painel não é
 * conteúdo público — é o mesmo motivo pelo qual `/admin` entra em
 * `FORA_DO_BUSCADOR`, em app/robots.ts.
 *
 * Hoje ele é redundante três vezes (a prévia bloqueia tudo; o rastreador
 * anônimo recebe 404; o robots.txt pede para não rastrear). Existe para o
 * dia em que as duas primeiras deixarem de valer.
 */
export const metadata = {
  robots: { index: false, follow: false }
};

export default async function LayoutDoPainel({ children }: { children: React.ReactNode }) {
  // A SEGUNDA tranca (ver o bloco medido acima): a que impede o vazamento
  // é a de app/admin/page.tsx. `ehEquipe()` (servidor/permissao.ts) falha
  // FECHADA: sem sessão, sem Supabase, erro de consulta, prazo estourado e
  // exceção de rede chegam todos aqui como `false`. É o contrário da
  // política de degradação do resto do site, de propósito — o porquê está
  // escrito em compartilhado/permissao-de-equipe.ts.
  if (!await ehEquipe()) notFound();

  return (
    <div className="painel">
      {children}
      <ConfirmacaoDeAcoes />
    </div>
  );
}
