import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, consultarOuDegradar, type Degradavel } from './degradacao';

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
 * `getPublicUrl` precisa do cliente do Supabase, e página nenhuma deste
 * projeto fala com `supabase-js` direto (CLAUDE.md, arquitetura). Então as
 * duas listagens devolvem a linha JÁ COM `url`, e os componentes de
 * apresentação (componentes/ListaAlbuns.ts, componentes/ListaMidia.ts)
 * ficam `.ts` puros, sem nada que só exista dentro de uma requisição do
 * Next — que é o que permite exercitá-los no `node --test` sem sessão de
 * equipe.
 *
 * A CHAMADA NÃO CUSTA REDE: MEDIDO pela Tarefa A5 e registrado em
 * servidor/dados/acervo.ts — `getPublicUrl` é síncrona e só concatena
 * string (URL do projeto + bucket + caminho, com encodeURI). Resolver
 * cinquenta endereços num laço é cinquenta concatenações, não cinquenta
 * requisições.
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

/** Uma peça com o endereço público do arquivo já resolvido. */
export type MidiaComEndereco = Midia & { url: string };

/**
 * Um álbum: o nome e as peças dele, na ordem em que foram enviadas.
 *
 * A GALERIA É AGRUPADA POR ÁLBUM porque é assim que o HTML original da
 * página promete (`<div id="lista-albuns">`, e o estado vazio fala em
 * "nenhum álbum"). O agrupamento acontece aqui, e não no componente, pelo
 * mesmo motivo de sempre: assim o componente continua sendo função pura de
 * uma estrutura simples, exercitável fora do Next.
 */
export type Album = { nome: string; pecas: MidiaComEndereco[] };

/** Endereço público de um arquivo do bucket `galeria`. Ver o cabeçalho. */
function comEndereco(
  linhas: Midia[],
  publico: (caminho: string) => string
): MidiaComEndereco[] {
  return linhas.map((linha) => ({ ...linha, url: publico(linha.caminho) }));
}

async function resolvedor(): Promise<(caminho: string) => string> {
  const supabase = await obterCliente();
  return (caminho: string) => supabase.storage.from('galeria').getPublicUrl(caminho).data.publicUrl;
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

  const publico = await resolvedor();
  const pecas = comEndereco(linhas, publico);

  // Agrupa preservando a ordem de chegada dentro de cada álbum. `Map`
  // mantém a ordem de inserção das chaves, que aqui é a ordem do PRIMEIRO
  // envio de cada álbum — invertida logo abaixo.
  const porAlbum = new Map<string, MidiaComEndereco[]>();
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

  const publico = await resolvedor();
  return { valor: comEndereco(linhas, publico), degradou };
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
  const { valor: linha, degradou } = await consultarComEstado<Midia | null>(
    'midia (por id)',
    async () => (await obterCliente()).from('midia').select('*').eq('id', id).maybeSingle(),
    null
  );

  if (!linha) return { valor: null, degradou };

  const publico = await resolvedor();
  return { valor: { ...linha, url: publico(linha.caminho) }, degradou };
}
