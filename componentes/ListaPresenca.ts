import { createElement } from 'react';
import type { Inscrito } from '../servidor/dados/inscricoes.ts';
import { formatarTelefone } from '../compartilhado/validacao.ts';

/**
 * componentes/ListaPresenca.ts — a lista de presença pelo celular (RF17).
 *
 * ===================================================================
 * POR QUE ELA É UMA TELA SEPARADA DA LISTA DE INSCRITOS (RF16)
 * ===================================================================
 *
 * As duas leem a mesma consulta, e juntá-las numa só foi considerado. O que
 * separa é ONDE cada uma é usada:
 *
 *  · `/admin/eventos/inscritos` é lida ANTES do evento, sentada, para
 *    planejar: quantas pessoas, quem precisa de responsável, quem autorizou
 *    imagem. Ela mostra e-mail, telefone e CPF porque é para isso que serve;
 *  · esta é usada NA PORTA, de pé, com o celular na mão e gente em volta
 *    (regra 4). Ela mostra o NOME e mais nada que não seja necessário ali.
 *
 * Essa diferença não é de conforto, é de privacidade: um telefone segurando
 * a lista de e-mails e CPFs de trinta pessoas, virado para uma fila, é um
 * vazamento à espera de acontecer. O que fica aqui é o nome, a marca de
 * menor de idade e o telefone de quem responde por ela — este último porque
 * é exatamente o que se precisa quando uma criança não foi buscada.
 *
 * ===================================================================
 * TRÊS BOTÕES, E O TERCEIRO É O QUE FAZ A TELA SER HONESTA
 * ===================================================================
 *
 * "Veio" e "Não veio" são os dois óbvios. "Limpar" devolve a inscrição para
 * "ainda não conferido", que é um estado DIFERENTE de "faltou" — numa
 * prestação de contas de edital, uma lista que ninguém conferiu não pode
 * virar uma lista de faltas. Sem o terceiro botão, um toque errado seria
 * irreversível no único sentido que importa.
 *
 * ===================================================================
 * UM `<form>` POR PESSOA, SEM UMA LINHA DE JAVASCRIPT
 * ===================================================================
 *
 * Cada botão é `type="submit"` dentro do seu próprio `<form method="post">`
 * com a Server Action. Sem script o navegador faz o POST, recebe 303 e
 * recarrega a lista já marcada — que é o desfecho certo num galpão com
 * internet ruim, onde um `fetch` que falha em silêncio deixaria a equipe
 * achando que marcou.
 *
 * O botão do estado ATUAL vem `disabled`: marcar "veio" em quem já está
 * marcado como "veio" é um POST que não muda nada, e um alvo de 44px que
 * não faz nada é um alvo que rouba o toque do que faz.
 */

/** Alvo de toque grande, uma ação por botão. */
function botao(
  rotulo: string,
  acao: string,
  inscricaoId: string,
  eventoId: string,
  atual: boolean,
  acaoDoFormulario: (dados: FormData) => Promise<void>,
  classe: string
) {
  return createElement(
    'form',
    { action: acaoDoFormulario, className: 'presenca__form' },
    createElement('input', { type: 'hidden', name: 'inscricao_id', value: inscricaoId }),
    createElement('input', { type: 'hidden', name: 'evento_id', value: eventoId }),
    createElement('input', { type: 'hidden', name: 'acao', value: acao }),
    createElement(
      'button',
      {
        type: 'submit',
        className: `presenca__botao ${classe}`,
        disabled: atual,
        // Sem isto, quem usa leitor de tela ouve "Veio, botão" trinta vezes
        // seguidas sem saber de quem. O nome vai junto.
        'aria-label': `${rotulo}`
      },
      rotulo
    )
  );
}

export function ListaPresenca(
  { inscritos, eventoId, degradou, acaoMarcar, mensagemVazio }: {
    inscritos: Inscrito[];
    eventoId: string;
    degradou: boolean;
    acaoMarcar: (dados: FormData) => Promise<void>;
    mensagemVazio: string;
  }
) {
  if (degradou) {
    return createElement('p', { className: 'estado estado--erro' },
      'Não deu para carregar a lista agora — o banco de dados não respondeu. Isto NÃO quer '
      + 'dizer que ninguém se inscreveu. Se estiver na porta do evento, anote no papel e marque '
      + 'depois: ninguém perde a inscrição por isso.');
  }

  if (inscritos.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  const presentes = inscritos.filter((p) => p.presente === true).length;
  const conferidos = inscritos.filter((p) => p.presente !== null).length;

  return createElement(
    'div',
    null,

    // O PLACAR ANTES DA LISTA, e ele é o motivo de a equipe abrir esta tela
    // no fim do evento: é o número que vai para a prestação de contas. Os
    // dois números são ditos, e não só o primeiro, porque "12 presentes"
    // sozinho não diz se os outros faltaram ou se ninguém conferiu.
    createElement(
      'p',
      { className: 'presenca__placar', role: 'status' },
      createElement('strong', null, `${presentes} de ${inscritos.length} presentes`),
      conferidos < inscritos.length
        ? ` · ${inscritos.length - conferidos} ainda sem conferir`
        : ' · lista toda conferida'
    ),

    createElement(
      'ul',
      { className: 'lista-presenca' },
      inscritos.map((pessoa) =>
        createElement(
          'li',
          {
            className: 'presenca__item',
            key: pessoa.id,
            // O estado da linha vira atributo, para o CSS pintar sem
            // precisar de classe condicional — e para um teste conseguir
            // afirmar o estado sem depender de nome de classe.
            'data-presente': pessoa.presente === null ? 'sem-conferir'
              : pessoa.presente ? 'sim' : 'nao'
          },

          createElement(
            'div',
            { className: 'presenca__pessoa' },
            createElement('span', { className: 'presenca__nome' }, pessoa.nome),
            pessoa.eh_menor
              ? createElement(
                'span',
                { className: 'presenca__responsavel' },
                'Menor de 18',
                pessoa.responsavel_telefone
                  ? createElement('span', null, ' · responsável: ', createElement('a',
                    { href: `tel:${pessoa.responsavel_telefone.replace(/\D/g, '')}` },
                    formatarTelefone(pessoa.responsavel_telefone)))
                  : null
              )
              : null
          ),

          createElement(
            'div',
            { className: 'presenca__botoes' },
            botao('Veio', 'presente', pessoa.id, eventoId,
              pessoa.presente === true, acaoMarcar, 'presenca__botao--sim'),
            botao('Não veio', 'ausente', pessoa.id, eventoId,
              pessoa.presente === false, acaoMarcar, 'presenca__botao--nao'),
            // O terceiro só aparece quando há o que limpar — ver o
            // cabeçalho. Um botão "Limpar" numa linha que nunca foi marcada
            // é um alvo de 44px que não faz nada.
            pessoa.presente !== null
              ? botao('Limpar', 'limpar', pessoa.id, eventoId,
                false, acaoMarcar, 'presenca__botao--limpar')
              : null
          )
        )
      )
    )
  );
}
