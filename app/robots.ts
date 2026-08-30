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
 * PRÉVIA: REMOVER NO LANÇAMENTO — E SÃO TRÊS LUGARES, NÃO SÓ ESTE.
 *
 *   1. este arquivo: trocar o `disallow: '/'` por `allow: '/'`;
 *   2. `X-Robots-Tag` em middleware.ts (procure por "PREVIA") — vale para
 *      as páginas renderizadas;
 *   3. `X-Robots-Tag` em netlify.toml — vale para o que a CDN serve
 *      direto, inclusive os caminhos que o `matcher` do middleware exclui.
 *
 * Os três saem JUNTOS. Fazer um só não produz erro visível nenhum: o site
 * sobe, as pessoas navegam, os testes passam, e o site simplesmente não
 * aparece em busca. Um `X-Robots-Tag: noindex` que sobreviva vence este
 * arquivo — robots.txt controla o RASTREIO, o cabeçalho controla a
 * INDEXAÇÃO, e a ONG precisa dos dois abertos para ser encontrada.
 *
 * Quando os três saírem, apagar também a entrada correspondente em
 * "O que trava hoje", no CLAUDE.md — e o segundo teste de
 * `testes/noindex.test.mjs`, que existe para quebrar exatamente uma vez, no
 * lançamento. Esse arquivo é o que impede tudo isto de depender de alguém
 * ler três comentários: ele mede os três e falha se um sair sozinho.
 * =====================================================================
 *
 * `sitemap` fica de fora de propósito: não existe `app/sitemap.ts` neste
 * projeto, e apontar para um arquivo que responde 404 é pior que não
 * apontar. Entra junto com o sitemap, se e quando ele existir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/'
    }
  };
}
