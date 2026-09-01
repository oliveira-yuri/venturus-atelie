import 'server-only';
import { obterCliente } from '../supabase';
import { consultarComEstado, type Degradavel } from './degradacao';
import { nomeParaBaixar } from '@/compartilhado/validacao';

/**
 * Acervo aberto (RF35-RF37). Download livre, sem cadastro. Porte de
 * site/assets/js/dados/acervo.js.
 *
 * Consultas copiadas COMO ESTÃO — `select('*')`, sem enumerar coluna
 * (restrição global 1 desta fase) — mesmo motivo de servidor/dados/
 * eventos.ts: sem JSON local irmão, nenhuma comparação pegaria um nome de
 * coluna inventado.
 *
 * ===================================================================
 * A MESMA TABELA, DOIS LEITORES, E QUEM SEPARA OS DOIS É A RLS
 * ===================================================================
 *
 * Desde o RF37 (01/09/2026) este módulo tem, além da leitura pública, a do
 * PAINEL. A política de `public.acervo` (002_conteudo.sql) é
 *
 *     using (publicado or public.eh_equipe())
 *
 * ou seja, mesmo que `listarMateriaisDoPainel()` fosse chamada de uma
 * página pública, o Postgres devolveria só o que está publicado. O
 * `.eq('publicado', true)` da leitura pública é INTENÇÃO ESCRITA — "esta é
 * a consulta da página de quem visita" —, não a tranca. A tranca é a RLS, e
 * o cliente deste projeto usa a sessão de quem pediu: não existe chave de
 * serviço aqui (spec §4.1).
 */

/**
 * Um material do acervo. Os campos espelham as colunas de public.acervo
 * (migration 002_conteudo.sql) que site/assets/js/paginas/acervo.js de
 * fato lê — `downloads` e `criado_em` existem na tabela e ficam de fora
 * daqui pelo mesmo motivo do `Evento` em servidor/dados/eventos.ts: nada
 * portado até agora os usa. `publicado` fica de fora por ser campo de
 * filtro, não de apresentação (mesma decisão de `Atividade`).
 */
export type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  tema: string | null;
  faixa_etaria: string | null;
  arquivo_caminho: string;
  tamanho_bytes: number | null;
};

/**
 * O mesmo material, com o que só a tela da EQUIPE precisa (RF37).
 *
 * `publicado` está aqui porque é a informação que decide qual botão a lista
 * do painel desenha — como em `Publicacao` e `Midia`, e pelo mesmo motivo.
 * `criado_em` porque a lista mostra quando o material subiu.
 *
 * `downloads` NÃO ESTÁ, e a ausência é decisão, não esquecimento: a coluna
 * existe (`downloads integer not null default 0`) e **nada neste projeto
 * consegue incrementá-la**. Ver o cabeçalho de `enderecoParaBaixar`, onde a
 * medição está escrita. Desenhar "0 downloads" ao lado de cada material
 * seria a tela afirmando que ninguém baixou, quando o que acontece é que
 * ninguém CONTA.
 */
export type MaterialDoPainel = Material & {
  publicado: boolean;
  criado_em: string;
};

export type FiltrosAcervo = {
  tema?: string;
  faixaEtaria?: string;
  busca?: string;
};

/**
 * A GUARDA DE CONFIGURAÇÃO E A POLÍTICA DE ERRO MORAM EM
 * servidor/dados/degradacao.ts. Antes da revisão final do Bloco A esta
 * função fazia `if (error) throw error`, e MEDIDO com o Supabase
 * configurado e a consulta falhando, /acervo respondia 500 com a página de
 * erro embutida do Next.
 *
 * DEVOLVE O ESTADO, não só a lista, e o motivo é específico desta página:
 * o texto de estado vazio de /acervo MUDA conforme haja busca ativa
 * ('Nada encontrado para "X"'). Degradar em silêncio ali não seria só
 * pobre — seria MENTIROSO: a página afirmaria que a busca não achou nada
 * quando ninguém conseguiu buscar. Com `degradou` na mão,
 * app/acervo/page.tsx escolhe a mensagem honesta.
 *
 * As listagens de eventos e voluntariado não precisam disso porque o
 * estado vazio delas não faz afirmação sobre a consulta ("Nenhuma
 * atividade marcada por enquanto", "As áreas ainda estão sendo
 * organizadas") — continua impreciso, e é o log que carrega essa
 * distinção; ver o cabeçalho de degradacao.ts.
 */
