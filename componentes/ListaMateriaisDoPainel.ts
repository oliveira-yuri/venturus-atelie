import { createElement, Fragment } from 'react';
import type { MaterialDoPainel } from '@/servidor/dados/acervo';

/**
 * A lista de materiais DENTRO do painel (RF37) — o que a equipe vê ao abrir
 * /admin/acervo.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Mesmo motivo de componentes/ListaMidia.ts e ListaPublicacoes.ts: a página
 * está atrás de uma guarda que responde 404 para TODO MUNDO hoje — ninguém
 * concedeu `eh_equipe` a conta nenhuma (CLAUDE.md, "O que trava hoje", item
 * 2). Se esta lista morasse no `page.tsx`, nada nela teria verificação
 * nenhuma até alguém conseguir entrar; aqui ela é renderizada por
 * `react-dom/server` num teste do Node, sem sessão, sem Next e sem
 * navegador (testes/acervo.test.mjs).
 *
 * `acaoAlternar` é prop pelo mesmo motivo de `acaoPorNoAr` lá: Server Action
 * não pode ser importada por um teste do Node (o módulo é `'use server'` e
 * importa `server-only`), e recebendo-a como prop o teste passa uma string
 * — `<form action="/qualquer-coisa">` é HTML válido.
 *
 * ===================================================================
 * DOIS ESTADOS, E UM LINK QUE A GALERIA NÃO PRECISA TER
 * ===================================================================
 *
 * Estados: NO AR e GUARDADO. Não há o terceiro da galeria ("sem
 * autorização") porque a RN07 é sobre imagem de pessoa, e material de
 * acervo é documento (ver o cabeçalho de acoes/acervo.ts).
 *
 * O QUE ESTA LISTA TEM E A DA GALERIA NÃO: um link "Abrir o arquivo" em
 * cada item. Lá a miniatura É a foto, e reconhecer qual é qual é olhar. Um
 * PDF não tem miniatura — e não há como gerar uma sem biblioteca nova
 * (regra 7 do CLAUDE.md). Sem um jeito de ABRIR o arquivo, a equipe não tem
 * como confirmar que o que subiu foi mesmo o material certo, que é
 * justamente o erro que "Apagar" existe para corrigir.
 *
 * O link abre em outra aba (`target="_blank"`), e isso está ESCRITO no
 * próprio link para quem usa leitor de tela: sem o aviso, a aba nova é uma
 * mudança de contexto sem explicação (regra 8). `rel="noopener"` porque é
 * link para outra origem — o Storage do Supabase.
 *
 * ===================================================================
 * ESTA LISTA TEM APAGAR, E A DE NOTÍCIAS NÃO
 * ===================================================================
 *
 * A decisão e o porquê estão em acoes/acervo.ts (`apagarMaterial`), em
 * resumo: o bucket `acervo` é PÚBLICO de propósito (download livre é o
 * requisito RF36), então "Tirar do ar" mexe só na tabela — o arquivo
 * continua baixável por quem tiver o endereço, sem prazo nenhum. Quando o
 * que subiu foi o arquivo errado, só apagar resolve.
 *
 * O "Apagar" daqui é um LINK, não um botão de formulário: ele leva à tela
 * de confirmação (/admin/acervo/apagar?id=...), que mostra a ficha e
 * pergunta. Um `confirm()` do navegador não existe sem JavaScript, e o
 * gesto sem desfazer é justamente o que não pode depender de script.
 */

/**
 * Um material do painel com o endereço do arquivo já resolvido.
 *
 * A resolução acontece na PÁGINA, e não aqui, pelo mesmo motivo de
 * `MaterialComUrl` em componentes/ListaMateriais.ts: `enderecoDoArquivo()` é
 * assíncrona (precisa de `obterCliente()`, que lê `cookies()`) e este
 * componente precisa continuar síncrono e puro para ser testável com
 * react-dom/server sem o Next.
 */
export type MaterialDoPainelComUrl = MaterialDoPainel & { url: string };

/** Os dois estados, ESCRITOS — nunca só uma cor (regra 8 do CLAUDE.md). */
const NO_AR = 'No ar';
const GUARDADO = 'Guardado';

/**
 * O aviso permanente do rodapé da lista. Fica FORA do item, uma vez só:
 * repetir a mesma frase em cada material é ruído para quem enxerga e é a
 * mesma leitura repetida para quem usa leitor de tela.
 *
 * ELE DIZ A COISA QUE A TELA SOZINHA FARIA PARECER FALSA: "Tirar do ar" não
 * tira o arquivo do ar. Sem esta frase, quem subiu o arquivo errado usaria
 * o botão mais próximo e acharia que resolveu.
 */
const AVISO_DO_BUCKET_PUBLICO = 'Os arquivos do acervo ficam num endereço público, porque eles '
  + 'existem para ser baixados por qualquer pessoa, sem cadastro. Por isso "Tirar do ar" só '
  + 'esconde o material desta página do site: quem já tiver o endereço do arquivo continua '
  + 'conseguindo abri-lo. Se subiu o arquivo ERRADO, use "Apagar" — é o único que remove o '
  + 'arquivo de verdade.';

