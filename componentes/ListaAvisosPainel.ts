import { createElement } from 'react';
import type { AvisoDoPainel } from '../servidor/dados/avisos.ts';
import type { Evento } from '../servidor/dados/eventos.ts';
import { GRUPOS_DE_AVISO } from '../compartilhado/grupos-de-aviso.ts';

/**
 * componentes/ListaAvisosPainel.ts — os avisos, como a equipe os vê
 * (RF27/RF28).
 *
 * =====================================================================
 * TRÊS GESTOS POR LINHA, E A ORDEM DELES É A DECISÃO
 * =====================================================================
 *
 *   Editar  →  navegação, o mais frequente e o menos arriscado
 *   Publicar / Tirar do mural  →  reversível
 *   Enviar por e-mail  →  SEM DESFAZER
 *
 * O terceiro vem por último, num bloco visualmente separado, e só aparece
 * quando o aviso está PUBLICADO. Num celular, de pé, a distância entre dois
 * alvos de 44px é o que separa "publiquei" de "mandei para quarenta
 * pessoas".
 *
 * O SELETOR DE GRUPO FICA DENTRO DO FORMULÁRIO DE ENVIO, e não numa
 * configuração da tela: assim a escolha é feita no mesmo gesto do envio, e
 * não fica um valor pendurado de um envio anterior.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo dos outros
 * componentes do painel: o runtime nativo do Node o importa e o teste o
 * renderiza de verdade, sem subir o Next.
 */

type AcaoDeFormulario = (dados: FormData) => Promise<void>;

function data(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  });
}

export function ListaAvisosPainel(
  { avisos, eventos, degradou, acaoAlternar, acaoEnviar }: {
    avisos: AvisoDoPainel[];
    /** Para o grupo "inscritos em um evento". Só os publicados. */
    eventos: Evento[];
    degradou: boolean;
    acaoAlternar: AcaoDeFormulario;
    acaoEnviar: AcaoDeFormulario;
  }
) {
  if (degradou) {
    return createElement('p', { className: 'estado estado--erro' },
      'Não deu para carregar os avisos agora — o banco de dados não respondeu. Isto NÃO quer '
      + 'dizer que não há avisos. Tente de novo em alguns instantes.');
  }

  if (avisos.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' },
      'Nenhum aviso escrito ainda. Use "Escrever aviso" para criar o primeiro — ele fica '
      + 'guardado como rascunho até você publicar.');
  }

  return createElement(
    'ul',
    { className: 'lista-painel' },
    avisos.map((aviso) => {
      const publicado = aviso.publicado;

      return createElement(
        'li',
        { className: 'cartao-painel', key: aviso.id, 'data-publicado': publicado ? 'sim' : 'nao' },

        createElement('h3', { className: 'cartao-painel__titulo' }, aviso.titulo),

        createElement(
          'p',
          { className: 'cartao-painel__marcas' },
          publicado
            ? createElement('span', { className: 'etiqueta etiqueta--sim' }, 'No mural')
            : createElement('span', { className: 'etiqueta etiqueta--neutra' }, 'Rascunho'),
          aviso.publicado_em
            ? createElement('span', { className: 'cartao-painel__data' },
              ` publicado em ${data(aviso.publicado_em)}`)
            : null
        ),

        // O corpo dentro de um <details>: a lista fica navegável a 375px, e
        // o texto continua ali sem depender de JavaScript.
        createElement(
          'details',
          { className: 'cartao-painel__corpo' },
          createElement('summary', null, 'Ver o texto'),
          createElement('p', null, aviso.corpo)
        ),

        createElement(
          'div',
          { className: 'evento-painel__botoes' },

          createElement(
            'a',
            {
              className: 'evento-painel__botao',
              href: `/admin/avisos/editar?id=${encodeURIComponent(aviso.id)}`
            },
            'Editar',
            createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${aviso.titulo}`)
          ),

          createElement(
            'form',
            {
              action: acaoAlternar,
              className: 'evento-painel__form',
              'data-confirmar-titulo': publicado ? 'Tirar do mural?' : 'Publicar no mural?',
              'data-confirmar': publicado
                ? `"${aviso.titulo}" some do mural. Quem já recebeu por e-mail continua com o e-mail.`
                : `"${aviso.titulo}" aparece no mural para quem é voluntário ativo. Isso NÃO manda e-mail.`,
              'data-confirmar-rotulo': publicado ? 'Tirar do mural' : 'Publicar'
            },
            createElement('input', { type: 'hidden', name: 'id', value: aviso.id }),
            createElement('input', {
              type: 'hidden', name: 'acao', value: publicado ? 'despublicar' : 'publicar'
            }),
            createElement('button', { type: 'submit', className: 'evento-painel__botao' },
              publicado ? 'Tirar do mural' : 'Publicar')
          )
        ),

        /*
          O ENVIO, separado do resto — ver o cabeçalho. Só existe para aviso
          PUBLICADO: um botão "enviar" ao lado de um rascunho é um convite
          para o único gesto do painel que não tem desfazer.
        */
        publicado
          ? createElement(
            'form',
            {
              action: acaoEnviar,
              className: 'aviso-envio',
              'data-confirmar-titulo': 'Enviar por e-mail?',
              'data-confirmar': `"${aviso.titulo}" vai por e-mail para o grupo escolhido. `
                + 'E-mail enviado NÃO volta. Quem já recebeu este aviso antes não recebe de novo.',
              'data-confirmar-rotulo': 'Enviar agora'
            },
            createElement('input', { type: 'hidden', name: 'id', value: aviso.id }),

            createElement(
              'label',
              { className: 'aviso-envio__campo', htmlFor: `grupo-${aviso.id}` },
              'Enviar por e-mail para:'
            ),
            createElement(
              'select',
              { id: `grupo-${aviso.id}`, name: 'grupo', className: 'aviso-envio__select' },
              GRUPOS_DE_AVISO.map((grupo) =>
                createElement('option', { key: grupo.chave, value: grupo.chave }, grupo.rotulo))
            ),

            // O evento só serve a UM dos grupos. Ele fica sempre visível,
            // porque escondê-lo exigiria JavaScript — e sem script a pessoa
            // veria a recusa "escolha o evento" apontando para um campo que
            // nunca apareceu. Mesma decisão dos campos de responsável em
            // componentes/FormularioInscricao.tsx.
            eventos.length > 0
              ? createElement(
                'span',
                { className: 'aviso-envio__evento' },
                createElement('label', { htmlFor: `evento-${aviso.id}` },
                  'Se escolher "inscritos", diga qual evento:'),
                createElement(
                  'select',
                  { id: `evento-${aviso.id}`, name: 'evento_id', className: 'aviso-envio__select' },
                  createElement('option', { value: '' }, '— nenhum —'),
                  eventos.map((evento) =>
                    createElement('option', { key: evento.id, value: evento.id }, evento.titulo))
                )
              )
              : null,

            createElement('button', { type: 'submit', className: 'aviso-envio__botao' },
              'Enviar por e-mail')
          )
          : null
      );
    })
  );
}