export async function listarMateriais(
  filtros: FiltrosAcervo = {}
): Promise<Degradavel<Material[]>> {
  return consultarComEstado<Material[]>('acervo', async () => {
    let consulta = (await obterCliente()).from('acervo').select('*').eq('publicado', true);

    if (filtros.tema) consulta = consulta.eq('tema', filtros.tema);
    if (filtros.faixaEtaria) consulta = consulta.eq('faixa_etaria', filtros.faixaEtaria);

    // Full-text search em português, pela coluna gerada (RF35).
    if (filtros.busca && filtros.busca.trim()) {
      consulta = consulta.textSearch('busca', filtros.busca.trim(), {
        type: 'plain',
        config: 'portuguese'
      });
    }

    return consulta.order('titulo');
  }, []);
}

/**
 * O que o painel mostra (RF37): tudo — guardado e publicado —, do mais novo
 * para o mais antigo.
 *
 * DEVOLVE `Degradavel` pelo mesmo motivo de `listarTodasAsMidias()`: uma
 * lista vazia numa tela onde a pessoa ACABOU de subir um material faria ela
 * pensar que o envio se perdeu e subir de novo — e aqui "de novo" custa
 * outra vez o plano de dados dela.
 *
 * NÃO CAI PARA JSON NENHUM, e não há para onde cair: ao contrário das
 * atividades (item 0k do CLAUDE.md), o acervo nunca teve cópia versionada
 * em `dados-iniciais/` — os arquivos são grandes demais para o repositório,
 * e é justamente por isso que eles vivem no Storage.
 */
export async function listarMateriaisDoPainel(): Promise<Degradavel<MaterialDoPainel[]>> {
  return consultarComEstado<MaterialDoPainel[]>('acervo (painel)', async () =>
    (await obterCliente())
      .from('acervo')
      .select('*')
      .order('criado_em', { ascending: false }),
  []);
}

/**
 * Um material pelo id — para a tela de confirmação de apagar e para as
 * Actions, que precisam do `arquivo_caminho` para mexer no arquivo.
 *
 * DEVOLVE `Degradavel` para a mesma distinção que a tela de apagar da
 * galeria precisa fazer: "este material não existe" e "o banco não
 * respondeu" chegariam os dois como `null`, e tratar o segundo como 404
 * diria à equipe, no meio de uma queda do Supabase, que o material já
 * sumiu — e a reação a isso é parar de procurar.
 */
export async function buscarMaterial(id: string): Promise<Degradavel<MaterialDoPainel | null>> {
  return consultarComEstado<MaterialDoPainel | null>(
    'acervo (por id)',
    async () => (await obterCliente()).from('acervo').select('*').eq('id', id).maybeSingle(),
    null
  );
}

/**
 * Endereço público do arquivo — o de LER na tela, sem baixar.
 *
 * MEDIDO (lendo node_modules/@supabase/storage-js/src/packages/
 * StorageFileApi.ts, método getPublicUrl): a chamada é SÍNCRONA e só
 * concatena string (URL do projeto + bucket + caminho, com encodeURI) —
 * não faz requisição de rede, não lê sessão nem cookie, e a documentação
 * do próprio método diz que não exige permissão nenhuma de RLS ("buckets
 * table permissions: none", "objects table permissions: none"). O bucket
 * `acervo` é público (supabase/migrations/006_storage.sql). Funciona a
 * partir do servidor sem nenhuma ressalva — o único motivo de esta função
 * precisar ser `async` aqui é obterCliente() exigir `await` (por causa de
 * `cookies()`, que só existe dentro de uma requisição do Next); a chamada
 * a getPublicUrl em si não espera nada.
 *
 * E ELE CONTINUA PÚBLICO DE PROPÓSITO, ao contrário do `galeria`, que virou
 * privado em 008_galeria_privada.sql: o material daqui é feito para ser
 * baixado por qualquer pessoa, sem cadastro — é o que /acervo promete em
 * texto desde o site antigo, e é o requisito RF36. Há teste em
 * testes/galeria.test.mjs que falha se `getPublicUrl` sumir deste arquivo.
 *
 * A CONSEQUÊNCIA, escrita porque não é dedutível: material guardado ou
 * tirado do ar continua baixável por quem tiver o endereço. O caminho tem
 * um uuid dentro (`caminhoDoMaterial`), ou seja, não é adivinhável e só
 * aparece no HTML de um material publicado — mas isso é obscuridade, não
 * permissão. Quem subiu o arquivo ERRADO precisa apagar, e é por isso que a
 * tela da equipe tem "Apagar".
 */
