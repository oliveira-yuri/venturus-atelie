/**
 * O BUCKET DA GALERIA É PRIVADO — o prazo da assinatura, a sonda que
 * descobre se a migration já foi rodada, e as frases que dizem isso.
 *
 * Fica em `compartilhado/` pelo mesmo motivo de
 * `compartilhado/permissao-de-equipe.ts`: são DECISÕES, separadas de quem
 * fala com a rede. Assim elas são exercitadas por `node --test` sem subir o
 * Next, sem sessão e sem Supabase (testes/galeria.test.mjs) — que é o único
 * jeito de esta tarefa ter verificação, já que ninguém consegue entrar como
 * equipe (CLAUDE.md, "O que trava hoje", itens 1 e 2).
 *
 * ===================================================================
 * POR QUE UMA HORA
 * ===================================================================
 *
 * Uma URL assinada é um PORTADOR: enquanto vale, serve o arquivo para quem
 * a tiver, sem perguntar quem é. O prazo é, portanto, dois números ao mesmo
 * tempo — quanto tempo a página aguenta aberta, e quanto tempo um link
 * vazado continua servindo. Os dois puxam para lados opostos.
 *
 * O QUE UM PRAZO CURTO QUEBRA, e não é hipótese: as duas listas usam
 * `loading="lazy"` (componentes/ListaAlbuns.ts, ListaMidia.ts). Uma foto
 * que está abaixo da dobra só é BAIXADA quando a pessoa rola até ela — que
 * pode ser meia hora depois de a página ter sido montada, com o celular no
 * bolso no meio de um evento. Com 5 minutos, rolar a galeria depois de uma
 * pausa daria uma coluna de imagens quebradas, e a equipe não teria como
 * saber que o motivo é prazo e não defeito. Some a isso rede de celular
 * fraca, que é o cenário de projeto (regra 4 do CLAUDE.md).
 *
 * O QUE UM PRAZO LONGO RECRIA: com 24 h, um link que vaze — a pessoa
 * compartilha a tela num evento, manda a URL num grupo de WhatsApp, empresta
 * o celular — continua servindo a foto no dia seguinte. Isso é a mesma
 * brecha que esta mudança veio fechar, só que com data de validade.
 *
 * UMA HORA (3600 s) é onde os dois se encontram, e o número tem um
 * significado operacional que vale escrever: **é o teto da janela entre
 * "Tirar do ar" e a foto de fato ficar inalcançável.** Depois de tirar do
 * ar, nenhuma URL NOVA é emitida (a política do banco deixa de casar a
 * linha); as que já foram emitidas morrem em no máximo uma hora.
 *
 * E PARA O CASO URGENTE DA RN07 — autorização retirada, foto de criança
 * subida por engano — quem resolve NA HORA continua sendo "Apagar", que
 * remove o arquivo do bucket: sem arquivo, toda URL assinada viva morre no
 * mesmo instante, independente do prazo. É por isso que a tela da galeria
 * tem "Apagar" e a de notícias não, e o argumento sobrevive a esta
 * migration — ver o cabeçalho de acoes/galeria.ts.
 *
 * O prazo é UM SÓ para as duas telas, e a alternativa foi considerada:
 * dar ao painel um prazo menor, já que é lá que aparecem as fotos
 * guardadas e as sem autorização. Descartado porque o painel também rola
 * com `loading="lazy"`, e um prazo curto justamente na tela de trabalho da
 * equipe trocaria um risco pequeno por um defeito diário.
 */

/** Segundos de validade de cada URL assinada. Ver o cabeçalho. */
export const VALIDADE_DA_ASSINATURA_SEGUNDOS = 3600;

/** O arquivo que precisa ser rodado à mão no painel do Supabase. */
export const MIGRATION_DA_GALERIA = '008_galeria_privada.sql';

/**
 * O que a sonda descobriu sobre o endereço público do bucket.
 *
 *  · `aberto`  — /object/public/galeria/... ainda aceita o bucket, ou seja,
 *                qualquer arquivo de lá continua baixável por quem tiver o
 *                caminho. A migration NÃO foi aplicada.
 *  · `fechado` — o endereço público recusa o bucket. É o estado desejado.
 *  · `nao-sei` — não deu para perguntar (sem Supabase configurado, rede
 *                fora, resposta em formato desconhecido). NUNCA é tratado
 *                como `fechado`: a dúvida não pode virar silêncio.
 */
