import { createElement, Fragment } from 'react';
import type { MidiaComEndereco } from '@/servidor/dados/galeria';

/**
 * A lista de fotos DENTRO do painel (RF33) — o que a equipe vê ao abrir
 * /admin/galeria.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Mesmo motivo de componentes/ListaPublicacoes.ts e PainelInicio.ts: a
 * página está atrás de uma guarda que responde 404 para TODO MUNDO hoje —
 * não existe sessão de equipe utilizável (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2). Se esta lista morasse no `page.tsx`, nada nela teria
 * verificação nenhuma até alguém conseguir entrar; aqui ela é renderizada
 * por `react-dom/server` num teste do Node, sem sessão, sem Next e sem
 * navegador (testes/galeria.test.mjs).
 *
 * `acaoPorNoAr` é prop pelo mesmo motivo de `acaoAlternar` lá: Server Action
 * não pode ser importada por um teste do Node (o módulo é `'use server'` e
 * importa `server-only`), e recebendo-a como prop o teste passa uma string
 * — `<form action="/qualquer-coisa">` é HTML válido.
 *
 * ===================================================================
 * TRÊS ESTADOS, NÃO DOIS — E O TERCEIRO É A RN07
 * ===================================================================
 *
 * A lista de notícias tem dois: "No ar" e "Rascunho". Aqui há um terceiro,
 * e ele é o mais importante da tela:
 *
 *   · SEM AUTORIZAÇÃO — `autorizacao_registrada` é false. A foto está
 *     guardada e NÃO PODE ir ao ar. Não recebe botão de publicar, e o
 *     motivo está escrito ao lado, não codificado numa cor.
 *   · GUARDADA — autorizada, fora do ar.
 *   · NO AR — autorizada e publicada.
 *
 * "No ar" é desenhado a partir das DUAS colunas (`publicado &&
 * autorizacao_registrada`), e não só de `publicado`. É o que impede a tela
 * de mentir: a política de leitura do banco exige as duas, então uma linha
 * com `publicado` true e autorização false NÃO é vista por ninguém — e
 * escrever "No ar" nela faria a equipe acreditar que publicou. Esse estado
 * não deveria existir (a Action recusa criá-lo), mas alguém pode ligar a
 * coluna direto no painel do Supabase.
 *
 * ===================================================================
 * ESTA LISTA TEM APAGAR, E A DE NOTÍCIAS NÃO
 * ===================================================================
 *
 * A decisão e o porquê estão em acoes/galeria.ts (`apagarMidia`), em
 * resumo: um texto guardado e fora do ar não faz mal a ninguém; uma foto
 * guardada e fora do ar continua existindo como arquivo. Desde
 * supabase/migrations/008_galeria_privada.sql o bucket é privado e o
 * endereço vence em uma hora, então "Tirar do ar" passou a resolver — com
 * atraso de até uma hora. Para o caso urgente da RN07 (autorização
 * retirada, foto de criança subida por engano) uma hora é tempo demais, e
 * só apagar age no mesmo instante: sem arquivo, toda URL assinada viva
 * morre junto.
 *
 * O "Apagar" daqui é um LINK, não um botão de formulário: ele leva à tela
 * de confirmação (/admin/galeria/apagar?id=...), que mostra a foto e
 * pergunta. Um `confirm()` do navegador não existe sem JavaScript, e o
 * gesto sem desfazer é justamente o que não pode depender de script.
 */

const SEM_EDITAR = 'Não dá para trocar a foto nem o texto de uma que já subiu: escolher a foto '
  + 'de novo é o mesmo trabalho que subir outra. Para corrigir, suba de novo e apague esta.';

/** Os três estados, ESCRITOS — nunca só uma cor (regra 8 do CLAUDE.md). */
const NO_AR = 'No ar';
const GUARDADA = 'Guardada';
const SEM_AUTORIZACAO = 'Sem autorização de imagem';

/**
 * A frase que explica o terceiro estado. Fica no ITEM, e não no rodapé da
 * lista como o aviso geral: ela é sobre aquela foto e sobre o que fazer com
 * ela, e uma nota no fim da página obrigaria a pessoa a ligar as duas
 * coisas de cabeça.
 */
const EXPLICACAO_SEM_AUTORIZACAO = 'Esta foto não pode ir ao ar: a autorização de uso de imagem '
  + 'não foi declarada quando ela subiu. Suba de novo marcando a caixa, ou apague esta.';

/**
 * O que aparece NO LUGAR da miniatura quando a foto ficou sem endereço.
 *
 * Desde supabase/migrations/008_galeria_privada.sql o endereço de cada foto
 * é uma URL assinada, pedida ao Storage — e pedir pode falhar: o arquivo
 * não está mais no bucket (a linha ficou órfã), a política recusou, a rede
 * caiu no meio. `servidor/dados/galeria.ts` devolve `url` nula nesse caso.
 *
 * A galeria PÚBLICA omite a foto; esta lista NÃO, e a diferença é o ponto:
 * é aqui que está a pessoa que pode consertar, e o gesto que resolve
 * (apagar a linha órfã) precisa continuar ao alcance. Um `<img src="">`
 * desenharia o ícone de imagem quebrada do navegador, que não diz nada e
 * não é lido por leitor de tela.
 */