export async function enderecoDoArquivo(caminho: string): Promise<string> {
  const { data } = (await obterCliente()).storage.from('acervo').getPublicUrl(caminho);
  return data.publicUrl;
}

/**
 * O MESMO arquivo, agora como DOWNLOAD — o botão "Baixar" de /acervo (RF36).
 *
 * ===================================================================
 * POR QUE O ATRIBUTO `download` DO HTML NÃO BASTA, E NUNCA BASTOU
 * ===================================================================
 *
 * O site antigo (e o port da Tarefa A4) escrevia
 * `<a href="<url do Storage>" download>Baixar material</a>`. **O atributo
 * `download` é IGNORADO quando o endereço é de outra origem** — está na
 * especificação do HTML, e a razão é óbvia depois de dita: senão qualquer
 * site forçaria o download de qualquer arquivo de qualquer servidor, com o
 * nome que quisesse. O arquivo mora em `<projeto>.supabase.co` e a página
 * em outro domínio: são origens diferentes SEMPRE, em qualquer ambiente.
 * Ou seja, aquele botão nunca baixou nada — ele NAVEGAVA para o PDF, e o
 * navegador abria o leitor embutido.
 *
 * O que funciona entre origens é o servidor do arquivo dizer
 * `Content-Disposition: attachment`, e o Storage do Supabase faz isso
 * quando a URL leva `?download=`. MEDIDO em 01/09/2026 contra o projeto do
 * Ateliê: `getPublicUrl(caminho, { download: 'Nome Bonito.pdf' })` é
 * síncrona como a irmã e devolve
 * `.../object/public/acervo/<caminho>?download=Nome+Bonito.pdf`.
 * **O QUE NÃO FOI MEDIDO, e precisa estar dito:** o cabeçalho que o Storage
 * responde COM um arquivo de verdade no bucket. O bucket `acervo` está
 * VAZIO (medido no mesmo dia, `storage.from('acervo').list()` devolve `[]`),
 * e subir um arquivo exige sessão de equipe, que este projeto ainda não tem
 * (CLAUDE.md, "O que trava hoje", item 2). Conferir no primeiro material de
 * verdade: o download tem de começar sem abrir o leitor de PDF.
 *
 * O NOME DO ARQUIVO vem do título (`nomeParaBaixar`), e não do caminho:
 * sem isso o material chegaria à pasta de downloads como
 * "b3f1c2d4-....pdf".
 *
 * ===================================================================
 * E A COLUNA `downloads`? NINGUÉM CONSEGUE INCREMENTÁ-LA HOJE.
 * ===================================================================
 *
 * `public.acervo.downloads` existe desde 002_conteudo.sql e continua em
 * ZERO para sempre. Não é descuido — é o que a RLS decide, e foi MEDIDO em
 * 01/09/2026 contra o Supabase de produção, com a chave publicável:
 *
 *     update public.acervo set downloads = ... -> 42501
 *     "permission denied for table acervo"
 *     hint: "GRANT UPDATE ON public.acervo TO anon"
 *
 * O papel `anon` não tem `grant update` nesta tabela (002_conteudo.sql dá
 * `insert, update, delete` só a `authenticated`), e mesmo com o grant a
 * política `acervo: equipe gerencia` (`for all using eh_equipe()`) recusaria
 * quem não é equipe. Ou seja: **contar download de visitante é impossível
 * sem uma migration** — uma função `security definer`, como
 * `public.registrar_contato` de 007_limite_por_visitante.sql já é para
 * outra coisa. Migration não era desta tarefa (era instrução do brief), e
 * este repositório não teria como aplicá-la de qualquer forma (spec §4.1).
 * O SQL sugerido está no relatório do RF36.
 *
 * O que NÃO se fez, e é a razão de a contagem não ter virado um jeitinho:
 * uma rota nossa (`/acervo/baixar/<id>`) que redirecionasse para o Storage
 * gastaria uma função por download, na plataforma que cobra por invocação,
 * para incrementar um número que o banco recusa. Ficaria a indireção, sem a
 * contagem.
 */
export async function enderecoParaBaixar(
  caminho: string,
  titulo: string
): Promise<string> {
  const { data } = (await obterCliente())
    .storage.from('acervo')
    .getPublicUrl(caminho, { download: nomeParaBaixar(titulo, caminho) });

  return data.publicUrl;
}
