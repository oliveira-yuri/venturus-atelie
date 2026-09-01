/**
 * acoes/galeria.ts — subir foto, pôr no ar, tirar do ar e apagar
 * (RF05/RF33/RN07). Tarefa P3 do painel.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO. O PAINEL RESPONDER 404 NÃO PROTEGE NADA
 * AQUI.
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts, e vale palavra por palavra: o
 * Next publica cada função exportada de um arquivo `'use server'` numa URL
 * (spec §4.5), e ela não passa por `app/admin/layout.tsx`, nem pela página,
 * nem por `generateMetadata`. A varredura de testes/painel-guarda.test.mjs
 * lê `app/admin/**` e NÃO alcança este arquivo.
 *
 * Por isso CADA função abaixo chama `ehEquipe()` por conta própria, na
 * primeira coisa que faz depois de ler o corpo — e testes/galeria.test.mjs
 * varre este arquivo exigindo isso de toda Action nova.
 *
 * A guarda daqui não é a tranca. A tranca são DUAS políticas, e nesta tela
 * elas são de sistemas diferentes:
 *   · `midia: equipe gerencia` (RLS da tabela, 002_conteudo.sql);
 *   · `arquivos publicos: equipe envia/atualiza/remove` (RLS do Storage,
 *     006_storage.sql — política de Storage também é RLS), mais a leitura
 *     reescrita por 008_galeria_privada.sql.
 * O cliente deste projeto usa a sessão de quem pediu e não existe chave de
 * serviço no repositório (spec §4.1): mesmo que alguém contornasse o `if`,
 * o Postgres recusaria as duas. O que a guarda faz é transformar a recusa
 * numa frase que a pessoa entende.
 *
 * ===================================================================
 * RN07 — NENHUMA FOTO NO AR SEM AUTORIZAÇÃO DE USO DE IMAGEM REGISTRADA
 * ===================================================================
 *
 * É a regra 9 do CLAUDE.md, e é o motivo de não haver UMA foto no site
 * inteiro hoje. O público da ONG inclui crianças a partir de 10 anos.
 *
 * A regra é honrada em quatro lugares, e nenhum deles depende dos outros:
 *
 *   1. NO BANCO. A política de leitura de `public.midia` é
 *      `(publicado and autorizacao_registrada) or eh_equipe()`. Uma linha
 *      sem autorização simplesmente não é legível por quem não é equipe —
 *      nem se `publicado` estiver true.
 *   2. NESTA ACTION. `porNoAr` lê a linha e RECUSA publicar quando
 *      `autorizacao_registrada` é false, mesmo que o botão tenha sido
 *      montado à mão. Não é redundância inútil: sem ela a tela mostraria
 *      "No ar" para uma foto que o público não vê, e a equipe acharia que
 *      publicou.
 *   3. NA TELA. A caixa de autorização não diz "aceito os termos": diz o
 *      que a pessoa está AFIRMANDO — que existe autorização registrada
 *      para quem aparece ali (componentes/FormularioMidia.tsx).
 *   4. NO ARQUIVO, desde 01/09/2026. Até a Tarefa P3 as três camadas acima
 *      protegiam a LISTAGEM e nenhuma protegia o ARQUIVO: o bucket
 *      `galeria` nascia público em 006_storage.sql, e toda foto enviada
 *      ficava baixável para sempre por quem tivesse o caminho, publicada
 *      ou não. Era o item 0j do CLAUDE.md, e a medição está no cabeçalho
 *      de supabase/migrations/008_galeria_privada.sql. Agora o bucket é
 *      privado e o endereço é uma URL assinada de uma hora
 *      (servidor/dados/galeria.ts), emitida só para foto publicada E
 *      autorizada — a mesma condição das outras três, aplicada ao arquivo.
 *
 * O QUE CONTINUA SEM RESOLVER, e precisa estar escrito porque é limite
 * real: **a migration 008 ainda não foi rodada em lugar nenhum**. Ninguém
 * consegue aplicá-la pelo código (não há `service_role` — spec §4.1), e
 * enquanto ela não for colada no SQL Editor do painel do Supabase o bucket
 * segue público, sem nada quebrar. Contra esse silêncio existe a sonda de
 * `bucketAindaAberto()` (servidor/dados/galeria.ts), que grita no log e
 * desenha um aviso permanente no topo de /admin/galeria.
 *
 * E, mesmo com a migration aplicada, uma URL assinada é um PORTADOR: quem
 * tiver o link entra até ele vencer. Por isso **esta tela continua tendo
 * "Apagar", ao contrário da de notícias** (ver `apagarMidia`).
 *
 * ===================================================================
 * `publicado` E `autorizacao_registrada` NUNCA VÊM ESPALHADOS DO FORMULÁRIO
 * ===================================================================
 *
 * `enviarMidia` monta o objeto do insert chave por chave, a partir de
 * `compartilhado/validacao.ts`, que só conhece cinco campos. `publicado`
 * não está entre eles e a coluna é `not null default false`: a foto nasce
 * fora do ar pela AUSÊNCIA da chave, não por um `false` escrito à mão que
 * alguém possa "parametrizar" depois. É a regra 6 do CLAUDE.md aplicada a
 * outras duas colunas — e aqui o preço de errar é a foto de uma criança na
 * internet.
 *
 * ===================================================================
 * TODA FUNÇÃO TERMINA EM redirect() — É O QUE FAZ FUNCIONAR SEM JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como em acoes/publicacoes.ts. Numa tela de upload isso
 * vale mais do que lá: sem o redirect, atualizar a página depois de enviar
 * reenviaria a foto inteira — de novo o plano de dados de quem está de pé
 * no meio de um evento.
 *
 * `redirect()` e `notFound()` sinalizam POR EXCEÇÃO e ficam FORA de todo
 * `try`. Um catch em volta os transformaria em "não foi possível gravar"
 * logo depois de uma gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { ehEquipe } from '@/servidor/permissao';
import { buscarLinhaDaMidia } from '@/servidor/dados/galeria';
import {
  lerMidia, validarMidia, lerAlternancia, ehIdentificador,
  tipoDaImagem, caminhoNoBucket, BYTES_PARA_RECONHECER
} from '@/compartilhado/validacao';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const LISTA = '/admin/galeria';

/** O bucket, privado desde supabase/migrations/008_galeria_privada.sql. */
const BUCKET = 'galeria';

