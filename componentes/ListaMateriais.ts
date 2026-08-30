import { createElement } from 'react';
import type { Material } from '@/servidor/dados/acervo';

/**
 * Um material do acervo com o endereço público do arquivo já resolvido —
 * `arquivo_caminho` (a coluna) vira `url` (o link de download) ANTES de
 * chegar aqui: enderecoDoArquivo() é assíncrona (precisa de obterCliente(),
 * que lê cookies()) e este componente precisa continuar síncrono e puro
 * para ser testável com react-dom/server sem o Next — ver o comentário de
 * app/acervo/page.tsx sobre onde essa resolução acontece.
 */
export type MaterialComUrl = Material & { url: string };

/**
 * Lista do acervo aberto (RF35) — ou o estado vazio.
 *
 * Porta a parte de apresentação de site/assets/js/paginas/acervo.js
 * (desenhar + as duas mensagens de estado vazio: sem filtro, e busca sem
 * resultado). A busca do dado mora em servidor/dados/acervo.ts, chamada
 * direto pelo servidor em app/acervo/page.tsx.
 *
 * Mesma decisão da Tarefa A4 documentada em componentes/ListaEventos.ts:
 * a tabela `acervo` está vazia hoje, e a lista vazia é o caso NORMAL, não
 * uma seção a omitir (ao contrário de componentes/SecaoNaMidia.ts e
 * componentes/SecaoOndeEstivemos.ts) — por isso sempre desenha os cartões
 * OU um parágrafo `.estado.estado--vazio` com texto real, nunca nada.
 *
 * Escrito com createElement, não JSX — mesmo motivo de CardAtividade.ts e
 * ListaEventos.ts: fica um .ts puro, testável com react-dom/server pelo
 * runtime nativo do Node — ver testes/lista-materiais.test.mjs.
 */

/** Tamanho legível, mesma conta de site/assets/js/paginas/acervo.js. */
function tamanhoLegivel(bytes: number | null): string | null {
  if (!bytes) return null;
  const mega = bytes / (1024 * 1024);
  return mega >= 1 ? `${mega.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function ListaMateriais({
  materiais,
  mensagemVazio
}: {
  materiais: MaterialComUrl[];
  mensagemVazio: string;
}) {
  if (materiais.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  return createElement(
    'div',
    { className: 'lista-atividades' },
    materiais.map((material) => {
      const tamanho = tamanhoLegivel(material.tamanho_bytes);
      const ficha: Array<[string, string]> = [
        ...(material.tema ? [['Tema', material.tema] as [string, string]] : []),
        ...(material.faixa_etaria ? [['Para', material.faixa_etaria] as [string, string]] : []),
        ...(tamanho ? [['Tamanho', tamanho] as [string, string]] : [])
      ];

      return createElement(
        'article',
        { className: 'atividade', id: material.id, key: material.id },
        createElement('h3', { className: 'atividade__titulo' }, material.titulo),
        material.descricao ? createElement('p', null, material.descricao) : null,
        ficha.length > 0
          ? createElement(
              'dl',
              { className: 'atividade__ficha' },
              ficha.map(([rotulo, valor]) =>
                createElement(
                  'div',
                  { key: rotulo },
                  createElement('dt', null, rotulo),
                  createElement('dd', null, valor)
                )
              )
            )
          : null,
        createElement(
          'p',
          null,
          createElement('a', { className: 'botao', href: material.url, download: true }, 'Baixar material')
        )
      );
    })
  );
}
