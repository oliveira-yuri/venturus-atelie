import 'server-only';
import { obterCliente } from '../supabase';
import {
  consultarComEstado, consultarOuDegradar, temSupabase, descrever, type Degradavel
} from './degradacao';
import {
  VALIDADE_DA_ASSINATURA_SEGUNDOS, MIGRATION_DA_GALERIA, lerRespostaDaSonda,
  type EstadoDoBucket
} from '@/compartilhado/galeria-privada';

/**
 * Galeria — fotos das ações da ONG (RF05). Tarefa P3 do painel.
 *
 * ===================================================================
 * A MESMA TABELA, DOIS LEITORES, E QUEM SEPARA OS DOIS É A RLS
 * ===================================================================
 *
 * Igual a servidor/dados/publicacoes.ts, com uma diferença que importa: a
 * política de `public.midia` (supabase/migrations/002_conteudo.sql) é
 *
 *     using ((publicado and autorizacao_registrada) or public.eh_equipe())
 *
 * ou seja, o BANCO é quem garante a RN07 (regra 9 do CLAUDE.md: nenhuma
 * foto no ar sem autorização de uso de imagem registrada). Mesmo que
 * alguém chamasse `listarTodas()` de uma página pública, o Postgres
 * devolveria só o que está publicado E autorizado.
 *
 * Os dois `.eq()` de `listarPublicadas()` são INTENÇÃO ESCRITA — "esta é a
 * consulta da página pública" —, não a tranca. A tranca é a RLS, e o
 * cliente deste projeto usa a sessão de quem pediu: não existe chave de
 * serviço aqui (spec §4.1).
 *
 * ===================================================================
 * SEM JSON IRMÃO, E AQUI ISSO É MAIS QUE UMA CONVENÇÃO
 * ===================================================================
 *
 * Não há nenhuma foto versionada em `dados-iniciais/` e não pode haver:
 * não existe UMA autorização de uso de imagem registrada neste projeto
 * (CLAUDE.md, "O que trava hoje", item 5), e por isso não há uma única
 * foto no site inteiro. A degradação é para LISTA VAZIA, como
 * eventos/acervo/voluntariado — a página fica no ar com o estado vazio
 * escrito (que aqui já explica o motivo), e o aviso `[dados]` no log é o
 * único lugar onde "não há álbum" se distingue de "não deu para
 * perguntar".
 *
 * ===================================================================
 * O ENDEREÇO DE CADA ARQUIVO É RESOLVIDO AQUI, NÃO NA PÁGINA
 * ===================================================================
 *
 * Assinar uma URL precisa do cliente do Supabase, e página nenhuma deste
 * projeto fala com `supabase-js` direto (CLAUDE.md, arquitetura). Então as
 * duas listagens devolvem a linha JÁ COM `url`, e os componentes de
 * apresentação (componentes/ListaAlbuns.ts, componentes/ListaMidia.ts)
 * ficam `.ts` puros, sem nada que só exista dentro de uma requisição do
 * Next — que é o que permite exercitá-los no `node --test` sem sessão de
 * equipe.
 *
 * ===================================================================
 * URL ASSINADA, E NÃO MAIS `getPublicUrl` — E ISSO CUSTA UMA REQUISIÇÃO
 * ===================================================================
 *
 * Até 01/09/2026 o endereço saía de `getPublicUrl`, que é SÍNCRONA e só
 * concatena string (medido pela Tarefa A5 e registrado em
 * servidor/dados/acervo.ts, que continua usando-a — o bucket `acervo` é
 * material feito para download livre). O preço disso era o item 0j do
 * CLAUDE.md: com o bucket público, uma foto guardada ou tirada do ar
 * continuava baixável para sempre por quem tivesse o endereço, e a RN07
 * (regra 9) não tolera isso num site cujo público inclui crianças a partir
 * de 10 anos.
 *
 * Agora o bucket é privado (supabase/migrations/008_galeria_privada.sql) e
 * o endereço vem de `createSignedUrls`, que **não é síncrona**: é uma
 * requisição ao Storage, que só devolve a assinatura se a RLS deixar. É por
 * isso que `assinar()` abaixo existe em vez de um `map` — e é por isso que
 * ela usa a forma PLURAL: `createSignedUrls(caminhos, prazo)` assina a
 * lista inteira numa requisição só. `createSignedUrl` no singular, dentro
 * de um laço, seria cinquenta requisições para desenhar uma galeria de
 * cinquenta fotos.
 *
 * O PRAZO ESTÁ EM compartilhado/galeria-privada.ts, com a conta que o
 * escolheu. Uma hora.
 *
 * ===================================================================
 * `url` PODE SER NULA AGORA, E ISSO É O DEFEITO APARECENDO
 * ===================================================================
 *
 * Assinar pode falhar por linha: arquivo que não está no bucket (a linha
 * ficou órfã), RLS recusando, rede caindo no meio. Antes, com string
 * concatenada, não existia esse estado — o endereço sempre "existia", e uma
 * foto ausente virava imagem quebrada silenciosa.
 *
 * As duas listas tratam a falha de formas OPOSTAS, de propósito:
 *
 *   · A GALERIA PÚBLICA OMITE a foto (`listarAlbunsPublicados` filtra as
 *     nulas). Melhor uma galeria mais curta que uma coluna de imagens
 *     quebradas para quem visita o site.
 *   · O PAINEL MANTÉM a linha, com `url` nula, e
 *     componentes/ListaMidia.ts desenha uma frase no lugar da miniatura.
 *     Sumir com a foto da tela da equipe seria esconder justamente a linha
 *     que alguém precisa apagar.
 *
 * Nos dois casos sai aviso `[dados]` no log — é lá que "não há foto" se
 * distingue de "não deu para assinar".
 */

