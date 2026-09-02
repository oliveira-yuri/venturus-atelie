/**
 * acoes/voluntariado.ts — a candidatura ao voluntariado (RF25), gravando em
 * `public.voluntarios` e `public.voluntario_areas`.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO
 * ===================================================================
 *
 * O mesmo cabeçalho das Actions do painel e de acoes/conta.ts, e vale
 * palavra por palavra: o Next publica cada função exportada de um arquivo
 * `'use server'` numa URL (spec §4.5). Qualquer pessoa chama com qualquer
 * corpo, sem passar pelo formulário, sem navegador. A guarda da PÁGINA
 * (`app/voluntariado/candidatura/page.tsx`) não protege nada aqui — Action
 * não passa por página nem por layout.
 *
 * Por isso a função abaixo pergunta quem está autenticado por conta
 * própria, com a MESMA `usuarioAtual()` que a página usa
 * (servidor/sessao.ts). Duas respostas diferentes para a mesma pergunta
 * seriam exatamente o buraco. `testes/voluntariado.test.mjs` varre este
 * arquivo exigindo isso de toda Action nova.
 *
 * ===================================================================
 * A GUARDA É `usuarioAtual()`, NÃO `ehEquipe()` — E CANDIDATAR-SE EXIGE
 * CONTA
 * ===================================================================
 *
 * Duas assimetrias no mesmo lugar, e as duas são decisão:
 *
 *  · NÃO É `ehEquipe()`, como nas quatro Actions do painel: candidatar-se é
 *    de quem está de fora, não de quem trabalha na ONG. Exigir equipe aqui
 *    trancaria justamente o público desta tela;
 *  · NÃO É PÚBLICA COMO `acoes/contato.ts`, e essa é a decisão que o brief
 *    desta tarefa pedia para justificar. `public.voluntarios.perfil_id` é
 *    `not null references public.perfis(id)`, e a política de insert é
 *    `with check (perfil_id = auth.uid())` (004_pessoas.sql): sem sessão
 *    não existe linha possível. A alternativa considerada era gravar em
 *    `public.contatos` com `origem = 'voluntariado'` para quem não tem
 *    conta — e ela foi RECUSADA por três motivos:
 *
 *      1. perderia as ÁREAS. `contatos` não tem para onde apontar
 *         `areas_voluntariado`; a escolha viraria texto solto dentro da
 *         mensagem, e a RF26 (gestão de voluntários) teria de adivinhar;
 *      2. perderia a SITUAÇÃO da candidatura, que é o que a pessoa
 *         acompanha em /minha-conta (RF11). Uma candidatura anônima nunca
 *         apareceria para quem a fez — e a área do usuário já tem a seção
 *         esperando por esta tarefa;
 *      3. seria uma segunda porta de entrada para a mesma coisa, com regra
 *         diferente, na tabela que a ONG usa como registro central de
 *         contatos (RF29). Quem atende passaria a ver dois tipos de
 *         candidatura, uma delas invisível para a RF26.
 *
 *    O preço, dito em voz alta: quem não tem conta não se candidata por
 *    aqui. O que a tela faz por essa pessoa é explicar POR QUE precisa de
 *    conta e mostrar o caminho — e os canais reais da ONG continuam na
 *    mesma página. É o que a própria /voluntariado já prometia antes desta
 *    tarefa ("Você cria uma conta e escolhe suas áreas de interesse").
 *
 * ===================================================================
 * DUAS TABELAS, SEM TRANSAÇÃO — E O DESFECHO PARCIAL É VISÍVEL
 * ===================================================================
 *
 * A candidatura é uma linha em `voluntarios` e N linhas em
 * `voluntario_areas`, e o PostgREST não tem transação entre duas
 * requisições. Fazer as duas de uma vez exigiria uma função no banco (como
 * `registrar_contato`, de 007) — ou seja, migration nova, que esta tarefa
 * não pode criar.
 *
 * A ORDEM É OBRIGATÓRIA: `voluntarios` primeiro, porque `voluntario_areas`
 * referencia o id dela. Então o desfecho parcial possível é sempre o mesmo,
 * e é o menos ruim: candidatura registrada, áreas de fora. A ONG fica com o
 * contato de alguém que quer ajudar — que é o essencial — e a pessoa NÃO
 * recebe "salvo" liso: recebe `?aviso=candidatura-sem-areas`, que diz o que
 * ficou faltando e por onde completar. Sem isso o defeito seria invisível
 * para os dois lados.
 *
 * ===================================================================
 * NÃO HÁ COMO DESFAZER, E ISSO MUDA O DESENHO
 * ===================================================================
 *
 * MEDIDO em 01/09/2026 contra o Supabase real, com sessão de verdade:
 * `delete from voluntarios where perfil_id = <eu>` responde SUCESSO COM
 * ZERO LINHAS — `public.voluntarios` não tem política de delete para a
 * própria pessoa (apagar é de quem é equipe). Ou seja, nem esta Action nem
 * a pessoa conseguem apagar uma candidatura depois de criada.
 *
 * Daí a regra de `compartilhado/candidatura.ts`: quem já tem candidatura em
 * andamento não cria outra. A tela desenha a que existe em vez do
 * formulário, e esta Action recusa de novo — porque a tela não é a guarda.
 *
 * O QUE ESSA REGRA NÃO RESOLVE, dito em voz alta: dois envios SIMULTÂNEOS.
 * As duas requisições consultam antes de gravar, as duas encontram nada, e
 * as duas gravam. Fechar isso de verdade é um índice único em
 * `voluntarios (perfil_id) where situacao <> 'inativo'`, que é migration —
 * e migration não é desta tarefa. O que sobra hoje: o POST-redirect-GET
 * cobre o F5, e o botão desabilita enquanto envia (para quem tem
 * JavaScript).
 *
 * ===================================================================
 * O LIMITE DE ENVIO NÃO É O DE /contato, E NÃO PRECISA SER
 * ===================================================================
 *
 * `acoes/contato.ts` calcula o hash da origem do visitante
 * (compartilhado/origem-do-visitante.ts) porque lá quem escreve é anônimo:
 * sem isso, um script encheria `public.contatos` de graça. Aqui o balde já
 * existe e é melhor: candidatar-se exige CONTA, e uma conta só tem uma
 * candidatura em andamento. Quem quisesse inundar a tabela precisaria criar
 * uma conta por linha — e criar conta passa pelo Auth do Supabase, que tem
 * o limite dele.
 *
 * ===================================================================
 * `redirect()` FICA FORA DO `try`
 * ===================================================================
 *
 * Ele sinaliza POR EXCEÇÃO. Um catch em volta o transformaria em "não deu
 * para enviar" logo depois de uma gravação bem-sucedida — e aqui isso seria
 * pior que no formulário de contato: a pessoa tentaria de novo e a segunda
 * tentativa bateria na recusa de candidatura duplicada, ou seja, ela leria
 * duas mensagens contraditórias sobre o mesmo envio.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { usuarioAtual } from '@/servidor/sessao';
import { listarAreasComEstado } from '@/servidor/dados/voluntariado';
import { listarMinhasCandidaturas } from '@/servidor/dados/conta';
import { candidaturaEmAndamento } from '@/compartilhado/candidatura';
import {
  lerCandidatura, validarCandidatura, colunasDaCandidatura, linhasDasAreas
} from '@/compartilhado/validacao';
import { mensagemDeErroDeEnvio } from '@/compartilhado/erros';
import type { EstadoFormulario } from './autenticacao';

/** Para onde a candidatura registrada leva. Ver o bloco abaixo. */
const MINHA_CONTA = '/minha-conta';