/** Mensagem única de "o formulário voltou com campo errado". */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, no formulário de envio.
 *
 * Diferente da de acoes/publicacoes.ts numa coisa, e a diferença é honesta:
 * lá a frase promete que "o que você escreveu continua nesta tela", e é
 * verdade. AQUI O ARQUIVO NÃO VOLTA. Nenhum navegador aceita repopular um
 * `<input type="file">` por questão de segurança — o servidor não pode
 * escolher um arquivo do disco de quem está do outro lado. Os campos de
 * texto voltam; a foto precisa ser escolhida de novo. Dizer isso é melhor
 * que deixar a pessoa apertar "Enviar" num formulário que parece cheio e
 * está sem a foto.
 */
const SEM_PERMISSAO = 'Sua sessão de equipe não vale mais (ou nunca valeu). Entre de novo em '
  + 'outra aba e envie outra vez. Os textos continuam nesta tela; a foto você precisa escolher '
  + 'de novo — o navegador não deixa o site preencher um campo de arquivo.';

/**
 * Sem projeto Supabase configurado não há bucket nem tabela. Acontece de
 * verdade na suíte offline (`npm test`) e num deploy sem as variáveis no
 * painel da Netlify (CLAUDE.md, item 0e).
 */
function semSupabase(): string {
  console.error('[galeria] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma foto pode ser enviada.');
  return 'O banco de dados não está configurado neste endereço, então não dá para subir foto agora.';
}

/**
 * A mensagem de falha de envio. Genérica na tela, detalhada no log — a
 * mesma regra de acoes/autenticacao.ts: erro do Supabase nunca vai cru para
 * quem está usando.
 */
function naoDeuParaEnviar(): string {
  return 'Não deu para subir a foto agora. Tente de novo em alguns instantes — pode ser a '
    + 'conexão. Se estiver em rede de celular fraca, vale tentar de novo com Wi-Fi.';
}

/**
 * RF05/RF33 — sobe uma foto para o Storage e grava a linha em `public.midia`.
 *
 * NASCE FORA DO AR, sempre: o `insert` abaixo não menciona `publicado`.
 *
 * A ORDEM É ARQUIVO PRIMEIRO, LINHA DEPOIS, e ela tem consequência: se o
 * insert falhar depois de o arquivo ter subido, sobra um arquivo órfão no
 * bucket. A ordem inversa seria pior — uma linha apontando para um arquivo
 * que não existe é uma imagem quebrada na galeria pública, enquanto o órfão
 * é invisível para todo mundo (nenhuma tela lista o bucket; as duas listas
 * saem da TABELA). Por isso o `catch` do insert tenta remover o arquivo, e
 * por isso a falha dessa remoção é só um aviso no log: ela não muda nada do
 * que a pessoa vê.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera.
 */
