import type { MetadataRoute } from 'next';

/**
 * /robots.txt — o arquivo que voltou a existir.
 *
 * O site estático tinha `site/robots.txt`, e ele carregava a instrução de
 * lançamento no topo, em comentário:
 *
 *     # Para o lancamento: apagar as duas linhas abaixo e remover o
 *     # X-Robots-Tag do netlify.toml.
 *     User-agent: *
 *     Disallow: /
 *
 * A Tarefa A8 apagou `site/`, e a instrução morreu com o arquivo. Desde
 * então `/robots.txt` respondia 404 e a única marca de "isto é temporário"
 * era um comentário em middleware.ts que falava de UM dos dois cabeçalhos.
 * Este arquivo devolve as duas coisas: o robots e a instrução.
 *
 * =====================================================================
 * PRÉVIA: REMOVER NO LANÇAMENTO — E SÃO QUATRO LUGARES, NÃO SÓ ESTE.
 *
 *   1. este arquivo: trocar o `disallow: '/'` por `allow: '/'`;
 *   2. `X-Robots-Tag` em middleware.ts (procure por "PREVIA") — vale para
 *      as páginas renderizadas, nas duas plataformas;
 *   3. `X-Robots-Tag` em netlify.toml — vale para o que a CDN serve
 *      direto, inclusive os caminhos que o `matcher` do middleware exclui;
 *   4. `X-Robots-Tag` em vercel.json — o equivalente do 3 na outra
 *      plataforma, desde que o projeto passou a poder rodar nas duas. O
 *      aviso inteiro está em `vercel.json.LEIA-ME.txt`, e mora num arquivo
 *      separado porque a Vercel recusa comentário dentro do `vercel.json`.
 *
 * Os quatro saem JUNTOS. Fazer um só não produz erro visível nenhum: o site
 * sobe, as pessoas navegam, os testes passam, e o site simplesmente não
 * aparece em busca. Um `X-Robots-Tag: noindex` que sobreviva vence este
 * arquivo — robots.txt controla o RASTREIO, o cabeçalho controla a
 * INDEXAÇÃO, e a ONG precisa dos dois abertos para ser encontrada.
 *
 * Quando os quatro saírem, apagar também a entrada correspondente em
 * "O que trava hoje", no CLAUDE.md — e o segundo teste de
 * `testes/noindex.test.mjs`, que existe para quebrar exatamente uma vez, no
 * lançamento. Esse arquivo é o que impede tudo isto de depender de alguém
 * ler quatro avisos: ele mede os quatro e falha se um sair sozinho.
 * =====================================================================
 *
 * `sitemap` fica de fora de propósito: não existe `app/sitemap.ts` neste
 * projeto, e apontar para um arquivo que responde 404 é pior que não
 * apontar. Entra junto com o sitemap, se e quando ele existir.
 */

