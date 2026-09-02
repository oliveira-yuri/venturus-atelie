import { createElement, Fragment } from 'react';
import type { EventoDoPainel } from '@/servidor/dados/eventos';

/**
 * A lista de eventos DENTRO do painel (RF13/RF33) — o que a equipe vê ao
 * abrir /admin/eventos.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * O mesmo motivo de componentes/ListaPublicacoes.ts, ListaMidia.ts,
 * ListaAtividades.ts e ListaContatos.ts: a página está atrás de uma guarda
 * que responde 404 para todo mundo hoje — não existe conta com `eh_equipe`
 * neste projeto (CLAUDE.md, "O que trava hoje", itens 2 e 3). Se esta lista
 * morasse no `page.tsx`, nada nela teria verificação nenhuma até alguém
 * conseguir entrar; aqui ela é renderizada por `react-dom/server` num teste
 * do Node, sem sessão, sem Next e sem navegador (testes/eventos.test.mjs).
 *
 * ===================================================================
 * `acaoAlternar` É UMA PROP, E É ELA QUE TORNA ISTO TESTÁVEL
 * ===================================================================
 *
 * O botão de publicar/tirar do ar vive dentro de um `<form>` cujo `action`,
 * na aplicação, é a Server Action `alternarEvento`. Server Action não pode
 * ser importada por um teste do Node (o módulo é `'use server'` e importa
 * `server-only`). Recebendo-a como prop, o teste passa uma STRING no lugar —
 * `<form action="/qualquer-coisa">` é HTML válido, e o que o teste quer
 * medir (os campos escondidos, o rótulo do botão, o estado de cada item) não
 * depende de qual função está do outro lado.
 *
 * ===================================================================
 * `<form>` DE VERDADE, UM POR ITEM
 * ===================================================================
 *
 * Não é um botão com `onClick`: é um formulário com dois campos escondidos
 * (`id` e `acao`) e um `submit`. Sem JavaScript o navegador faz o POST
 * sozinho; com JavaScript o Next intercepta. Trocar isto por um handler de
 * clique quebraria o painel para quem está sem script, em silêncio.
 *
 * ===================================================================
 * NÃO EXISTE BOTÃO DE APAGAR, E AQUI O MOTIVO É MAIOR QUE NAS NOTÍCIAS
 * ===================================================================
 *
 * Vale tudo o que componentes/ListaPublicacoes.ts diz — apagar é o único
 * gesto sem desfazer, e ele aconteceria num celular, de pé, no meio de um
 * evento (regra 4 do CLAUDE.md) — e há um segundo motivo, deste esquema:
 * `inscricoes.evento_id` referencia `eventos(id)` com `on delete cascade`
 * (003_eventos.sql). Apagar um evento apagaria junto, em silêncio, a lista
 * de quem se inscreveu nele. O banco permite; a tela não oferece, e a frase
 * abaixo diz isso por escrito — um botão que não existe e não é explicado
 * vira busca frustrada.
 */

const SEM_APAGAR = 'Não dá para apagar um evento por aqui, de propósito: apagar não tem '
  + 'desfazer, e apagaria junto a lista de quem se inscreveu. "Tirar do ar" faz o evento sumir '
  + 'da agenda na hora e guarda tudo o que você escreveu.';

/**
 * O QUE A AGENDA AINDA NÃO FAZ, dito na tela de quem publica nela.
 *
 * A página /agenda tem, desde o site antigo, um parágrafo dizendo que "para
 * se inscrever não é preciso criar conta — basta preencher o formulário do
 * evento". Esse formulário é a RF15 e NÃO EXISTE. Enquanto a agenda estava
 * vazia ninguém batia nessa promessa; a partir do primeiro evento publicado,
 * ela passa a ser lida por quem quer participar.
 *
 * Isto não é um problema que esta tela possa consertar (o texto de /agenda é
 * conteúdo da ONG, comparado palavra por palavra com o HTML original em
 * testes/paridade-texto.test.mjs), mas é um problema que a equipe precisa
 * saber que existe ANTES de publicar o primeiro evento — senão ela descobre
 * pelo telefone, com alguém perguntando onde fica o botão.
 */
const SEM_INSCRICAO = 'O site ainda não tem formulário de inscrição: quem quiser participar vai '
  + 'procurar o WhatsApp ou o e-mail da ONG. Se o evento tiver vaga limitada, escreva isso na '
  + 'descrição.';

/**
 * O estado de cada item, ESCRITO — nunca só uma cor.
 *
 * É a informação mais importante da lista: decide se o evento está na agenda
 * ou não. Quem enxerga vê a etiqueta; quem usa leitor de tela ouve a mesma
 * palavra (regra 8 do CLAUDE.md).
 */
const NO_AR = 'Na agenda';
const RASCUNHO = 'Rascunho';

/**
 * O FUSO É EXPLÍCITO AQUI, e essa linha é a correção de um defeito real da
 * migração — o mesmo bloco que componentes/ListaEventos.ts carrega, e pela
 * mesma razão: função da Netlify roda em UTC, e um evento das 19h de São
 * Paulo sairia às 22:00, mudando inclusive o DIA quando for de fim de noite.
 *
 * A cópia é consciente: este arquivo é importado pelo runtime nativo do
 * Node, que não resolve o alias `@/...` do tsconfig, então um módulo
 * compartilhado quebraria o teste que o mede. O que impede as cópias de
 * divergirem em silêncio é o teste que lê os arquivos como TEXTO e exige o
 * mesmo fuso em todos (testes/eventos.test.mjs, seção do fuso).
 */
