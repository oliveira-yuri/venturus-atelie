import { createElement } from 'react';
import type { Material } from '@/servidor/dados/acervo';

/**
 * Um material do acervo com os DOIS endereços já resolvidos —
 * `arquivo_caminho` (a coluna) vira `url` (abrir para ler) e `urlDownload`
 * (baixar) ANTES de chegar aqui: as duas funções que os produzem são
 * assíncronas (precisam de `obterCliente()`, que lê `cookies()`) e este
 * componente precisa continuar síncrono e puro para ser testável com
 * react-dom/server sem o Next — ver o comentário de app/acervo/page.tsx
 * sobre onde essa resolução acontece.
 *
 * SÃO DOIS ENDEREÇOS PARA O MESMO ARQUIVO, e a diferença é uma linha de
 * consulta na URL (`?download=`), que faz o Storage responder com
 * `Content-Disposition: attachment`. O porquê de isso ser necessário — e de
 * o atributo `download` do HTML NÃO resolver — está no cabeçalho de
 * `enderecoParaBaixar`, em servidor/dados/acervo.ts.
 */
export type MaterialComUrl = Material & { url: string; urlDownload: string };

/**
 * Lista do acervo aberto (RF35/RF36) — ou o estado vazio.
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
 *
 * ===================================================================
 * DOIS LINKS POR MATERIAL, E ISSO É O RF36 (01/09/2026)
 * ===================================================================
 *
 * Até aqui havia um só: `<a href="<url>" download>Baixar material</a>`,
 * porte fiel do site antigo. **Aquele botão nunca baixou nada.** O atributo
 * `download` do HTML é IGNORADO quando o endereço é de outra origem, e o
 * arquivo mora em `<projeto>.supabase.co` enquanto a página mora no domínio
 * do site — origens diferentes SEMPRE, em qualquer ambiente. O que
 * acontecia era navegação para o PDF, com o leitor embutido do navegador
 * abrindo por cima do site.
 *
 * Agora são dois gestos separados, porque são dois desejos diferentes e a
 * própria página promete os dois ("Leia na própria página ou baixe"):
 *
 *   · ABRIR PARA LER — o endereço direto. O navegador mostra o PDF. É o
 *     caminho de quem quer só dar uma olhada, e é o mais barato para quem
 *     está no celular: ninguém guarda um arquivo de 3 MB para ler uma
 *     página. `target="_blank"` para o site não sumir por baixo do leitor,
 *     com o aviso ESCRITO dentro do link (regra 8: mudança de contexto sem
 *     explicação é o que leitor de tela não perdoa);
 *   · BAIXAR MATERIAL — o mesmo endereço com `?download=<nome>`, que é como
 *     se pede ao Storage a resposta com `Content-Disposition: attachment`.
 *     É o caminho de quem vai usar o material numa aula, e o nome do
 *     arquivo sai do título, não do uuid do caminho. **O cabeçalho da
 *     resposta não foi medido**: o bucket está vazio e subir exige sessão
 *     de equipe — ver o cabeçalho de `enderecoParaBaixar`.
 *
 * O atributo `download` continua no segundo link, de propósito: ele não faz
 * nada entre origens, mas é o que passa a valer se um dia o arquivo for
 * servido do mesmo domínio, e não custa nada. Quem faz o trabalho hoje é o
 * `?download=` da URL.
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
          { className: 'material__acoes' },
          createElement(
            'a',
            {
              className: 'botao botao--secundario',
              href: material.url,
              target: '_blank',
              rel: 'noopener'
            },
            'Abrir para ler',
            createElement(
              'span',
              { className: 'apenas-leitor-de-tela' },
              ` — ${material.titulo} (abre em outra aba)`
            )
          ),
          ' ',
          createElement(
            'a',
            { className: 'botao', href: material.urlDownload, download: true },
            'Baixar material',
            createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${material.titulo}`)
          )
        )
      );
    })
  );
}
