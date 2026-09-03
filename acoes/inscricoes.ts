/**
 * acoes/inscricoes.ts — inscrição em evento SEM CONTA (RF15), gravando em
 * `public.inscricoes`.
 *
 * ===================================================================
 * A SEGUNDA ACTION DO PROJETO SEM `ehEquipe()`, E A AUSÊNCIA É O DESENHO
 * ===================================================================
 *
 * A outra é `acoes/contato.ts`, e o argumento é o mesmo com um agravante.
 * A decisão D4 do escopo diz, com todas as letras, que reduzir atrito
 * importa mais que histórico individual: quem quer levar o filho a uma
 * oficina de sábado não vai criar conta para isso, e exigir sessão aqui
 * esvaziaria a agenda. O esquema concorda — `inscricoes: qualquer pessoa
 * se inscreve` (`for insert with check (true)`), e `anon` tem `grant
 * insert` na tabela (003_eventos.sql).
 *
 * O AGRAVANTE, e é o que torna esta Action diferente de todas as outras:
 * ela é a ÚNICA do projeto que grava dado de CRIANÇA. `public.inscricoes`
 * guarda nome, e-mail, telefone e — quando é menor de idade — nome e
 * telefone de quem responde por ela. O público da ONG começa aos 10 anos.
 *
 * Por isso a validação roda inteira no servidor, lê o FormData campo a
 * campo (compartilhado/validacao.ts) e não confia em nada que a tela tenha
 * exibido. `testes/inscricoes.test.mjs` tem a varredura que EXIGE que este
 * arquivo continue sem `ehEquipe()` — irmã da de contato, e ela existe
 * porque quem ler as Actions do painel vai achar que aqui faltou a guarda.
 *
 * ===================================================================
 * `exige_cpf` E AS VAGAS VÊM DO BANCO, NUNCA DO CORPO DA REQUISIÇÃO
 * ===================================================================
 *
 * As duas são regra de negócio da ONG guardada em `public.eventos`:
 *
 *  · `exige_cpf` (RN06) decide se o CPF é obrigatório. Vindo do
 *    formulário, quem quisesse pular o campo mandaria `false`;
 *  · a vaga é conferida DENTRO do banco, com a linha do evento travada
 *    (`reservar_vaga`, migration 010). Conferir aqui não resolveria: duas
 *    pessoas enviando ao mesmo tempo o formulário do último lugar veriam
 *    as duas uma vaga livre.
 *
 * ===================================================================
 * A MIGRATION 010 PODE NÃO ESTAR APLICADA — E ISSO CUSTA DUAS COISAS
 * ===================================================================
 *
 * Mesma janela de `acoes/contato.ts`: este repositório não tem, e não vai
 * ter, credencial capaz de aplicar migration (spec §4.1). Quando o
 * PostgREST responde `PGRST202`, esta Action cai num INSERT direto, que
 * continua gravando a inscrição. O que se perde, e está no log:
 *
 *  1. o LIMITE volta a ser o balde por cabeçalho de 005 — que neste
 *     desenho é sempre este servidor, ou seja, 30 inscrições por hora para
 *     o site inteiro. O caminho de /para-escolas é uma turma se
 *     inscrevendo de um endereço só;
 *  2. a VAGA deixa de ser conferida. `anon` não tem select em
 *     `public.inscricoes` (003_eventos.sql), então contar do lado do
 *     servidor devolveria zero para todo mundo e a trava passaria sempre —
 *     uma verificação que nunca dispara é pior que nenhuma, porque
 *     ninguém vai procurar por ela. Sem a função, não há como conferir, e
 *     o código diz isso em vez de fingir.
 *
 * O contrário — recusar toda inscrição enquanto a migration não vier —
 * perderia gente real por causa de uma tarefa de manutenção, e a ONG
 * descobriria numa oficina vazia.
 *
 * ===================================================================
 * `redirect()` FICA FORA DO `try`
 * ===================================================================
 *
 * Ele sinaliza POR EXCEÇÃO. Um catch em volta o transformaria em "não deu
 * para inscrever" logo depois de uma gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { buscarEventoParaInscricao } from '@/servidor/dados/eventos';
import { lerInscricao, validarInscricao } from '@/compartilhado/validacao';
import { origemDoVisitante } from '@/compartilhado/origem-do-visitante';
import { mensagemDeErroDeEnvio, FUNCAO_NAO_EXISTE } from '@/compartilhado/erros';
import { avisar } from '@/servidor/email';
import type { EstadoFormulario } from './autenticacao';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/** Canais reais da ONG — os mesmos de compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/**
 * O que a função do banco responde. Lista fechada, e ela é a razão de
 * `registrar_inscricao` devolver texto em vez de levantar exceção: "o
 * evento lotou" não é erro, é uma resposta que a pessoa precisa entender —
 * e o P0001 já está ocupado pelo limite de envios, cuja frase ("muitas
 * mensagens deste ponto de acesso") não tem nada a ver.
 */