/**
 * Uma peça da galeria. Os campos espelham as colunas de `public.midia`
 * que alguma tela de fato lê.
 *
 * `autorizacao_registrada` ESTÁ AQUI, e não é detalhe: a tela do painel
 * precisa DESENHAR se aquela foto pode ou não ir ao ar (RN07). É a
 * informação que decide qual botão aparece — como `publicado` em
 * `Publicacao`, e pelo mesmo motivo.
 *
 * `evento_id` e `publicacao_id` existem na tabela e ficam de fora: nada
 * portado até agora as usa. A consulta é `select('*')` (mesma convenção de
 * servidor/dados/eventos.ts), então elas chegam do banco e são ignoradas.
 */
export type Midia = {
  id: string;
  album: string;
  tipo: string;
  caminho: string;
  alt: string;
  legenda: string | null;
  autorizacao_registrada: boolean;
  publicado: boolean;
  criado_em: string;
};

/**
 * Uma peça com o endereço do arquivo já resolvido — ou `null`, quando não
 * deu para assinar. Ver "url PODE SER NULA AGORA" no cabeçalho.
 */
export type MidiaComEndereco = Midia & { url: string | null };

/**
 * Uma peça que TEM endereço. É o que a galeria pública desenha, e o tipo
 * existe para que componentes/ListaAlbuns.ts não precise de um `if` para um
 * caso que nunca chega até ele: `listarAlbunsPublicados` já filtrou.
 */
export type MidiaVisivel = Midia & { url: string };

/**
 * Um álbum: o nome e as peças dele, na ordem em que foram enviadas.
 *
 * A GALERIA É AGRUPADA POR ÁLBUM porque é assim que o HTML original da
 * página promete (`<div id="lista-albuns">`, e o estado vazio fala em
 * "nenhum álbum"). O agrupamento acontece aqui, e não no componente, pelo
 * mesmo motivo de sempre: assim o componente continua sendo função pura de
 * uma estrutura simples, exercitável fora do Next.
 */
export type Album = { nome: string; pecas: MidiaVisivel[] };

/** O bucket privado de 008_galeria_privada.sql. */
const BUCKET = 'galeria';

/** O que `createSignedUrls` devolve por caminho pedido. */
type Assinatura = { path: string | null; signedUrl: string | null; error: string | null };

