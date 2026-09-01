import { createElement } from 'react';
import type { Candidatura, Doacao, Perfil } from '@/servidor/dados/conta';

/**
 * componentes/MinhaConta.ts — o que a área do usuário DESENHA e não edita
 * (RF11): a ficha da conta, as candidaturas ao voluntariado e o histórico de
 * doações.
 *
 * Escrito com createElement em vez de JSX, mesmo motivo de
 * componentes/CardAtividade.ts, ListaEventos.ts e ListaContatos.ts: fica um
 * `.ts` puro, sem nada que só funcione dentro de uma requisição do Next, e
 * `testes/minha-conta.test.mjs` consegue montá-lo com `react-dom/server`
 * pelo runtime nativo do Node (que despe os tipos, mas não transforma JSX).
 * Esta tela exige sessão para ser servida — o que não for medido assim não é
 * medido.
 *
 * O FORMULÁRIO fica de fora deste arquivo, em
 * componentes/FormularioMeusDados.tsx: ele é Client Component (`useActionState`,
 * foco, máscara de telefone), e misturar as duas coisas obrigaria o arquivo
 * inteiro a virar cliente — o que mandaria as listas de doações para o
 * navegador em vez de deixá-las no HTML do servidor.
 *
 * ===================================================================
 * TRÊS ESTADOS EM CADA LISTA, E O DO MEIO É O QUE COSTUMA FALTAR
 * ===================================================================
 *
 *  · tem registro → desenha;
 *  · não deu para perguntar (`degradou`) → diz isso;
 *  · não há registro → o estado vazio.
 *
 * As duas tabelas estão VAZIAS hoje (RF25 e RF19–RF22 não existem), então o
 * terceiro é o caso normal. Sem o do meio, uma queda do banco seria
 * indistinguível dele — e a pessoa fecharia a tela achando que a ONG não
 * registrou a doação que ela fez. É a mesma decisão de
 * componentes/ListaContatos.ts, do outro lado do balcão.
 *
 * O ESTADO VAZIO NÃO PROMETE O QUE NÃO EXISTE (regra 2 do CLAUDE.md).
 * Candidatar-se e ofertar doação pelo site ainda não existem como tela; o
 * texto diz onde a coisa acontece hoje — os canais reais da ONG, os mesmos
 * de /doar, /contato e acoes/autenticacao.ts — em vez de apontar para um
 * botão que não há.
 */

/** Canais reais da ONG — os mesmos de /doar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/** O fuso da agenda da ONG, preso — mesmo motivo de componentes/ListaEventos.ts. */
const FUSO_DA_ONG = 'America/Sao_Paulo';

/**
 * Data por extenso, sem hora.
 *
 * O FUSO É EXPLÍCITO pelo defeito já medido no projeto (ListaEventos.ts): o
 * servidor da Netlify roda em UTC, e uma data gravada às 21h de São Paulo
 * imprime o DIA SEGUINTE se o fuso ficar por conta do processo. Aqui isso
 * apareceria como "doação registrada em 2 de setembro" para uma doação de 1º
 * de setembro — pequeno, e do tipo que ninguém consegue explicar depois.
 */
export function dataPorExtenso(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO_DA_ONG
  });
}

/**
 * As palavras de cada valor de coluna, em listas fechadas.
 *
 * Elas espelham os `check` de supabase/migrations/004_pessoas.sql, e
 * `testes/minha-conta.test.mjs` LÊ AQUELE ARQUIVO e reconcilia — do jeito
 * que testes/contatos.test.mjs faz com as situações de contato. Sem isso,
 * uma quinta situação criada no banco apareceria na tela como o texto cru da
 * coluna (`em_contato`), e ninguém descobriria até alguém ver.
 *
 * O QUE ELAS NÃO DECIDEM: nada. Esta tela só lê. As listas fechadas que
 * decidem o que o servidor ACEITA moram em compartilhado/ (é o caso de
 * `TIPOS_DE_PESSOA`, em validacao.ts, que o formulário e a Action usam) —
 * estas aqui são vocabulário de apresentação, e por isso podem viver ao lado
 * do que as desenha.
 */
