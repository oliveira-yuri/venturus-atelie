import { createElement, Fragment } from 'react';
import type { Publicacao } from '@/servidor/dados/publicacoes';

/**
 * As notícias publicadas (RF04), em /noticias — ou o estado vazio.
 *
 * Até a Tarefa P2 esta página era HTML fixo: não havia camada de dados nem
 * como a ONG publicar nada, e o parágrafo de estado vazio estava escrito
 * direto no `page.tsx`. Agora ele passa por aqui, COM O MESMO TEXTO — o da
 * Tarefa A4, aprovado no relatório daquela tarefa e verificado por
 * testes/paginas-vazias-a4.test.mjs, que compara as duas frases inteiras num
 * regex só. Mudar uma vírgula ali quebra a suíte de propósito.
 *
 * MESMA DECISÃO DE componentes/ListaEventos.ts, e pelo mesmo motivo: a
 * seção NÃO é omitida quando não há nada. A regra 2 do CLAUDE.md manda
 * omitir seção sem dado, mas aqui a lista vazia é o caso normal (a tabela
 * está vazia hoje) e uma página com `<h1>Notícias</h1>` e nada embaixo não
 * responde nada a quem chegou. O estado vazio com texto real responde.
 *
 * Escrito com createElement em vez de JSX, como ListaEventos/CardAtividade e
 * irmãos: fica um `.ts` puro que o runtime nativo do Node importa e
 * `react-dom/server` renderiza dentro de um teste, sem subir o Next.
 * Consequência prática que vale registrar: por isso este arquivo NÃO pode
 * importar VALOR de `@/...` (o Node não resolve o alias do tsconfig) — só
 * `react` e tipos, que são apagados na compilação. É o que explica a
 * duplicação do fuso, logo abaixo.
 */

/**
 * O fuso da ONG, repetido de componentes/ListaEventos.ts — e a repetição é
 * consciente, não descuido.
 *
 * O motivo de a constante existir é um defeito real, medido na revisão final
 * do Bloco A: no site estático a formatação de data rodava no NAVEGADOR de
 * quem visitava (fuso de São Paulo, na prática); como Server Component ela
 * passou a rodar no fuso do PROCESSO, e função da Netlify roda em UTC — três
 * horas de diferença, que para qualquer coisa depois das 21h muda o DIA
 * impresso.
 *
 * O certo seria uma constante só, num módulo compartilhado. Não dá sem
 * quebrar o teste: este arquivo é importado pelo runtime nativo do Node, que
 * não resolve `@/...` nem caminho sem extensão, e um import relativo com
 * `.ts` não passa no `next build` sem mexer no tsconfig do projeto inteiro.
 * A saída foi travar a repetição com um teste: testes/publicacoes.test.mjs
 * lê os DOIS arquivos e falha se os fusos divergirem.
 */
const FUSO_DA_ONG = 'America/Sao_Paulo';

/**
 * Data por extenso, sem hora — diferente do `quando()` de ListaEventos, que
 * mostra o horário porque agenda é compromisso. Notícia não tem hora: dizer
 * "publicado quinta-feira, 3 de setembro, às 23:47" só conta a que horas
 * alguém da equipe estava trabalhando.
 */
function dataPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO_DA_ONG
  });
}

/**
 * O texto vira parágrafos por linha em branco — a mesma convenção de
 * `descricao` em componentes/CardAtividade.ts.
 *
 * É o máximo de formatação que existe aqui, e de propósito: sem editor de
 * texto rico e sem biblioteca (regra 7 do CLAUDE.md), o `<textarea>` do
 * painel guarda texto puro. Interpretar Markdown ou aceitar HTML seria
 * inventar um formato que a equipe não pediu — e, no caso do HTML, abrir
 * injeção de marcação dentro do site da ONG. O React escapa tudo o que passa
 * por aqui.
 *
 * `\r\n` entra na conta porque o formulário pode chegar de um celular ou de
 * um navegador que normaliza a quebra de linha para CRLF; sem isto, um texto
 * escrito no Android viraria um parágrafo só.
 */
function paragrafos(texto: string): string[] {
  return texto
    .split(/\r?\n\s*\r?\n/)
    .map((bloco) => bloco.trim())
    .filter(Boolean);
}

export function ListaNoticias(
  { publicacoes, mensagemVazio }: { publicacoes: Publicacao[]; mensagemVazio: string }
) {
  if (publicacoes.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  return createElement(
    'div',
    { className: 'lista-atividades' },
    publicacoes.map((publicacao) =>
      createElement(
        'article',
        { className: 'atividade', id: publicacao.id, key: publicacao.id },
        createElement('h2', { className: 'atividade__titulo' }, publicacao.titulo),

        // A data só aparece quando existe. Uma linha publicada sem
        // `publicado_em` é possível (alguém ligando a coluna direto pelo
        // painel do Supabase), e um `<time>` vazio ou um "Invalid Date"
        // seriam pior que a ausência.
        publicacao.publicado_em
          ? createElement(
            'p',
            { className: 'noticia__data' },
            createElement(
              'time',
              { dateTime: publicacao.publicado_em },
              dataPorExtenso(publicacao.publicado_em)
            )
          )
          : null,

        // Campo sem dado é omitido, nunca desenhado vazio — regra 2 do
        // CLAUDE.md aplicada a campo, como em CardAtividade.ts.
        // `atividade__resumo` é a classe da CHAMADA (fonte de display, corpo
        // maior) que /projetos e /agenda já usam — reaproveitada aqui porque
        // o papel é o mesmo: a frase que resume o que vem abaixo. Só a data
        // ganhou classe nova, por não existir equivalente.
        publicacao.resumo
          ? createElement('p', { className: 'atividade__resumo' }, publicacao.resumo)
          : null,

        createElement(
          Fragment,
          null,
          ...paragrafos(publicacao.corpo).map((paragrafo, indice) =>
            createElement('p', { key: indice }, paragrafo)
          )
        )
      )
    )
  );
}
