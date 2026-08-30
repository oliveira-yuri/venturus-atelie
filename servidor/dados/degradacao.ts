import 'server-only';

/**
 * A POLÍTICA DE ERRO DA CAMADA DE DADOS, num lugar só.
 *
 * Até a revisão final do Bloco A conviviam DUAS políticas incompatíveis:
 *
 *   - servidor/dados/conteudo.ts degradava (caía para o JSON versionado),
 *     avisava no log e carimbava a procedência;
 *   - servidor/dados/eventos.ts, acervo.ts e voluntariado.ts faziam
 *     `if (error) throw error`.
 *
 * MEDIDO na revisão, com SUPABASE_URL apontando para host inalcançável:
 * `/`, `/projetos` e `/para-escolas` respondiam 200 (caíam para o JSON);
 * `/voluntariado`, `/agenda` e `/acervo` respondiam 500 com
 * `<html id="__next_error__">` — sem cabeçalho, sem rodapé, sem
 * `<main id="conteudo">`, sem link de pular, sem os controles A+/contraste,
 * sem VLibras.
 *
 * DECISÃO: degradar é a política certa para conteúdo público. Uma página
 * institucional de ONG no ar com uma seção vazia é melhor que a mesma
 * página fora do ar — e o estado vazio das três rotas já é texto real
 * escrito e aprovado (Tarefa A4), não um branco. `app/error.tsx` continua
 * existindo como rede para o que escapar daqui.
 *
 * O QUE ESTA POLÍTICA CUSTA, dito em voz alta: `eventos` e `acervo` não têm
 * JSON versionado irmão em dados-iniciais/ (as tabelas estão vazias em
 * produção, não há conteúdo real para versionar) e `areas_voluntariado` tem
 * dado real SÓ no seed do Postgres. Degradar ali é servir lista vazia — ou
 * seja, a página fica CERTA na forma e POBRE no conteúdo, e nada na tela
 * distingue "não há evento marcado" de "o banco não respondeu". É por isso
 * que avisarQueDegradou() abaixo existe e é ruidosa: o único lugar onde
 * essa diferença aparece é o log do servidor (Netlify Functions).
 *
 * Não é o mesmo caso de conteudo.ts, que tem como distinguir e distingue
 * (`origem`/`carimbo`, e `data-origem-clipping` no HTML). Ali a distinção é
 * possível porque existem duas fontes com o mesmo conteúdo; aqui só existe
 * uma.
 */

/**
 * O ambiente tem projeto Supabase configurado?
 *
 * Era a MESMA função copiada em quatro arquivos (conteudo.ts, eventos.ts,
 * acervo.ts, voluntariado.ts). Quatro cópias de uma decisão de configuração
 * é quatro lugares para uma delas envelhecer sozinha — por exemplo, no dia
 * em que uma terceira variável entrar na conta.
 */
export function temSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_CHAVE_PUBLICAVEL);
}

/**
 * Erro do PostgREST NÃO é um Error: é um objeto simples com message/code/
 * details/hint. `String(motivo)` nele imprime "[object Object]" — um aviso
 * que não diz qual das causas ocorreu (chave errada, grant faltando, RLS,
 * coluna renomeada) é quase tão inútil quanto não avisar.
 */
export function descrever(motivo: unknown): string {
  if (motivo instanceof Error) return motivo.message;
  if (motivo && typeof motivo === 'object') {
    const e = motivo as { message?: string; code?: string; hint?: string; details?: string };
    const partes = [e.message, e.code && `código ${e.code}`, e.details, e.hint].filter(Boolean);
    if (partes.length > 0) return partes.join(' | ');
    return JSON.stringify(motivo);
  }
  return String(motivo);
}

/**
 * Erros de CONTROLE do Next não podem ser engolidos por um catch de dados.
 *
 * Achado ao rodar o modo degradado na fase 1 e ler o log do build: durante
 * `next build` o Next tenta renderizar a página estaticamente, `cookies()`
 * (dentro de obterCliente()) lança DynamicServerError para avisar "esta
 * rota é dinâmica", e um catch largo tratava isso como "o Supabase não
 * respondeu" — avisando errado no log e, pior, ABAFANDO o sinal que faz o
 * Next marcar a rota como dinâmica.
 *
 * A CONSEQUÊNCIA CONCRETA, que é o motivo de esta guarda existir e não
 * poder ser "simplificada" depois: hoje não deu prejuízo porque
 * app/layout.tsx usa headers() para o nonce da CSP, o que já torna toda
 * rota dinâmica. No dia em que isso mudar, /para-escolas seria
 * pré-renderizada com o JSON e serviria conteúdo congelado para sempre,
 * sem erro nenhum. (Este parágrafo vivia em servidor/dados/conteudo.ts e
 * quase se perdeu ao mover a função para cá — sem ele o comentário explica
 * o mecanismo e não o motivo.)
 *
 * Todo erro de controle do Next carrega `digest` (DYNAMIC_SERVER_USAGE,
 * NEXT_REDIRECT, NEXT_NOT_FOUND, NEXT_HTTP_ERROR_FALLBACK...). Falha de
 * rede, DNS e timeout não carregam. Então a regra é: com digest, repassa.
 */
export function repassarSeForControleDoNext(erro: unknown): void {
  if (erro && typeof erro === 'object' && typeof (erro as { digest?: unknown }).digest === 'string') {
    throw erro;
  }
}

/**
 * O aviso de quem degradou para lista VAZIA (não para JSON).
 *
 * Diferente de avisarQueCaiuParaOJson() em servidor/dados/conteudo.ts: lá o
 * conteúdo real continua na tela e o que envelhece é o dado; aqui a seção
 * fica vazia, e a página passa a dizer "não há nada marcado" quando na
 * verdade ninguém conseguiu perguntar.
 */
