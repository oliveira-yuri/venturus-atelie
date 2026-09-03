/**
 * compartilhado/filtro-de-voluntarios.ts — o filtro da fila de candidaturas
 * (pedido V1: "filtro: nome, email, cpf/pj, área de atuação e status").
 *
 * =====================================================================
 * ELE FILTRA EM MEMÓRIA, E ISSO É DECISÃO
 * =====================================================================
 *
 * A alternativa era filtrar no PostgREST. Ela quebra em dois lugares:
 *
 *  · nome e e-mail moram em `public.perfis`, e área mora dois níveis
 *    abaixo (`voluntario_areas` → `areas_voluntariado`). Filtrar por eles
 *    exige `!inner` aninhado, que é frágil e que NENHUMA das suítes deste
 *    projeto alcança — `npm run rls` fala com o Postgres pelo driver, não
 *    pelo PostgREST, e o painel não tem sessão de equipe na suíte. Seria
 *    código que ninguém consegue medir;
 *  · a contagem. Com `count: 'exact'` e filtro no embed, o número que
 *    volta conta as linhas do PAI, não as que sobraram — e a paginação
 *    passaria a mentir.
 *
 * Filtrando aqui, a função é PURA: entra uma lista, sai uma lista, e
 * `testes/voluntarios.test.mjs` a exercita sem banco nenhum.
 *
 * O PREÇO, dito em voz alta: a consulta traz TODAS as candidaturas antes
 * de recortar. Com a base desta ONG isso é dezenas de linhas. O dia em que
 * pesar tem sinal visível — a tela demorando a abrir —, e a saída então é
 * uma view no banco que já devolva o filtro pronto. Escrito aqui para que
 * a conta seja uma decisão, e não um esquecimento.
 *
 * ARQUIVO SEM NENHUM IMPORT, como os outros de compartilhado/ que precisam
 * ser medidos pelo runtime nativo do Node.
 */

/** O que o formulário de filtro devolve. Tudo texto, tudo opcional. */
export type FiltroDeVoluntarios = {
  /** Casa com o nome OU o e-mail. Um campo só — ver `combina`. */
  busca: string;
  /** O nome de uma área de atuação, exato. */
  area: string;
  /** Uma das quatro situações do `check` do banco. */
  situacao: string;
  /** 'fisica' | 'juridica' — o "CPF/PJ" do pedido. */
  tipoPessoa: string;
};

export const FILTRO_VAZIO: FiltroDeVoluntarios =
  { busca: '', area: '', situacao: '', tipoPessoa: '' };

/**
 * As opções de tipo de pessoa.
 *
 * O PEDIDO DIZ "CPF/PJ", E NÃO EXISTE CPF NO BANCO. `public.perfis` guarda
 * `tipo_pessoa` com `check (tipo_pessoa in ('fisica', 'juridica'))` — não
 * há coluna de CPF em perfil nenhum, e não deve haver: coleta mínima
 * (RNF09). O CPF existe só em `public.inscricoes`, quando o evento exige
 * (RN06), e não tem ligação com conta.
 *
 * Então o que este filtro oferece é a distinção que o pedido queria fazer
 * — pessoa física ou jurídica — com o dado que existe.
 */
export const TIPOS_DE_PESSOA_DO_FILTRO: Array<{ valor: string; rotulo: string }> = [
  { valor: 'fisica', rotulo: 'Pessoa física' },
  { valor: 'juridica', rotulo: 'Pessoa jurídica' }
];

/** Um texto comparável: sem acento, sem caixa, sem espaço nas pontas. */
export function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // ESCAPES, e não os caracteres literais:
    // eles são marcas de combinação INVISÍVEIS num editor, e qualquer
    // "limpeza de espaços em branco" as apagaria sem deixar rastro no diff.
    // O defeito reapareceria longe daqui, como "a busca parou de achar nome
    // com acento". Mesma precaução do BOM em compartilhado/exportacao.ts.
    .toLowerCase()
    .trim();
}

/** Lê o filtro da URL. Valor que não é texto vira vazio, nunca erro. */
export function lerFiltro(
  parametros: Record<string, string | string[] | undefined>
): FiltroDeVoluntarios {
  const texto = (chave: string) =>
    (typeof parametros[chave] === 'string' ? parametros[chave] : '').trim();

  return {
    busca: texto('busca'),
    area: texto('area'),
    situacao: texto('situacao'),
    tipoPessoa: texto('tipo_pessoa')
  };
}

export function filtroAtivo(filtro: FiltroDeVoluntarios): boolean {
  return Boolean(filtro.busca || filtro.area || filtro.situacao || filtro.tipoPessoa);
}

/**
 * O filtro, como parâmetros de URL — para os links de paginação
 * preservarem o que a equipe escolheu.
 *
 * SEM ISSO, IR PARA A PÁGINA 2 APAGA O FILTRO, e a pessoa vê uma lista
 * diferente da que estava lendo sem entender por quê. Só entram os campos
 * preenchidos: um `?busca=` vazio na URL é sujeira que a equipe copia e
 * cola por engano.
 */
export function parametrosDoFiltro(filtro: FiltroDeVoluntarios): Record<string, string> {
  const saida: Record<string, string> = {};
  if (filtro.busca) saida.busca = filtro.busca;
  if (filtro.area) saida.area = filtro.area;
  if (filtro.situacao) saida.situacao = filtro.situacao;
  if (filtro.tipoPessoa) saida.tipo_pessoa = filtro.tipoPessoa;
  return saida;
}

/** O mínimo que uma candidatura precisa ter para ser filtrada. */
export type CandidaturaFiltravel = {
  nome: string | null;
  email: string | null;
  situacao: string;
  areas: string[];
  tipo_pessoa?: string | null;
};

/**
 * Uma candidatura passa pelo filtro?
 *
 * OS CAMPOS SE SOMAM (E, não OU): quem preenche nome e área quer as duas
 * coisas. Um OU devolveria mais resultados a cada campo preenchido, que é
 * o contrário do que "filtrar" significa para quem está usando.
 *
 * A BUSCA CASA NOME **OU** E-MAIL, e aí o OU é o certo — é UM campo, e a
 * pessoa digita o que lembra. Obrigá-la a escolher em qual coluna procurar
 * é pedir que ela saiba onde o dado mora.
 */
export function combina(
  candidatura: CandidaturaFiltravel,
  filtro: FiltroDeVoluntarios
): boolean {
  if (filtro.busca) {
    const alvo = normalizar(filtro.busca);
    const casa = normalizar(candidatura.nome).includes(alvo)
      || normalizar(candidatura.email).includes(alvo);
    if (!casa) return false;
  }

  // Área por nome EXATO, e não por trecho: as opções vêm de um `<select>`
  // alimentado pelas áreas reais, então não há o que digitar errado — e um
  // "contém" faria "Produção de eventos" casar com uma área chamada
  // "Produção", se um dia existir.
  if (filtro.area && !candidatura.areas.some((a) => normalizar(a) === normalizar(filtro.area))) {
    return false;
  }

  if (filtro.situacao && candidatura.situacao !== filtro.situacao) return false;

  if (filtro.tipoPessoa && (candidatura.tipo_pessoa ?? '') !== filtro.tipoPessoa) return false;

  return true;
}

export function filtrarCandidaturas<T extends CandidaturaFiltravel>(
  lista: T[],
  filtro: FiltroDeVoluntarios
): T[] {
  if (!filtroAtivo(filtro)) return lista;
  return lista.filter((candidatura) => combina(candidatura, filtro));
}
