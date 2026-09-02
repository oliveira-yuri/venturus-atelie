import { createElement, Fragment } from 'react';
import type { AtividadeDoPainel } from '@/servidor/dados/conteudo';

/**
 * A lista das 11 atividades DENTRO do painel (RF03/RF33) — o que a equipe vê
 * ao abrir /admin/atividades.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Pelo mesmo motivo de componentes/PainelInicio.ts, ListaPublicacoes.ts e
 * ListaMidia.ts: a página está atrás de uma guarda que responde 404 para
 * TODO MUNDO hoje — não existe sessão de equipe utilizável (CLAUDE.md, "O
 * que trava hoje", itens 1 e 2). Se esta lista morasse no `page.tsx`, nada
 * nela teria verificação nenhuma até alguém conseguir entrar; aqui ela é
 * renderizada por `react-dom/server` num teste do Node, sem sessão, sem Next
 * e sem navegador (testes/atividades.test.mjs).
 *
 * ===================================================================
 * `acaoAlternar` É UMA PROP, E É ELA QUE TORNA ISTO TESTÁVEL
 * ===================================================================
 *
 * O botão de tirar do ar / pôr de volta vive dentro de um `<form>` cujo
 * `action`, na aplicação, é a Server Action `alternarAtividade`. Server
 * Action não pode ser importada por um teste do Node (o módulo é
 * `'use server'` e importa `server-only`). Recebendo-a como prop, o teste
 * passa uma STRING no lugar — `<form action="/qualquer-coisa">` é HTML
 * válido, e o que o teste quer medir não depende de qual função está do
 * outro lado.
 *
 * ===================================================================
 * NÃO EXISTE "NOVA ATIVIDADE" E NÃO EXISTE "APAGAR" — É A DECISÃO DA TAREFA
 * ===================================================================
 *
 * As 11 são conteúdo da ONG, escrito por eles, e chegaram pelo seed
 * versionado. Esta tela existe para CORRIGIR o texto — o que faltava para
 * fechar RF03. Apagar é o único gesto sem desfazer, e aconteceria num
 * celular, de pé, no meio de um evento (regra 4 do CLAUDE.md). Criar, sem
 * poder apagar, deixaria a ONG sem saída depois de um toque errado.
 *
 * "Tirar do ar" cobre o caso urgente e é reversível num toque. As duas
 * frases abaixo dizem isso por escrito, porque botão que não existe e não é
 * explicado vira busca frustrada.
 */

const SEM_CRIAR_NEM_APAGAR = 'Esta tela só corrige o texto do que já existe: não dá para criar '
  + 'nem apagar atividade por aqui, de propósito — apagar não tem desfazer. "Tirar do ar" faz a '
  + 'atividade sumir da página de projetos na hora e guarda o texto inteiro aqui.';

/**
 * A ARMADILHA DA FONTE DUPLA, DITA PARA QUEM USA A TELA.
 *
 * O texto das atividades tem duas fontes: a tabela do banco e uma cópia
 * versionada dentro do próprio site (dados-iniciais/atividades.json), que é
 * o que /projetos mostra quando o banco não responde — ver o cabeçalho de
 * servidor/dados/conteudo.ts. A partir da primeira correção feita aqui, as
 * duas deixam de dizer a mesma coisa.
 *
 * Isto não é um detalhe técnico que a equipe possa ignorar: é a explicação
 * do único comportamento estranho que ela pode ver — o texto antigo
 * reaparecendo sozinho. Sem esta frase, aquilo parece o painel ter perdido a
 * correção, e a reação natural é corrigir tudo de novo.
 *
 * Fica FORA dos itens, uma vez só, pelo mesmo motivo do aviso de
 * componentes/PainelInicio.ts: repetir onze vezes é ruído para quem enxerga
 * e onze leituras para quem usa leitor de tela.
 */
const AVISO_DA_COPIA = 'O site guarda uma cópia do texto destas atividades dentro dele, que '
  + 'aparece quando o banco de dados não responde. Essa cópia não é atualizada pelo painel: se '
  + 'o banco cair, a página de projetos volta a mostrar o texto de antes das suas correções, e '
  + 'volta ao texto novo quando o banco voltar. Quem cuida do site pode atualizar a cópia.';

/**
 * O estado de cada item, ESCRITO — nunca só uma cor.
 *
 * É a informação que decide se a atividade está na página de projetos.
 * "Fora do ar" e não "Rascunho" (a palavra da tela de notícias): nenhuma
 * destas 11 é rascunho — todas foram publicadas um dia, e tirar do ar aqui é
 * retirar algo que estava no site.
 */