export function avisarQueDegradou(tabela: string, motivo: unknown): void {
  console.warn(
    `[dados] "${tabela}": o Supabase está configurado mas a consulta não voltou — `
    + 'a página vai ao ar com a seção VAZIA, e o estado vazio na tela não distingue '
    + `isto de "não há registro". Motivo: ${descrever(motivo)}`
  );
}

/**
 * Tabelas sobre as quais já se avisou "sem Supabase" neste processo.
 *
 * É a única coisa que segura o volume deste aviso, e por isso ela existe:
 * sem o Set, "sem Supabase" viraria uma linha de log por requisição, para
 * sempre, porque a condição não se resolve sozinha.
 *
 * NÃO MEDIDO em produção: numa Netlify Function cada instância fria tem seu
 * próprio módulo, então o aviso reaparece a cada instância nova — o que é o
 * comportamento desejado (um deploy mal configurado precisa continuar
 * aparecendo no log), sem virar uma linha por requisição.
 */
const jaAvisadoSemSupabase = new Set<string>();

/**
 * O SEGUNDO MODO DE FALHA SILENCIOSA, achado na mesma revisão.
 *
 * Publicar na Netlify SEM SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL no painel
 * não produz erro nenhum: `temSupabase()` devolve false, as consultas nem
 * saem, e as cinco áreas reais de /voluntariado (que só existem no seed do
 * Postgres) viram o estado vazio. O site sobe bonito e incompleto.
 *
 * SEM FILTRO POR AMBIENTE, e isso é medida, não descuido. A primeira versão
 * desta função tinha `if (process.env.NODE_ENV !== 'production') return`,
 * para poupar a suíte offline (onde a ausência das variáveis é DELIBERADA —
 * ver "MODO OFFLINE" em ferramentas/rodar-testes.mjs). MEDIDO: o filtro não
 * fazia nada. `ferramentas/rodar-testes.mjs` passa NODE_ENV=test ao `next
 * build`/`next start`, mas o que o código do servidor lê em execução, num
 * build de produção do Next, é `production` — o aviso saía do mesmo jeito.
 * Um `if` que não filtra nada é pior que nenhum: ele AFIRMA um
 * comportamento que não acontece, e o próximo a ler acredita.
 *
 * Então o preço está pago em voz alta. MEDIDO: uma rodada de `npm test`
 * imprime 7 destas linhas — uma por tabela consultada POR PROCESSO (o Set
 * acima), e a rodada tem dois processos, `next build` e `next start`. Sete
 * linhas por suíte é barato; um deploy sem as variáveis, silencioso, não é.
 * Não existe knob para calar isto, de propósito — todo knob de silenciar
 * acaba ligado em produção.
 */
export function avisarQueNaoHaSupabase(tabela: string): void {
  if (jaAvisadoSemSupabase.has(tabela)) return;
  jaAvisadoSemSupabase.add(tabela);

  console.warn(
    `[dados] "${tabela}": SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente — `
    + 'nenhuma consulta será feita e a seção vai ao ar VAZIA. Em produção isto quase '
    + 'sempre é variável faltando no painel da Netlify, não tabela sem registro.'
  );
}

/**
 * O que uma consulta degradável devolve: o valor já desenhável e se ele é
 * fruto de degradação.
 *
 * `degradou` significa exatamente uma coisa: O SUPABASE ESTAVA CONFIGURADO
 * E A CONSULTA NÃO VOLTOU. Ausência de configuração (o modo offline
 * deliberado de `npm test`) NÃO liga esta bandeira — ali a lista vazia é o
 * estado esperado, não um acidente, e tratar as duas como iguais faria a
 * suíte offline exibir mensagem de erro em página que está correta.
 */
export type Degradavel<T> = { valor: T; degradou: boolean };

/**
 * Executa uma consulta e, em qualquer falha, devolve o valor degradado.
 *
 * O `degradado` é sempre um valor JÁ DESENHÁVEL — lista vazia para as
 * listagens, null para a busca por id —, nunca uma exceção: é isso que
 * mantém a página no ar com cabeçalho, rodapé e estado vazio escrito.
 *
 * `data` nulo SEM `error` não é falha e não vira aviso: é a resposta
 * legítima de `.maybeSingle()` quando não há linha com aquele id.
 */
export async function consultarComEstado<T>(
  tabela: string,
  executar: () => Promise<{ data: unknown; error: unknown }>,
  degradado: T
): Promise<Degradavel<T>> {
  if (!temSupabase()) {
    avisarQueNaoHaSupabase(tabela);
    return { valor: degradado, degradou: false };
  }

  try {
    const { data, error } = await executar();
    if (error) {
      avisarQueDegradou(tabela, error);
      return { valor: degradado, degradou: true };
    }
    if (data === null || data === undefined) return { valor: degradado, degradou: false };
    return { valor: data as T, degradou: false };
  } catch (erro) {
    repassarSeForControleDoNext(erro);
    // Falha de rede, DNS e timeout chegam como exceção, não como { error }:
    // mesmo tratamento, mesma rede de segurança.
    avisarQueDegradou(tabela, erro);
    return { valor: degradado, degradou: true };
  }
}

/** Idem, para quem só precisa do valor — a maioria das chamadas. */
export async function consultarOuDegradar<T>(
  tabela: string,
  executar: () => Promise<{ data: unknown; error: unknown }>,
  degradado: T
): Promise<T> {
  return (await consultarComEstado(tabela, executar, degradado)).valor;
}