/** A tela desta Action — revalidada junto, porque o que ela desenha muda. */
const CANDIDATURA = '/voluntariado/candidatura';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/** Canais reais da ONG — os mesmos de /doar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/**
 * A recusa de quem não tem (ou não tem mais) sessão.
 *
 * NÃO É `redirect('/entrar')`, ao contrário do que a PÁGINA faz para quem
 * chega sem conta, e a diferença é o caso real: quem chega AQUI sem sessão
 * é, quase sempre, alguém que abriu a tela, ficou escrevendo por que quer
 * ajudar e teve a sessão vencida no meio. Mandar para /entrar nesse
 * instante apagaria o texto. A recusa devolve `valores`, ou seja, o
 * formulário volta preenchido, com as áreas ainda marcadas.
 *
 * É a mesma decisão de acoes/conta.ts e das Actions do painel.
 */
const SEM_SESSAO = 'Sua sessão não vale mais. Entre de novo em outra aba e envie outra vez — '
  + 'o que você escolheu continua nesta tela.';

/**
 * Sem projeto Supabase configurado não há onde gravar. Acontece de verdade
 * na suíte offline (`npm test`) e num deploy sem as variáveis no painel da
 * Netlify (CLAUDE.md, "O que trava hoje", item 0e).
 *
 * Na prática ninguém vê esta mensagem, porque sem Supabase `usuarioAtual()`
 * já devolveu `null` e a recusa acima veio antes — ela existe para o caso
 * de a ordem mudar, e para o log, que é onde a causa aparece.
 */