export const SITUACAO_DA_CANDIDATURA: Record<string, string> = {
  novo: 'Recebida, ainda sem resposta',
  em_contato: 'A ONG está falando com você',
  ativo: 'Voluntariado ativo',
  inativo: 'Encerrada'
};

export const SITUACAO_DA_DOACAO: Record<string, string> = {
  ofertada: 'Ofertada, ainda sem resposta',
  aceita: 'Aceita pela ONG',
  recusada: 'A ONG não conseguiu receber',
  recebida: 'Recebida'
};

export const TIPO_DA_DOACAO: Record<string, string> = {
  item: 'Item',
  recurso_financeiro: 'Dinheiro'
};

export const TIPO_DE_PESSOA: Record<string, string> = {
  fisica: 'Pessoa física',
  juridica: 'Organização (pessoa jurídica)'
};

/**
 * Traduz, e quando não conhece o valor mostra o valor cru.
 *
 * Nunca "—" nem string vazia: um valor que a lista não conhece é um defeito
 * de manutenção (coluna que ganhou valor novo), e escondê-lo faria a tela
 * mentir em silêncio. Mostrando o texto cru, a próxima pessoa que abrir a
 * tela vê `em_analise` e sabe onde mexer.
 */
function traduzir(mapa: Record<string, string>, valor: string): string {
  return Object.hasOwn(mapa, valor) ? mapa[valor] : valor;
}

/**
 * Dinheiro em reais.
 *
 * `numeric(12,2)` chega do PostgREST como STRING ("150.00"), não como
 * número — é assim que o driver preserva a precisão decimal. `Number()`
 * aqui é seguro (dois dígitos decimais cabem em ponto flutuante com folga) e
 * é o que `Intl.NumberFormat` espera.
 */
export function emReais(valor: string | number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(valor));
}

/**
 * A ficha da conta: o que a pessoa TEM registrado e não muda por aqui.
 *
 * `<dl>` e não parágrafos, pelo mesmo motivo da ficha técnica de uma
 * atividade (componentes/CardAtividade.ts): são pares rótulo/valor, e o
 * leitor de tela anuncia a relação entre os dois. Reaproveita a classe
 * `.ficha`, que já existe em estilos/base.css.
 *
 * `tipo_pessoa` nulo simplesmente NÃO APARECE — regra 2 do CLAUDE.md no
 * nível do campo, a mesma decisão de CardAtividade.ts. Um rótulo "Você fala
 * por" seguido de nada pareceria defeito; e o campo é opcional de propósito
 * (coleta mínima, RNF09).
 */
export function FichaDaConta({ perfil }: { perfil: Perfil }) {
  const papeis = [
    perfil.eh_voluntario ? 'voluntariado' : null,
    perfil.eh_doador ? 'doações' : null
  ].filter(Boolean).join(' e ');

  return createElement(
    'dl',
    { className: 'ficha' },
    linhaDaFicha('E-mail', perfil.email),
    perfil.tipo_pessoa
      ? linhaDaFicha('Você fala por', traduzir(TIPO_DE_PESSOA, perfil.tipo_pessoa))
      : null,
    // "Como você quis participar" e não "Seus papéis": é o que a pessoa
    // marcou no cadastro, e as duas caixas são acumuláveis (RF10). Quem não
    // marcou nenhuma vê a frase de baixo, que é verdade e não é erro.
    linhaDaFicha(
      'Como você quis participar',
      papeis || 'Você não marcou nenhuma opção no cadastro.'
    ),
    linhaDaFicha('Conta criada em', dataPorExtenso(perfil.criado_em))
  );
}

function linhaDaFicha(rotulo: string, valor: string) {
  return createElement(
    'div',
    { key: rotulo },
    createElement('dt', null, rotulo),
    createElement('dd', null, valor)
  );
}

