import { VerMais } from './VerMais.ts';
import { createElement, Fragment, type ReactNode } from 'react';
import type { DoacaoDoPainel } from '@/servidor/dados/doacoes';
// SÓ O TIPO, e isso é o que torna este arquivo importável por um teste do
// Node: `import type` é apagado antes de executar, então o alias `@/...`
// — que o runtime nativo do Node não resolve — nunca precisa ser
// resolvido. O porquê inteiro, com as duas medições que fecharam as outras
// saídas, está no cabeçalho de `montarAnalise`, em
// compartilhado/doacoes.ts.
import type { ItemDeDoacao } from '@/compartilhado/doacoes';

/**
 * A fila de doações DENTRO do painel (RF19–RF22) — o que a equipe vê ao
 * abrir /admin/doacoes.
 *
 * ===================================================================
 * SEGUNDA TELA DO PAINEL COM DADO PESSOAL DE TERCEIROS
 * ===================================================================
 *
 * A primeira foi /admin/contatos (RF29), e o cabeçalho daquele componente
 * vale palavra por palavra aqui: nome, e-mail e texto livre de gente que
 * falou com a ONG. O que isso muda, item por item:
 *
 *  · NADA AQUI É COMPONENTE DE CLIENTE. Este arquivo é `.ts` com
 *    `createElement`, renderizado no servidor. Nenhum nome, e-mail ou
 *    descrição atravessa a fronteira servidor/navegador como PROP de
 *    componente de cliente — o que vai para o navegador é o HTML já pronto
 *    de uma página que só existe para quem é equipe;
 *  · o link "Responder" leva o `id` na URL e mais nada: nenhum campo
 *    escondido com o texto de quem doou, que é como esse dado voltaria a
 *    viajar sem motivo;
 *  · o VLibras continua montado no layout raiz, que envolve o painel, e a
 *    CSP usa `strict-dynamic`. É risco conhecido e aceito pelo dono do
 *    projeto (CLAUDE.md, item 0h), e esta tela o agrava do mesmo jeito que
 *    a de mensagens. Não foi mudado aqui: tirar a tradução da tela de
 *    trabalho excluiria quem usa Libras.
 *
 * ===================================================================
 * POR QUE É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Pelo mesmo motivo de ListaContatos.ts, ListaAtividades.ts,
 * ListaPublicacoes.ts, ListaMidia.ts e PainelInicio.ts: a página está
 * atrás de uma guarda que responde 404 para quem não é equipe. Se esta
 * lista morasse no `page.tsx`, a única forma de verificar o que ela
 * desenha seria abrir a tela autenticado — e não existe sessão de equipe
 * utilizável neste projeto (CLAUDE.md, "O que trava hoje", itens 1 e 2).
 * Aqui ela é renderizada por `react-dom/server` num teste do Node, sem
 * sessão, sem Next e sem navegador.
 *
 * ===================================================================
 * ESTA TELA LÊ E RESPONDE. NÃO APAGA E NÃO EDITA O QUE A PESSOA ESCREVEU.
 * ===================================================================
 *
 * As duas ausências estão ditas por escrito no fim da lista, porque botão
 * que não existe e não é explicado vira busca frustrada. O argumento
 * inteiro está no rodapé de acoes/doacoes.ts.
 */

/** O que o `href` de "Responder" aponta — a tela de uma doação só. */
const RESPONDER = '/admin/doacoes/responder';

/**
 * Data e hora no fuso da ONG.
 *
 * CÓPIA LOCAL, e não um import de componentes/MinhaConta.ts (que tem
 * `dataPorExtenso`) nem de compartilhado/doacoes.ts. Não é descuido: um
 * import de VALOR com o alias `@/...` faz o teste do Node morrer em
 * ERR_MODULE_NOT_FOUND antes do primeiro assert, e um import relativo com
 * extensão `.ts` faz o `next build` recusar com TS5097 — as duas medições
 * estão no cabeçalho de `montarTriagem`, em
 * compartilhado/triagem-de-contatos.ts. componentes/ListaContatos.ts tem a
 * mesma cópia (`quandoChegou`) pelo mesmo motivo.
 *
 * O FUSO É EXPLÍCITO pelo defeito já medido no projeto (ListaEventos.ts): o
 * servidor da Netlify roda em UTC, e uma data gravada às 21h de São Paulo
 * imprime o DIA SEGUINTE se o fuso ficar por conta do processo.
 */
