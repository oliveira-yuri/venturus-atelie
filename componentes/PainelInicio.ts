import { createElement, Fragment } from 'react';

/**
 * A home do painel (RF33): "o que você quer fazer?", e nada além disso.
 *
 * ===================================================================
 * O DEFEITO QUE ESTE ARQUIVO EXISTE PARA NÃO REPETIR
 * ===================================================================
 *
 * A home do painel do site antigo (hoje congelada em
 * testes/apoio/html-original/admin/index.html) prometia SEIS telas que
 * nunca existiram: eventos, presença, contatos, mais, doações,
 * publicações. Seis links, seis becos. É um dos defeitos que este projeto
 * documenta, e a tentação de repeti-lo é grande justamente agora: as três
 * telas de verdade nascem só nas tarefas P2, P3 e P4.
 *
 * DECISÃO (Tarefa P1): as três aparecem, mas **só vira link a tela que já
 * existe**. Enquanto não existe, o item é texto — sem `<a>`, sem `href`,
 * sem nada clicável — com a marca "ainda não está pronta" escrita ao lado,
 * na frase, não só numa cor.
 *
 * Por que não simplesmente omitir o que não existe: a equipe da ONG vai
 * abrir esta tela antes de P2/P3/P4 ficarem prontas, e uma home vazia sob
 * o título "o que você quer fazer?" não responde nada — a pessoa fica sem
 * saber se o painel está quebrado, se ela não tem permissão, ou se aquilo
 * é tudo que existe. Listar com a marca de preparo responde as três de uma
 * vez. E o que a torna diferente da promessa do site antigo é que aqui ela
 * não pode envelhecer em silêncio: `testes/painel-guarda.test.mjs`
 * reconcilia `TELAS_DO_PAINEL` contra as rotas que de fato existem em
 * `app/` e fica vermelho nos DOIS sentidos — tela marcada como pronta sem
 * rota, e rota criada sem alguém virar a marca. Quem escrever a P2
 * descobre isso pelo teste, não pela memória.
 *
 * Escrito com createElement, não JSX, pelo mesmo motivo de
 * componentes/ListaAreas.ts e irmãos: fica um `.ts` puro, que o runtime
 * nativo do Node importa e `react-dom/server` renderiza dentro de um teste
 * — sem subir o Next, sem navegador e, o que importa aqui, SEM SESSÃO. É
 * a única forma de medir o que esta tela desenha enquanto não existe conta
 * de equipe utilizável neste projeto (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2).
 */

export type TelaDoPainel = {
  /** Rota da tela. Só vira `href` quando `pronta` for true. */
  caminho: string;
  titulo: string;
  /** O que se faz lá — frase funcional de interface, não texto da ONG. */
  descricao: string;
  /**
   * A rota existe em `app/`? Reconciliado contra o sistema de arquivos por
   * testes/painel-guarda.test.mjs — mentir aqui deixa a suíte vermelha.
   */
  pronta: boolean;
};

/**
 * As telas do painel, na ordem em que foram construídas: as três do plano
 * do bloco (docs/superpowers/plans/2026-08-31-painel-administrativo.md) e,
 * desde o RF29, a de mensagens recebidas — que não estava naquele plano e
 * entrou porque o formulário público de /contato (RF07) passou a gravar de
 * verdade e não havia onde ler.
 *
 * Nenhuma outra entra aqui por antecipação. Quatro saíram desta frase, cada
 * uma quando a tela passou a EXISTIR: a gestão de voluntários (RF26) e
 * eventos (RF13), em 01/09/2026; e o relatório (RF32), em 02/09/2026.
 *
 * A LISTA DE PRESENÇA (RF17) EXISTE E CONTINUA FORA DAQUI, de propósito, e
 * é a única exceção — ela e a lista de inscritos (RF16) moram DENTRO de
 * `/admin/eventos/`, alcançadas pelo botão "Inscritos" de cada evento.
 * Listá-las na home seria oferecer "lista de presença" sem dizer de qual
 * evento, que é o mesmo motivo de `/admin/publicacoes/editar` não estar
 * aqui. O teste de reconciliação concorda: ele cobra rota de PRIMEIRO nível
 * (`/admin/<algo>`), e as duas são de segundo.
 */
