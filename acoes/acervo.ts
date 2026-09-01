/**
 * acoes/acervo.ts — subir material, pôr no ar, tirar do ar e apagar
 * (RF36/RF37/RF33).
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/galeria.ts e acoes/publicacoes.ts, e vale
 * palavra por palavra: o Next publica cada função exportada de um arquivo
 * `'use server'` numa URL (spec §4.5), e ela não passa por
 * `app/admin/layout.tsx`, nem pela página, nem por `generateMetadata`. A
 * varredura de testes/painel-guarda.test.mjs lê `app/admin/**` e NÃO
 * alcança este arquivo.
 *
 * Por isso CADA função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo — e testes/acervo.test.mjs
 * varre este arquivo exigindo isso de toda Action nova.
 *
 * A guarda daqui não é a tranca. A tranca são DUAS políticas, de sistemas
 * diferentes:
 *   · `acervo: equipe gerencia` (RLS da tabela, 002_conteudo.sql);
 *   · `arquivos publicos: equipe envia/atualiza/remove` (RLS do Storage,
 *     006_storage.sql — política de Storage também é RLS).
 * O cliente deste projeto usa a sessão de quem pediu e não existe chave de
 * serviço no repositório (spec §4.1): mesmo que alguém contornasse o `if`,
 * o Postgres recusaria as duas. O que a guarda faz é transformar a recusa
 * numa frase que a pessoa entende.
 *
 * ===================================================================
 * O BUCKET `acervo` É PÚBLICO, E ISSO MUDA O QUE "TIRAR DO AR" SIGNIFICA
 * ===================================================================
 *
 * `supabase/migrations/006_storage.sql` criou os três buckets públicos. O
 * `galeria` deixou de ser em 008, por causa da RN07 (foto de pessoa, e o
 * público da ONG inclui crianças a partir de 10 anos). **O `acervo` NÃO, e
 * é decisão, não pendência:** cartilha, ficha técnica e portfólio existem
 * para circular, e /acervo promete download livre, sem cadastro, desde o
 * site antigo. Fechá-lo significaria URL assinada com prazo — ou seja, um
 * link que a professora salvou e que morre em uma hora.
 *
 * A CONSEQUÊNCIA, que precisa estar escrita porque é o contrário do que a
 * tela sugere: **"Tirar do ar" mexe só na tabela.** O arquivo continua no
 * bucket e continua baixável por quem já tiver o endereço, para sempre. O
 * caminho tem um uuid dentro (`caminhoDoMaterial`), então não é adivinhável
 * e só aparece no HTML de material publicado — obscuridade, não permissão.
 *
 * É POR ISSO QUE ESTA TELA TEM "APAGAR", como a da galeria e ao contrário
 * da de notícias: quando o que subiu foi o ARQUIVO ERRADO (o caso real
 * deste projeto: os PDFs da ONG estão numa pasta ao lado de currículo e de
 * documento pessoal), tirar do ar não resolve nada. Só `apagarMaterial`
 * remove o arquivo.
 *
 * ===================================================================
 * `publicado` E `downloads` NUNCA VÊM DO FORMULÁRIO
 * ===================================================================
 *
 * `enviarMaterial` monta o objeto do insert com `colunasDoMaterial()`
 * (compartilhado/validacao.ts), que só conhece seis chaves e é função pura
 * — testada com um FormData hostil. `publicado` não está entre elas e a
 * coluna é `not null default false`: o material nasce fora do ar pela
 * AUSÊNCIA da chave, não por um `false` escrito à mão que alguém possa
 * "parametrizar" depois. É a regra 6 do CLAUDE.md aplicada a outras duas
 * colunas.
 *
 * ===================================================================
 * TODA FUNÇÃO TERMINA EM redirect() — É O QUE FAZ FUNCIONAR SEM JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como em acoes/galeria.ts. Numa tela de upload isso
 * vale mais do que numa de texto: sem o redirect, atualizar a página depois
 * de enviar reenviaria o arquivo inteiro.
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try`. Um catch em volta os transformaria em "não foi possível gravar"
 * logo depois de uma gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { buscarMaterial } from '@/servidor/dados/acervo';
import {
  lerMaterial, validarMaterial, lerAlternancia, ehIdentificador,
  tipoDoDocumento, caminhoDoMaterial, colunasDoMaterial, BYTES_PARA_RECONHECER
} from '@/compartilhado/validacao';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const LISTA = '/admin/acervo';

/** O bucket, público desde supabase/migrations/006_storage.sql. */
const BUCKET = 'acervo';

