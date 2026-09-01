/**
 * acoes/contato.ts — o formulário público de /contato (RF07), gravando em
 * `public.contatos`.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO — E AQUI ISSO É O DESENHO, NÃO O RISCO
 * ===================================================================
 *
 * As quatro Actions do painel (publicações, galeria, atividades) começam
 * com o mesmo aviso e terminam chamando `ehEquipe()`. ESTA NÃO CHAMA, e a
 * ausência é deliberada: quem escreve para a ONG não tem conta, não vai
 * criar uma, e exigir sessão aqui fecharia o único canal do site que
 * qualquer pessoa pode usar. A política do banco diz a mesma coisa —
 * `contatos: qualquer pessoa escreve` (`for insert with check (true)`), e
 * `anon` tem `grant insert` na tabela (004_pessoas.sql).
 *
 * O QUE MUDA POR NÃO HAVER GUARDA: a validação abaixo é a ÚNICA barreira
 * entre um POST montado à mão e uma tabela com nome, e-mail e telefone de
 * gente real (RF29). Por isso ela roda inteira no servidor, lê o FormData
 * campo a campo por nome (compartilhado/validacao.ts) e não confia em nada
 * que o formulário tenha exibido.
 *
 * testes/contato.test.mjs tem uma varredura que EXIGE que este arquivo
 * continue sem `ehEquipe()` — o contrário da varredura das Actions do
 * painel. Ela existe porque a próxima pessoa que ler as quatro Actions
 * irmãs vai achar que faltou a guarda aqui.
 *
 * ===================================================================
 * `origem` E `situacao` NUNCA VÊM DO FORMULÁRIO
 * ===================================================================
 *
 * `public.contatos` tem `check (origem in ('contato','escola','doacao',
 * 'voluntariado'))` e `situacao` com o fluxo de atendimento da equipe. As
 * duas são colunas de trabalho da ONG, não campos de quem escreve: deixar
 * o corpo da requisição escolher a origem sujaria o registro central de
 * graça, e deixar escolher a situação faria uma mensagem nascer
 * "concluída", ou seja, invisível para quem atende.
 *
 * `origem` é escrita aqui com o literal 'contato' (e dentro de
 * `registrar_contato`, no banco); `situacao` não é mencionada em lugar
 * nenhum e nasce do `default` da coluna. É a regra 6 do CLAUDE.md aplicada
 * a outras duas colunas: o objeto que vai ao banco é montado chave por
 * chave, nunca `...campos`.
 *
 * ===================================================================
 * O LIMITE DE ENVIO, E POR QUE ELE PRECISA DE DUAS METADES
 * ===================================================================
 *
 * `005_contencao.sql` conta os envios por origem, e descobria a origem
 * lendo o `x-forwarded-for` que o PostgREST expõe ao Postgres. Isso
 * funcionava quando o navegador de cada pessoa falava direto com o
 * Supabase; neste desenho quem fala é o servidor (spec §4.1), então aquele
 * cabeçalho é o MESMO para todo mundo e o limite viraria um balde global de
 * 10/hora para o site inteiro — negação de serviço contra quem usa, não
 * contenção (spec §4.6).
 *
 * As duas metades do conserto: `compartilhado/origem-do-visitante.ts` lê o
 * IP real aqui no servidor e calcula o hash; `supabase/migrations/
 * 007_limite_por_visitante.sql` recebe esse hash como PARÂMETRO da função
 * `registrar_contato` e conta o balde por visitante.
 *
 * ===================================================================
 * A MIGRATION 007 PODE NÃO ESTAR APLICADA — E O CÓDIGO PRECISA VIVER COM
 * ISSO
 * ===================================================================
 *
 * Este repositório não tem, e não vai ter, credencial capaz de aplicar
 * migration (não existe service_role, spec §4.1): quem aplica é uma pessoa,
 * no SQL Editor do Supabase. Ou seja, existe uma janela real em que o
 * código novo está no ar e a função `registrar_contato` ainda não existe no
 * banco.
 *
 * Nessa janela o PostgREST responde `PGRST202` ("não achei essa função"), e
 * é o que `enviarContato` usa para CAIR NO CAMINHO ANTIGO: um INSERT direto
 * na tabela, que continua funcionando, com o balde global de 005. A
 * mensagem continua sendo gravada; o que degrada é a qualidade do limite, e
 * o log diz exatamente isso, com o nome do arquivo a aplicar.
 *
 * O contrário — recusar o envio enquanto a migration não vier — perderia
 * mensagens de gente real por causa de uma tarefa de manutenção.
 *
 * ===================================================================
 * `redirect()` FICA FORA DO `try`
 * ===================================================================
 *
 * Ele sinaliza POR EXCEÇÃO. Um catch em volta o transformaria em "não deu
 * para enviar" logo depois de uma gravação bem-sucedida. Mesma regra das
 * quatro Actions do painel.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { lerContato, validarContato } from '@/compartilhado/validacao';
import { origemDoVisitante } from '@/compartilhado/origem-do-visitante';
import { mensagemDeErroDeEnvio, FUNCAO_NAO_EXISTE } from '@/compartilhado/erros';
import type { EstadoFormulario } from './autenticacao';

/** Para onde o envio bem-sucedido volta. Ver compartilhado/avisos-de-contato.ts. */
const DESTINO = '/contato?aviso=enviada';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/** Canais reais da ONG — os mesmos de compartilhado/erros.ts e de /contato. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/**
 * Sem projeto Supabase configurado não há onde gravar. Acontece de verdade
 * na suíte offline (`npm test`) e num deploy sem as variáveis no painel da
 * Netlify (CLAUDE.md, "O que trava hoje", item 0e).
 *
 * AQUI ISSO É PIOR QUE NAS OUTRAS TELAS, e por isso a mensagem é diferente:
 * nas telas do painel, sem Supabase a pessoa nem chega — `ehEquipe()` falha
 * fechada e a rota responde 404. Esta é pública e continua no ar de
 * qualquer jeito, então quem escreveu precisa sair daqui sabendo por onde
 * falar com a ONG de verdade, e não só que "não deu".
 */