/** Sem tela de editar, e a ausência precisa estar escrita para não virar busca. */
const SEM_EDITAR = 'Não dá para trocar o arquivo nem o texto de um material que já subiu: '
  + 'escolher o arquivo de novo é o mesmo trabalho que subir outro. Para corrigir, suba de novo '
  + 'e apague este.';

type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaMateriaisDoPainel = {
  materiais: MaterialDoPainelComUrl[];
  /** Para onde o botão de pôr/tirar do ar manda o POST. */
  acaoAlternar: AcaoDeFormulario;
  /** Rota da tela de confirmação de apagar — o `?id=` é acrescentado por item. */
  caminhoApagar: string;
  /**
   * A consulta falhou? Mesma prop e mesmo motivo de ListaMidia: uma lista
   * vazia numa tela onde a pessoa ACABOU de subir um material diria que o
   * envio se perdeu — e aqui "subir de novo" custa outra vez o plano de
   * dados dela.
   */
  degradou: boolean;
};

/** Tamanho legível — a MESMA conta de componentes/ListaMateriais.ts. */
function tamanhoLegivel(bytes: number | null): string | null {
  if (!bytes) return null;
  const mega = bytes / (1024 * 1024);
  return mega >= 1 ? `${mega.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function dataDeEnvio(iso: string): string {
  // Fuso repetido de componentes/ListaNoticias.ts e ListaMidia.ts pelo mesmo
  // motivo escrito lá (o teste do Node não resolve `@/...` para VALOR).
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo'
  });
}

export function ListaMateriaisDoPainel(
  { materiais, acaoAlternar, caminhoApagar, degradou }: PropsListaMateriaisDoPainel
) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar o acervo agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: atualize a página em alguns instantes.'
    );
  }

  if (materiais.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhum material subiu ainda. Use o formulário acima para subir o primeiro — ele fica '
      + 'guardado e só aparece no site quando você publicar.'
    );
  }

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'materiais' },
      materiais.map((material) => {
        const noAr = material.publicado === true;
        const tamanho = tamanhoLegivel(material.tamanho_bytes);
        const ficha: Array<[string, string]> = [
          ...(material.tema ? [['Tema', material.tema] as [string, string]] : []),
          ...(material.faixa_etaria ? [['Para', material.faixa_etaria] as [string, string]] : []),
          ...(tamanho ? [['Tamanho', tamanho] as [string, string]] : [])
        ];

        return createElement(
          'li',
          { className: 'material', key: material.id },

          createElement(
            'p',
            { className: noAr ? 'material__estado material__estado--no-ar' : 'material__estado' },
            noAr ? NO_AR : GUARDADO
          ),

          createElement('h2', { className: 'material__titulo' }, material.titulo),

          material.descricao
            ? createElement('p', { className: 'material__descricao' }, material.descricao)
            : null,

          ficha.length > 0
            ? createElement(
              'dl',
              { className: 'material__ficha' },
              ficha.map(([rotulo, valor]) => createElement(
                'div',
                { key: rotulo },
                createElement('dt', null, rotulo),
                createElement('dd', null, valor)
              ))
            )
            : null,

          createElement(
            'p',
            { className: 'material__quando' },
            `Enviado em ${dataDeEnvio(material.criado_em)}`
          ),

          createElement(
            'div',
            { className: 'material__botoes' },

            // ABRIR O ARQUIVO — ver o cabeçalho: é o que substitui a
            // miniatura que um PDF não tem. Sem ele não há como conferir se
            // o que subiu foi o material certo.
            createElement(
              'a',
              {
                className: 'material__botao',
                href: material.url,
                target: '_blank',
                rel: 'noopener'
              },
              'Abrir o arquivo',
              createElement(
                'span',
                { className: 'apenas-leitor-de-tela' },
                ` — ${material.titulo} (abre em outra aba)`
              )
            ),

            createElement(
              'form',
              { action: acaoAlternar, className: 'material__form' },
              createElement('input', { type: 'hidden', name: 'id', value: material.id }),
              createElement('input', {
                type: 'hidden', name: 'acao', value: noAr ? 'despublicar' : 'publicar'
              }),
              createElement(
                'button',
                {
                  type: 'submit',
                  className: noAr
                    ? 'material__botao material__botao--tirar'
                    : 'material__botao material__botao--publicar'
                },
                noAr ? 'Tirar do ar' : 'Publicar',
                // O título dentro do botão: "Publicar" repetido dez vezes
                // numa lista não diz a quem navega por botões qual é qual.
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${material.titulo}`)
              )
            ),

            createElement(
              'a',
              {
                className: 'material__botao material__botao--apagar',
                href: `${caminhoApagar}?id=${encodeURIComponent(material.id)}`
              },
              'Apagar',
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${material.titulo}`)
            )
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, AVISO_DO_BUCKET_PUBLICO),
    createElement('p', { className: 'painel__aviso' }, SEM_EDITAR)
  );
}
