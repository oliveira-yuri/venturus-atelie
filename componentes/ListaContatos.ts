import { createElement, Fragment, type ReactNode } from 'react';
import type { Contato } from '@/servidor/dados/contatos';
// SÓ O TIPO, e isso é o que torna este arquivo importável por um teste do
// Node: `import type` é apagado antes de executar, então o alias `@/...`
// — que o runtime nativo do Node não resolve — nunca precisa ser resolvido.
// O porquê inteiro, com as duas medições que fecharam as outras saídas,
// está no cabeçalho de `montarTriagem`, em
// compartilhado/triagem-de-contatos.ts.
import type { ItemDeTriagem } from '@/compartilhado/triagem-de-contatos';

/**
 * As mensagens recebidas DENTRO do painel (RF29) — o que a equipe vê ao
 * abrir /admin/contatos.
 *
 * ===================================================================
 * A TELA MAIS SENSÍVEL DO PAINEL
 * ===================================================================
 *
 * É a primeira do projeto com dado pessoal de TERCEIROS em volume: nome,
 * e-mail, telefone e texto livre de gente que escreveu para a ONG. As
 * outras três telas mostram conteúdo institucional (notícia, foto,
 * atividade); esta mostra pessoas.
 *
 * O que isso muda, item por item:
 *
 *  · NADA AQUI É COMPONENTE DE CLIENTE. Este arquivo é `.ts` com
 *    `createElement`, renderizado no servidor, e os botões são `<form>` com
 *    Server Action. Nenhum nome, e-mail ou mensagem atravessa a fronteira
 *    servidor/navegador como PROP de componente de cliente — o que vai para
 *    o navegador é o HTML já pronto de uma página que só existe para quem é
 *    equipe (a guarda responde 404 para o resto, e o não-vazamento é medido
 *    em testes/contatos.test.mjs);
 *  · o `<form>` de cada botão leva o id e a situação pedida, e mais nada:
 *    nenhum campo escondido com o texto da mensagem, que é como esse dado
 *    voltaria a viajar sem motivo;
 *  · o VLibras continua montado no layout raiz, que envolve o painel, e a
 *    CSP usa `strict-dynamic`. É risco conhecido e aceito pelo dono do
 *    projeto (CLAUDE.md, item 0h) — e esta tela o AGRAVA, porque o que está
 *    na página deixou de ser só dado da equipe. Não foi mudado aqui: tirar
 *    a tradução da tela de trabalho excluiria quem usa Libras.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Pelo mesmo motivo de componentes/ListaAtividades.ts, ListaPublicacoes.ts,
 * ListaMidia.ts e PainelInicio.ts: a página está atrás de uma guarda que
 * responde 404 para quem não é equipe. Se esta lista morasse no `page.tsx`,
 * a única forma de verificar o que ela desenha seria abrir a tela
 * autenticado. Aqui ela é renderizada por `react-dom/server` num teste do
 * Node, sem sessão, sem Next e sem navegador.
 *
 * ===================================================================
 * `acaoSituacao` É UMA PROP, E É ELA QUE TORNA ISTO TESTÁVEL
 * ===================================================================
 *
 * Server Action não pode ser importada por um teste do Node (o módulo é
 * `'use server'` e importa `server-only`). Recebendo-a como prop, o teste
 * passa uma STRING no lugar — `<form action="/qualquer-coisa">` é HTML
 * válido, e o que o teste quer medir não depende de qual função está do
 * outro lado.
 *
 * ===================================================================
 * ESTA TELA LÊ E TRIA. NÃO APAGA E NÃO EDITA.
 * ===================================================================
 *
 * O texto que a pessoa escreveu é registro — alterar seria falsificar o que
 * alguém disse à ONG. E apagar não tem desfazer. As duas ausências estão
 * ditas por escrito no fim da lista, porque botão que não existe e não é
 * explicado vira busca frustrada — e porque /privacidade promete que quem
 * escreveu pode "pedir a exclusão dos seus dados", promessa que esta tela
 * NÃO cumpre sozinha. A frase diz onde isso se resolve.
 */