export type EstadoDoBucket = 'aberto' | 'fechado' | 'nao-sei';

/**
 * Traduz a resposta do endereço público do Storage em um dos três estados.
 *
 * ===================================================================
 * OS DOIS CORPOS ABAIXO SÃO MEDIDOS, NÃO DEDUZIDOS
 * ===================================================================
 *
 * 01/09/2026, contra o projeto de verdade, SEM MANDAR CHAVE NENHUMA:
 *
 *   GET .../storage/v1/object/public/galeria/nao-existe.jpg
 *   → 400 {"statusCode":"404","error":"not_found",
 *          "message":"Object not found","code":"NoSuchKey"}
 *
 *   GET .../storage/v1/object/public/nao-existe-bucket/x.jpg
 *   → 400 {"statusCode":"404","error":"Bucket not found",
 *          "message":"Bucket not found","code":"NoSuchBucket"}
 *
 * `NoSuchKey` é a resposta que só existe quando o bucket É PÚBLICO: o
 * Storage aceitou o bucket e só reclamou da chave. Um bucket privado (ou
 * inexistente) responde `NoSuchBucket`, porque o endereço público nem
 * chega a procurar o arquivo.
 *
 * NÃO FOI MEDIDO o lado privado deste bucket, e não tinha como: aplicar a
 * migration exige `service_role`, que este projeto não tem (spec §4.1). O
 * que está medido é o lado que importa hoje — o alarme dispara de verdade,
 * contra o projeto de verdade, no estado em que ele está. Quando alguém
 * rodar a migration, a confirmação é abrir /admin/galeria e ver o aviso
 * sumir.
 *
 * A SONDA É A PRÓPRIA BRECHA, e não um espelho dela: ela pergunta pelo
 * mesmo endereço, do mesmo jeito e sem credencial nenhuma, que um estranho
 * de posse de uma URL usaria. Se ela diz `aberto`, é porque a porta está
 * aberta — não porque um número de versão em algum lugar está desatualizado.
 */
export function lerRespostaDaSonda(status: number, corpo: string): EstadoDoBucket {
  // ANTES DE OLHAR O CORPO: uma resposta de sucesso significa que o endereço
  // público SERVIU alguma coisa, sem chave nenhuma. Improvável (a sonda pede
  // um nome que nenhum arquivo real tem), mas se acontecer o bucket está
  // aberto por definição — e o corpo aí nem é JSON, é o arquivo.
  if (status >= 200 && status < 300) return 'aberto';

  let codigo: unknown;

  try {
    codigo = (JSON.parse(corpo) as { code?: unknown }).code;
  } catch {
    // Corpo que não é JSON: pode ser página de erro de um proxy, um HTML de
    // captive portal, qualquer coisa. Não afirma nada.
    return 'nao-sei';
  }

  if (codigo === 'NoSuchKey') return 'aberto';
  if (codigo === 'NoSuchBucket') return 'fechado';

  return 'nao-sei';
}

/**
 * O aviso que a equipe lê no topo de /admin/galeria enquanto a migration
 * não foi rodada.
 *
 * Ele diz o que está errado, o que isso significa para as fotos que já
 * subiram, e o gesto exato que resolve — com o nome do arquivo. Um aviso
 * que só diz "atenção" faz a pessoa fechar a tela.
 */
export const AVISO_BUCKET_ABERTO = 'Atenção: o depósito de arquivos desta galeria ainda está '
  + 'aberto. Toda foto que subir por aqui fica baixável por quem tiver o endereço dela, mesmo '
  + 'depois de "Tirar do ar" — só "Apagar" tira de vez. Falta alguém rodar a migration '
  + `supabase/migrations/${MIGRATION_DA_GALERIA} no painel do Supabase; este aviso some sozinho `
  + 'quando isso acontecer.';

/**
 * O aviso de quando a sonda não conseguiu responder.
 *
 * Existe porque "não deu para perguntar" e "está fechado" não podem chegar
 * à tela como a mesma coisa: o padrão de defeito deste projeto é falha
 * silenciosa (CLAUDE.md), e um silêncio aqui seria lido como "está tudo
 * certo".
 */
export const AVISO_SONDA_SEM_RESPOSTA = 'Não deu para conferir se o depósito de arquivos desta '
  + 'galeria está fechado. Enquanto ninguém confirmar, trate as fotos como se o endereço delas '
  + 'fosse público: "Tirar do ar" pode não bastar, e "Apagar" tira de vez.';