const FUSO_DA_ONG = 'America/Sao_Paulo';

/**
 * Dia, mês e hora — o que a equipe precisa reconhecer numa lista.
 *
 * Mais curto que o `quando()` da agenda pública (que escreve o dia da semana
 * e o mês por extenso): ali o texto é para quem está decidindo se vai; aqui
 * é para quem está procurando um item numa lista, no celular, e uma linha
 * comprida rouba a largura do título.
 */
function quando(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO_DA_ONG
  });
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: FUSO_DA_ONG
  });
  return `${dia}, às ${hora}`;
}

/**
 * O que o `action` do `<form>` aceita — a Server Action na aplicação, uma
 * string no teste. Tipado com a assinatura real para que trocar a Action por
 * uma de outra forma não passe despercebido.
 */
type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaEventosPainel = {
  eventos: EventoDoPainel[];
  /** Para onde o botão de publicar/tirar do ar manda o POST. */
  acaoAlternar: AcaoDeFormulario;
  /** Rota da tela de edição — o `?id=` é acrescentado por item. */
  caminhoEditar: string;
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * ESTA PROP É O MOTIVO DE A LISTA DO PAINEL NÃO PODER USAR O MESMO ESTADO
   * VAZIO DA AGENDA PÚBLICA. Em /agenda, "não deu para perguntar" vira
   * "nenhuma atividade marcada por enquanto" e ninguém se machuca. Aqui, a
   * pessoa acabou de cadastrar um evento: uma lista vazia diria que o
   * cadastro se perdeu, e a reação natural é cadastrar de novo — dois
   * eventos iguais na agenda, e nenhuma tela que apague um deles.
   */
  degradou: boolean;
};

export function ListaEventosPainel(
  { eventos, acaoAlternar, caminhoEditar, degradou }: PropsListaEventosPainel
) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar a agenda agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: atualize a página em alguns instantes.'
    );
  }

  if (eventos.length === 0) {
    return createElement(
      Fragment,
      null,
      createElement(
        'p',
        { className: 'estado estado--vazio' },
        'Nenhum evento cadastrado ainda. Use o botão "Cadastrar evento" acima para marcar o '
        + 'primeiro — ele nasce como rascunho e só aparece na agenda do site quando você '
        + 'publicar.'
      ),
      createElement('p', { className: 'painel__aviso' }, SEM_INSCRICAO)
    );
  }

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'eventos-painel' },
      eventos.map((evento) => {
        const publicado = evento.publicado === true;

        return createElement(
          'li',
          { className: 'evento-painel', key: evento.id },

          createElement(
            'p',
            {
              className: publicado
                ? 'evento-painel__estado evento-painel__estado--no-ar'
                : 'evento-painel__estado'
            },
            publicado ? NO_AR : RASCUNHO
          ),

          createElement('h2', { className: 'evento-painel__titulo' }, evento.titulo),

          // O `<time>` carrega a string ISO crua no atributo e a hora de São
          // Paulo no texto. É o texto que a pessoa lê, e é ele que o teste
          // mede — o atributo sai igual em qualquer fuso, e foi essa
          // diferença que deixou o defeito de fuso passar uma vez.
          createElement(
            'p',
            { className: 'evento-painel__quando' },
            createElement('time', { dateTime: evento.comeca_em }, quando(evento.comeca_em)),
            evento.local ? ` · ${evento.local}` : null
          ),

          createElement(
            'div',
            { className: 'evento-painel__botoes' },

            // Editar é um link comum: navegação, não ação. Vai antes do botão
            // de publicar porque é o gesto mais frequente e o menos
            // arriscado.
            createElement(
              'a',
              {
                className: 'evento-painel__botao',
                href: `${caminhoEditar}?id=${encodeURIComponent(evento.id)}`
              },
              // O nome do evento dentro do link: "Editar" repetido cinco
              // vezes numa lista não diz a quem navega por links qual é qual.
              'Editar',
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${evento.titulo}`)
            ),

            createElement(
              'form',
              {
                action: acaoAlternar,
                className: 'evento-painel__form',
                'data-confirmar-titulo': publicado ? 'Tirar da agenda?' : 'Publicar na agenda?',
                'data-confirmar': publicado
                  ? `"${evento.titulo}" sai da agenda pública. Quem já se inscreveu continua inscrito.`
                  : `"${evento.titulo}" vai para a agenda e passa a aceitar inscrições.`,
                'data-confirmar-rotulo': publicado ? 'Tirar da agenda' : 'Publicar'
              },
              createElement('input', { type: 'hidden', name: 'id', value: evento.id }),
              createElement('input', {
                type: 'hidden', name: 'acao', value: publicado ? 'despublicar' : 'publicar'
              }),
              createElement(
                'button',
                {
                  type: 'submit',
                  className: publicado
                    ? 'evento-painel__botao evento-painel__botao--tirar'
                    : 'evento-painel__botao evento-painel__botao--publicar'
                },
                publicado ? 'Tirar do ar' : 'Publicar',
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${evento.titulo}`)
              )
            )
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, SEM_INSCRICAO),
    createElement('p', { className: 'painel__aviso' }, SEM_APAGAR)
  );
}