export async function enviarMidia(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerMidia(dados);
  const { valido, erros } = validarMidia(campos);

  // O que a pessoa escreveu volta em toda recusa (defeito medido na Tarefa
  // 3 da autenticação). O ARQUIVO NÃO VOLTA — ver SEM_PERMISSAO acima.
  // `autorizacao` volta como 'on'/'' porque é assim que CampoFormulario lê
  // `valorInicial` numa caixa de marcar.
  const valores = {
    album: campos.album,
    alt: campos.alt,
    legenda: campos.legenda,
    autorizacao: campos.autorizacao ? 'on' : ''
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  const arquivo = campos.arquivo as File;

  // O TIPO VEM DOS BYTES, NUNCA DA EXTENSÃO NEM DO Content-Type.
  //
  // O `accept` do input é sugestão para o seletor de arquivos do sistema, e
  // `arquivo.type` vem do cliente: os dois são entrada de usuário. Quem
  // monta a requisição à mão escolhe os três (nome, extensão, tipo
  // declarado). O que não dá para forjar sem de fato ser aquilo são os
  // primeiros bytes — ver `tipoDaImagem` em compartilhado/validacao.ts.
  //
  // Lê o arquivo INTEIRO uma vez só e reaproveita o buffer no upload: uma
  // segunda leitura de 4 MB não custa rede, mas custa memória na função, e
  // memória de função é o que a Netlify cobra.
  let conteudo: ArrayBuffer;
  try {
    conteudo = await arquivo.arrayBuffer();
  } catch (erro) {
    console.error('[galeria] não deu para ler o arquivo recebido:', descrever(erro));
    return { ok: false, mensagem: naoDeuParaEnviar(), valores };
  }

  const reconhecido = tipoDaImagem(new Uint8Array(conteudo.slice(0, BYTES_PARA_RECONHECER)));

  if (!reconhecido) {
    return {
      ok: false,
      valores,
      mensagem: CONFIRA_OS_CAMPOS,
      erros: {
        arquivo: 'Este arquivo não é uma foto que o site saiba mostrar. Aceitamos JPG, PNG, GIF '
          + 'e WebP — que é o que sai da câmera do celular. Vídeo ainda não entra por aqui.'
      }
    };
  }

  // Nome de arquivo é entrada de usuário e NÃO entra no caminho: nem
  // "limpo". Ver `caminhoNoBucket` — o caminho é <álbum reduzido>/<uuid>.
  const caminho = caminhoNoBucket(campos.album, reconhecido.extensao, crypto.randomUUID());

  let falha: EstadoFormulario | null = null;
  let subiu = false;

  try {
    const supabase = await obterCliente();

    const envio = await supabase.storage.from(BUCKET).upload(caminho, conteudo, {
      contentType: reconhecido.tipo,
      // `upsert: false` de propósito: o caminho tem um uuid dentro, então
      // colisão só aconteceria por defeito nosso — e sobrescrever em
      // silêncio uma foto que já está no ar seria o pior desfecho possível
      // de um defeito desses.
      upsert: false
    });

    if (envio.error) {
      console.error('[galeria] upload:', descrever(envio.error));
      falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };
    } else {
      subiu = true;

      // Chave por chave, nunca `...campos`: ver o cabeçalho deste arquivo.
      // `publicado` não está aqui, e é a AUSÊNCIA dele que faz a foto nascer
      // fora do ar. `legenda` vazia vira NULL, não string vazia — a coluna
      // aceita nulo e a galeria omite o que é nulo (regra 2 aplicada a
      // campo); guardar '' faria a página desenhar uma legenda em branco.
      const linha = {
        album: campos.album,
        // Só imagem por enquanto — ver o comentário sobre vídeo no
        // cabeçalho de componentes/FormularioMidia.tsx. A coluna tem
        // `check (tipo in ('imagem', 'video'))`, e este valor é nosso, não
        // vem do formulário.
        tipo: 'imagem',
        caminho,
        alt: campos.alt,
        legenda: campos.legenda || null,
        autorizacao_registrada: campos.autorizacao
      };

      const { error } = await supabase.from('midia').insert(linha);

      if (error) {
        console.error('[galeria] insert:', descrever(error));
        falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };

        // O arquivo subiu e a linha não: sem isto sobra um arquivo órfão no
        // bucket para sempre. Se a remoção também falhar, o que resta é o
        // log — e isso é aceitável porque um órfão não aparece em tela
        // nenhuma (as listas saem da TABELA, nunca do bucket).
        const limpeza = await supabase.storage.from(BUCKET).remove([caminho]);
        if (limpeza.error) {
          console.error(
            `[galeria] o insert falhou e o arquivo "${caminho}" NÃO pôde ser removido do `
            + `bucket — sobrou órfão. Motivo: ${descrever(limpeza.error)}`
          );
        }
      }
    }
  } catch (erro) {
    console.error('[galeria] enviar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaEnviar(), valores };
    if (subiu) {
      console.error(
        `[galeria] a exceção aconteceu depois do upload de "${caminho}": pode ter sobrado órfão.`
      );
    }
  }

  if (falha) return falha;

  // FORA do try. Dois desfechos diferentes de propósito: uma foto guardada
  // SEM autorização é um caso que a equipe precisa saber que aconteceu, e
  // não a mesma confirmação de sucesso da outra.
  redirect(`${LISTA}?aviso=${campos.autorizacao ? 'enviada' : 'enviada-sem-autorizacao'}`);
}