function semSupabase(): string {
  console.error('[contato] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma mensagem pode ser gravada. Em produção isto quase sempre é variável faltando '
    + 'no painel da Netlify.');

  return 'O envio de mensagens não está disponível neste endereço. Fale com a gente pelo '
    + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} — os dois funcionam.`;
}

/**
 * RF07 — grava a mensagem em `public.contatos`.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura
 * porque o React o passa.
 */
export async function enviarContato(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerContato(dados);
  const { valido, erros } = validarContato(campos);

  // TUDO o que a pessoa escreveu volta em toda recusa (defeito medido na
  // Tarefa 3 da autenticação). Aqui o que se perderia é uma mensagem
  // inteira, escrita no celular — e quem perde uma vez não escreve de novo.
  // `consentimento` volta como 'on'/'' porque é assim que CampoFormulario
  // lê `valorInicial` numa caixa de marcar.
  const valores = {
    nome: campos.nome,
    email: campos.email,
    telefone: campos.telefone,
    instituicao: campos.instituicao,
    mensagem: campos.mensagem,
    consentimento: campos.consentimento ? 'on' : ''
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // Quem está do outro lado, para efeito de limite de envio — nunca para
  // identificar a pessoa. Sai daqui um hash SHA-256; o IP não é gravado em
  // lugar nenhum (RNF09, e é o que a política de privacidade promete).
  const cabecalhos = await headers();
  const origem = origemDoVisitante((nome) => cabecalhos.get(nome));

  // Chave por chave, nunca `...campos`: ver o cabeçalho deste arquivo.
  // Telefone e instituição vazios viram NULL, e não string vazia — as
  // colunas aceitam nulo e a tela da equipe omite o que é nulo (regra 2 do
  // CLAUDE.md aplicada a campo).
  const linha = {
    origem: 'contato',
    nome: campos.nome,
    email: campos.email,
    telefone: campos.telefone || null,
    instituicao: campos.instituicao || null,
    mensagem: campos.mensagem,
    consentimento_dados: campos.consentimento
  };

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    // CAMINHO PREFERIDO: a função de 007, que recebe a origem como
    // parâmetro e conta o balde por visitante.
    let { error } = await supabase.rpc('registrar_contato', {
      p_visitante: origem,
      p_nome: linha.nome,
      p_email: linha.email,
      p_mensagem: linha.mensagem,
      p_consentimento: linha.consentimento_dados,
      p_telefone: campos.telefone,
      p_instituicao: campos.instituicao
    });

    if (error && (error as { code?: string }).code === FUNCAO_NAO_EXISTE) {
      console.error(
        '[contato] a função public.registrar_contato não existe neste projeto Supabase: '
        + 'supabase/migrations/007_limite_por_visitante.sql ainda NÃO foi aplicada. A mensagem '
        + 'vai ser gravada pelo caminho antigo (insert direto), o que funciona — mas o limite '
        + 'de envio continua sendo o BALDE GLOBAL de 005_contencao.sql: 10 envios por hora para '
        + 'o site inteiro, porque quem faz a requisição ao Supabase é sempre este servidor. '
        + 'Aplicar a migration no SQL Editor do Supabase fecha isto.'
      );

      // .insert() SEM .select(), e isto é o contrário do que as Actions do
      // painel fazem — a assimetria convida a "corrigir" o lado errado, por
      // isso está escrito nos dois lugares. Em `publicacoes`/`midia` a
      // equipe LÊ tudo, então pedir a linha de volta é a única forma de
      // saber se o update casou alguma linha. Aqui a leitura é NEGADA
      // (`anon` só tem `grant insert`, e a política de select exige
      // `eh_equipe()`): pedir a linha de volta faria a inserção PARECER que
      // falhou depois de ter gravado — e a pessoa mandaria tudo de novo.
      ({ error } = await supabase.from('contatos').insert(linha));
    }

    if (error) {
      const traduzido = mensagemDeErroDeEnvio(error);

      // O erro inteiro vai para o log SEMPRE, e não só quando é
      // desconhecido: aqui, diferente de uma tela de conta, ninguém vai
      // reportar o problema — quem não conseguiu enviar simplesmente vai
      // embora. O log é a única testemunha.
      console.error(
        `[contato] não deu para gravar${traduzido.conhecido ? '' : ' (causa não prevista)'}:`,
        descrever(error)
      );

      falha = { ok: false, mensagem: traduzido.mensagem, valores };
    }
  } catch (erro) {
    console.error('[contato] enviar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  // FORA do try — ver o cabeçalho. POST-redirect-GET: sem isto, atualizar a
  // página depois de enviar manda a mesma mensagem de novo.
  redirect(DESTINO);
}