/** O que o `action` do `<form>` aceita — a Action na aplicação, uma string no teste. */
type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaContatos = {
  /**
   * As mensagens JÁ ORDENADAS e com as decisões tomadas — o que
   * `montarTriagem` devolve. Este componente não decide ordem, rótulo nem
   * quais botões existem: ele desenha.
   */
  itens: ItemDeTriagem<Contato>[];
  /** Para onde os botões de triagem mandam o POST. */
  acaoSituacao: AcaoDeFormulario;
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * A INDISTINÇÃO QUE ESTA PROP EVITA É A PIOR DA TELA. Uma lista vazia
   * aqui diz "ninguém escreveu para a ONG", e a equipe fecha o celular. Se
   * a causa foi o banco não responder, o que ela acabou de fazer foi deixar
   * de responder gente que está esperando. Com a falha declarada, ela sabe
   * que as mensagens continuam lá.
   */
  degradou: boolean;
};

/**
 * As duas ausências desta tela, ditas na tela.
 *
 * A segunda metade é LGPD e não é enfeite: /privacidade promete que a
 * pessoa pode pedir a exclusão dos dados dela, e este painel não apaga.
 * Sem esta frase, o pedido de exclusão morre na primeira pessoa da equipe
 * que procurar um botão, não achar, e esquecer.
 */
const SEM_APAGAR_NEM_EDITAR = 'Esta tela lê e organiza: ela não apaga mensagem e não muda o '
  + 'que a pessoa escreveu — o texto recebido é registro, e mexer nele seria mudar o que '
  + 'alguém disse. Para apagar uma mensagem a pedido de quem escreveu, como a política de '
  + 'privacidade permite, fale com quem cuida do site: isso não se faz por aqui.';

/**
 * O que as três marcas querem dizer, uma vez só no fim da lista.
 *
 * FICA FORA DOS ITENS pelo mesmo motivo do aviso de
 * componentes/ListaAtividades.ts: repetir a legenda em cada cartão é ruído
 * para quem enxerga e uma leitura a mais, por mensagem, para quem usa
 * leitor de tela.
 *
 * "Concluída" é descrita com as palavras de /privacidade ("até o
 * atendimento ser concluído, e um tempo depois como histórico do contato"),
 * e não com palavras novas: a tela não pode prometer à equipe um
 * comportamento diferente do que a ONG publicou.
 */
const O_QUE_AS_MARCAS_QUEREM_DIZER = 'Nova: ninguém respondeu ainda. Em contato: alguém da '
  + 'equipe já está cuidando. Concluída: o atendimento acabou — a mensagem desce para o fim '
  + 'da lista e continua guardada como histórico do contato.';

/**
 * O lembrete de que a tela está cheia de dado de outras pessoas.
 *
 * Curto de propósito: aviso longo em tela de trabalho é aviso que se
 * aprende a pular. Ele existe porque o cenário real é um celular pessoal,
 * de pé, no meio de um evento (regra 4 do CLAUDE.md) — a tela aberta na mão
 * de alguém é a forma mais provável de esses dados vazarem, e nenhuma
 * política de RLS cobre isso.
 */
const CUIDADO_COM_A_TELA = 'Esta tela mostra nome, e-mail, telefone e o que pessoas de fora '
  + 'escreveram. Ela não é para mostrar a ninguém de fora da equipe.';

/**
 * A data de recebimento, com a HORA — ao contrário das outras telas do
 * painel, que mostram só o dia.
 *
 * Numa fila de atendimento a hora importa: duas mensagens do mesmo dia
 * precisam de ordem, e "recebida hoje às 9h" e "recebida hoje às 23h" são
 * urgências diferentes na manhã seguinte.
 *
 * Fuso fixo em America/Sao_Paulo, repetido de componentes/ListaNoticias.ts
 * pelo mesmo motivo escrito lá (o teste do Node não resolve `@/...`): sem
 * ele, a data sairia no fuso de quem RENDERIZA — o servidor da Netlify, em
 * UTC —, e uma mensagem enviada às 22h de terça viraria "quarta".
 */
function quandoChegou(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
}

/**
 * O telefone dentro de um `tel:`.
 *
 * O que a pessoa digitou fica na TELA como ela digitou; o que vai no link
 * são só os dígitos (e um `+` inicial, se houver). Um `tel:` com espaço e
 * parêntese é aceito por uns discadores e ignorado por outros, e o cenário
 * aqui é justamente o celular: o link que não disca é o link que não
 * serve.
 */