/**
 * RF05/RF33/RN07 — pôr no ar ou tirar do ar. O ato separado de subir.
 *
 * Assinatura `(dados) => void`, sem estado de formulário: é um botão dentro
 * da lista, usado direto como `<form action={porNoAr}>` num Server
 * Component. Sem componente de cliente no meio, ou seja, sem nada que
 * dependa de hidratar — funciona sem JavaScript por construção.
 *
 * ===================================================================
 * A RECUSA DA RN07 ACONTECE AQUI, E NÃO SÓ NA TELA
 * ===================================================================
 *
 * A lista não desenha o botão "Publicar" para uma foto sem autorização
 * (componentes/ListaMidia.ts). Isso não basta: esta função é um endpoint
 * HTTP, e o `id` vem do corpo da requisição. Sem a leitura abaixo, quem
 * montasse o POST à mão ligaria `publicado` numa foto sem autorização.
 *
 * O banco ainda protegeria o PÚBLICO (a política de select exige as duas
 * colunas), mas o painel passaria a mostrar "No ar" para uma foto que
 * ninguém vê — a equipe acreditaria ter publicado. A recusa aqui é o que
 * mantém a tela dizendo a verdade.
 */
export async function porNoAr(dados: FormData): Promise<void> {
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
  let desfecho: 'publicada' | 'retirada' | 'sem-autorizacao' | 'erro' = 'erro';

  try {
    // Ler antes de escrever, por causa da RN07 (ver acima).
    // `buscarLinhaDaMidia` já é degradável e nunca lança — e não assina
    // endereço nenhum, que seria uma ida à rede a mais só para decidir.
    const { valor: atual } = await buscarLinhaDaMidia(id);

    if (atual && publicando && !atual.autorizacao_registrada) {
      desfecho = 'sem-autorizacao';
    } else if (atual) {
      const supabase = await obterCliente();
      const { data, error } = await supabase
        .from('midia')
        .update({ publicado: publicando })
        .eq('id', id)
        // `.select('id')` AQUI É DIFERENTE do caso de `inscricoes`/`contatos`,
        // onde pedir a linha de volta faz a escrita PARECER que falhou porque
        // a leitura é negada (CLAUDE.md, arquitetura). Em `midia` a equipe lê
        // tudo (`... or eh_equipe()`), então o retorno volta — e é a única
        // forma de saber se o `update` acertou alguma linha: um update que
        // não casa nenhuma é SUCESSO no PostgREST, com zero linhas. Sem isto,
        // publicar uma foto apagada por outra pessoa responderia "Publicada"
        // sem ter publicado nada.
        .select('id');

      if (error) console.error('[galeria] pôr no ar:', descrever(error));
      else if (Array.isArray(data) && data.length > 0) {
        desfecho = publicando ? 'publicada' : 'retirada';
      }
    }
  } catch (erro) {
    console.error('[galeria] pôr no ar (exceção):', descrever(erro));
  }

  if (desfecho === 'publicada' || desfecho === 'retirada') revalidatePath('/galeria');

  // FORA do try.
  redirect(`${LISTA}?aviso=${desfecho}`);
}