const VAGA_OK = 'ok';
const VAGA_LOTADO = 'lotado';
const VAGA_INDISPONIVEL = 'indisponivel';

function semSupabase(): string {
  console.error('[inscricoes] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma inscrição pode ser gravada. Em produção isto quase sempre é variável faltando '
    + 'no painel da hospedagem (CLAUDE.md, "O que trava hoje", item 0e).');

  return 'As inscrições pelo site não estão disponíveis neste endereço. Fale com a gente pelo '
    + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} — os dois funcionam, e a gente `
    + 'inscreve você por lá.';
}

/**
 * RF15 — grava a inscrição em `public.inscricoes`.
 *
 * Forma `(anterior, dados) => EstadoFormulario`, que é o que
 * `useActionState` do React 19 espera.
 */
export async function inscrever(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerInscricao(dados);

  // TUDO o que a pessoa preencheu volta em toda recusa. Aqui isso pesa mais
  // que em qualquer outra tela do projeto: são até nove campos, preenchidos
  // no celular, por alguém que pode estar inscrevendo um filho. Quem perde
  // isso uma vez não preenche de novo.
  const valores = {
    evento_id: campos.eventoId,
    nome: campos.nome,
    email: campos.email,
    telefone: campos.telefone,
    cpf: campos.cpf,
    eh_menor: campos.ehMenor ? 'on' : '',
    responsavel_nome: campos.responsavelNome,
    responsavel_telefone: campos.responsavelTelefone,
    autoriza_imagem: campos.autorizaImagem ? 'on' : '',
    consentimento: campos.consentimento ? 'on' : ''
  };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // O EVENTO É LIDO ANTES DA VALIDAÇÃO, porque é dele que sai `exige_cpf` —
  // ver o cabeçalho. Um id que não é uuid nem chega a consultar o banco:
  // `validarInscricao` recusa, e a leitura abaixo só aconteceria para
  // devolver o mesmo erro mais devagar.
  const { valor: evento, degradou } = await buscarEventoParaInscricao(campos.eventoId);

  if (degradou) {
    return {
      ok: false,
      mensagem: 'Não deu para confirmar os dados deste evento agora — o banco não respondeu. '
        + 'Sua inscrição NÃO foi registrada. Tente de novo em alguns instantes, ou fale com a '
        + `gente pelo WhatsApp ${WHATSAPP}.`,
      valores
    };
  }

  if (!evento) {
    return {
      ok: false,
      mensagem: 'Este evento não está mais aberto para inscrições. Veja o que vem por aí na '
        + 'agenda — pode ser que ele volte a acontecer.',
      valores
    };
  }

  const { valido, erros } = validarInscricao(campos, { exigeCpf: evento.exige_cpf });
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  // Quem está do outro lado, para efeito de limite de envio — nunca para
  // identificar a pessoa. Sai daqui um hash SHA-256; o IP não é gravado em
  // lugar nenhum (RNF09, e é o que a política de privacidade promete).
  const cabecalhos = await headers();
  const origem = origemDoVisitante((nome) => cabecalhos.get(nome));

  // Coluna por coluna, nunca `...campos`. Vazio vira null: as colunas
  // aceitam nulo e a tela da equipe omite o que é nulo.
  const linha = {
    evento_id: campos.eventoId,
    nome: campos.nome,
    email: campos.email,
    telefone: campos.telefone || null,
    cpf: campos.cpf || null,
    eh_menor: campos.ehMenor,
    responsavel_nome: campos.responsavelNome || null,
    responsavel_telefone: campos.responsavelTelefone || null,
    autoriza_imagem: campos.autorizaImagem,
    consentimento_dados: campos.consentimento
  };

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    // CAMINHO PREFERIDO: a função de 010 — origem como parâmetro (balde por
    // visitante) e vaga conferida com a linha do evento travada.
    const chamada = await supabase.rpc('registrar_inscricao', {
      p_visitante: origem,
      p_evento_id: campos.eventoId,
      p_nome: linha.nome,
      p_email: linha.email,
      p_consentimento: linha.consentimento_dados,
      p_telefone: campos.telefone,
      p_cpf: campos.cpf,
      p_eh_menor: linha.eh_menor,
      p_responsavel_nome: campos.responsavelNome,
      p_responsavel_telefone: campos.responsavelTelefone,
      p_autoriza_imagem: linha.autoriza_imagem
    });

    let { error } = chamada;

    if (error && (error as { code?: string }).code === FUNCAO_NAO_EXISTE) {
      console.error(
        '[inscricoes] a função public.registrar_inscricao não existe neste projeto Supabase: '
        + 'supabase/migrations/010_inscricao_por_visitante.sql ainda NÃO foi aplicada. A '
        + 'inscrição vai ser gravada pelo caminho antigo (insert direto), o que funciona — mas '
        + 'DUAS coisas se perdem: (1) o limite volta a ser o balde global de 005 (30 por hora '
        + 'para o site inteiro, porque quem faz a requisição é sempre este servidor), e (2) a '
        + 'VAGA DEIXA DE SER CONFERIDA, porque anon não pode contar public.inscricoes. Aplicar '
        + 'a migration no SQL Editor do Supabase fecha as duas.'
      );

      // .insert() SEM .select(): a leitura é NEGADA para anon (grant insert
      // e nada mais). Pedir a linha de volta faria a inserção PARECER que
      // falhou depois de ter gravado — e a pessoa se inscreveria de novo.
      ({ error } = await supabase.from('inscricoes').insert(linha));
    } else if (!error) {
      // A função respondeu. `data` é uma das três palavras fechadas.
      const desfecho = String(chamada.data ?? '');

      if (desfecho === VAGA_LOTADO) {
        return {
          ok: false,
          mensagem: 'As vagas deste evento acabaram enquanto você preenchia — sua inscrição não '
            + 'foi registrada. Dá para entrar na lista de espera falando com a gente pelo '
            + `WhatsApp ${WHATSAPP}, e a agenda continua com as próximas datas.`,
          valores
        };
      }

      if (desfecho === VAGA_INDISPONIVEL) {
        return {
          ok: false,
          mensagem: 'Este evento não está mais aberto para inscrições.',
          valores
        };
      }

      if (desfecho !== VAGA_OK) {
        // Palavra fora da lista fechada: o banco e este arquivo divergiram.
        // Não dá para afirmar que gravou nem que não gravou — e a frase
        // precisa dizer isso, porque mandar tentar de novo poderia
        // duplicar a inscrição.
        console.error(`[inscricoes] registrar_inscricao respondeu "${desfecho}", que não está `
          + 'na lista fechada deste arquivo. O banco e acoes/inscricoes.ts divergiram.');
        return {
          ok: false,
          mensagem: 'Não deu para confirmar sua inscrição. Antes de tentar de novo, fale com a '
            + `gente pelo WhatsApp ${WHATSAPP} — a gente confere se ela entrou.`,
          valores
        };
      }
    }

    if (error) {
      const traduzido = mensagemDeErroDeEnvio(error);

      // O erro inteiro vai para o log SEMPRE: quem não conseguiu se
      // inscrever simplesmente vai embora, e o log é a única testemunha.
      console.error(
        `[inscricoes] não deu para gravar${traduzido.conhecido ? '' : ' (causa não prevista)'}:`,
        descrever(error)
      );

      falha = { ok: false, mensagem: traduzido.mensagem, valores };
    }
  } catch (erro) {
    console.error('[inscricoes] inscrever (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  /*
   * RF18 — A CONFIRMAÇÃO POR E-MAIL, E ELA VEM DEPOIS DE TUDO.
   *
   * A inscrição JÁ ESTÁ GRAVADA neste ponto. `avisar()` nunca lança (ver o
   * cabeçalho de servidor/email.ts): rede fora, função não publicada,
   * provedor recusando — tudo devolve `false` e vira uma linha no log.
   *
   * O RESULTADO SÓ ESCOLHE A FRASE que a pessoa lê, nunca se a operação deu
   * certo. Dizer "não deu para inscrever" porque um e-mail não saiu faria
   * a pessoa se inscrever de novo — e o segundo envio ocuparia mais uma
   * vaga.
   *
   * ELE VAI COM `await`, e isso é decisão medida em plataforma serverless:
   * o processo é CONGELADO assim que a resposta é devolvida, então uma
   * promessa solta morre no meio — às vezes DEPOIS de o e-mail sair e ANTES
   * de `public.envios` ser gravado, que é o pior desfecho possível (a
   * próxima tentativa mandaria de novo). O prazo é curto, e está lá.
   */
  const confirmou = await avisar({
    tipo: 'inscricao',
    evento_id: campos.eventoId,
    email: campos.email
  });

  // FORA do try — ver o cabeçalho. POST-redirect-GET: sem isto, atualizar a
  // página depois de enviar inscreveria a pessoa de novo.
  redirect(`/agenda/${campos.eventoId}/inscricao`
    + `?aviso=${confirmou ? 'inscrita' : 'inscrita-sem-email'}`);
}