/** Mensagem única de "o formulário voltou com campo errado". */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, no formulário de envio.
 *
 * Diz que o arquivo não volta pelo mesmo motivo escrito em acoes/galeria.ts:
 * nenhum navegador aceita repopular um `<input type="file">` — o servidor
 * não pode escolher um arquivo do disco de quem está do outro lado.
 */
const SEM_PERMISSAO = 'Sua sessão de equipe não vale mais (ou nunca valeu). Entre de novo em '
  + 'outra aba e envie outra vez. Os textos continuam nesta tela; o arquivo você precisa '
  + 'escolher de novo — o navegador não deixa o site preencher um campo de arquivo.';

/**
 * Sem projeto Supabase configurado não há bucket nem tabela. Acontece de
 * verdade na suíte offline (`npm test`) e num deploy sem as variáveis no
 * painel da Netlify (CLAUDE.md, item 0e).
 */
function semSupabase(): string {
  console.error('[acervo] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhum material pode ser enviado.');
  return 'O banco de dados não está configurado neste endereço, então não dá para subir '
    + 'material agora.';
}

/**
 * A mensagem de falha de envio. Genérica na tela, detalhada no log — a
 * mesma regra de acoes/autenticacao.ts: erro do Supabase nunca vai cru para
 * quem está usando.
 */
function naoDeuParaEnviar(): string {
  return 'Não deu para subir o material agora. Tente de novo em alguns instantes — pode ser a '
    + 'conexão. Se estiver em rede de celular fraca, vale tentar de novo com Wi-Fi.';
}

/**
 * RF37 — sobe um material para o Storage e grava a linha em `public.acervo`.
 *
 * NASCE FORA DO AR, sempre: `colunasDoMaterial()` não menciona `publicado`.
 *
 * A ORDEM É ARQUIVO PRIMEIRO, LINHA DEPOIS, e a consequência é a mesma de
 * `enviarMidia`: se o insert falhar depois de o arquivo ter subido, sobra um
 * arquivo órfão no bucket. A ordem inversa seria pior — uma linha apontando
 * para um arquivo que não existe é um botão "Baixar" que devolve erro na
 * página pública, enquanto o órfão é invisível (nenhuma tela lista o
 * bucket; as listas saem da TABELA). Por isso o `catch` do insert tenta
 * remover o arquivo, e por isso a falha dessa remoção é só um aviso no log.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera.
 */