/**
 * RF05/RF33/RN07 — apaga a linha E o arquivo.
 *
 * ===================================================================
 * POR QUE ESTA TELA TEM APAGAR E A DE NOTÍCIAS NÃO
 * ===================================================================
 *
 * A Tarefa P2 deixou o apagar de fora de propósito, e o argumento era bom:
 * "tirar do ar" resolve o caso urgente, guarda o conteúdo, e apagar é o
 * único gesto sem desfazer — feito num celular, de pé, no meio de um
 * evento. Aqui o argumento se INVERTE, e a inversão tem uma causa concreta.
 *
 * Um texto guardado e fora do ar não faz mal a ninguém. Uma FOTO guardada
 * e fora do ar continua existindo como arquivo, e o que muda com
 * 008_galeria_privada.sql é O TAMANHO DA JANELA, não a existência dela:
 *
 *   · ANTES (bucket público): "tirar do ar" mexia só na tabela e o arquivo
 *     continuava baixável **para sempre** por quem tivesse a URL. Tirar do
 *     ar não cumpria a RN07 de jeito nenhum.
 *   · AGORA (bucket privado, URL assinada de uma hora): tirar do ar faz o
 *     banco parar de emitir endereço novo na hora, e as URLs já emitidas
 *     morrem em no máximo uma hora. Tirar do ar passa a cumprir a RN07 —
 *     **com atraso de até uma hora**.
 *
 * E é esse atraso que mantém o "Apagar" nesta tela. No caso urgente da
 * RN07 — autorização retirada, foto de criança subida por engano — uma
 * hora é tempo demais, e apagar é o único gesto que age no mesmo instante:
 * sem o arquivo no bucket, toda URL assinada viva morre junto. O argumento
 * mudou de "tirar do ar não resolve" para "tirar do ar demora até uma
 * hora", e a conclusão continua a mesma.
 *
 * O RISCO DE APAGAR POR ENGANO É TRATADO COM UMA TELA, NÃO COM UM
 * `confirm()`: `/admin/galeria/apagar?id=...` mostra a foto e pergunta.
 * `confirm()` do navegador não existe sem JavaScript, e uma tela de
 * confirmação é o único caminho que funciona nos dois casos.
 *
 * A ORDEM É ARQUIVO PRIMEIRO, LINHA DEPOIS — o inverso da ordem de
 * `enviarMidia`, e de propósito. O desfecho ruim aqui é sobrar arquivo sem
 * linha (invisível, e alcançável por qualquer URL assinada que ainda esteja viva),
 * e ele é pior que sobrar
 * linha sem arquivo (imagem quebrada, visível, corrigível). Apagando o
 * arquivo primeiro, uma falha no meio deixa o caso VISÍVEL na tela, onde
 * alguém pode agir — e não o caso invisível, que é o que a RN07 não pode
 * aceitar.
 */
export async function apagarMidia(dados: FormData): Promise<void> {
  const { id } = lerAlternancia(dados);

  if (!await ehEquipe()) notFound();

  if (!ehIdentificador(id)) redirect(`${LISTA}?aviso=erro`);

  if (!temSupabase()) {
    semSupabase();
    redirect(`${LISTA}?aviso=erro`);
  }

  let apagou = false;

  try {
    const { valor: atual } = await buscarLinhaDaMidia(id);

    if (atual) {
      const supabase = await obterCliente();

      // O arquivo primeiro — ver acima. Se a remoção falhar, a linha FICA:
      // apagar a linha aqui esconderia da equipe o arquivo que continua no
      // bucket, que é exatamente o estado que ninguém pode deixar de ver.
      const doBucket = await supabase.storage.from(BUCKET).remove([atual.caminho]);

      if (doBucket.error) {
        console.error(
          `[galeria] não deu para remover "${atual.caminho}" do bucket — a linha NÃO foi `
          + `apagada, de propósito, para o caso continuar visível no painel. `
          + `Motivo: ${descrever(doBucket.error)}`
        );
      } else {
        const { data, error } = await supabase.from('midia').delete().eq('id', id).select('id');

        if (error) {
          console.error(
            `[galeria] o arquivo "${atual.caminho}" foi removido do bucket mas a linha ${id} `
            + `NÃO foi apagada: a galeria vai mostrar imagem quebrada até alguém apagar de `
            + `novo. Motivo: ${descrever(error)}`
          );
        } else {
          apagou = Array.isArray(data) && data.length > 0;
        }
      }
    }
  } catch (erro) {
    console.error('[galeria] apagar (exceção):', descrever(erro));
  }

  if (apagou) revalidatePath('/galeria');

  // FORA do try.
  redirect(`${LISTA}?aviso=${apagou ? 'apagada' : 'erro'}`);
}