function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
}

/**
 * Dinheiro em reais.
 *
 * `numeric(12,2)` chega do PostgREST como STRING ("150.00"), não como
 * número — é assim que o driver preserva a precisão decimal. `Number()`
 * aqui é seguro (dois dígitos decimais cabem em ponto flutuante com folga)
 * e é o que `Intl.NumberFormat` espera. Mesma função de
 * componentes/MinhaConta.ts, copiada pelo motivo escrito em `quando`.
 */
function emReais(valor: string | number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(valor));
}

export type PropsListaDoacoes = {
  /**
   * As doações JÁ ORDENADAS e com as decisões tomadas — o que
   * `montarAnalise` devolve. Este componente não decide ordem nem rótulo:
   * ele desenha.
   */
  itens: ItemDeDoacao<DoacaoDoPainel>[];
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * A INDISTINÇÃO QUE ESTA PROP EVITA É A PIOR DA TELA. Uma lista vazia
   * aqui diz "ninguém ofereceu nada", e a equipe fecha o celular. Se a
   * causa foi o banco não responder, o que ela acabou de fazer foi deixar
   * de responder gente que se dispôs a doar.
   */
  degradou: boolean;
};

/**
 * As duas ausências desta tela, ditas na tela.
 *
 * A segunda metade é LGPD e não é enfeite: /privacidade promete que a
 * pessoa pode pedir a exclusão dos dados dela, e este painel não apaga.
 * Sem esta frase, o pedido morre na primeira pessoa da equipe que procurar
 * um botão, não achar, e esquecer. Mesma decisão e quase a mesma frase de
 * componentes/ListaContatos.ts.
 */
const SEM_APAGAR_NEM_EDITAR = 'Esta tela responde e registra: ela não apaga doação e não muda '
  + 'o que a pessoa escreveu — o que foi oferecido é registro, e o que a ONG recebeu é '
  + 'prestação de contas. Quando não dá para receber, o caminho é marcar como recusada com o '
  + 'motivo escrito, que a pessoa lê na conta dela. Para apagar de vez, a pedido de quem '
  + 'ofereceu, fale com quem cuida do site: isso não se faz por aqui.';

/**
 * O que a tela NÃO é, dito antes de alguém procurar.
 *
 * RN08, e a /doar já promete em texto: "Este site não processa
 * pagamentos". Esta é a tela onde alguém da equipe procuraria um "cobrar"
 * ou um "emitir recibo" — e não há, nem vai haver por aqui. O valor que se
 * digita é o REGISTRO do que entrou, escrito depois do fato.
 */
const O_QUE_ESTA_TELA_NAO_FAZ = 'O site não cobra, não recebe pagamento e não emite recibo. '
  + 'O que fica guardado aqui é o que a ONG diz ter recebido, escrito por vocês depois que '
  + 'chegou.';

/**
 * O nome que vai no `<h2>` do cartão — e os QUATRO desfechos, porque três
 * deles acontecem de verdade.
 *
 *  1. a equipe registrou a doação → `doador_nome`, que é obrigatório nesse
 *     caminho (`constraint identificacao_obrigatoria`, 004_pessoas.sql);
 *  2. veio pelo site e o nome carregou → o nome da conta;
 *  3. veio pelo site e o nome NÃO carregou → a frase diz isso, em vez de um
 *     branco. A segunda consulta de servidor/dados/doacoes.ts é
 *     independente justamente para a lista continuar de pé quando ela
 *     falha, e uma tela que engolisse a falha desfaria o ganho;
 *  4. nem uma coisa nem outra — impossível pelo `check` do banco, escrito
 *     mesmo assim porque uma tela que só sabe desenhar o caso bom afirma o
 *     caso bom até quando ele deixa de ser verdade (mesma decisão do
 *     `consentimento_dados` falso em componentes/ListaContatos.ts).
 */
