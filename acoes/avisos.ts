/**
 * acoes/avisos.ts — o mural de avisos (RF27) e o envio para um grupo
 * (RF28).
 *
 * ===================================================================
 * TODA ACTION DAQUI CHAMA `ehEquipe()` SOZINHA
 * ===================================================================
 *
 * Server Action é endpoint HTTP público (spec §4.5) e não passa por página
 * nem por layout — a varredura de `testes/painel-guarda.test.mjs` cobre
 * `app/admin/**` e NÃO alcança este arquivo. `testes/avisos.test.mjs` tem a
 * varredura irmã.
 *
 * A guarda não é a tranca: `avisos: equipe gerencia` é `for all using
 * (public.eh_equipe())` (migration 012), e `anon` não recebe grant nenhum
 * nessa tabela. Mesmo que estes `if` fossem contornados, o Postgres
 * recusaria.
 *
 * ===================================================================
 * TRÊS GESTOS SEPARADOS, E A SEPARAÇÃO É O DESENHO
 * ===================================================================
 *
 *   escrever  →  `salvarAviso`   — não conhece a coluna `publicado`
 *   publicar  →  `alternarAviso` — botão próprio
 *   enviar    →  `enviarAviso`   — botão próprio, e SEM DESFAZER
 *
 * Publicar já é separado de escrever em `publicacoes`, pelo mesmo motivo.
 * O terceiro é novo, e é o mais sério: **e-mail enviado não volta**. Um
 * único gesto que escrevesse, publicasse e mandasse para 40 pessoas seria
 * o gesto mais perigoso do painel inteiro, num celular, de pé.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { ehEquipe } from '@/servidor/permissao';
import { descrever } from '@/servidor/dados/degradacao';
import { buscarAviso } from '@/servidor/dados/avisos';
import { avisar } from '@/servidor/email';
import { lerAviso, validarAviso, colunasDoAviso, ehIdentificador } from '@/compartilhado/validacao';
import { grupoPorChave } from '@/compartilhado/grupos-de-aviso';
import { mensagemDeErroDeEnvio } from '@/compartilhado/erros';
import type { EstadoFormulario } from './autenticacao';

const LISTA = '/admin/avisos';
const MURAL = '/avisos';
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/** Escrever ou corrigir um aviso. NÃO publica — ver o cabeçalho. */
export async function salvarAviso(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  if (!await ehEquipe()) redirect(LISTA);

  const campos = lerAviso(dados);
  const { valido, erros } = validarAviso(campos);

  // Tudo volta em toda recusa: o que se perderia aqui é um texto inteiro,
  // escrito no celular.
  const valores = { id: campos.id, titulo: campos.titulo, corpo: campos.corpo };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  const linha = colunasDoAviso(campos);
  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    if (campos.id) {
      // `.select('id')` DE PROPÓSITO, e é o contrário do insert público de
      // `contatos`: aqui a equipe LÊ tudo, então sem pedir a linha de volta
      // um update que não casa nenhuma seria "sucesso com zero linhas" no
      // PostgREST — e corrigir um aviso apagado responderia "guardado" sem
      // ter guardado nada. Mesma regra de `publicacoes`.
      const { data, error } = await supabase
        .from('avisos').update(linha).eq('id', campos.id).select('id');

      if (error) {
        console.error('[avisos] salvar:', descrever(error));
        falha = { ok: false, mensagem: mensagemDeErroDeEnvio(error).mensagem, valores };
      } else if (!Array.isArray(data) || data.length === 0) {
        falha = {
          ok: false,
          valores,
          mensagem: 'Nada foi guardado: este aviso não está mais lá. Volte para a lista e '
            + 'confira — pode ser que alguém da equipe o tenha apagado.'
        };
      }
    } else {
      const { error } = await supabase.from('avisos').insert(linha);
      if (error) {
        console.error('[avisos] criar:', descrever(error));
        falha = { ok: false, mensagem: mensagemDeErroDeEnvio(error).mensagem, valores };
      }
    }
  } catch (erro) {
    console.error('[avisos] salvar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  revalidatePath(LISTA);
  revalidatePath(MURAL);

  // FORA do try — `redirect()` sinaliza por exceção.
  redirect(`${LISTA}?aviso=${campos.id ? 'salvo' : 'criado'}`);
}

/**
 * Publicar ou tirar do mural.
 *
 * `publicado_em` só é carimbado se ainda for nulo — corrigir e republicar
 * não é republicar. Ao tirar do ar a data FICA: ela é um fato, e apagá-la
 * seria destruir informação num gesto sem desfazer. Mesma regra de
 * `publicacoes`.
 */
export async function alternarAviso(dados: FormData): Promise<void> {
  if (!await ehEquipe()) redirect(LISTA);

  const id = String(dados.get('id') ?? '');
  const acao = String(dados.get('acao') ?? '');

  if (!ehIdentificador(id) || (acao !== 'publicar' && acao !== 'despublicar')) {
    redirect(`${LISTA}?aviso=erro`);
  }

  const publicar = acao === 'publicar';
  let deuCerto = false;

  try {
    const { valor: atual } = await buscarAviso(id);

    const linha: { publicado: boolean; publicado_em?: string } = { publicado: publicar };
    if (publicar && !atual?.publicado_em) linha.publicado_em = new Date().toISOString();

    const { data, error } = await (await obterCliente())
      .from('avisos').update(linha).eq('id', id).select('id');

    if (error) {
      console.error('[avisos] alternar:', descrever(error));
    } else {
      deuCerto = Array.isArray(data) && data.length > 0;
    }
  } catch (erro) {
    console.error('[avisos] alternar (exceção):', descrever(erro));
  }

  revalidatePath(LISTA);
  revalidatePath(MURAL);

  redirect(`${LISTA}?aviso=${!deuCerto ? 'erro' : publicar ? 'publicado' : 'retirado'}`);
}

/**
 * RF28 — manda o aviso por e-mail para um grupo.
 *
 * ===================================================================
 * O TEXTO NÃO VIAJA, SÓ O IDENTIFICADOR
 * ===================================================================
 *
 * É a regra da Edge Function (spec §9), e aqui ela aparece na assinatura:
 * o que vai para a função é `{ tipo: 'aviso', id, grupo }`. Nem o título,
 * nem o corpo, nem um endereço de e-mail. A função busca o aviso no banco e
 * resolve o grupo por conta própria.
 *
 * Sem isso, este endpoint seria um jeito de mandar qualquer texto para
 * qualquer lista, em nome do domínio da ONG.
 *
 * ===================================================================
 * SÓ O QUE ESTÁ PUBLICADO PODE SER ENVIADO
 * ===================================================================
 *
 * Um rascunho é um texto que a equipe ainda está escrevendo. Mandar um
 * rascunho para 40 pessoas é o desfecho que não tem desfazer — e a recusa
 * aqui existe porque o botão fica na mesma tela do botão de publicar, a um
 * toque de distância, num celular.
 *
 * A checagem é NOSSA e não do banco: a política de 012 deixa a equipe
 * atualizar qualquer linha. Aqui não se trata de permissão, e sim de ordem
 * dos gestos.
 */
export async function enviarAviso(dados: FormData): Promise<void> {
  if (!await ehEquipe()) redirect(LISTA);

  const id = String(dados.get('id') ?? '');
  const grupo = grupoPorChave(dados.get('grupo'));
  const eventoId = String(dados.get('evento_id') ?? '');

  if (!ehIdentificador(id) || !grupo) redirect(`${LISTA}?aviso=erro`);

  // O grupo "inscritos em um evento" precisa saber QUAL evento. Sem ele não
  // existe lista, e mandar para lista vazia daria "enviado" sem ninguém ter
  // recebido — que é a pior forma de este gesto falhar.
  if (grupo.exigeEvento && !ehIdentificador(eventoId)) {
    redirect(`${LISTA}?aviso=sem-evento`);
  }

  const { valor: aviso } = await buscarAviso(id);

  if (!aviso) redirect(`${LISTA}?aviso=erro`);
  if (!aviso.publicado) redirect(`${LISTA}?aviso=rascunho-nao-envia`);

  // `avisar()` nunca lança (ver servidor/email.ts). O resultado escolhe a
  // FRASE que a equipe lê — nunca derruba nada, porque não há nada a
  // derrubar: o aviso já está gravado e publicado.
  const enviou = await avisar({
    tipo: 'aviso',
    id,
    grupo: grupo.chave,
    ...(grupo.exigeEvento ? { evento_id: eventoId } : {})
  });

  redirect(`${LISTA}?aviso=${enviou ? 'enviado' : 'envio-falhou'}`);
}