function semSupabase(): string {
  console.error('[voluntariado] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma candidatura pode ser gravada.');

  return 'As candidaturas não estão disponíveis neste endereço. Fale com a gente pelo '
    + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} — os dois funcionam.`;
}

/**
 * RF25 — registra a candidatura da PRÓPRIA pessoa.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura
 * porque o React o passa.
 */
export async function candidatar(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerCandidatura(dados);

  /**
   * TUDO o que a pessoa escolheu volta em toda recusa (defeito medido na
   * Tarefa 3 da autenticação: o React 19 dá `reset()` no <form> ao fim de
   * uma action, e sem script a página é renderizada do zero).
   *
   * AS ÁREAS VOLTAM COMO `area:<id>` = 'on', uma chave por caixa marcada, e
   * não como uma lista: `EstadoFormulario.valores` é `Record<string,
   * string>` indexado pelo `name` do campo, e as cinco caixas compartilham
   * o mesmo `name` ("areas") — é o único grupo assim no site. O prefixo é o
   * que dá a cada caixa uma chave própria; `componentes/
   * FormularioCandidatura.tsx` lê pela mesma chave, e as duas pontas estão
   * amarradas por `testes/voluntariado.test.mjs`.
   *
   * Montado a partir de `campos.areas` — que já passou por `lerCandidatura`
   * —, nunca varrendo o FormData: senão um corpo montado à mão devolveria
   * chaves inventadas para a própria tela.
   */
  const valores: Record<string, string> = { mensagem: campos.mensagem };
  for (const area of campos.areas) valores[`area:${area}`] = 'on';

  // A GUARDA. `usuarioAtual()` pergunta ao Supabase (`getUser()`), não
  // confia no cookie — ver servidor/sessao.ts. É a MESMA função que a
  // página usa.
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, mensagem: SEM_SESSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // AS ÁREAS REAIS, DO BANCO — e a bandeira de degradação junto. Sem a
  // bandeira, uma consulta que falha devolve lista vazia e a validação
  // acusaria a PESSOA ("essa área não está mais na lista") por um defeito
  // do servidor. Ver servidor/dados/voluntariado.ts.
  const { valor: areas, degradou } = await listarAreasComEstado();

  if (degradou) {
    console.error('[voluntariado] não deu para ler public.areas_voluntariado: a candidatura '
      + 'NÃO foi gravada, porque sem a lista real não há como conferir as áreas escolhidas.');

    return {
      ok: false,
      valores,
      mensagem: 'Não deu para confirmar as áreas agora — o banco de dados não respondeu. Nada '
        + 'foi perdido: tente de novo em alguns instantes.'
    };
  }

  const { valido, erros } = validarCandidatura(campos, areas.map((area) => area.id));
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  /**
   * A REGRA DE CANDIDATURA DUPLICADA, conferida DE NOVO aqui — a tela já a
   * aplicou, e a tela não é a guarda (esta Action é endpoint HTTP público).
   *
   * QUANDO A CONSULTA DEGRADA, O ENVIO SEGUE. É decisão, e é o contrário da
   * decisão sobre as áreas logo acima: lá a consulta que falhou faria o
   * site ACUSAR a pessoa; aqui ela só nos deixa sem saber se já existe
   * candidatura. Entre bloquear alguém que quer ajudar e correr o risco de
   * uma linha repetida — que a equipe resolve olhando —, o desfecho seguro
   * é gravar. O log fica com a diferença.
   */
  const jaExistentes = await listarMinhasCandidaturas(usuario.id);

  if (jaExistentes.degradou) {
    console.warn('[voluntariado] não deu para conferir se já havia candidatura desta pessoa; '
      + 'a nova vai ser gravada assim mesmo. Pode nascer uma linha repetida em '
      + 'public.voluntarios, que só a equipe consegue apagar.');
  }

  const emAndamento = candidaturaEmAndamento(jaExistentes.valor);

  if (emAndamento) {
    return {
      ok: false,
      valores,
      mensagem: 'Você já tem uma candidatura registrada, e ela ainda está em andamento. Não '
        + 'precisa mandar de novo: ela aparece em "Sua conta", com a situação atualizada. Se '
        + `quiser mudar as áreas, fale com a gente pelo WhatsApp ${WHATSAPP}.`
    };
  }

  const linha = colunasDaCandidatura(campos, usuario.id);

  let falha: EstadoFormulario | null = null;
  let areasGravadas = false;

  try {
    const supabase = await obterCliente();

    /**
     * `.select('id')` AQUI É OBRIGATÓRIO, e é o CONTRÁRIO de
     * acoes/contato.ts — a assimetria convida a "corrigir" o lado errado,
     * por isso está escrita nos dois arquivos.
     *
     * Em `public.contatos` a leitura é negada para quem escreve, então
     * pedir a linha de volta faz a inserção PARECER que falhou. Aqui a
     * pessoa LÊ a própria candidatura (`voluntarios: a pessoa le a propria
     * candidatura`), e o id que volta é o que a segunda tabela precisa
     * referenciar. Sem ele não há como gravar as áreas.
     */
    const { data, error } = await supabase
      .from('voluntarios')
      .insert(linha)
      .select('id');

    if (error) {
      const traduzido = mensagemDeErroDeEnvio(error);

      console.error(
        `[voluntariado] não deu para gravar a candidatura${traduzido.conhecido ? '' : ' (causa não prevista)'}:`,
        descrever(error)
      );

      falha = { ok: false, mensagem: traduzido.mensagem, valores };
    } else if (!Array.isArray(data) || data.length === 0) {
      // Não acontece hoje: a política de select da própria pessoa existe e
      // foi medida. Se um dia ela mudar, a candidatura estaria GRAVADA e
      // este código não saberia o id — as áreas se perderiam em silêncio.
      // Melhor dizer isso do que dizer "pronto".
      console.error('[voluntariado] a candidatura foi gravada mas o insert não devolveu o id '
        + '(a política de select de public.voluntarios mudou?). As áreas escolhidas NÃO foram '
        + 'gravadas.');

      falha = {
        ok: false,
        valores,
        mensagem: 'Sua candidatura foi registrada, mas não deu para guardar as áreas que você '
          + `escolheu. Não mande de novo: fale com a gente pelo WhatsApp ${WHATSAPP} contando `
          + 'em qual área você quer ajudar.'
      };
    } else {
      const { error: erroDasAreas } = await supabase
        .from('voluntario_areas')
        .insert(linhasDasAreas(data[0].id, campos.areas));

      if (erroDasAreas) {
        console.error('[voluntariado] a candidatura foi gravada em public.voluntarios mas as '
          + `áreas NÃO entraram em public.voluntario_areas: ${descrever(erroDasAreas)}. A `
          + 'candidatura existe e a equipe a vê; o que falta é para qual área.');
      } else {
        areasGravadas = true;
      }
    }
  } catch (erro) {
    console.error('[voluntariado] candidatar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  // As DUAS telas que mudam com isto: a área do usuário, que passa a listar
  // a candidatura, e esta própria tela, que passa a desenhar a candidatura
  // em vez do formulário. Sem revalidar, quem voltasse pelo botão do
  // navegador veria o formulário em branco de novo e tentaria enviar outra
  // vez — e leria a recusa de duplicada.
  revalidatePath(MINHA_CONTA);
  revalidatePath(CANDIDATURA);

  // FORA do try — ver o cabeçalho. POST-redirect-GET: sem isto, atualizar a
  // página depois de enviar reenvia a candidatura.
  //
  // O DESTINO É A ÁREA DO USUÁRIO, e não esta mesma tela com um aviso: lá a
  // candidatura APARECE, com a situação e as áreas escritas. Uma
  // confirmação que mostra o registro vale mais que uma que promete que ele
  // existe — e é a mesma tela onde a pessoa vai acompanhar o resto (RF11).
  // PARA A HOME, e não para /minha-conta (pedido V1: "popup assim que uma
  // candidatura for feita, e ser redirecionado para a home").
  //
  // A decisão anterior mandava para /minha-conta com um argumento bom: uma
  // confirmação que MOSTRA o registro vale mais que uma que o promete. Ele
  // não foi descartado — virou o link "Ver minha candidatura" dentro do
  // próprio aviso (compartilhado/avisos-da-home.ts). O registro continua a
  // um toque; o que mudou é onde a pessoa aterrissa.
  redirect(`/?aviso=${areasGravadas ? 'candidatura' : 'candidatura-sem-areas'}`);
}
