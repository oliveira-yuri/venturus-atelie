import { createElement, Fragment } from 'react';
import type { Publicacao } from '@/servidor/dados/publicacoes';

/**
 * A lista de notícias DENTRO do painel (RF33) — o que a equipe vê ao abrir
 * /admin/publicacoes.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Pelo mesmo motivo que fez a Tarefa P1 escrever componentes/PainelInicio.ts:
 * a página está atrás de uma guarda que responde 404 para TODO MUNDO hoje —
 * não existe sessão de equipe utilizável (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2). Se esta lista morasse no `page.tsx`, nada nela teria
 * verificação nenhuma até alguém conseguir entrar; aqui ela é renderizada
 * por `react-dom/server` num teste do Node, sem sessão, sem Next e sem
 * navegador (testes/publicacoes.test.mjs).
 *
 * A lição que motiva isso é do próprio projeto: a home do painel antigo
 * prometia seis telas inexistentes, e nada acusava — porque ninguém nunca
 * tinha aberto aquela tela.
 *
 * ===================================================================
 * `acaoAlternar` É UMA PROP, E É ELA QUE TORNA ISTO TESTÁVEL
 * ===================================================================
 *
 * O botão de publicar/tirar do ar vive dentro de um `<form>` cujo `action`,
 * na aplicação, é a Server Action `alternarPublicacao`. Server Action não
 * pode ser importada por um teste do Node (o módulo é `'use server'` e
 * importa `server-only`). Recebendo-a como prop, o teste passa uma STRING no
 * lugar — `<form action="/qualquer-coisa">` é HTML válido, e o que o teste
 * quer medir (os campos escondidos, o rótulo do botão, o estado de cada
 * item) não depende de qual função está do outro lado.
 *
 * ===================================================================
 * `<form>` DE VERDADE, UM POR ITEM
 * ===================================================================
 *
 * Não é um botão com `onClick`: é um formulário com dois campos escondidos
 * (`id` e `acao`) e um `submit`. Sem JavaScript o navegador faz o POST
 * sozinho; com JavaScript o Next intercepta. Trocar isto por um handler de
 * clique quebraria o painel inteiro para quem está sem script, em silêncio —
 * o mesmo defeito que testes/formularios-conta.test.mjs existe para pegar
 * nos formulários de conta.
 *
 * ===================================================================
 * NÃO EXISTE BOTÃO DE APAGAR, E É DECISÃO DESTA TAREFA
 * ===================================================================
 *
 * "Tirar do ar" já resolve o caso urgente (a notícia sai do site na hora, e
 * o texto continua guardado). Apagar é o único gesto sem desfazer, e ele
 * aconteceria num celular, de pé, no meio de um evento (regra 4 do
 * CLAUDE.md) — com um dedo a mais o texto some para sempre, sem lixeira e
 * sem backup. O banco permite (a política é `for all`), a tela não oferece.
 * A frase abaixo diz isso por escrito, porque um botão que não existe e não
 * é explicado vira busca frustrada.
 */

const SEM_APAGAR = 'Não dá para apagar uma notícia por aqui, de propósito: apagar não tem '
  + 'desfazer. "Tirar do ar" faz ela sumir do site na hora e guarda o texto inteiro.';

/**
 * O estado de cada item, ESCRITO — nunca só uma cor.
 *
 * É a informação mais importante da lista: decide se a notícia está no site
 * ou não. Quem enxerga vê a etiqueta; quem usa leitor de tela ouve a mesma
 * palavra (regra 8 do CLAUDE.md). O mesmo cuidado que
 * componentes/PainelInicio.ts tomou com "ainda não está pronta".
 */
const NO_AR = 'No ar';
const RASCUNHO = 'Rascunho';

/**
 * O que o `action` do `<form>` aceita — a Server Action na aplicação, uma
 * string no teste. Tipado com a assinatura real para que trocar a Action por
 * uma de outra forma não passe despercebido.
 */
