import { createElement, Fragment } from 'react';
import { ROTULO_DE_SITUACAO, ordenarParaModeracao, type SituacaoDeDepoimento } from '../compartilhado/depoimentos.ts';

/**
 * A fila de moderação (painel). Lê e decide: três botões por cartão, cada um
 * um `<form>` com Server Action, que funciona sem JavaScript. Não edita nem
 * apaga o texto — é registro do que a pessoa escreveu.
 *
 * `acaoModerar` é prop pelo motivo de `ListaContatos`: Server Action não
 * importa num teste do Node, uma string no lugar serve.
 */
type Item = {
  id: string; nome: string; atividade: string | null; texto: string;
  situacao: string; criado_em: string;
};
type Acao = string | ((dados: FormData) => void | Promise<void>);

const BOTOES: Array<{ para: SituacaoDeDepoimento; rotulo: string; mostrarSe: SituacaoDeDepoimento[] }> = [
  { para: 'aprovado', rotulo: 'Aprovar e publicar', mostrarSe: ['pendente', 'recusado'] },
  { para: 'recusado', rotulo: 'Recusar', mostrarSe: ['pendente'] },
  { para: 'recusado', rotulo: 'Tirar do ar', mostrarSe: ['aprovado'] },
  { para: 'pendente', rotulo: 'Voltar para a fila', mostrarSe: ['aprovado', 'recusado'] }
];

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Sao_Paulo'
});

export function ListaDepoimentosDoPainel({ itens, acaoModerar, degradou }: {
  itens: Item[]; acaoModerar: Acao; degradou: boolean;
}) {
  if (degradou) {
    return createElement('p', { className: 'estado estado--erro' },
      'Não deu para carregar os depoimentos agora — o banco de dados não respondeu, ou a '
      + 'migration 014 ainda não foi aplicada. Nada foi perdido.');
  }
  if (itens.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' },
      'Nenhum depoimento recebido ainda. Eles chegam pelo formulário da página de depoimentos.');
  }

  return createElement(
    Fragment,
    null,
    createElement('ul', { className: 'contatos' },
      ordenarParaModeracao(itens).map((item) =>
        createElement('li', { className: 'contato', key: item.id },
          createElement('p', { className: 'contato__marcas' },
            createElement('span', {
              className: item.situacao === 'pendente'
                ? 'contato__estado contato__estado--nova' : 'contato__estado'
            }, ROTULO_DE_SITUACAO[item.situacao as SituacaoDeDepoimento] ?? item.situacao),
            createElement('span', { className: 'contato__origem' }, quando(item.criado_em))
          ),
          createElement('h2', { className: 'contato__nome' }, item.nome),
          item.atividade
            ? createElement('p', { className: 'contato__origem' }, `Atividade: ${item.atividade}`)
            : null,
          createElement('p', { className: 'contato__mensagem' }, item.texto),
          createElement('div', { className: 'contato__botoes depoimento__botoes' },
            BOTOES.filter((b) => b.mostrarSe.includes(item.situacao as SituacaoDeDepoimento)).map((b) =>
              createElement('form', { action: acaoModerar as string, method: 'post', className: 'contato__form', key: b.rotulo },
                createElement('input', { type: 'hidden', name: 'id', value: item.id }),
                createElement('input', { type: 'hidden', name: 'situacao', value: b.para }),
                createElement('button', { type: 'submit', className: 'contato__botao' }, b.rotulo)
              )
            )
          )
        )
      )
    ),
    createElement('p', { className: 'painel__aviso' },
      'Aprovar publica o nome e o texto no site, com a autorização que a própria pessoa deu. '
      + 'Esta tela não edita nem apaga o que foi escrito. Para remover um depoimento a pedido de '
      + 'quem escreveu, tire do ar aqui e fale com quem cuida do site para apagar de vez.')
  );
}