/**
 * Assina os caminhos de uma vez e devolve o mapa caminho → endereço.
 *
 * UMA REQUISIÇÃO PARA A LISTA INTEIRA — ver o cabeçalho. Caminho repetido
 * (a mesma foto duas vezes na lista, que não acontece hoje) custaria uma
 * entrada a mais no corpo e nada mais, então não há de-duplicação aqui:
 * seria código para um caso que não existe.
 *
 * NUNCA LANÇA. A falha do lote inteiro passa por `consultarComEstado`, que
 * é a política única de erro (servidor/dados/degradacao.ts) e já avisa no
 * log; a falha de um caminho só vem DENTRO do `data`, com `error`
 * preenchido e `signedUrl` nulo, e é avisada aqui — sem isso ela seria o
 * caso silencioso de sempre.
 */
async function assinar(linhas: Midia[]): Promise<Map<string, string>> {
  const caminhos = linhas.map((linha) => linha.caminho);

  const assinaturas = await consultarOuDegradar<Assinatura[]>(
    'galeria (assinaturas do Storage)',
    async () => (await obterCliente())
      .storage.from(BUCKET)
      .createSignedUrls(caminhos, VALIDADE_DA_ASSINATURA_SEGUNDOS),
    []
  );

  const enderecos = new Map<string, string>();
  const recusados: string[] = [];

  for (const assinatura of assinaturas) {
    if (assinatura.path && assinatura.signedUrl) enderecos.set(assinatura.path, assinatura.signedUrl);
    else if (assinatura.path) recusados.push(`${assinatura.path} (${assinatura.error ?? 'sem motivo'})`);
  }

  // Caminho que a lista pediu e o Storage não devolveu de jeito nenhum.
  // Acontece com o lote inteiro degradado, e aí a lista abaixo é toda a
  // lista — o que também precisa aparecer.
  const faltando = caminhos.filter((caminho) => !enderecos.has(caminho)
    && !recusados.some((r) => r.startsWith(`${caminho} (`)));

  if (recusados.length > 0 || faltando.length > 0) {
    console.warn(
      `[dados] "galeria (assinaturas do Storage)": ${recusados.length + faltando.length} de `
      + `${caminhos.length} foto(s) ficaram SEM endereço. A galeria pública omite essas fotos e `
      + 'o painel desenha um aviso no lugar da miniatura — nenhuma das duas telas mostra imagem '
      + `quebrada. Motivos: ${[...recusados, ...faltando.map((c) => `${c} (sem resposta)`)].join('; ')}`
    );
  }

  return enderecos;
}

/** As linhas já com endereço (ou `null`), na mesma ordem em que chegaram. */
async function comEndereco(linhas: Midia[]): Promise<MidiaComEndereco[]> {
  const enderecos = await assinar(linhas);
  return linhas.map((linha) => ({ ...linha, url: enderecos.get(linha.caminho) ?? null }));
}

/**
 * ===================================================================
 * A SONDA: A MIGRATION 008 JÁ FOI RODADA?
 * ===================================================================
 *
 * Ninguém consegue aplicar `008_galeria_privada.sql` pelo código do site —
 * não existe `service_role` neste projeto (spec §4.1). Ela precisa ser
 * colada no SQL Editor do painel do Supabase por uma pessoa.
 *
 * E aqui mora o modo de falha típico deste projeto: **enquanto a migration
 * não for rodada, NADA QUEBRA**. URL assinada funciona em bucket público
 * também, a suíte fica verde, o site sobe, as fotos aparecem — e a brecha
 * continua aberta, exatamente como estava. Seria mais um item 0e: silêncio.
 *
 * Então esta função pergunta, do jeito mais direto possível: bate no
 * endereço PÚBLICO do bucket, sem chave nenhuma, como faria um estranho de
 * posse de uma URL. A leitura da resposta (e a medição que a fundamenta)
 * está em `lerRespostaDaSonda`, em compartilhado/galeria-privada.ts.
 *
 * UMA VEZ POR PROCESSO. O resultado é guardado numa promessa de módulo:
 * renderizações simultâneas de /admin/galeria compartilham a mesma
 * requisição, e a resposta não muda entre uma e outra. Numa Netlify
 * Function cada instância fria pergunta de novo, que é o comportamento
 * desejado — o mesmo raciocínio do Set em servidor/dados/degradacao.ts.
 *
 * NÃO USA `obterCliente()`, de propósito: um cliente do Supabase manda
 * `apikey` e `Authorization`, e a pergunta que precisa ser respondida é
 * justamente "isto responde SEM credencial?". Mandar credencial mediria
 * outra coisa.
 *
 * `getBucket('galeria')` seria o caminho óbvio e NÃO SERVE — medido em
 * 01/09/2026: `storage.buckets` não é legível pela chave publicável, e a
 * chamada volta 404 "Bucket not found" tanto para bucket público quanto
 * para bucket que não existe. Ou seja, ela não distingue os dois estados
 * que importam.
 */