export async function enviarMaterial(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerMaterial(dados);
  const { valido, erros } = validarMaterial(campos);

  // O que a pessoa escreveu volta em toda recusa (defeito medido na Tarefa
  // 3 da autenticação). O ARQUIVO NÃO VOLTA — ver SEM_PERMISSAO acima.
  const valores = {
    titulo: campos.titulo,
    descricao: campos.descricao,
    tema: campos.tema,
    faixa_etaria: campos.faixaEtaria
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  const arquivo = campos.arquivo as File;

  // O TIPO VEM DOS BYTES, NUNCA DA EXTENSÃO NEM DO Content-Type — mesma
  // decisão de acoes/galeria.ts, e pelo mesmo motivo: `accept` é sugestão
  // para o seletor de arquivos e `arquivo.type` vem do cliente. Quem monta
  // a requisição à mão escolhe os três (nome, extensão, tipo declarado).
  //
  // Lê o arquivo INTEIRO uma vez só e reaproveita o buffer no upload: uma
  // segunda leitura não custa rede, mas custa memória na função, e memória
  // de função é o que a Netlify cobra.
  let conteudo: ArrayBuffer;
  try {
    conteudo = await arquivo.arrayBuffer();
  } catch (erro) {
    console.error('[acervo] não deu para ler o arquivo recebido:', descrever(erro));
    return { ok: false, mensagem: naoDeuParaEnviar(), valores };
  }

  const reconhecido = tipoDoDocumento(new Uint8Array(conteudo.slice(0, BYTES_PARA_RECONHECER)));

  if (!reconhecido) {
    return {
      ok: false,
      valores,
      mensagem: CONFIRA_OS_CAMPOS,
      erros: {
        arquivo: 'Este arquivo não é um PDF. O acervo aceita PDF por enquanto — se o material '
          + 'está em Word ou em slides, use "Exportar como PDF" (ou "Imprimir → Salvar como '
          + 'PDF") e suba o arquivo gerado.'
      }
    };
  }

  // Nome de arquivo é entrada de usuário e NÃO entra no caminho: nem
  // "limpo". Ver `caminhoDoMaterial` — o caminho é <tema reduzido>/<uuid>.
  const caminho = caminhoDoMaterial(campos.tema, reconhecido.extensao, crypto.randomUUID());

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    const envio = await supabase.storage.from(BUCKET).upload(caminho, conteudo, {
      contentType: reconhecido.tipo,
      // `upsert: false` de propósito: o caminho tem um uuid dentro, então
      // colisão só aconteceria por defeito nosso — e sobrescrever em
      // silêncio um material que já está no ar seria o pior desfecho
      // possível de um defeito desses.
      upsert: false
    });

    if (envio.error) {
      console.error('[acervo] upload:', descrever(envio.error));
      falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };
    } else {
      // Chave por chave, e a montagem é uma função PURA — ver o cabeçalho
      // deste arquivo e `colunasDoMaterial` em compartilhado/validacao.ts.
      // `tamanho_bytes` sai do arquivo recebido, nunca do formulário: é o
      // número que alguém em rede de celular usa para decidir se baixa.
      const linha = colunasDoMaterial(campos, caminho, arquivo.size);

      const { error } = await supabase.from('acervo').insert(linha);

      if (error) {
        console.error('[acervo] insert:', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };

        // O arquivo subiu e a linha não: sem isto sobra um arquivo órfão no
        // bucket PÚBLICO para sempre. Se a remoção também falhar, o que
        // resta é o log.
        const limpeza = await supabase.storage.from(BUCKET).remove([caminho]);
        if (limpeza.error) {
          console.error(
            `[acervo] o insert falhou e o arquivo "${caminho}" NÃO pôde ser removido do `
            + `bucket — sobrou órfão, num bucket público. Motivo: ${descrever(limpeza.error)}`
          );
        }
      }
    }
  } catch (erro) {
    console.error('[acervo] enviar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };
  }

  if (falha) return falha;

  // FORA do try.
  redirect(`${LISTA}?aviso=enviado`);
}

/**
 * RF37 — pôr no ar ou tirar do ar. O ato separado de subir.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: é um botão dentro
 * da lista, usado direto como `<form action={alternarMaterial}>` num Server
 * Component. Sem componente de cliente no meio, ou seja, sem nada que
 * dependa de hidratar — funciona sem JavaScript por construção.
 *
 * O `.select('id')` do update NÃO é enfeite: em `acervo` a equipe lê tudo
 * (`using (publicado or eh_equipe())`), então a linha volta — e é a única
 * forma de saber se o update acertou ALGUMA linha. Um update que não casa
 * nenhuma é SUCESSO no PostgREST, com zero linhas: sem isto, publicar um
 * material apagado por outra pessoa responderia "Publicado" sem ter
 * publicado nada. (É o contrário do caso de `inscricoes`/`contatos`, onde
 * pedir a linha de volta faz a escrita PARECER que falhou — ver o
 * CLAUDE.md.)
 */
