import { createElement, Fragment, type ReactNode } from 'react';
import type { CandidaturaDaEquipe } from '@/servidor/dados/voluntarios';
// SÓ O TIPO, e isso é o que torna este arquivo importável por um teste do
// Node: `import type` é apagado antes de executar, então o alias `@/...`
// — que o runtime nativo do Node não resolve — nunca precisa ser resolvido.
// O porquê inteiro, com as duas medições que fecharam as outras saídas,
// está no cabeçalho de `montarTriagemDeVoluntarios`, em
// compartilhado/triagem-de-voluntarios.ts.
import type { ItemDeTriagemDeVoluntario } from '@/compartilhado/triagem-de-voluntarios';

/**
 * As candidaturas ao voluntariado DENTRO do painel (RF26) — o que a equipe
 * vê ao abrir /admin/voluntarios.
 *
 * ===================================================================
 * A SEGUNDA TELA DO PAINEL COM DADO PESSOAL DE TERCEIROS
 * ===================================================================
 *
 * A primeira foi /admin/contatos (RF29). Aqui é pior num ponto e melhor em
 * outro, e vale saber qual é qual:
 *
 *  · PIOR: quem aparece nesta lista tem CONTA no site. O que se vê é nome,
 *    e-mail e telefone de `public.perfis` — o cadastro da pessoa —, não o
 *    que ela digitou num formulário anônimo. E vem junto o que ela escreveu
 *    sobre por que quer ajudar;
 *  · MELHOR: nada aqui foi escrito por desconhecido. Toda linha tem `perfil_id
 *    not null` e passou pelo Auth do Supabase.
 *
 * O que isso muda, item por item:
 *
 *  · NADA AQUI É COMPONENTE DE CLIENTE. Este arquivo é `.ts` com
 *    `createElement`, renderizado no servidor, e os botões são `<form>` com
 *    Server Action. Nenhum nome, e-mail ou mensagem atravessa a fronteira
 *    servidor/navegador como PROP de componente de cliente — o que vai para
 *    o navegador é o HTML já pronto de uma página que só existe para quem é
 *    equipe (a guarda responde 404 para o resto, e o não-vazamento é medido
 *    em testes/voluntarios.test.mjs);
 *  · o `<form>` de cada botão leva o id e a situação pedida, e mais nada:
 *    nenhum campo escondido com o texto da candidatura ou com o e-mail, que
 *    é como esse dado voltaria a viajar sem motivo;
 *  · o VLibras continua montado no layout raiz, que envolve o painel, e a
 *    CSP usa `strict-dynamic`. É risco conhecido e aceito pelo dono do
 *    projeto (CLAUDE.md, item 0h). Não foi mudado aqui: tirar a tradução da
 *    tela de trabalho excluiria quem usa Libras.
 *
 * ===================================================================
 * POR QUE ELA É UM COMPONENTE `.ts`, E NÃO JSX DENTRO DA PÁGINA
 * ===================================================================
 *
 * Pelo mesmo motivo de componentes/ListaContatos.ts, ListaAtividades.ts,
 * ListaPublicacoes.ts, ListaMidia.ts e PainelInicio.ts: a página está atrás
 * de uma guarda que responde 404 para quem não é equipe. Se esta lista
 * morasse no `page.tsx`, a única forma de verificar o que ela desenha seria
 * abrir a tela autenticado — e ninguém abriu ainda (CLAUDE.md, "O que trava
 * hoje", itens 2 e 3). Aqui ela é renderizada por `react-dom/server` num
 * teste do Node, sem sessão, sem Next e sem navegador.
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
 * ESTA TELA LÊ E TRIA. NÃO APAGA, NÃO EDITA E NÃO MUDA AS ÁREAS.
 * ===================================================================
 *
 * O texto que a pessoa escreveu é registro; as áreas que ela marcou são
 * escolha dela. As três ausências estão ditas por escrito no fim da lista,
 * porque botão que não existe e não é explicado vira busca frustrada — e
 * porque /privacidade promete que quem se candidatou pode "pedir a exclusão
 * dos seus dados", promessa que esta tela NÃO cumpre sozinha. A frase diz
 * onde isso se resolve. Ver o cabeçalho de acoes/voluntarios.ts.
 */

/** O que o `action` do `<form>` aceita — a Action na aplicação, uma string no teste. */
type AcaoDeFormulario = string | ((dados: FormData) => void | Promise<void>);

