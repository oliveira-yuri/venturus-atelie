/**
 * compartilhado/albuns-e-projetos.ts — a ponte entre o nome do álbum de uma
 * foto e a atividade a que ela pertence.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como os outros `compartilhado/*` puros: assim os testes o importam pelo
 * runtime nativo do Node.
 *
 * ===================================================================
 * POR QUE COMPARAR NOMES, EM VEZ DE TER UMA COLUNA
 * ===================================================================
 *
 * O pedido V1 quer "uma menção ao respectivo projeto que a foto da galeria
 * pertence". A relação correta seria uma coluna — `midia.atividade_id`
 * referenciando `public.atividades` — e ela NÃO EXISTE: `public.midia` tem
 * `evento_id` e `publicacao_id`, mas nada que aponte para atividade
 * (002_conteudo.sql).
 *
 * Criar essa coluna é migration, e migration neste projeto é uma pessoa
 * colando SQL no painel do Supabase. Mais do que isso: seria uma coluna
 * nova para uma relação que a equipe JÁ EXPRESSA sem saber, escrevendo o
 * nome da oficina no campo `album` — a ajuda daquele campo diz, literal,
 * "o nome da oficina, do evento ou do projeto".
 *
 * Então a ponte é feita por NOME, e a comparação é frouxa de propósito
 * (ver `mesmaCoisa`): a equipe digita no celular, e "Cafú e o Café" e
 * "cafu e o cafe" são a mesma oficina para qualquer pessoa que olhe.
 *
 * ===================================================================
 * O QUE ISSO NÃO É
 * ===================================================================
 *
 * Não é integridade referencial. Renomear uma atividade quebra o vínculo
 * em silêncio, e a foto volta a ser um álbum sem link — degradação
 * aceitável, porque o pior desfecho é a galeria continuar exatamente como
 * era antes deste arquivo existir. Nenhuma foto some, nenhum álbum some.
 *
 * O dia em que a ONG quiser que isso seja garantido, o caminho é a coluna
 * — e aí este arquivo é apagado, não estendido.
 */

/**
 * Duas grafias que uma pessoa consideraria a mesma coisa.
 *
 * Ignora caixa, acento, pontuação e espaço repetido. NÃO ignora palavras
 * diferentes: "Cafú e o Café" não casa com "Café", e é assim que tem de
 * ser — casar por prefixo ligaria a foto ao projeto errado.
 */
export function normalizarNome(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    // Remove os diacríticos que a decomposição separou.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mesmaCoisa(um: unknown, outro: unknown): boolean {
  const a = normalizarNome(um);
  return a.length > 0 && a === normalizarNome(outro);
}

export type ProjetoParaLigar = { id: string; titulo: string };

/**
 * A atividade cujo título é o nome deste álbum, se houver.
 *
 * Devolve `null` quando não há — e a galeria simplesmente não desenha o
 * link, em vez de desenhar um link para lugar nenhum.
 */
export function projetoDoAlbum(
  album: string,
  projetos: ProjetoParaLigar[]
): ProjetoParaLigar | null {
  return projetos.find((projeto) => mesmaCoisa(projeto.titulo, album)) ?? null;
}

/**
 * O endereço do projeto na página pública.
 *
 * `/projetos/<id>` — a página PRÓPRIA daquela atividade, com sinopse e
 * ficha técnica.
 *
 * ANTES ERA `/projetos#<id>`, uma âncora no cartão da lista, e o comentário
 * daqui dizia "a página de projetos é uma só". Deixou de ser: o pedido V1
 * (02/09/2026) deu página própria a cada atividade. A âncora continua
 * existindo — `CardAtividade` ainda põe o `id` no `<article>` —, então o
 * link não estava QUEBRADO; ele levava a pessoa ao resumo quando a página
 * inteira já existia a um clique dali.
 *
 * QUEM PEGOU ISSO FOI A SUÍTE, e só com credenciais: `public.midia` estava
 * vazia, então o link nunca chegava a ser desenhado. É o mesmo padrão do
 * item 0x do CLAUDE.md — o teste que só falha quando aparece conteúdo.
 */
export function enderecoDoProjeto(projeto: ProjetoParaLigar): string {
  return `/projetos/${projeto.id}`;
}