export async function alternarMaterial(dados: FormData): Promise<void> {
  const { id, acao } = lerAlternancia(dados);

  // A guarda, antes de tocar em qualquer coisa. `notFound()` (e não uma
  // mensagem, como no formulário de envio) porque não há tela de trabalho
  // para preservar: este é um botão.
  if (!await ehEquipe()) notFound();

  if (!acao || !ehIdentificador(id)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  const publicando = acao === 'publicar';
  let desfecho: 'publicado' | 'retirado' | 'erro' = 'erro';

  try {
    const supabase = await obterCliente();
    const { data, error } = await supabase
      .from('acervo')
      .update({ publicado: publicando })
      .eq('id', id)
      .select('id');

    if (error) console.error('[acervo] pôr no ar:', descrever(error));
    else if (Array.isArray(data) && data.length > 0) {
      desfecho = publicando ? 'publicado' : 'retirado';
    }
  } catch (erro) {
    console.error('[acervo] pôr no ar (exceção):', descrever(erro));
  }

  if (desfecho !== 'erro') revalidatePath('/acervo');

  // FORA do try.
  redirect(`${LISTA}?aviso=${desfecho}`);
}

/**
 * RF37 — apaga a linha E o arquivo.
 *
 * ===================================================================
 * POR QUE ESTA TELA TEM APAGAR E A DE NOTÍCIAS NÃO
 * ===================================================================
 *
 * A Tarefa P2 deixou o apagar de fora de propósito, e o argumento era bom:
 * "tirar do ar" resolve o caso urgente, guarda o conteúdo, e apagar é o
 * único gesto sem desfazer — feito num celular, de pé, no meio de um
 * evento. Aqui o argumento se INVERTE, e a causa é o bucket público (ver o
 * cabeçalho): um texto guardado e fora do ar não faz mal a ninguém; um
 * ARQUIVO guardado e fora do ar continua sendo baixável por quem tiver o
 * endereço, e para sempre — não há prazo de assinatura nenhum aqui, ao
 * contrário da galeria desde 008.
 *
 * O caso concreto que isto atende: subir o arquivo errado. Os PDFs da ONG
 * moram numa pasta ao lado de currículo e de documento pessoal, e um toque
 * errado no seletor do celular põe o arquivo errado num endereço público.
 * "Tirar do ar" não desfaz isso; só apagar desfaz.
 *
 * O RISCO DE APAGAR POR ENGANO É TRATADO COM UMA TELA, NÃO COM UM
 * `confirm()`: `/admin/acervo/apagar?id=...` mostra a ficha e pergunta.
 * `confirm()` do navegador não existe sem JavaScript, e uma tela de
 * confirmação é o único caminho que funciona nos dois casos.
 *
 * A ORDEM É ARQUIVO PRIMEIRO, LINHA DEPOIS — o inverso da ordem de
 * `enviarMaterial`, e de propósito. O desfecho ruim aqui é sobrar arquivo
 * sem linha (invisível, e baixável por quem tiver o endereço), e ele é pior
 * que sobrar linha sem arquivo (botão "Baixar" que falha, visível,
 * corrigível). Apagando o arquivo primeiro, uma falha no meio deixa o caso
 * VISÍVEL na tela, onde alguém pode agir.
 */
export async function apagarMaterial(dados: FormData): Promise<void> {
  const { id } = lerAlternancia(dados);

  if (!await ehEquipe()) notFound();

  if (!ehIdentificador(id)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  let apagou = false;

  try {
    const { valor: atual } = await buscarMaterial(id);

    if (atual) {
      const supabase = await obterCliente();

      // O arquivo primeiro — ver acima. Se a remoção falhar, a linha FICA:
      // apagar a linha aqui esconderia da equipe o arquivo que continua no
      // bucket público, que é exatamente o estado que ninguém pode deixar
      // de ver.
      const doBucket = await supabase.storage.from(BUCKET).remove([atual.arquivo_caminho]);

      if (doBucket.error) {
        console.error(
          `[acervo] não deu para remover "${atual.arquivo_caminho}" do bucket — a linha NÃO foi `
          + `apagada, de propósito, para o caso continuar visível no painel. `
          + `Motivo: ${descrever(doBucket.error)}`
        );
      } else {
        const { data, error } = await supabase.from('acervo').delete().eq('id', id).select('id');

        if (error) {
          console.error(
            `[acervo] o arquivo "${atual.arquivo_caminho}" foi removido do bucket mas a linha `
            + `${id} NÃO foi apagada: o acervo vai mostrar um material que não baixa até alguém `
            + `apagar de novo. Motivo: ${descrever(error)}`
          );
        } else {
          apagou = Array.isArray(data) && data.length > 0;
        }
      }
    }
  } catch (erro) {
    console.error('[acervo] apagar (exceção):', descrever(erro));
  }

  if (apagou) revalidatePath('/acervo');

  // FORA do try.
  redirect(`${LISTA}?aviso=${apagou ? 'apagado' : 'erro'}`);
}