function quemDoou(doacao: DoacaoDoPainel): string {
  if (doacao.doador_nome) return doacao.doador_nome;
  if (doacao.perfil_nome) return doacao.perfil_nome;
  if (doacao.perfil_id) return 'Ofertada pelo site (o nome não carregou)';
  return 'Doação sem identificação';
}

/** Uma linha da ficha de uma doação — só desenhada quando há valor. */
function linhaDaFicha(rotulo: string, conteudo: ReactNode) {
  return createElement(
    'div',
    null,
    createElement('dt', null, rotulo),
    createElement('dd', null, conteudo)
  );
}

export function ListaDoacoes({ itens, degradou }: PropsListaDoacoes) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar as doações agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: as ofertas continuam guardadas. Atualize esta tela em alguns instantes.'
    );
  }

  if (itens.length === 0) {
    // A frase diz ONDE nasce uma doação, porque esta é a segunda tela do
    // painel cujo conteúdo não é criado só pela equipe. Sem isso, uma lista
    // vazia parece tela quebrada.
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma doação registrada ainda. Quando alguém com conta oferecer uma doação pelo site, '
      + 'ela aparece aqui esperando resposta — e o que chegar pelo WhatsApp, pelo e-mail ou na '
      + 'porta da sede você registra em "Registrar doação recebida".'
    );
  }

  return createElement(
    Fragment,
    null,

    createElement('p', { className: 'painel__aviso' }, O_QUE_ESTA_TELA_NAO_FAZ),

    createElement(
      'ul',
      { className: 'doacoes' },
      itens.map(({ doacao, situacaoRotulo, tipoRotulo, emAberto }) => createElement(
        'li',
        { className: 'doacao', key: doacao.id },

        // DUAS MARCAS NO TOPO, as duas escritas: em que pé está e de que
        // tipo é. Nenhuma depende de cor — quem usa leitor de tela ouve as
        // palavras, e em alto contraste, onde a paleta some, elas
        // continuam lá. Mesma decisão de componentes/ListaContatos.ts.
        createElement(
          'p',
          { className: 'doacao__marcas' },
          createElement(
            'span',
            { className: emAberto ? 'doacao__estado doacao__estado--aberta' : 'doacao__estado' },
            situacaoRotulo
          ),
          createElement('span', { className: 'doacao__tipo' }, tipoRotulo)
        ),

        // QUEM DOOU, no <h2>. Duas origens possíveis (a conta do site, ou o
        // registro feito pela equipe) e quatro desfechos — ver `quemDoou`.
        createElement('h2', { className: 'doacao__quem' }, quemDoou(doacao)),

        // TUDO O QUE SE LÊ DEPOIS DE ESCOLHER A LINHA ENTRA NA DOBRA
        // (pedido V1). Ficam de fora a marca de situação, quem doou e os
        // BOTÕES. Uma doação EM ABERTO chega aberta: é a que ainda espera
        // resposta da equipe.
        VerMais({ rotulo: 'Dados e oferta', aberta: emAberto, children: [
        createElement(
          'dl',
          { className: 'doacao__ficha', key: 'ficha' },

          // O e-mail é link de RESPOSTA, não texto: responder é o que a
          // equipe veio fazer, e no celular um toque abre o app de e-mail
          // com o endereço já no lugar. Sem `subject` montado por nós —
          // escrever uma frase institucional por conta própria é o que a
          // regra 2 do CLAUDE.md recusa.
          //
          // A ORDEM É `doador_email` PRIMEIRO: quando a equipe registrou a
          // doação, foi ela que anotou o contato, e ele vale mais que
          // qualquer coisa que estivesse no cadastro (nesse caminho não há
          // cadastro).
          (doacao.doador_email ?? doacao.perfil_email)
            ? linhaDaFicha('E-mail', createElement(
              'a',
              { href: `mailto:${doacao.doador_email ?? doacao.perfil_email}` },
              doacao.doador_email ?? doacao.perfil_email
            ))
            : null,

          // DE ONDE VEIO, sempre. É o que explica por que umas linhas têm
          // nome e outras não, e é o que diz à equipe onde encontrar a
          // pessoa: quem ofertou pelo site tem conta, e o contato dela está
          // no cadastro.
          linhaDaFicha(
            'Como chegou',
            doacao.perfil_id
              ? 'Ofertada pelo site, por quem tem conta'
              : 'Registrada pela equipe (chegou por fora do site)'
          ),

          // Valor nulo NÃO desenha linha nenhuma, em vez de desenhar
          // "R$ 0,00" — que diria que a doação não vale nada (mesma
          // decisão de componentes/MinhaConta.ts).
          doacao.valor === null || doacao.valor === undefined
            ? null
            : linhaDaFicha('Valor registrado', emReais(doacao.valor)),

          linhaDaFicha('Recebemos a oferta em', quando(doacao.criado_em)),

          doacao.recebida_em
            ? linhaDaFicha('Chegou em', quando(doacao.recebida_em))
            : null
        ),

        // A DESCRIÇÃO DENTRO DE UMA DOBRA, e ela nasce ABERTA no que ainda
        // espera alguma coisa da equipe.
        //
        // Numa tela de 375px, dez descrições abertas viram uma parede de
        // texto onde não se acha nada; dez fechadas escondem justamente o
        // que a pessoa veio ler. `<details>` é elemento nativo — abre e
        // fecha SEM uma linha de JavaScript, que é a condição desta tela.
        // Mesmas classes de /admin/contatos, inclusive a seta escrita à mão
        // do `::after` (com `display: flex` o triângulo nativo do <summary>
        // some — medido na Tarefa P4).
        createElement(
          'details',
          { className: 'painel__dobra doacao__dobra', open: emAberto, key: 'oferta' },
          createElement(
            'summary',
            { className: 'painel__dobra-titulo' },
            'O que foi oferecido',
            createElement(
              'span',
              { className: 'painel__dobra-dica' },
              emAberto ? 'ainda em aberto' : 'toque para ler'
            )
          ),
          // `white-space: pre-wrap` no CSS: as quebras de linha que a
          // pessoa escreveu ficam como ela escreveu.
          createElement('p', { className: 'doacao__descricao' }, doacao.descricao),

          // A RESPOSTA JÁ DADA, quando houver. Fica dentro da dobra, junto
          // do que ela responde: separá-las faria a equipe ler a resposta
          // sem o texto ao lado, que é como se responde duas vezes a mesma
          // coisa de formas diferentes.
          doacao.resposta
            ? createElement(
              'p',
              { className: 'doacao__resposta' },
              createElement('strong', null, 'Resposta da ONG: '),
              doacao.resposta
            )
            : null
        )
        ] }),

        createElement(
          'div',
          { className: 'doacao__botoes' },
          createElement(
            'a',
            {
              className: 'doacao__botao doacao__botao--responder',
              href: `${RESPONDER}?id=${doacao.id}`
            },
            emAberto ? 'Responder' : 'Ver e corrigir',
            // O nome dentro do link: "Responder" repetido dez vezes numa
            // lista não diz qual é qual para quem navega saltando de link
            // em link.
            createElement(
              'span',
              { className: 'apenas-leitor-de-tela' },
              ` — ${quemDoou(doacao)}`
            )
          )
        )
      ))
    ),

    createElement('p', { className: 'painel__aviso' }, SEM_APAGAR_NEM_EDITAR)
  );
}