const SEM_ENDERECO = 'Não deu para carregar esta foto agora — o arquivo pode não estar mais '
  + 'guardado. Os dados abaixo são o que o site sabe sobre ela; se o arquivo sumiu, "Apagar" '
  + 'limpa a lista.';

type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaMidia = {
  midias: MidiaComEndereco[];
  /** Para onde o botão de pôr/tirar do ar manda o POST. */
  acaoPorNoAr: AcaoDeFormulario;
  /** Rota da tela de confirmação de apagar — o `?id=` é acrescentado por item. */
  caminhoApagar: string;
  /**
   * A consulta falhou? Mesma prop e mesmo motivo de ListaPublicacoes: uma
   * lista vazia numa tela onde a pessoa ACABOU de subir uma foto diria que
   * o envio se perdeu — e aqui "subir de novo" custa outra vez o plano de
   * dados dela.
   */
  degradou: boolean;
};

function dataDeEnvio(iso: string): string {
  // Fuso repetido de componentes/ListaNoticias.ts pelo mesmo motivo escrito
  // lá (o teste do Node não resolve `@/...` para VALOR), e travado pelo
  // mesmo teste que compara os arquivos.
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo'
  });
}

export function ListaMidia(
  { midias, acaoPorNoAr, caminhoApagar, degradou }: PropsListaMidia
) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar a galeria agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: atualize a página em alguns instantes.'
    );
  }

  if (midias.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma foto subiu ainda. Use o formulário acima para subir a primeira — ela fica '
      + 'guardada e só aparece no site quando você publicar.'
    );
  }

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'midias' },
      midias.map((midia) => {
        const autorizada = midia.autorizacao_registrada === true;
        // As DUAS colunas — ver o cabeçalho. Só `publicado` faria a tela
        // mentir sobre o que o público de fato vê.
        const noAr = midia.publicado === true && autorizada;

        return createElement(
          'li',
          { className: 'midia', key: midia.id },

          createElement(
            'p',
            {
              className: !autorizada
                ? 'midia__estado midia__estado--sem-autorizacao'
                : noAr ? 'midia__estado midia__estado--no-ar' : 'midia__estado'
            },
            !autorizada ? SEM_AUTORIZACAO : noAr ? NO_AR : GUARDADA
          ),

          // A MINIATURA É A FOTO DE VERDADE, reduzida por CSS: é uma tela de
          // trabalho onde a pessoa precisa reconhecer qual foto é qual, e
          // não há coluna de miniatura no banco nem serviço de redução sem
          // biblioteca nova (regra 7).
          //
          // `alt=""` e `aria-hidden`: o texto alternativo da foto está
          // escrito logo abaixo, como conteúdo da tela (é o que a equipe
          // precisa CONFERIR). Repeti-lo no `alt` faria o leitor de tela
          // ler a mesma frase duas vezes seguidas.
          //
          // `midia.url` pode ser NULA — ver SEM_ENDERECO acima.
          midia.url
            ? createElement('img', {
              className: 'midia__miniatura',
              src: midia.url,
              alt: '',
              'aria-hidden': 'true',
              loading: 'lazy',
              decoding: 'async'
            })
            : createElement('p', { className: 'midia__sem-endereco' }, SEM_ENDERECO),

          createElement('h2', { className: 'midia__album' }, midia.album),

          createElement(
            'p',
            { className: 'midia__alt' },
            createElement('strong', null, 'Descrição: '),
            midia.alt
          ),

          midia.legenda
            ? createElement(
              'p',
              { className: 'midia__legenda' },
              createElement('strong', null, 'Legenda: '),
              midia.legenda
            )
            : null,

          createElement(
            'p',
            { className: 'midia__quando' },
            `Enviada em ${dataDeEnvio(midia.criado_em)}`
          ),

          !autorizada
            ? createElement('p', { className: 'midia__impedimento' }, EXPLICACAO_SEM_AUTORIZACAO)
            : null,

          createElement(
            'div',
            { className: 'midia__botoes' },

            // O botão de publicar SÓ EXISTE para foto autorizada. Isso não é
            // a tranca (a Action recusa por conta própria — ver
            // acoes/galeria.ts) e não pretende ser: é a tela não oferecendo
            // um gesto que ela sabe que vai ser recusado.
            autorizada
              ? createElement(
                'form',
                { action: acaoPorNoAr, className: 'midia__form' },
                createElement('input', { type: 'hidden', name: 'id', value: midia.id }),
                createElement('input', {
                  type: 'hidden', name: 'acao', value: noAr ? 'despublicar' : 'publicar'
                }),
                createElement(
                  'button',
                  {
                    type: 'submit',
                    className: noAr
                      ? 'midia__botao midia__botao--tirar'
                      : 'midia__botao midia__botao--publicar'
                  },
                  noAr ? 'Tirar do ar' : 'Publicar',
                  // O álbum dentro do botão: "Publicar" repetido dez vezes
                  // numa lista não diz a quem navega por botões qual é qual.
                  createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${midia.album}`)
                )
              )
              : null,

            createElement(
              'a',
              {
                className: 'midia__botao midia__botao--apagar',
                href: `${caminhoApagar}?id=${encodeURIComponent(midia.id)}`
              },
              'Apagar',
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${midia.album}`)
            )
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, SEM_EDITAR)
  );
}