export type PropsListaVoluntarios = {
  /**
   * As candidaturas JÁ ORDENADAS e com as decisões tomadas — o que
   * `montarTriagemDeVoluntarios` devolve. Este componente não decide ordem,
   * rótulo nem quais botões existem: ele desenha.
   */
  itens: ItemDeTriagemDeVoluntario<CandidaturaDaEquipe>[];
  /** Para onde os botões de triagem mandam o POST. */
  acaoSituacao: AcaoDeFormulario;
  /**
   * A consulta falhou? (`degradou` de servidor/dados/degradacao.ts.)
   *
   * A INDISTINÇÃO QUE ESTA PROP EVITA É A PIOR DA TELA. Uma lista vazia aqui
   * diz "ninguém se ofereceu para ajudar", e a equipe fecha o celular. Se a
   * causa foi o banco não responder, o que ela acabou de fazer foi deixar de
   * responder gente que se ofereceu. Com a falha declarada, ela sabe que as
   * candidaturas continuam lá.
   */
  degradou: boolean;
};

/**
 * As três ausências desta tela, ditas na tela.
 *
 * A última metade é LGPD e não é enfeite: /privacidade promete que a pessoa
 * pode pedir a exclusão dos dados dela, e este painel não apaga. Sem esta
 * frase, o pedido de exclusão morre na primeira pessoa da equipe que
 * procurar um botão, não achar, e esquecer.
 */
const SEM_APAGAR_NEM_EDITAR = 'Esta tela lê e organiza: ela não apaga candidatura, não muda o '
  + 'que a pessoa escreveu e não mexe nas áreas que ela escolheu — isso é escolha de quem se '
  + 'candidatou, e mudar por aqui seria decidir no lugar dela. Para apagar uma candidatura a '
  + 'pedido de quem a fez, como a política de privacidade permite, fale com quem cuida do '
  + 'site: isso não se faz por aqui.';

/**
 * O que as quatro marcas querem dizer, uma vez só no fim da lista.
 *
 * FICA FORA DOS ITENS pelo mesmo motivo do aviso de
 * componentes/ListaContatos.ts: repetir a legenda em cada cartão é ruído
 * para quem enxerga e uma leitura a mais, por candidatura, para quem usa
 * leitor de tela.
 *
 * "Encerrada" carrega a única consequência desta tela que acontece FORA
 * dela: quem tem candidatura encerrada volta a poder se candidatar
 * ('inativo' fica fora de `SITUACOES_EM_ANDAMENTO`, em
 * compartilhado/candidatura.ts). Sem esta frase, a segunda candidatura da
 * mesma pessoa apareceria na fila parecendo defeito do site.
 */
const O_QUE_AS_MARCAS_QUEREM_DIZER = 'Nova: ninguém falou com a pessoa ainda. Em contato: '
  + 'alguém da equipe já está conversando. Voluntariando: ela está ajudando no Ateliê hoje. '
  + 'Encerrada: acabou — a candidatura desce para o fim da lista, continua guardada, e a '
  + 'pessoa volta a poder se candidatar pelo site.';

/**
 * O lembrete de que a tela está cheia de dado de outras pessoas.
 *
 * Curto de propósito: aviso longo em tela de trabalho é aviso que se aprende
 * a pular. Ele existe porque o cenário real é um celular pessoal, de pé, no
 * meio de um evento (regra 4 do CLAUDE.md) — a tela aberta na mão de alguém
 * é a forma mais provável de esses dados vazarem, e nenhuma política de RLS
 * cobre isso.
 */
const CUIDADO_COM_A_TELA = 'Esta tela mostra o nome, o e-mail e o telefone de quem se '
  + 'candidatou. Ela não é para mostrar a ninguém de fora da equipe.';

/**
 * A data de chegada, com a HORA — como na tela de mensagens, e ao contrário
 * das telas de conteúdo do painel, que mostram só o dia.
 *
 * Numa fila de pessoas a hora importa: duas candidaturas do mesmo dia
 * precisam de ordem, e é ela que diz há quanto tempo alguém está esperando.
 *
 * Fuso fixo em America/Sao_Paulo, repetido de componentes/ListaContatos.ts
 * pelo mesmo motivo escrito lá (o teste do Node não resolve `@/...`): sem
 * ele, a data sairia no fuso de quem RENDERIZA — o servidor da Netlify, em
 * UTC —, e uma candidatura enviada às 22h de terça viraria "quarta".
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
 * O que a pessoa cadastrou fica na TELA como ela digitou; o que vai no link
 * são só os dígitos (e um `+` inicial, se houver). Um `tel:` com espaço e
 * parêntese é aceito por uns discadores e ignorado por outros, e o cenário
 * aqui é justamente o celular: o link que não disca é o link que não serve.
 */
