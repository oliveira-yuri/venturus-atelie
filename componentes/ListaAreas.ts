import { createElement, Fragment } from 'react';
import type { Area } from '@/servidor/dados/voluntariado';

/**
 * Lista das áreas de voluntariado (RF24) — "Onde você pode ajudar" — ou o
 * estado vazio.
 *
 * Porta a parte de apresentação de site/assets/js/paginas/voluntariado.js
 * (o `.map()` dentro de `renderizarEstado`): a busca do dado agora mora em
 * servidor/dados/voluntariado.ts, chamada direto pelo servidor em
 * app/voluntariado/page.tsx.
 *
 * DIFERENTE de componentes/ListaEventos.ts e componentes/ListaMateriais.ts
 * (Tarefa A4): ali a lista vazia era o caso NORMAL, porque as tabelas
 * `eventos`/`acervo` estão vazias hoje em produção. Aqui é o oposto —
 * `areas_voluntariado` TEM as cinco áreas reais semeadas (supabase/
 * seed.sql) — e a lista só vem vazia em modo offline (`npm test`, sem
 * SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL), porque, ao contrário de
 * atividades/clipping, esta tabela não tem JSON versionado irmão para
 * servir de fallback local (ver o comentário de servidor/dados/
 * voluntariado.ts). Mesmo o caso vazio sendo excepcional aqui, o
 * tratamento é o MESMO dos dois componentes irmãos, pelo mesmo motivo:
 * uma seção com só o <h2> "Onde você pode ajudar" e nada embaixo é o
 * defeito que motivou aquele padrão — por isso este componente também
 * sempre desenha algo, os cartões OU um parágrafo `.estado.estado--vazio`
 * com o texto real que já existia em voluntariado.js (`mensagemVazio` do
 * `renderizarEstado`), nunca nada.
 *
 * Escrito com createElement, não JSX — mesmo motivo dos dois componentes
 * irmãos: fica um .ts puro, testável com react-dom/server pelo runtime
 * nativo do Node — ver testes/lista-areas.test.mjs.
 */
export function ListaAreas({ areas, mensagemVazio }: { areas: Area[]; mensagemVazio: string }) {
  if (areas.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  // Sem <div> de agrupamento em volta dos cartões, de propósito — diferente
  // de ListaEventos/ListaMateriais (que embrulham em `.lista-atividades`
  // para o grid de `estilos/componentes.css`): `.setor` já tem
  // `margin-bottom` própria (estilos/base.css) para se empilhar sozinha, e
  // o original (site/assets/js/paginas/voluntariado.js) também não
  // embrulhava — o `.map().join('')` ali gerava os `<article>` direto como
  // filhos de `#lista-areas`. Fragment evita um <div> sem estilo nenhum que
  // não existia no original.
  return createElement(
    Fragment,
    null,
    areas.map((area) =>
      createElement(
        'article',
        { className: 'setor', key: area.id },
        createElement('h3', null, area.nome),
        createElement('p', null, area.descricao)
      )
    )
  );
}
