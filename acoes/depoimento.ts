'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { lerDepoimento, validarDepoimento } from '@/compartilhado/validacao';
import { origemDoVisitante } from '@/compartilhado/origem-do-visitante';
import { mensagemDeErroDeEnvio, FUNCAO_NAO_EXISTE } from '@/compartilhado/erros';
import type { EstadoFormulario } from './autenticacao';

/**
 * O formulário PÚBLICO de depoimento — a 3ª Action do projeto SEM `ehEquipe()`,
 * e a ausência é o desenho (como `acoes/contato.ts` e `acoes/inscricoes.ts`):
 * quem escreve um depoimento não tem conta. A tranca é a validação daqui, os
 * `check` do banco (adulto/responsável, autorização) e a RLS (só nasce
 * `pendente`).
 *
 * O depoimento NÃO vai ao ar: nasce `pendente` e só a equipe aprova
 * (`acoes/depoimentos.ts`, que EXIGE `ehEquipe()`). Esta Action nunca escreve
 * `situacao` — a coluna toma o default do banco, e a política de insert recusa
 * qualquer outro valor.
 *
 * Sem `.select()` depois do insert, pelo mesmo motivo de `contatos`: a linha
 * pendente não é legível por quem a enviou, e pedi-la de volta faria um
 * envio que deu certo parecer falha.
 */
const DESTINO = '/depoimentos?aviso=enviado';
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

export async function enviarDepoimento(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerDepoimento(dados);
  const { valido, erros } = validarDepoimento(campos);

  const valores = {
    nome: campos.nome,
    atividade: campos.atividade,
    texto: campos.texto,
    declara_adulto: campos.declaraAdulto ? 'on' : '',
    autoriza_publicacao: campos.autorizaPublicacao ? 'on' : ''
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!temSupabase()) {
    console.error('[depoimento] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente.');
    return {
      ok: false,
      valores,
      mensagem: 'O envio de depoimentos não está disponível neste endereço. Escreva para a '
        + `gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}.`
    };
  }

  const cabecalhos = await headers();
  const origem = origemDoVisitante((nome) => cabecalhos.get(nome));

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();
    const { error } = await supabase.rpc('registrar_depoimento', {
      p_visitante: origem,
      p_nome: campos.nome,
      p_texto: campos.texto,
      p_declara_adulto: campos.declaraAdulto,
      p_autoriza_publicacao: campos.autorizaPublicacao,
      p_atividade: campos.atividade
    });

    if (error) {
      if ((error as { code?: string }).code === FUNCAO_NAO_EXISTE) {
        console.error('[depoimento] a função public.registrar_depoimento não existe: '
          + 'supabase/migrations/014_depoimentos.sql ainda NÃO foi aplicada.');
        falha = {
          ok: false,
          valores,
          mensagem: 'Os depoimentos ainda não estão abertos. Escreva para a gente pelo WhatsApp '
            + `${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} que a gente guarda com carinho.`
        };
      } else {
        const traduzido = mensagemDeErroDeEnvio(error);
        console.error(
          `[depoimento] não deu para gravar${traduzido.conhecido ? '' : ' (causa não prevista)'}:`,
          descrever(error)
        );
        falha = { ok: false, mensagem: traduzido.mensagem, valores };
      }
    }
  } catch (erro) {
    console.error('[depoimento] enviar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  redirect(DESTINO);
}