function paraDiscar(telefone: string): string {
  const digitos = telefone.replace(/[^\d]/g, '');
  return telefone.trim().startsWith('+') ? `+${digitos}` : digitos;
}

/** Uma linha da ficha — só desenhada quando há valor. */
function linhaDaFicha(rotulo: string, conteudo: ReactNode) {
  return createElement(
    'div',
    null,
    createElement('dt', null, rotulo),
    createElement('dd', null, conteudo)
  );
}

export function ListaVoluntarios({ itens, acaoSituacao, degradou }: PropsListaVoluntarios) {
  if (degradou) {
    return createElement(
      'p',
      { className: 'estado estado--erro' },
      'Não deu para carregar as candidaturas agora — o banco de dados não respondeu. Nada foi '
      + 'perdido: as candidaturas continuam guardadas, e ninguém que se ofereceu foi apagado. '
      + 'Atualize esta tela em alguns instantes.'
    );
  }

  if (itens.length === 0) {
    // A frase diz ONDE nasce uma candidatura, porque esta é a segunda tela
    // do painel cujo conteúdo não é criado pela equipe: quem cria é quem se
    // candidata, de fora. Sem isso, uma lista vazia parece tela quebrada.
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma candidatura ainda. Quando alguém se candidatar pela página de voluntariado do '
      + 'site, ela aparece aqui — e quem preferir falar direto pelo WhatsApp ou pessoalmente '
      + 'não passa por esta tela.'
    );
  }

  return createElement(
    Fragment,
    null,

    createElement('p', { className: 'painel__aviso' }, CUIDADO_COM_A_TELA),

    createElement(
      'ul',
      { className: 'voluntarios' },
      itens.map(({ candidatura, situacaoRotulo, nova, destinos }) => {
        // O nome pode faltar se o embed de `public.perfis` não vier — o
        // banco torna isso impossível hoje (`perfil_id` é `not null`), e
        // está tratado porque uma tela que só sabe desenhar o caso bom
        // afirma o caso bom até quando ele deixa de ser verdade. E o nome é
        // usado também no rótulo dos botões para leitor de tela, onde um
        // `null` viraria "— null".
        const quem = candidatura.nome ?? 'Pessoa sem cadastro ligado';

        return createElement(
          'li',
          { className: 'voluntario', key: candidatura.id },

          // A MARCA NO TOPO, ESCRITA. Não depende de cor — quem usa leitor
          // de tela ouve a palavra, e em alto contraste, onde a paleta some,
          // ela continua lá.
          createElement(
            'p',
            { className: 'voluntario__marcas' },
            createElement(
              'span',
              {
                className: nova
                  ? 'voluntario__estado voluntario__estado--nova'
                  : 'voluntario__estado'
              },
              situacaoRotulo
            )
          ),

          createElement('h2', { className: 'voluntario__nome' }, quem),

          createElement(
            'dl',
            { className: 'voluntario__ficha' },

            // O e-mail é link de CONTATO, não texto: falar com quem se
            // ofereceu é o que a equipe veio fazer aqui, e no celular um
            // toque abre o app de e-mail com o endereço já no lugar.
            //
            // Sem `subject` montado por nós, de propósito: o assunto vai
            // dentro de um e-mail que sai em nome da ONG, e escrever uma
            // frase institucional por conta própria é o que a regra 2 do
            // CLAUDE.md recusa. Quem escreve é a equipe.
            candidatura.email
              ? linhaDaFicha('E-mail', createElement(
                'a', { href: `mailto:${candidatura.email}` }, candidatura.email
              ))
              : null,

            // Telefone é opcional no cadastro (coleta mínima, RNF09): campo
            // sem valor não desenha linha nenhuma, em vez de desenhar um
            // rótulo com um traço (regra 2 no nível do campo — a mesma
            // decisão de componentes/CardAtividade.ts).
            candidatura.telefone
              ? linhaDaFicha('Telefone', createElement(
                'a', { href: `tel:${paraDiscar(candidatura.telefone)}` }, candidatura.telefone
              ))
              : null,

            // AS ÁREAS SÃO O CONTEÚDO DESTA TELA, e não um detalhe: é a
            // única coisa que a pessoa ESCOLHEU, e é o que responde "para
            // onde essa ajuda vai?".
            //
            // A ausência delas é DESENHADA, não omitida. Candidatura sem
            // área é o desfecho parcial de acoes/voluntariado.ts (duas
            // tabelas, sem transação): a candidatura existe e a escolha se
            // perdeu. Omitir a linha nesse caso esconderia da equipe
            // exatamente o que ela precisa perguntar à pessoa — é a mesma
            // decisão de componentes/MinhaConta.ts, do outro lado.
            linhaDaFicha(
              'Áreas',
              candidatura.areas.length > 0
                ? candidatura.areas.join(', ')
                : createElement(
                  'span',
                  { className: 'voluntario__sem-areas' },
                  'não ficaram registradas — pergunte à pessoa em qual área ela quer ajudar'
                )
            ),

            linhaDaFicha('Recebida', quandoChegou(candidatura.criado_em))
          ),

          // A MENSAGEM DENTRO DE UMA DOBRA, e ela nasce ABERTA no que é novo.
          //
          // Numa tela de 375px, dez candidaturas abertas viram uma parede de
          // texto onde não se acha nada; dez fechadas viram uma tela que
          // esconde justamente o que a pessoa veio ler. A dobra aberta no
          // que ainda não teve resposta resolve as duas.
          //
          // `<details>` é elemento nativo — abre e fecha SEM uma linha de
          // JavaScript, que é a condição desta tela (regra 8). Mesmo
          // elemento e mesmas classes da dobra de /admin/contatos, inclusive
          // a seta escrita à mão do `::after` (ver estilos/admin.css: com
          // `display: flex` o triângulo nativo do <summary> some).
          //
          // A mensagem é OPCIONAL na candidatura (`mensagem text`, sem `not
          // null`): sem texto não há dobra nenhuma, em vez de uma dobra que
          // abre para o vazio.
          candidatura.mensagem
            ? createElement(
              'details',
              { className: 'painel__dobra voluntario__dobra', open: nova },
              createElement(
                'summary',
                { className: 'painel__dobra-titulo' },
                'Por que quer ajudar',
                createElement(
                  'span',
                  { className: 'painel__dobra-dica' },
                  nova ? 'ainda sem resposta' : 'toque para ler'
                )
              ),
              // `white-space: pre-wrap` no CSS: as quebras de linha que a
              // pessoa escreveu ficam como ela escreveu.
              createElement('p', { className: 'voluntario__mensagem' }, candidatura.mensagem)
            )
            : createElement(
              'p',
              { className: 'voluntario__sem-mensagem' },
              'Esta pessoa não escreveu nada além das áreas — o campo é opcional no formulário.'
            ),

          createElement(
            'div',
            { className: 'voluntario__botoes' },

            // Falar com a pessoa vem PRIMEIRO: é o gesto que a tela existe
            // para provocar. Marcar a situação é o registro do que já foi
            // feito, e vem depois.
            candidatura.email
              ? createElement(
                'a',
                {
                  className: 'voluntario__botao voluntario__botao--responder',
                  href: `mailto:${candidatura.email}`
                },
                'Falar por e-mail',
                // O nome dentro do link: "Falar por e-mail" repetido dez
                // vezes numa lista não diz qual é qual para quem navega
                // saltando de link em link.
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` com ${quem}`)
              )
              : null,

            // Um <form> por botão, cada um com a situação de destino num
            // campo escondido. Nada de `onClick`: sem JavaScript o botão
            // continua sendo um POST comum, que a Action atende igual.
            ...destinos.map((destino) => createElement(
              'form',
              {
                action: acaoSituacao,
                className: 'voluntario__form',
                key: destino.valor,
                // "Encerrar" é a única ação do painel que muda o que OUTRA
                // pessoa pode fazer no site: quem é encerrado volta a poder
                // se candidatar. A frase precisa dizer isso.
                'data-confirmar-titulo': 'Mudar a situação da candidatura?',
                'data-confirmar': destino.valor === 'inativo'
                  ? `A candidatura de ${quem} é encerrada. Ela deixa de aparecer como em andamento — e volta a poder se candidatar pelo site.`
                  : `A candidatura de ${quem} passa a aparecer como "${destino.rotulo ?? destino.botao}". Dá para mudar de novo depois.`,
                'data-confirmar-rotulo': destino.botao
              },
              createElement('input', { type: 'hidden', name: 'id', value: candidatura.id }),
              createElement('input', { type: 'hidden', name: 'situacao', value: destino.valor }),
              createElement(
                'button',
                { type: 'submit', className: 'voluntario__botao' },
                destino.botao,
                createElement('span', { className: 'apenas-leitor-de-tela' }, ` — ${quem}`)
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