/** A frase de "não deu para perguntar", igual nas duas listas. */
function naoDeuParaConsultar(oQue: string) {
  return createElement(
    'p',
    { className: 'estado estado--erro' },
    `Não deu para consultar ${oQue} agora — o banco de dados não respondeu. `
    + 'Isso não quer dizer que não haja nada registrado: tente de novo em alguns instantes.'
  );
}

/**
 * RF11 — as candidaturas ao voluntariado da própria pessoa (RF25/RF26).
 */
export function MinhasCandidaturas(
  { candidaturas, degradou }: { candidaturas: Candidatura[]; degradou: boolean }
) {
  if (degradou) return naoDeuParaConsultar('suas candidaturas');

  if (candidaturas.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Você ainda não tem candidatura registrada. Candidatar-se pelo site ainda não existe: '
      + `hoje o caminho é falar com a gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail `
      + `${EMAIL_ATELIE}, contando em qual área você quer ajudar.`
    );
  }

  return createElement(
    'ul',
    { className: 'conta__lista' },
    candidaturas.map((candidatura) =>
      createElement(
        'li',
        { className: 'conta__item', key: candidatura.id },
        createElement(
          'p',
          { className: 'conta__situacao' },
          traduzir(SITUACAO_DA_CANDIDATURA, candidatura.situacao)
        ),
        createElement(
          'p',
          { className: 'conta__data' },
          'Enviada em ',
          createElement('time', { dateTime: candidatura.criado_em },
            dataPorExtenso(candidatura.criado_em))
        ),
        candidatura.mensagem ? createElement('p', null, candidatura.mensagem) : null
      )
    )
  );
}

/**
 * RF11 — o histórico de doações da própria pessoa (RF19–RF22).
 *
 * RN08 na tela, e não só no banco: o site REGISTRA doação, nunca processa
 * pagamento. É a mesma frase que /doar já diz — repetida aqui porque esta é
 * a tela onde alguém procuraria um "pagar agora".
 */
export function MinhasDoacoes({ doacoes, degradou }: { doacoes: Doacao[]; degradou: boolean }) {
  if (degradou) return naoDeuParaConsultar('suas doações');

  if (doacoes.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Nenhuma doação registrada no seu nome. Quando você doar e a ONG registrar, aparece '
      + `aqui — com a resposta de quem recebeu. Para doar, fale com a gente pelo WhatsApp `
      + `${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}. Este site não processa pagamentos.`
    );
  }

  return createElement(
    'ul',
    { className: 'conta__lista' },
    doacoes.map((doacao) =>
      createElement(
        'li',
        { className: 'conta__item', key: doacao.id },
        createElement(
          'p',
          { className: 'conta__situacao' },
          traduzir(SITUACAO_DA_DOACAO, doacao.situacao)
        ),
        createElement('p', null, doacao.descricao),
        createElement(
          'p',
          { className: 'conta__data' },
          traduzir(TIPO_DA_DOACAO, doacao.tipo),
          // `valor` é nulo em doação de item (a coluna aceita nulo), e
          // desenhar "R$ 0,00" ali seria dizer que a doação não vale nada.
          doacao.valor === null || doacao.valor === undefined
            ? null
            : ` · ${emReais(doacao.valor)}`,
          ' · registrada em ',
          createElement('time', { dateTime: doacao.criado_em },
            dataPorExtenso(doacao.criado_em))
        ),
        // A resposta da ONG (RF20/RN03) — a metade da conversa que pertence
        // a quem doou. Uma tela que dissesse "recusada" sem o motivo escrito
        // seria pior que não ter tela.
        doacao.resposta
          ? createElement('p', { className: 'conta__resposta' },
              createElement('strong', null, 'Resposta da ONG: '), doacao.resposta)
          : null,
        doacao.recebida_em
          ? createElement('p', { className: 'conta__data' },
              'Recebida em ',
              createElement('time', { dateTime: doacao.recebida_em },
                dataPorExtenso(doacao.recebida_em)))
          : null
      )
    )
  );
}