const NO_AR = 'No ar';
const FORA_DO_AR = 'Fora do ar';

/** O que o `action` do `<form>` aceita — a Action na aplicação, uma string no teste. */
type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaAtividades = {
  atividades: AtividadeDoPainel[];
  /** Para onde o botão de tirar do ar / pôr de volta manda o POST. */
  acaoAlternar: AcaoDeFormulario;
  /** Rota da tela de edição — o `?id=` é acrescentado por item. */
  caminhoEditar: string;
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * A lista do painel NÃO cai para o JSON versionado, ao contrário de
   * /projetos: desenhar 11 atividades com botão "Editar" ao lado, sabendo
   * que nenhum daqueles textos é o que está no banco, é oferecer um gesto
   * que não pode dar certo. O porquê inteiro está em
   * servidor/dados/conteudo.ts, na seção da leitura do painel.
   */
  degradou: boolean;
};

export function ListaAtividades(
  { atividades, acaoAlternar, caminhoEditar, degradou }: PropsListaAtividades
) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar as atividades agora — o banco de dados não respondeu. Nada foi '
      + 'perdido, e a página de projetos do site continua no ar. Atualize esta tela em alguns '
      + 'instantes.'
    );
  }

  if (atividades.length === 0) {
    // NÃO é "escreva a primeira", como na tela de notícias: aqui não se
    // cria. Uma lista vazia significa que este banco de dados não recebeu o
    // conteúdo inicial (supabase/seed.sql) — é problema de instalação, e a
    // frase precisa dizer isso para não mandar a equipe procurar um botão
    // que não existe.
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma atividade encontrada no banco de dados. As 11 atividades do Ateliê entram pelo '
      + 'conteúdo inicial do banco, não por esta tela — se a lista está vazia, fale com quem '
      + 'cuida do site.'
    );
  }

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'atividades-painel' },
      atividades.map((atividade) => {
        const noAr = atividade.publicado === true;

        return createElement(
          'li',
          { className: 'atividade-painel', key: atividade.id },

          createElement(
            'p',
            {
              className: noAr
                ? 'atividade-painel__estado atividade-painel__estado--no-ar'
                : 'atividade-painel__estado'
            },
            noAr ? NO_AR : FORA_DO_AR
          ),

          createElement('h2', { className: 'atividade-painel__titulo' }, atividade.titulo),

          // O resumo, quando existe, encurtado: serve para reconhecer qual
          // atividade é esta sem abrir. Cinco das 11 não têm resumo e nada é
          // desenhado no lugar (regra 2 do CLAUDE.md no nível do campo —
          // mesma decisão de componentes/CardAtividade.ts).
          atividade.resumo
            ? createElement('p', { className: 'atividade-painel__resumo' }, atividade.resumo)
            : null,

          createElement(
            'div',
            { className: 'atividade-painel__botoes' },

            // Editar é um link comum: navegação, não ação. Vai antes do botão
            // de tirar do ar porque é o gesto que a equipe veio fazer, e o
            // menos arriscado.
            createElement(
              'a',
              {
                className: 'atividade-painel__botao',
                href: `${caminhoEditar}?id=${encodeURIComponent(atividade.id)}`
              },
              // O nome da atividade dentro do link: "Editar" repetido onze
              // vezes não diz a quem navega por links qual é qual.
              'Editar',
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${atividade.titulo}`)
            ),

            createElement(
              'form',
              {
                action: acaoAlternar,
                className: 'atividade-painel__form',
                'data-confirmar-titulo': noAr ? 'Tirar da página de projetos?' : 'Pôr de volta no ar?',
                'data-confirmar': noAr
                  ? `"${atividade.titulo}" some da página de projetos do site. O texto continua guardado e dá para pôr de volta.`
                  : `"${atividade.titulo}" volta a aparecer na página de projetos.`,
                'data-confirmar-rotulo': noAr ? 'Tirar do ar' : 'Pôr de volta'
              },
              createElement('input', { type: 'hidden', name: 'id', value: atividade.id }),
              createElement('input', {
                type: 'hidden', name: 'acao', value: noAr ? 'despublicar' : 'publicar'
              }),
              createElement(
                'button',
                {
                  type: 'submit',
                  className: noAr
                    ? 'atividade-painel__botao atividade-painel__botao--tirar'
                    : 'atividade-painel__botao atividade-painel__botao--publicar'
                },
                noAr ? 'Tirar do ar' : 'Pôr de volta',
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` ${atividade.titulo}`)
              )
            )
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, SEM_CRIAR_NEM_APAGAR),
    createElement('p', { className: 'painel__aviso' }, AVISO_DA_COPIA)
  );
}