let sonda: Promise<EstadoDoBucket> | null = null;

/** Quanto a sonda espera antes de desistir. Ela nunca segura uma página. */
const PRAZO_DA_SONDA_MS = 4_000;

export function bucketAindaAberto(): Promise<EstadoDoBucket> {
  sonda ??= perguntarAoStorage();
  return sonda;
}

async function perguntarAoStorage(): Promise<EstadoDoBucket> {
  if (!temSupabase()) return 'nao-sei';

  let origem: string;
  try {
    origem = new URL(process.env.SUPABASE_URL!).origin;
  } catch {
    return 'nao-sei';
  }

  // Um nome que nenhum arquivo real tem: `caminhoNoBucket` sempre produz
  // `<álbum>/<uuid>.<extensão>`. A sonda não precisa (e não deve) tocar em
  // arquivo de verdade.
  const endereco = `${origem}/storage/v1/object/public/${BUCKET}/sonda-da-migration-008`;

  let estado: EstadoDoBucket;

  try {
    const resposta = await fetch(endereco, {
      // Sem cabeçalho de autenticação nenhum — é o ponto. E sem cache: uma
      // resposta guardada mentiria depois de a migration ser aplicada.
      cache: 'no-store',
      signal: AbortSignal.timeout(PRAZO_DA_SONDA_MS)
    });
    estado = lerRespostaDaSonda(resposta.status, await resposta.text());
  } catch (erro) {
    console.warn(
      '[dados] "galeria (sonda do bucket)": não deu para conferir se o depósito de arquivos da '
      + `galeria está fechado. Motivo: ${descrever(erro)}`
    );
    return 'nao-sei';
  }

  if (estado === 'aberto') {
    console.error(
      '[galeria] O BUCKET "galeria" AINDA É PÚBLICO: o endereço '
      + `${origem}/storage/v1/object/public/${BUCKET}/... serve arquivo SEM CHAVE NENHUMA. `
      + 'Toda foto que já subiu continua baixável por quem tiver o caminho dela, publicada ou '
      + 'não — "Tirar do ar" não fecha isso, só "Apagar". Isto viola a RN07 (regra 9 do '
      + `CLAUDE.md). CONSERTO: rodar supabase/migrations/${MIGRATION_DA_GALERIA} no SQL Editor `
      + 'do painel do Supabase. Ninguém consegue rodar pelo código: não há service_role aqui.'
    );
  }

  return estado;
}

/**
 * O que /galeria mostra: só o que está publicado E autorizado, agrupado por
 * álbum, do álbum mais recente para o mais antigo.
 *
 * A ORDEM DENTRO DO ÁLBUM é a de envio (`criado_em` crescente): a equipe
 * sobe as fotos de um evento na ordem em que quer contá-lo, e inverter isso
 * mostraria o fim primeiro. A ordem ENTRE álbuns é a inversa — o álbum
 * mexido por último aparece em cima, que é o que faz o trabalho recente da
 * ONG ser a primeira coisa que se vê.
 */
