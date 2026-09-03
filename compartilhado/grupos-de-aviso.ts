/**
 * compartilhado/grupos-de-aviso.ts — para quem um aviso pode ser mandado
 * (RF28).
 *
 * ===================================================================
 * LISTA FECHADA, E AQUI ISSO VALE MAIS QUE NAS OUTRAS
 * ===================================================================
 *
 * Nas outras listas fechadas do projeto (`?aviso=`, os conjuntos de
 * exportação, o `type` do link de e-mail) o que está do outro lado é uma
 * frase ou uma consulta. Aqui é UMA LISTA DE ENDEREÇOS DE E-MAIL de
 * terceiros, e o gesto é irreversível: e-mail enviado não volta.
 *
 * Sem a lista, o caminho fácil seria mandar o critério na requisição — e
 * `/admin/avisos` viraria um jeito de escolher quem recebe escrevendo a
 * consulta. Aqui o parâmetro só ESCOLHE um dos três grupos abaixo; qualquer
 * outro valor não é grupo nenhum.
 *
 * ===================================================================
 * NENHUM DELES É "TODO MUNDO"
 * ===================================================================
 *
 * Não existe grupo que alcance toda a base. É de propósito: um botão que
 * manda e-mail para todas as pessoas que já tocaram no site é o botão que
 * ninguém deveria ter num celular, de pé, no meio de um evento (regra 4).
 * Cada grupo abaixo tem um vínculo declarado com a ONG.
 *
 * ARQUIVO SEM NENHUM IMPORT, de propósito, como os outros de
 * compartilhado/ que precisam ser medidos sem subir o Next.
 */

export type ChaveDeGrupo = 'voluntarios' | 'doadores' | 'inscritos';

export type DescricaoDeGrupo = {
  chave: ChaveDeGrupo;
  /** O texto da opção, na tela. */
  rotulo: string;
  /** Quem está dentro, dito para quem vai apertar o botão. */
  descricao: string;
  /** Precisa que a equipe escolha um evento junto? */
  exigeEvento: boolean;
};

export const GRUPOS_DE_AVISO: DescricaoDeGrupo[] = [
  {
    chave: 'voluntarios',
    rotulo: 'Voluntárias e voluntários ativos',
    descricao: 'Quem tem candidatura marcada como ATIVA em /admin/voluntarios. É o mesmo '
      + 'grupo que enxerga o mural no site — quem está como "nova" ou "em contato" não '
      + 'recebe.',
    exigeEvento: false
  },
  {
    chave: 'doadores',
    rotulo: 'Quem já ofertou doação',
    descricao: 'Quem registrou uma oferta de doação pelo site, em qualquer situação.',
    exigeEvento: false
  },
  {
    chave: 'inscritos',
    rotulo: 'Inscritos em um evento',
    descricao: 'Todo mundo que se inscreveu no evento escolhido — inclusive quem ainda não '
      + 'foi conferido na lista de presença.',
    exigeEvento: true
  }
];

export function ehChaveDeGrupo(valor: unknown): valor is ChaveDeGrupo {
  return typeof valor === 'string'
    && GRUPOS_DE_AVISO.some((grupo) => grupo.chave === valor);
}

/** A descrição de um grupo, ou `null` — nunca uma exceção. */
export function grupoPorChave(valor: unknown): DescricaoDeGrupo | null {
  if (!ehChaveDeGrupo(valor)) return null;
  return GRUPOS_DE_AVISO.find((grupo) => grupo.chave === valor) ?? null;
}