type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaPublicacoes = {
  publicacoes: Publicacao[];
  /** Para onde o botão de publicar/tirar do ar manda o POST. */
  acaoAlternar: AcaoDeFormulario;
  /** Rota da tela de edição — o `?id=` é acrescentado por item. */
  caminhoEditar: string;
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * ESTA PROP É O MOTIVO DE A LISTA DO PAINEL NÃO PODER USAR O MESMO ESTADO
   * VAZIO DA PÁGINA PÚBLICA. Em /noticias, "não deu para perguntar" vira
   * "ainda não publicamos nada" e ninguém se machuca. Aqui, a pessoa acabou
   * de escrever uma notícia: uma lista vazia diria que o texto se perdeu, e
   * a reação natural é escrever tudo de novo. Com a falha declarada, ela
   * sabe que é o banco e volta depois.
   */
  degradou: boolean;
};

function dataDeCriacao(iso: string): string {
  // Fuso repetido de componentes/ListaNoticias.ts pelo mesmo motivo escrito
  // lá (o teste do Node não resolve `@/...`), e travado pelo mesmo teste.
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo'
  });
}

export function ListaPublicacoes(
  { publicacoes, acaoAlternar, caminhoEditar, degradou }: PropsListaPublicacoes
) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar a lista de notícias agora — o banco de dados não respondeu. '
      + 'Nada foi perdido: atualize a página em alguns instantes.'
    );
  }

  if (publicacoes.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma notícia escrita ainda. Use o botão "Escrever notícia" acima para começar a '
      + 'primeira — ela nasce como rascunho e só vai para o site quando você publicar.'
    );
  }

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'publicacoes' },
      publicacoes.map((publicacao) => {
        const publicada = publicacao.publicado === true;

        return createElement(
          'li',
          { className: 'publicacao', key: publicacao.id },

          createElement(
            'p',
            {
              className: publicada
                ? 'publicacao__estado publicacao__estado--no-ar'
                : 'publicacao__estado'
            },
            publicada ? NO_AR : RASCUNHO
          ),

          createElement('h2', { className: 'publicacao__titulo' }, publicacao.titulo),

          createElement(
            'p',
            { className: 'publicacao__quando' },
            `Escrita em ${dataDeCriacao(publicacao.criado_em)}`
          ),

          createElement(
            'div',
            { className: 'publicacao__botoes' },

            // Editar é um link comum: navegação, não ação. Vai antes do botão
            // de publicar porque é o gesto mais frequente e o menos
            // arriscado.
            createElement(
              'a',
              {
                className: 'publicacao__botao',
                href: `${caminhoEditar}?id=${encodeURIComponent(publicacao.id)}`
              },
              // O nome da notícia dentro do link: "Editar" repetido cinco
              // vezes numa lista não diz a quem navega por links qual é qual.
              'Editar',
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${publicacao.titulo}`)
            ),

            createElement(
              'form',
              {
                action: acaoAlternar,
                className: 'publicacao__form',
                // Confirmação do pedido V1. O atributo é lido por
                // componentes/ConfirmacaoDeAcoes.tsx, montado uma vez no
                // layout do painel — a lista não conhece o diálogo.
                'data-confirmar-titulo': publicada ? 'Tirar do ar?' : 'Publicar?',
                'data-confirmar': publicada
                  ? `"${publicacao.titulo}" sai da página de notícias e deixa de ser vista por quem visita o site. A data de publicação fica guardada.`
                  : `"${publicacao.titulo}" vai para a página de notícias e passa a ser vista por qualquer pessoa.`,
                'data-confirmar-rotulo': publicada ? 'Tirar do ar' : 'Publicar'
              },
              createElement('input', { type: 'hidden', name: 'id', value: publicacao.id }),
              createElement('input', {
                type: 'hidden', name: 'acao', value: publicada ? 'despublicar' : 'publicar'
              }),
              createElement(
                'button',
                {
                  type: 'submit',
                  className: publicada
                    ? 'publicacao__botao publicacao__botao--tirar'
                    : 'publicacao__botao publicacao__botao--publicar'
                },
                publicada ? 'Tirar do ar' : 'Publicar',
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${publicacao.titulo}`)
              )
            )
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, SEM_APAGAR)
  );
}