export const TELAS_DO_PAINEL: TelaDoPainel[] = [
  {
    caminho: '/admin/publicacoes',
    titulo: 'Notícias e campanhas',
    descricao: 'Escrever, editar e publicar o que aparece na página de notícias.',
    // Virou `true` na Tarefa P2, no mesmo commit que criou
    // app/admin/publicacoes/ — é o que o teste de reconciliação em
    // testes/painel-inicio.test.mjs cobra nos dois sentidos.
    pronta: true
  },
  {
    caminho: '/admin/galeria',
    titulo: 'Galeria',
    descricao: 'Subir foto e vídeo, escrever a descrição e registrar a autorização de uso de imagem.',
    // Virou `true` na Tarefa P3, no mesmo commit que criou app/admin/galeria/
    // — é o que o teste de reconciliação em testes/painel-inicio.test.mjs
    // cobra nos dois sentidos. A descrição continua falando em vídeo porque é
    // o que a tela vai fazer; hoje só imagem entra pelo formulário (o corpo de
    // uma Server Action vai até 8 MB — ver next.config.ts, com a medição).
    pronta: true
  },
  {
    caminho: '/admin/atividades',
    titulo: 'Atividades',
    descricao: 'Corrigir o texto das atividades que aparecem na página de projetos.',
    // Virou `true` na Tarefa P4, no mesmo commit que criou
    // app/admin/atividades/ — é o que o teste de reconciliação em
    // testes/painel-inicio.test.mjs cobra nos dois sentidos. A descrição
    // continua falando só em CORRIGIR porque é só isso que a tela faz: não
    // se cria nem se apaga atividade por ali (ver acoes/atividades.ts).
    pronta: true
  },
  {
    caminho: '/admin/eventos',
    titulo: 'Agenda',
    descricao: 'Marcar oficina, apresentação e vivência, e publicar na agenda do site.',
    // Virou `true` no RF13, no mesmo commit que criou app/admin/eventos/ — é
    // o que o teste de reconciliação em testes/painel-inicio.test.mjs cobra
    // nos dois sentidos.
    //
    // A DESCRIÇÃO NÃO FALA EM INSCRIÇÃO, e a ausência é deliberada: a tela
    // publica a data, não recebe inscrito. Inscrição sem conta é RF15 e não
    // existe — prometê-la aqui repetiria o defeito que este arquivo inteiro
    // existe para não repetir.
    pronta: true
  },
  {
    caminho: '/admin/contatos',
    titulo: 'Mensagens recebidas',
    descricao: 'Ler o que as pessoas escrevem pelo formulário do site e marcar o andamento.',
    // Virou `true` no RF29, no mesmo commit que criou app/admin/contatos/ —
    // é o que o teste de reconciliação em testes/painel-inicio.test.mjs
    // cobra nos dois sentidos.
    //
    // ELA É A ÚNICA DAS QUATRO QUE NÃO MEXE NO SITE, e a descrição diz isso
    // sem usar a palavra "publicar": as outras três existem para pôr coisa
    // no ar; esta existe para não perder gente. Entrou depois porque o
    // formulário público que a alimenta (RF07) só passou a gravar de
    // verdade em 01/09/2026 — até então não havia o que ler.
    pronta: true
  },
  {
    caminho: '/admin/voluntarios',
    titulo: 'Voluntários',
    descricao: 'Ler quem se candidatou ao voluntariado e marcar em que pé está cada candidatura.',
    // Virou `true` no RF26, no mesmo commit que criou app/admin/voluntarios/ —
    // é o que o teste de reconciliação em testes/painel-inicio.test.mjs cobra
    // nos dois sentidos.
    //
    // A DESCRIÇÃO NÃO FALA EM "CADASTRAR VOLUNTÁRIO", e a diferença é a
    // mesma da tela de mensagens: o conteúdo daqui não é criado pela equipe,
    // é criado por quem se oferece de fora. Prometer cadastro seria prometer
    // um botão que esta tela não tem (ver acoes/voluntarios.ts: sem insert,
    // sem delete, e o update grava uma coluna só).
    pronta: true
  },
  {
    caminho: '/admin/acervo',
    titulo: 'Acervo',
    descricao: 'Subir cartilha, ficha técnica e outros materiais para as pessoas baixarem.',
    // Virou `true` no RF37, no mesmo commit que criou app/admin/acervo/ — é
    // o que o teste de reconciliação em testes/painel-inicio.test.mjs cobra
    // nos dois sentidos.
    //
    // A descrição diz "para as pessoas baixarem" e não "publicar no site"
    // porque é a única tela cujo produto é um ARQUIVO que sai do site: o
    // material vai parar no computador de uma professora, e é assim que ele
    // é usado.
    pronta: true
  },
  {
    caminho: '/admin/doacoes',
    titulo: 'Doações',
    descricao: 'Responder quem ofereceu uma doação e registrar o que o Ateliê recebeu.',
    // Virou `true` no RF19–RF22, no mesmo commit que criou app/admin/doacoes/
    // — é o que o teste de reconciliação em testes/painel-inicio.test.mjs
    // cobra nos dois sentidos.
    //
    // A DESCRIÇÃO NÃO FALA EM DINHEIRO RECEBIDO nem em recibo, e isso é
    // regra 2 mais RN08: o site registra doação e nunca processa pagamento
    // (a /doar diz isso em texto). "Registrar o que o Ateliê recebeu"
    // significa escrever o que chegou, não movimentar conta nenhuma.
    //
    // É a SEGUNDA das cinco que não mexe no site, como a de mensagens: as
    // três primeiras existem para pôr coisa no ar; estas duas existem para
    // não perder gente.
    pronta: true
  },
  {
    caminho: '/admin/relatorio',
    titulo: 'Relatório em PDF',
    descricao: 'Os números do site numa folha só, para anexar a uma prestação de contas.',
    // Virou `true` em 02/09/2026, no mesmo commit que criou
    // app/admin/relatorio/ — é o que o teste de reconciliação cobra nos
    // dois sentidos.
    pronta: true
  },
  {
    caminho: '/admin/avisos',
    titulo: 'Avisos para voluntários',
    descricao: 'Recados que aparecem no mural do site e podem ir por e-mail.',
    // Virou `true` em 02/09/2026, no mesmo commit que criou app/admin/avisos/.
    pronta: true
  }
];