/**
 * As rotas que ficam fora do buscador **mesmo depois do lançamento** — e é
 * por isso que elas moram numa constante separada do `disallow: '/'` da
 * prévia, que sai.
 *
 * As duas são pontas do fluxo de e-mail (Tarefa 2 da autenticação):
 *
 *  - `/auth/confirm` só faz sentido com um `token_hash` de uso único na
 *    query, que chega no link do e-mail de uma pessoa específica;
 *  - `/nova-senha` só faz sentido logo depois dele, com a sessão que ele
 *    acabou de gravar.
 *
 * Rastreador que as visita não encontra nada de útil — encontra a tela de
 * "este link não vale mais", porque é isso que as duas respondem sem token
 * e sem sessão. Pior: se um link de e-mail vazar para um lugar público (um
 * grupo de WhatsApp encaminhado, um print), o rastreador ABRE o link e
 * GASTA o token, que é de uso único; quem recebeu o e-mail clica depois e
 * descobre que o link "já não vale", sem entender por quê.
 *
 * NÃO É PROTEÇÃO DE SEGREDO, e não deve ser confundida com uma: o token
 * viaja na query e quem tiver o link entra. Isto reduz ruído e um modo de
 * falha real; a validade curta e o uso único do token é que são a defesa.
 *
 * A TERCEIRA ENTRADA, `/admin`, chega com a Tarefa P1 do painel (RF33) e
 * tem outro motivo: o painel não é conteúdo público. `Disallow: /admin`
 * cobre também tudo o que P2/P3/P4 pendurarem embaixo
 * (`/admin/publicacoes`, `/admin/galeria`, `/admin/atividades`), porque a
 * regra do robots.txt é por prefixo.
 *
 * O INCÔMODO DESTA LINHA, dito em voz alta porque ele é real: robots.txt é
 * um arquivo PÚBLICO, então escrever `/admin` aqui NOMEIA o caminho do
 * painel para qualquer pessoa que abra `/robots.txt` — e o painel responde
 * 404 a quem não é equipe justamente para não confirmar que existe
 * (app/admin/layout.tsx). Pesado dos dois lados, a linha fica:
 *
 *   · `/admin` é o caminho mais adivinhável que existe. A lista de
 *     endereços de painel que um rastreador tenta sozinho começa nele;
 *   · `Disallow` não prova existência nenhuma — bloquear caminho que não
 *     existe é comum e não diz nada a quem lê;
 *   · o que ela evita é concreto: no dia em que o `noindex` de prévia sair
 *     (item 0c do CLAUDE.md), um link de painel que vaze num print, num
 *     grupo de WhatsApp ou no histórico de um navegador compartilhado
 *     poderia levar uma página autenticada para o índice de um buscador.
 *
 * O que de fato protege continua sendo a guarda (404) e a RLS; isto é
 * higiene, e o `noindex` da própria página (metadata em
 * app/admin/layout.tsx) é a metade que não depende de ninguém obedecer ao
 * robots.txt.
 */
/**
 * A QUARTA ENTRADA, `/minha-conta`, chega com a RF11 (área do usuário) e
 * tem o motivo do `/admin`, não o das duas de e-mail: não é conteúdo
 * público. A tela mostra nome, e-mail, telefone e histórico de doação de
 * uma pessoa.
 *
 * O incômodo aqui é MENOR que o do `/admin`: nomear `/minha-conta` num
 * arquivo público não conta nada que o site já não diga — há um "Entrar" no
 * cabeçalho de toda página, e a existência de contas é o assunto de
 * /entrar. E não há o que indexar: um rastreador anônimo é REDIRECIONADO
 * para /entrar (a guarda de app/minha-conta/page.tsx), então o que ele
 * arquivaria seria a tela de entrar com o endereço errado na frente.
 *
 * A defesa de verdade continua sendo a guarda e a RLS; isto é higiene, e o
 * `noindex` da própria página (o `robots` do `generateMetadata`, em
 * app/minha-conta/page.tsx) é a metade que não depende de ninguém obedecer
 * ao robots.txt.
 */
const FORA_DO_BUSCADOR = ['/auth/confirm', '/nova-senha', '/admin', '/minha-conta'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // NO LANÇAMENTO, esta linha vira `allow: '/'` — e o `...` some junto
      // com ela, mas `FORA_DO_BUSCADOR` FICA, como segundo campo:
      //
      //     allow: '/',
      //     disallow: FORA_DO_BUSCADOR
      //
      // Enquanto a prévia dura, `'/'` já bloqueia tudo e as duas rotas são
      // redundantes. Elas estão aqui desde já porque o dia do lançamento é
      // o dia de mexer em quatro arquivos ao mesmo tempo, e é o pior momento
      // para lembrar de acrescentar uma exceção que ninguém escreveu ainda.
      // `testes/noindex.test.mjs` tem um teste só para elas, que NÃO sai no
      // lançamento — ao contrário do teste de "modo prévia", que sai.
      disallow: ['/', ...FORA_DO_BUSCADOR]
    }
  };
}