export async function listarAlbunsPublicados(): Promise<Album[]> {
  const linhas = await consultarOuDegradar<Midia[]>('midia (pública)', async () =>
    (await obterCliente())
      .from('midia')
      .select('*')
      .eq('publicado', true)
      // Redundante com a RLS de propósito, e escrito por isso: a política do
      // banco já exige as duas. Ver o cabeçalho — isto é intenção, não
      // tranca.
      .eq('autorizacao_registrada', true)
      .order('criado_em', { ascending: true }),
  []);

  if (linhas.length === 0) return [];

  // Foto sem endereço é OMITIDA aqui — ver "url PODE SER NULA AGORA" no
  // cabeçalho. `assinar()` já gritou no log qual e por quê; o que a página
  // pública não pode fazer é desenhar um <img> quebrado.
  const pecas = (await comEndereco(linhas))
    .filter((peca): peca is MidiaVisivel => peca.url !== null);

  // Agrupa preservando a ordem de chegada dentro de cada álbum. `Map`
  // mantém a ordem de inserção das chaves, que aqui é a ordem do PRIMEIRO
  // envio de cada álbum — invertida logo abaixo.
  const porAlbum = new Map<string, MidiaVisivel[]>();
  for (const peca of pecas) {
    const atual = porAlbum.get(peca.album);
    if (atual) atual.push(peca);
    else porAlbum.set(peca.album, [peca]);
  }

  return [...porAlbum.entries()]
    .map(([nome, itens]) => ({ nome, pecas: itens }))
    .reverse();
}

/**
 * O que o painel mostra: tudo — rascunho, sem autorização, publicado —, do
 * mais novo para o mais antigo.
 *
 * DEVOLVE `Degradavel`, pelo mesmo motivo de `listarTodas()` em
 * servidor/dados/publicacoes.ts: uma lista vazia numa tela onde a pessoa
 * ACABOU de subir uma foto faria ela pensar que o envio se perdeu e subir
 * de novo — e aqui "de novo" custa mais uma vez o plano de dados dela.
 */
export async function listarTodasAsMidias(): Promise<Degradavel<MidiaComEndereco[]>> {
  const { valor: linhas, degradou } = await consultarComEstado<Midia[]>('midia (painel)', async () =>
    (await obterCliente())
      .from('midia')
      .select('*')
      .order('criado_em', { ascending: false }),
  []);

  if (linhas.length === 0) return { valor: [], degradou };

  // O painel MANTÉM a linha sem endereço — ver o cabeçalho. É a foto que
  // alguém precisa apagar; sumir com ela seria esconder o problema.
  return { valor: await comEndereco(linhas), degradou };
}

/**
 * Uma peça pelo id — para a tela de confirmação de apagar e para a Action
 * que põe no ar, que precisa saber se a autorização está registrada.
 *
 * DEVOLVE `Degradavel` para a mesma distinção que a tela de edição de
 * notícia precisa fazer: "esta foto não existe" e "o banco não respondeu"
 * chegariam as duas como `null`, e tratar a segunda como 404 diria à equipe
 * que a foto sumiu.
 */
export async function buscarMidia(id: string): Promise<Degradavel<MidiaComEndereco | null>> {
  const { valor: linha, degradou } = await buscarLinhaDaMidia(id);

  if (!linha) return { valor: null, degradou };

  const [comUrl] = await comEndereco([linha]);
  return { valor: comUrl, degradou };
}

/**
 * A MESMA linha, sem assinar endereço nenhum — para quem só precisa do
 * `caminho` e das duas colunas de estado.
 *
 * Existe desde que o endereço passou a custar uma requisição ao Storage
 * (ver o cabeçalho): `porNoAr` e `apagarMidia` (acoes/galeria.ts) leem a
 * linha só para decidir e para saber qual arquivo remover. Assinar uma URL
 * ali seria uma ida à rede a mais em cada toque de botão — num celular, no
 * meio de um evento (regra 4 do CLAUDE.md) — e, no caso do apagar, assinar
 * o endereço de um arquivo um instante antes de destruí-lo.
 */
export async function buscarLinhaDaMidia(id: string): Promise<Degradavel<Midia | null>> {
  return consultarComEstado<Midia | null>(
    'midia (por id)',
    async () => (await obterCliente()).from('midia').select('*').eq('id', id).maybeSingle(),
    null
  );
}