function paraDiscar(telefone: string): string {
  const digitos = telefone.replace(/[^\d]/g, '');
  return telefone.trim().startsWith('+') ? `+${digitos}` : digitos;
}

/** Uma linha da ficha de contato — só desenhada quando há valor. */
function linhaDaFicha(rotulo: string, conteudo: ReactNode) {
  return createElement(
    'div',
    null,
    createElement('dt', null, rotulo),
    createElement('dd', null, conteudo)
  );
}

export function ListaContatos({ itens, acaoSituacao, degradou }: PropsListaContatos) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar as mensagens agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: as mensagens continuam guardadas, e ninguém que escreveu foi apagado. '
      + 'Atualize esta tela em alguns instantes.'
    );
  }

  if (itens.length === 0) {
    // A frase diz ONDE nasce uma mensagem, porque esta é a única tela do
    // painel cujo conteúdo não é criado pela equipe: quem cria é quem
    // escreve de fora. Sem isso, uma lista vazia parece tela quebrada.
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma mensagem recebida ainda. Quando alguém escrever pelo formulário da página de '
      + 'contato do site, ela aparece aqui — e continua chegando também pelo WhatsApp e pelo '
      + 'e-mail da ONG, que não passam por esta tela.'
    );
  }

  return createElement(
    Fragment,
    null,

    createElement('p', { className: 'painel__aviso' }, CUIDADO_COM_A_TELA),

    createElement(
      'ul',
      { className: 'contatos' },
      itens.map(({ contato, situacaoRotulo, origemRotulo, nova, destinos }) => {
        return createElement(
          'li',
          { className: 'contato', key: contato.id },

          // DUAS MARCAS NO TOPO, as duas escritas: em que pé está o
          // atendimento e por onde a mensagem chegou. Nenhuma das duas
          // depende de cor — quem usa leitor de tela ouve as palavras, e em
          // alto contraste, onde a paleta some, elas continuam lá.
          createElement(
            'p',
            { className: 'contato__marcas' },
            createElement(
              'span',
              {
                className: nova
                  ? 'contato__estado contato__estado--nova'
                  : 'contato__estado'
              },
              situacaoRotulo
            ),
            createElement(
              'span',
              { className: 'contato__origem' },
              origemRotulo
            )
          ),

          createElement('h2', { className: 'contato__nome' }, contato.nome),

          createElement(
            'dl',
            { className: 'contato__ficha' },

            // O e-mail é link de RESPOSTA, não texto: responder é o que a
            // equipe veio fazer aqui, e no celular um toque abre o app de
            // e-mail com o endereço já no lugar.
            //
            // Sem `subject` montado por nós, de propósito: o assunto vai
            // dentro de um e-mail que sai em nome da ONG, e escrever uma
            // frase institucional por conta própria é o que a regra 2 do
            // CLAUDE.md recusa. Quem escreve é a equipe.
            linhaDaFicha('E-mail', createElement(
              'a', { href: `mailto:${contato.email}` }, contato.email
            )),

            // Telefone e instituição são opcionais no formulário: campo
            // sem valor não desenha linha nenhuma, em vez de desenhar um
            // rótulo com um traço (regra 2 no nível do campo — mesma
            // decisão de componentes/CardAtividade.ts).
            contato.telefone
              ? linhaDaFicha('Telefone', createElement(
                'a', { href: `tel:${paraDiscar(contato.telefone)}` }, contato.telefone
              ))
              : null,

            contato.instituicao
              ? linhaDaFicha('Instituição', contato.instituicao)
              : null,

            linhaDaFicha('Recebida', quandoChegou(contato.criado_em))
          ),

          // A MENSAGEM DENTRO DE UMA DOBRA, e ela nasce ABERTA no que é
          // novo.
          //
          // Numa tela de 375px, dez mensagens abertas viram uma parede de
          // texto onde não se acha nada; dez mensagens fechadas viram uma
          // tela que esconde justamente o que a pessoa veio ler. A dobra
          // aberta no que ainda não foi respondido resolve as duas: quem
          // abriu a tela lê o que falta responder, e rola por cima do que já
          // foi tratado.
          //
          // `<details>` é elemento nativo — abre e fecha SEM uma linha de
          // JavaScript, que é a condição desta tela (regra 8 e o modo sem
          // script medido nas tarefas anteriores). Mesmo elemento e mesmas
          // classes da ficha técnica de /admin/atividades/editar, inclusive
          // a seta escrita à mão do `::after` (ver estilos/admin.css: com
          // `display: flex` o triângulo nativo do <summary> some).
          createElement(
            'details',
            { className: 'painel__dobra contato__dobra', open: nova },
            createElement(
              'summary',
              { className: 'painel__dobra-titulo' },
              'Mensagem',
              createElement(
                'span',
                { className: 'painel__dobra-dica' },
                nova ? 'ainda sem resposta' : 'toque para ler'
              )
            ),
            // `white-space: pre-wrap` no CSS: as quebras de linha que a
            // pessoa escreveu ficam como ela escreveu. Não há conversão
            // para parágrafos aqui, e é decisão — dividir por linha em
            // branco é adivinhar a intenção de quem escreveu um recado no
            // celular, e o que a equipe precisa é do texto como ele chegou.
            createElement('p', { className: 'contato__mensagem' }, contato.mensagem)
          ),

          // O QUE A EQUIPE PODE FAZER COM ESTES DADOS, dito no cartão.
          //
          // Não é enfeite jurídico: sem isto, a pergunta "posso responder
          // esta pessoa?" não tem resposta na tela, e a resposta é sim. O
          // banco tem `constraint consentimento_obrigatorio check
          // (consentimento_dados)` (004_pessoas.sql), então linha sem
          // autorização não entra — o caso `false` abaixo é impossível
          // hoje, e está escrito mesmo assim porque uma tela que só sabe
          // desenhar o caso bom afirma o caso bom até quando ele deixa de
          // ser verdade.
          createElement(
            'p',
            {
              className: contato.consentimento_dados
                ? 'contato__consentimento'
                : 'contato__consentimento contato__consentimento--sem'
            },
            contato.consentimento_dados
              ? 'Esta pessoa autorizou o uso destes dados para responder a mensagem. '
                + 'O formulário do site não grava sem essa autorização.'
              : 'ATENÇÃO: esta mensagem está guardada SEM autorização de uso dos dados. '
                + 'Não responda por ela antes de falar com quem cuida do site.'
          ),

          createElement(
            'div',
            { className: 'contato__botoes' },

            // Responder vem PRIMEIRO: é o gesto que a tela existe para
            // provocar. Marcar a situação é o registro do que já foi feito,
            // e vem depois.
            createElement(
              'a',
              {
                className: 'contato__botao contato__botao--responder',
                href: `mailto:${contato.email}`
              },
              'Responder por e-mail',
              // O nome dentro do link: "Responder por e-mail" repetido dez
              // vezes numa lista não diz qual é qual para quem navega
              // saltando de link em link.
              createElement('span', { className: 'apenas-leitor-de-tela' }, ` a ${contato.nome}`)
            ),

            // Um <form> por botão, cada um com a situação de destino num
            // campo escondido. Nada de `onClick`: sem JavaScript o botão
            // continua sendo um POST comum, que a Action atende igual.
            ...destinos.map((destino) => createElement(
              'form',
              {
                action: acaoSituacao,
                className: 'contato__form',
                key: destino.valor,
                // Confirmação do pedido V1. Mudar a situação não apaga nada
                // e se desfaz voltando — por isso a frase diz o que muda,
                // sem drama, e não pede palavra digitada.
                'data-confirmar-titulo': 'Mudar o andamento?',
                'data-confirmar': `A mensagem de ${contato.nome} passa a aparecer como "${destino.rotulo ?? destino.botao}". Dá para voltar atrás depois, no mesmo lugar.`,
                'data-confirmar-rotulo': destino.botao
              },
              createElement('input', { type: 'hidden', name: 'id', value: contato.id }),
              createElement('input', { type: 'hidden', name: 'situacao', value: destino.valor }),
              createElement(
                'button',
                { type: 'submit', className: 'contato__botao' },
                destino.botao,
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${contato.nome}`)
              )
            ))
          )
        );
      })
    ),

    createElement('p', { className: 'painel__aviso' }, O_QUE_AS_MARCAS_QUEREM_DIZER),
    createElement('p', { className: 'painel__aviso' }, SEM_APAGAR_NEM_EDITAR)
  );
}
