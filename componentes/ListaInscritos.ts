import { createElement } from 'react';
import type { Inscrito } from '../servidor/dados/inscricoes.ts';
import { formatarTelefone, formatarCpf } from '../compartilhado/validacao.ts';

/**
 * componentes/ListaInscritos.ts — quem se inscreveu num evento (RF16).
 *
 * Escrito com createElement (arquivo `.ts`, não `.tsx`) pelo mesmo motivo
 * de CardAtividade.ts e Paginacao.ts: assim o runtime nativo do Node o
 * importa e o teste o renderiza de verdade, sem subir o Next. Os imports
 * são RELATIVOS e com extensão pelo mesmo motivo — o runtime do Node não
 * resolve o alias `@/...` do tsconfig.
 *
 * ===================================================================
 * ESTA É A TELA COM MAIS DADO PESSOAL DE TERCEIRO DO PROJETO INTEIRO
 * ===================================================================
 *
 * Mais que `/admin/contatos`, que era a recordista até aqui. Aqui há nome,
 * e-mail, telefone, CPF — e, quando quem se inscreveu é menor de idade,
 * nome e telefone de quem responde por ela. O público da ONG começa aos 10
 * anos.
 *
 * Três consequências que estão no desenho, e não só no comentário:
 *
 *  · a AUTORIZAÇÃO DE IMAGEM (RN07) aparece em toda linha, como marca
 *    visível, e não escondida atrás de um "ver detalhes". Ela é a
 *    informação que decide se aquela pessoa pode sair numa foto do site, e
 *    quem vai fotografar precisa conseguir ler isso correndo os olhos;
 *  · o CPF só é desenhado quando existe. Ele é pedido apenas quando a
 *    instituição parceira exige (RN06), e um campo "CPF: —" em toda linha
 *    normalizaria a ideia de que ele deveria estar ali;
 *  · a tela DIZ, por escrito, que a lista não deve ser reencaminhada. É a
 *    mesma disciplina de componentes/PainelExportacoes.ts — a LGPD não
 *    termina quando o dado aparece na tela.
 *
 * ===================================================================
 * A TELA LÊ. ELA NÃO EDITA E NÃO APAGA.
 * ===================================================================
 *
 * O que a pessoa preencheu é registro. Corrigir um nome errado aqui seria
 * um gesto sem desfazer feito num celular, de pé; e apagar uma inscrição
 * apagaria a prova de que alguém participou, que é o que a ONG usa para
 * prestar contas de edital. `testes/inscritos.test.mjs` falha se aparecer
 * um `.insert(`, um `.update(` ou um `.delete(` na página desta lista.
 */

/** O que a marca de presença mostra, para cada um dos três estados. */
function marcaDePresenca(presente: boolean | null) {
  if (presente === null) {
    return createElement('span', { className: 'etiqueta etiqueta--neutra' },
      'Presença não conferida');
  }
  return presente
    ? createElement('span', { className: 'etiqueta etiqueta--sim' }, 'Veio')
    : createElement('span', { className: 'etiqueta etiqueta--nao' }, 'Não veio');
}

export function ListaInscritos(
  { inscritos, degradou, mensagemVazio }: {
    inscritos: Inscrito[];
    degradou: boolean;
    mensagemVazio: string;
  }
) {
  // FALHA DE CONSULTA NÃO VIRA LISTA VAZIA, e aqui isso é mais grave que em
  // qualquer outra tela: "ninguém se inscreveu" faz a equipe não ir, ou ir
  // sem material. Ver servidor/dados/inscricoes.ts.
  if (degradou) {
    return createElement('p', { className: 'estado estado--erro' },
      'Não deu para carregar a lista de inscritos agora — o banco de dados não respondeu. '
      + 'Isto NÃO quer dizer que ninguém se inscreveu. Tente de novo em alguns instantes.');
  }

  if (inscritos.length === 0) {
    return createElement('p', { className: 'estado estado--vazio' }, mensagemVazio);
  }

  return createElement(
    'ul',
    { className: 'lista-painel' },
    inscritos.map((pessoa) =>
      createElement(
        'li',
        { className: 'cartao-painel', key: pessoa.id },

        createElement('h3', { className: 'cartao-painel__titulo' }, pessoa.nome),

        createElement(
          'p',
          { className: 'cartao-painel__marcas' },
          marcaDePresenca(pessoa.presente),
          ' ',
          // RN07 — a marca mais importante da linha. As duas formas são
          // escritas por extenso: um ícone sozinho, ou só a ausência de um,
          // não diz nada a quem usa leitor de tela (regra 8).
          pessoa.autoriza_imagem
            ? createElement('span', { className: 'etiqueta etiqueta--sim' }, 'Autoriza imagem')
            : createElement('span', { className: 'etiqueta etiqueta--nao' },
              'NÃO autoriza imagem'),
          pessoa.eh_menor
            ? createElement('span', { className: 'etiqueta etiqueta--atencao' }, ' Menor de 18')
            : null
        ),

        createElement(
          'dl',
          { className: 'cartao-painel__dados' },
          createElement('div', null,
            createElement('dt', null, 'E-mail'),
            createElement('dd', null,
              createElement('a', { href: `mailto:${pessoa.email}` }, pessoa.email))),

          pessoa.telefone
            ? createElement('div', null,
              createElement('dt', null, 'Telefone'),
              createElement('dd', null, createElement('a',
                { href: `tel:${pessoa.telefone.replace(/\D/g, '')}` },
                formatarTelefone(pessoa.telefone))))
            : null,

          // Só quando existe — ver o cabeçalho sobre a RN06.
          pessoa.cpf
            ? createElement('div', null,
              createElement('dt', null, 'CPF'),
              createElement('dd', null, formatarCpf(pessoa.cpf)))
            : null,

          pessoa.eh_menor
            ? createElement('div', null,
              createElement('dt', null, 'Responsável'),
              createElement('dd', null,
                pessoa.responsavel_nome ?? '—',
                pessoa.responsavel_telefone
                  ? createElement('span', null, ' · ', createElement('a',
                    { href: `tel:${pessoa.responsavel_telefone.replace(/\D/g, '')}` },
                    formatarTelefone(pessoa.responsavel_telefone)))
                  : null))
            : null,

          createElement('div', null,
            createElement('dt', null, 'Inscreveu-se em'),
            createElement('dd', null,
              createElement('time', { dateTime: pessoa.criado_em },
                new Date(pessoa.criado_em).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'America/Sao_Paulo'
                }))))
        )
      )
    )
  );
}
