import { createElement } from 'react';

export type AcaoDaBarra = {
  texto: string;
  /** Link: a ação leva a outra página. */
  href?: string;
  /** Envio: o `id` do <form> que o botão envia (atributo `form` do HTML). */
  formulario?: string;
  externo?: boolean;
};

function controle(acao: AcaoDaBarra, classe: string) {
  if (acao.formulario) {
    // `form="<id>"` liga o botão ao formulário mesmo estando FORA dele —
    // a barra mora no pé da tela, não dentro do <form>. Funciona sem
    // JavaScript: é HTML puro desde sempre.
    return createElement('button', { type: 'submit', form: acao.formulario, className: classe }, acao.texto);
  }
  return createElement('a', {
    className: classe,
    href: acao.href,
    rel: acao.externo ? 'noopener' : undefined
  }, acao.texto);
}

/**
 * A barra de ação do novo layout (Análise UX-UI, 3c/3d; plano, tarefa 2.5).
 *
 * "Telas de DETALHE e de FORMULÁRIO trocam a barra inferior por uma barra
 * com o próximo passo." No detalhe de um projeto, a barra de navegação
 * (Início · Agenda · Biblioteca · Menu) é menos útil que "Levar para minha
 * escola"; num formulário longo, o botão de enviar some debaixo do teclado
 * se morar só no fim da página.
 *
 * COMO ELA TROCA A BARRA INFERIOR: só por CSS. Toda página que desenha
 * `.af-barra-acao` esconde a barra de atalhos no celular
 * (`body:has(.af-barra-acao)` em estilos/sistema.css). A página não precisa
 * avisar o layout, e o layout não precisa saber qual página é.
 *
 * NO DESKTOP ela fica no fluxo, no fim do conteúdo: ali a navegação está no
 * cabeçalho e não há polegar a alcançar.
 *
 * O "Voltar" é a outra metade do padrão e mora no TOPO da página
 * (`LinkDeVoltar`, abaixo): ele diz o nome do destino ("‹ Projetos"),
 * que é o que a pessoa procura ao terminar de ler.
 *
 * `amostra`: desenha a barra no fluxo, para o catálogo de componentes, sem
 * esconder a navegação da página que a mostra.
 */
export default function BarraDeAcao({ principal, secundaria, rotulo = 'Próximo passo', amostra = false }: {
  principal: AcaoDaBarra;
  secundaria?: AcaoDaBarra;
  rotulo?: string;
  amostra?: boolean;
  /** Aceito e ignorado — o "Voltar" é `LinkDeVoltar`, no topo da página. */
  voltar?: { texto: string; href: string };
}) {
  return createElement(
    'div',
    {
      className: amostra ? 'af-barra-acao-amostra' : 'af-barra-acao',
      role: 'region',
      'aria-label': rotulo
    },
    controle(principal, 'af-btn af-btn--aplique af-barra-acao__principal'),
    secundaria ? controle(secundaria, 'af-btn af-btn--outline af-barra-acao__secundaria') : null
  );
}

/**
 * "‹ Projetos" — o voltar com o NOME do destino, no topo da página de
 * detalhe ou de formulário. Um link de verdade, não `history.back()`: quem
 * chegou por um link compartilhado no WhatsApp não tem "de onde voltar".
 */
export function LinkDeVoltar({ texto, href }: { texto: string; href: string }) {
  return createElement(
    'p',
    { className: 'af-voltar' },
    createElement('a', { href },
      createElement('span', { className: 'af-voltar__seta', 'aria-hidden': 'true' }),
      createElement('span', { className: 'apenas-leitor-de-tela' }, 'Voltar para '),
      texto
    )
  );
}
