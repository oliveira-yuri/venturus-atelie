import { createElement, Fragment } from 'react';
import type { Album } from '@/servidor/dados/galeria';

/**
 * Os álbuns publicados (RF05), em /galeria — ou o estado vazio.
 *
 * Até a Tarefa P3 esta página era HTML fixo: RF05 não tinha camada de dados
 * (o site antigo também não buscava nada ali — não existe
 * site/assets/js/dados/galeria.js) e o parágrafo de estado vazio estava
 * escrito direto no `page.tsx`. Agora ele passa por aqui, COM O MESMO TEXTO
 * — o da Tarefa A4, aprovado no relatório daquela tarefa e verificado por
 * testes/paginas-vazias-a4.test.mjs, que compara as duas frases inteiras num
 * regex só. Mudar uma vírgula ali quebra a suíte de propósito.
 *
 * Mesma decisão de componentes/ListaNoticias.ts: a seção NÃO é omitida
 * quando não há nada. A lista vazia é o caso normal hoje (não existe UMA
 * autorização de uso de imagem registrada neste projeto), e o estado vazio
 * desta página é o único do site que EXPLICA o motivo — que é RN07, não
 * esquecimento.
 *
 * Escrito com createElement em vez de JSX, como os irmãos: fica um `.ts`
 * puro que o runtime nativo do Node importa e `react-dom/server` renderiza
 * dentro de um teste, sem subir o Next e sem sessão.
 *
 * ===================================================================
 * `<img>` COMUM, NÃO `next/image`
 * ===================================================================
 *
 * `next/image` exigiria `images.remotePatterns` apontando para o host do
 * Supabase no `next.config.ts` e otimização de imagem em execução — que na
 * Netlify é mais um caminho que esta branch nunca exercitou (CLAUDE.md,
 * item 0). `loading="lazy"` e `decoding="async"` dão o essencial (a galeria
 * não baixa vinte fotos de uma vez em rede de celular) sem nada disso.
 *
 * A proporção fica no CSS (`aspect-ratio` em .album__foto), e não em
 * `width`/`height`: a tabela `midia` não guarda as dimensões do arquivo, e
 * inventar um número aqui produziria imagem esticada.
 *
 * ===================================================================
 * O `alt` VEM DO BANCO, SEMPRE, E NUNCA É INVENTADO
 * ===================================================================
 *
 * A coluna é `not null` com `check (length(trim(alt)) > 0)`, e o formulário
 * do painel exige o texto sem oferecer nenhum automático: descrever a
 * imagem é trabalho de quem a viu (regra 8 do CLAUDE.md). Aqui ele só é
 * repassado — não há fallback, de propósito. Um `alt` vazio "de reserva"
 * seria a forma de a descrição sumir sem ninguém notar.
 */

export type PropsListaAlbuns = {
  albuns: Album[];
  /** O texto de estado vazio — vem da página, que é dona do conteúdo. */
  mensagemVazio: string;
};

export function ListaAlbuns({ albuns, mensagemVazio }: PropsListaAlbuns) {
  if (albuns.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  return createElement(
    Fragment,
    null,
    albuns.map((album) => createElement(
      'section',
      { className: 'album', key: album.nome },

      createElement('h2', { className: 'album__titulo' }, album.nome),

      createElement(
        'ul',
        { className: 'album__fotos' },
        album.pecas.map((peca) => createElement(
          'li',
          { className: 'album__item', key: peca.id },

          // <figure>/<figcaption> e não <div>/<p>: a legenda é legenda, e a
          // relação entre ela e a imagem existe na semântica, não só na
          // proximidade visual.
          createElement(
            'figure',
            { className: 'album__figura' },
            createElement('img', {
              className: 'album__foto',
              src: peca.url,
              alt: peca.alt,
              loading: 'lazy',
              decoding: 'async'
            }),
            // Legenda nula não vira <figcaption> vazio: a regra 2 do
            // CLAUDE.md aplicada a campo — o que não tem dado é omitido, não
            // desenhado em branco.
            peca.legenda
              ? createElement('figcaption', { className: 'album__legenda' }, peca.legenda)
              : null
          )
        ))
      )
    ))
  );
}