/**
 * O aviso de que a lista tem item que ainda não abre.
 *
 * Fica FORA do `<li>`, uma vez só, e não repetido em cada item: repetir a
 * mesma frase três vezes é ruído para quem enxerga e é três vezes a mesma
 * leitura para quem usa leitor de tela.
 */
const AVISO_DE_PREPARO = 'As telas marcadas como "ainda não está pronta" não existem no site: '
  + 'elas aparecem aqui para você saber o que vem, e viram link no dia em que ficarem prontas.';

export function PainelInicio({ telas }: { telas: TelaDoPainel[] }) {
  const faltaAlguma = telas.some((tela) => !tela.pronta);

  return createElement(
    Fragment,
    null,
    createElement(
      'ul',
      { className: 'painel__telas' },
      telas.map((tela) => createElement(
        'li',
        { className: 'painel__tela', key: tela.caminho },
        tela.pronta
          // Alvo de toque grande e o cartão INTEIRO clicável: a operação é
          // no celular, de pé (regra 4). O `<a>` embrulha título e
          // descrição para que o dedo não precise acertar a palavra.
          ? createElement(
            'a',
            { className: 'painel__tela-alvo', href: tela.caminho },
            createElement('strong', { className: 'painel__tela-titulo' }, tela.titulo),
            createElement('span', { className: 'painel__tela-descricao' }, tela.descricao)
          )
          // Sem <a> e sem href: um link que devolve 404 dentro do painel é
          // exatamente o defeito do site antigo. O estado "em preparo" é
          // TEXTO — quem usa leitor de tela ouve a frase, não depende de
          // enxergar uma cor mais clara.
          : createElement(
            'div',
            { className: 'painel__tela-alvo painel__tela-alvo--em-preparo' },
            createElement('strong', { className: 'painel__tela-titulo' }, tela.titulo),
            createElement('span', { className: 'painel__tela-preparo' }, 'ainda não está pronta'),
            createElement('span', { className: 'painel__tela-descricao' }, tela.descricao)
          )
      ))
    ),
    faltaAlguma
      ? createElement('p', { className: 'painel__aviso' }, AVISO_DE_PREPARO)
      : null
  );
}
