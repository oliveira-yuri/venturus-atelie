/**
 * supabase/functions/enviar-email — o único ponto do projeto com a service
 * role key (spec §9).
 *
 * Serve RF18 (confirmação de inscrição) e RF20 (resposta de doação). O
 * RF28 (mensagem para grupo) usa o mesmo caminho e ainda não tem tela: o
 * tipo 'aviso' já é aceito pelo `check` de `public.envios`, para a
 * migration não precisar mudar depois.
 *
 * =====================================================================
 * ELA NÃO CONFIA NO PAYLOAD, E ISSO É O DESENHO INTEIRO
 * =====================================================================
 *
 * A spec §9 disse assim, e vale palavra por palavra:
 *
 *     Ela NÃO CONFIA NO PAYLOAD: recebe apenas o identificador do
 *     registro, busca os dados no banco e monta a mensagem. Sem isso, o
 *     endereço da função seria um formulário aberto para enviar e-mail em
 *     nome da ONG.
 *
 * Concretamente: o corpo aceito é `{ tipo, id }` e MAIS NADA. Não há
 * parâmetro para destinatário, para assunto nem para texto. Quem descobrir
 * o endereço desta função e a chave não consegue mandar uma palavra sua
 * para ninguém — no máximo consegue reenviar, para a pessoa certa, a
 * mensagem que ela já deveria ter recebido. E nem isso, por causa do
 * índice de `public.envios`.
 *
 * =====================================================================
 * DUAS TRAVAS, E ELAS SÃO DIFERENTES
 * =====================================================================
 *
 * 1. A CHAVE COMPARTILHADA (`x-chave-do-site`). Edge Function do Supabase
 *    aceita a anon key como autorização, e a anon key é PÚBLICA por
 *    construção — ou seja, sem esta trava qualquer pessoa chamaria a
 *    função. A chave vive como secret aqui e como variável no servidor do
 *    site, e nunca chega ao navegador.
 *
 *    A comparação é em TEMPO CONSTANTE. Um `!==` vaza, pelo tempo de
 *    resposta, quantos caracteres do começo estão certos — é pouco, e é
 *    exatamente o tipo de pouco que não se deixa de graça numa função que
 *    guarda a service role.
 *
 * 2. O ÍNDICE ÚNICO PARCIAL de `public.envios` (migration 011). Ele impede
 *    o REENVIO do que já deu certo, e deixa retentar o que falhou. É uma
 *    trava do BANCO, não deste código: duas chamadas simultâneas perderiam
 *    a corrida contra qualquer verificação feita aqui.
 *
 * =====================================================================
 * O ENDEREÇO NÃO É GRAVADO EM `envios` — SÓ O HASH
 * =====================================================================
 *
 * O e-mail da pessoa já está na tabela de origem, ligado a ela pela chave
 * estrangeira. Copiá-lo para `envios` criaria um SEGUNDO lugar com dado
 * pessoal, que a promessa de exclusão de /privacidade teria de lembrar de
 * limpar — e não lembraria. Mesma disciplina de `envios_recentes` (007).
 *
 * =====================================================================
 * PROVEDOR: RESEND, E ISSO MUDOU DESDE A SPEC
 * =====================================================================
 *
 * A spec §9 escolheu o BREVO, e o argumento era: "a decisão D6 assume que
 * não há domínio próprio, e o Resend exige domínio verificado para enviar
 * a terceiros".
 *
 * A premissa caiu em 02/09/2026: a ONG registrou `atelieafrocultural.site`,
 * e ele está verificado no Resend com SPF, DKIM e o return-path próprio
 * (CLAUDE.md, "Infraestrutura"). Com domínio, o Resend é a escolha melhor —
 * assinatura alinhada com o domínio de quem envia, que é o que decide se a
 * mensagem cai na caixa de entrada.
 *
 * A DECISÃO É REVERSÍVEL EM UM LUGAR SÓ: `enviarPeloProvedor()`, no fim
 * deste arquivo. Nada acima dela sabe qual provedor é.
 */

// @ts-nocheck -- este arquivo roda em Deno, não no Node do site. O tsconfig
// do projeto não o alcança (ele está fora de `include`), e os imports por
// URL abaixo são resolvidos pelo Deno do Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* =====================================================================
   Configuração — tudo por secret, nada no código
   ===================================================================== */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const CHAVE_DO_SITE = Deno.env.get('CHAVE_DE_ENVIO');

/**
 * O remetente. PRECISA ser um endereço do domínio verificado no Resend —
 * com qualquer outro, o Resend recusa o envio (e é assim que precisa ser:
 * é o que impede o site de mandar e-mail em nome de terceiros).
 */
const REMETENTE = Deno.env.get('REMETENTE_EMAIL')
  ?? 'Ateliê Afro Cultural <contato@atelieafrocultural.site>';

/** Para onde as respostas vão. O Gmail que a ONG lê todo dia. */
const RESPONDER_PARA = Deno.env.get('RESPONDER_PARA') ?? 'atelieafro@gmail.com';

const WHATSAPP = '(11) 95396-8344';
const SITE = 'https://www.atelieafrocultural.site';

/* =====================================================================
   Utilidades
   ===================================================================== */

/** Resposta JSON, sempre com o mesmo formato. */
function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * Comparação em tempo constante.
 *
 * `a !== b` sai no primeiro caractere diferente, e o tempo de resposta
 * conta quantos bateram. Aqui isso é medível pela rede com paciência
 * suficiente, e o que está do outro lado da chave é a service role.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

/** SHA-256 em hexadecimal — o mesmo formato de compartilhado/origem-do-visitante.ts. */
async function hash(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** A data como uma pessoa lê, no fuso da ONG. */
function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
}

/**
 * Escapa texto que vai para dentro do HTML do e-mail.
 *
 * O nome e a mensagem vêm de um formulário PÚBLICO — `acoes/inscricoes.ts`
 * e `acoes/doacoes.ts` aceitam qualquer texto. Sem escapar, um nome com
 * `<img src=x onerror=...>` viraria marcação dentro da caixa de entrada de
 * quem recebe. React escapa sozinho no site; aqui não há React.
 */
function escapar(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =====================================================================
   As mensagens
   =====================================================================

   REGRA 2 DO CLAUDE.md APLICADA A E-MAIL: nada aqui promete o que a ONG
   não faz. Sem "responderemos em até 48 horas", sem "sua vaga está
   garantida" quando o que existe é uma inscrição registrada.

   REGRA 1: nada de linguagem de caridade. É arte, cultura e identidade.
   ===================================================================== */

type Mensagem = { assunto: string; html: string; texto: string };

/**
 * Um e-mail simples, com o mesmo esqueleto para todos.
 *
 * SEM CSS EXTERNO, SEM IMAGEM, SEM FONTE BAIXADA: cliente de e-mail bloqueia
 * os três por padrão, e o que sobraria seria uma página quebrada. Estilo
 * inline, tipografia do sistema, e o texto puro como par — que é o que
 * quem usa leitor de tela e quem desliga HTML de fato lê.
 */
function montar(titulo: string, paragrafos: string[]): { html: string; texto: string } {
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 1em;line-height:1.5">${p}</p>`).join('\n');

  return {
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;`
      + `background:#f4efe6;font-family:Georgia,'Times New Roman',serif;color:#2B2019">`
      + `<div style="max-width:34em;margin:0 auto;background:#fff;padding:24px;`
      + `border:2px solid #2B2019">`
      + `<h1 style="margin:0 0 .6em;font-size:20px">${escapar(titulo)}</h1>`
      + corpo
      + `<hr style="border:none;border-top:1px solid #2B2019;margin:1.6em 0">`
      + `<p style="margin:0;font-size:13px;line-height:1.5">Ateliê Afro Cultural · `
      + `Casa Verde, São Paulo<br>WhatsApp ${WHATSAPP} · `
      + `<a href="${SITE}" style="color:#2B2019">${SITE.replace('https://', '')}</a></p>`
      + `</div></body></html>`,
    texto: `${titulo}\n\n`
      + paragrafos.map((p) => p.replace(/<[^>]+>/g, '')).join('\n\n')
      + `\n\n—\nAteliê Afro Cultural · Casa Verde, São Paulo\n`
      + `WhatsApp ${WHATSAPP} · ${SITE}\n`
  };
}

/**
 * RF18 — a confirmação de inscrição.
 *
 * O QUE ELA PODE PROMETER: que a inscrição está registrada. É fato — a
 * linha existe em `public.inscricoes`, e a equipe a vê em
 * /admin/eventos/inscritos.
 *
 * O QUE ELA NÃO PODE: dizer "sua vaga está garantida". Vaga é o que
 * `reservar_vaga` já resolveu no momento do insert; repetir isso em
 * palavras diferentes só criaria uma segunda promessa para manter.
 */
function mensagemDeInscricao(dados: {
  nome: string; evento: string; comeca_em: string; local: string | null;
  ehMenor: boolean; responsavel: string | null;
}): Mensagem {
  const paragrafos = [
    `Oi, ${escapar(dados.nome.split(' ')[0])}.`,
    `Sua inscrição em <strong>${escapar(dados.evento)}</strong> está registrada.`,
    `<strong>Quando:</strong> ${escapar(quando(dados.comeca_em))}`
      + (dados.local ? `<br><strong>Onde:</strong> ${escapar(dados.local)}` : '')
  ];

  // Só aparece quando é o caso — e é informação de verdade para quem vai
  // levar uma criança (RN02).
  if (dados.ehMenor && dados.responsavel) {
    paragrafos.push(`Como quem vai participar tem menos de 18 anos, anotamos o contato de `
      + `<strong>${escapar(dados.responsavel)}</strong> como responsável.`);
  }

  paragrafos.push(
    `Se precisar mudar alguma coisa ou desistir, é só chamar no WhatsApp ${WHATSAPP} — `
    + `a gente ajusta. Assim outra pessoa pode ocupar o lugar.`
  );

  return { assunto: `Inscrição confirmada: ${dados.evento}`, ...montar('Inscrição registrada', paragrafos) };
}

/**
 * RF20 — a resposta da ONG a uma oferta de doação.
 *
 * O TEXTO DA RESPOSTA É DA EQUIPE, escrito por ela em
 * /admin/doacoes/responder. Esta função NÃO inventa uma palavra do
 * conteúdo: ela emoldura o que a pessoa da ONG escreveu.
 *
 * REGRA 1: nada de "obrigado pela sua generosidade" nem contador de vidas.
 * Quem doa para esta ONG está apoiando arte e memória, não fazendo
 * caridade — e o texto da equipe é que diz o resto.
 */
function mensagemDeDoacao(dados: {
  nome: string; resposta: string; situacao: string;
}): Mensagem {
  const recusada = dados.situacao === 'recusada';

  return {
    assunto: recusada
      ? 'Sobre a sua oferta de doação ao Ateliê Afro'
      : 'Sua doação ao Ateliê Afro',
    ...montar(
      recusada ? 'Sobre a sua oferta' : 'Sobre a sua doação',
      [
        `Oi, ${escapar(dados.nome.split(' ')[0])}.`,
        // O texto da equipe, com as quebras de linha preservadas. Escapado,
        // porque ele foi digitado num celular e pode ter qualquer coisa.
        escapar(dados.resposta).replace(/\n/g, '<br>'),
        `Se quiser continuar a conversa, é só responder este e-mail ou chamar no `
        + `WhatsApp ${WHATSAPP}.`
      ]
    )
  };
}

/* =====================================================================
   O envio
   ===================================================================== */

/**
 * O ÚNICO lugar que sabe qual é o provedor. Trocar de provedor é trocar
 * esta função — ver o cabeçalho sobre a spec ter escolhido o Brevo.
 */
async function enviarPeloProvedor(
  para: string, mensagem: Mensagem
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [para],
        reply_to: RESPONDER_PARA,
        subject: mensagem.assunto,
        html: mensagem.html,
        text: mensagem.texto
      })
    });

    if (!resposta.ok) {
      // O corpo do erro do provedor, cortado. Ele vai para `envios.erro`,
      // que a equipe lê — e NUNCA o corpo do e-mail, que traria o dado
      // pessoal de volta para uma segunda tabela.
      return { ok: false, erro: `${resposta.status}: ${(await resposta.text()).slice(0, 400)}` };
    }

    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: `rede: ${String(erro).slice(0, 400)}` };
  }
}

/* =====================================================================
   RF28 — o aviso para um grupo
   ===================================================================== */

/**
 * Quantas pessoas um único aviso pode alcançar.
 *
 * NÃO É UM LIMITE DE PRODUTO, é um fusível. A ONG tem dezenas de
 * voluntários, não milhares; um grupo que passe disto é sinal de que algo
 * está errado na consulta, e o desfecho de mandar mesmo assim seria
 * irreversível. Quem bater no teto recebe uma recusa com o número, não um
 * envio pela metade.
 */
const LIMITE_DE_DESTINATARIOS = 300;

/**
 * O grupo, resolvido em endereços de e-mail — SEMPRE a partir do banco.
 *
 * A chave vem de uma lista fechada (compartilhado/grupos-de-aviso.ts, do
 * lado do site) e é conferida de novo AQUI: quem chama a função pode não
 * ser o site. Sem esta lista, o parâmetro escolheria a consulta.
 */
async function enderecosDoGrupo(
  supabase: ReturnType<typeof createClient>,
  grupo: string,
  eventoId?: string
): Promise<{ ok: true; enderecos: string[] } | { ok: false; erro: string }> {
  if (grupo === 'voluntarios') {
    // ATIVOS, e só. É o MESMO recorte de `public.eh_voluntario_ativo()`
    // (migration 012), ou seja, o mesmo grupo que enxerga o mural — quem
    // acabou de se candidatar não recebe comunicação interna.
    const { data, error } = await supabase
      .from('voluntarios')
      .select('perfis(email)')
      .eq('situacao', 'ativo');

    if (error) return { ok: false, erro: String(error.message) };

    return {
      ok: true,
      enderecos: (data ?? [])
        .map((linha) => {
          const p = Array.isArray(linha.perfis) ? linha.perfis[0] : linha.perfis;
          return p?.email ?? null;
        })
        .filter((e): e is string => Boolean(e))
    };
  }

  if (grupo === 'doadores') {
    // A doação pode ter vindo de quem tem conta OU de fora do site
    // (`doador_email` com `perfil_id` nulo — RF21). Os dois entram.
    const { data, error } = await supabase
      .from('doacoes')
      .select('doador_email, perfis(email)');

    if (error) return { ok: false, erro: String(error.message) };

    return {
      ok: true,
      enderecos: (data ?? [])
        .map((linha) => {
          const p = Array.isArray(linha.perfis) ? linha.perfis[0] : linha.perfis;
          return linha.doador_email ?? p?.email ?? null;
        })
        .filter((e): e is string => Boolean(e))
    };
  }

  if (grupo === 'inscritos') {
    if (!eventoId) return { ok: false, erro: 'grupo de inscritos sem evento' };

    const { data, error } = await supabase
      .from('inscricoes').select('email').eq('evento_id', eventoId);

    if (error) return { ok: false, erro: String(error.message) };

    return { ok: true, enderecos: (data ?? []).map((l) => l.email).filter(Boolean) };
  }

  return { ok: false, erro: `grupo desconhecido: ${grupo}` };
}

/**
 * Manda o aviso para o grupo.
 *
 * ===================================================================
 * UM E-MAIL POR PESSOA, NUNCA UMA LISTA NO MESMO `to`
 * ===================================================================
 *
 * O caminho barato seria `to: [todos]` numa requisição só. Isso mostraria
 * o endereço de cada pessoa para todas as outras — um vazamento de dado
 * pessoal em massa, feito pela própria ONG, sem que ninguém percebesse até
 * alguém responder "responder a todos".
 *
 * O `/emails/batch` do Resend resolve os dois lados: UMA requisição com N
 * mensagens SEPARADAS, cada uma com um destinatário só. Ninguém vê ninguém,
 * e o limite de requisições por segundo do provedor não é gasto uma vez por
 * pessoa.
 *
 * ===================================================================
 * O REGISTRO VEM ANTES DO ENVIO, PESSOA POR PESSOA
 * ===================================================================
 *
 * `public.envios` recebe uma linha por destinatário ANTES da chamada ao
 * provedor, e o índice único é quem decide quem entra: se este aviso já foi
 * para aquela pessoa, ela é PULADA. Isso é o que torna o botão seguro de
 * apertar duas vezes — a segunda vez alcança só quem faltou.
 *
 * Ao contrário, registrar depois faria uma falha de gravação virar reenvio
 * na próxima tentativa.
 */
async function enviarAvisoParaGrupo(
  supabase: ReturnType<typeof createClient>,
  corpo: { id?: string; grupo?: string; evento_id?: string }
): Promise<Response> {
  const { id, grupo, evento_id: eventoId } = corpo;

  if (typeof id !== 'string' || typeof grupo !== 'string') {
    return responder({ erro: 'pedido_invalido' }, 400);
  }

  // O TEXTO VEM DO BANCO. É a regra inteira da spec §9.
  const { data: aviso, error: erroDoAviso } = await supabase
    .from('avisos').select('titulo, corpo, publicado').eq('id', id).maybeSingle();

  if (erroDoAviso || !aviso) return responder({ erro: 'registro_nao_encontrado' }, 404);

  // RASCUNHO NÃO SAI. A Action já recusa antes; esta é a rede embaixo dela,
  // e ela existe porque o desfecho não tem desfazer.
  if (!aviso.publicado) return responder({ erro: 'aviso_nao_publicado' }, 409);

  const resolvido = await enderecosDoGrupo(supabase, grupo, eventoId);
  if (!resolvido.ok) {
    console.error('[enviar-email] não deu para resolver o grupo:', resolvido.erro);
    return responder({ erro: 'grupo_invalido', detalhe: resolvido.erro }, 400);
  }

  // Sem duplicata: a mesma pessoa pode estar em duas candidaturas, ou ter
  // duas doações. Um aviso que chega duas vezes parece defeito.
  const enderecos = [...new Set(resolvido.enderecos.map((e) => e.trim().toLowerCase()))];

  if (enderecos.length === 0) return responder({ ok: true, enviados: 0, grupo_vazio: true });

  if (enderecos.length > LIMITE_DE_DESTINATARIOS) {
    return responder({
      erro: 'grupo_grande_demais',
      detalhe: `${enderecos.length} destinatários, o teto é ${LIMITE_DE_DESTINATARIOS}`
    }, 413);
  }

  // Reserva pessoa por pessoa. Quem já recebeu ESTE aviso é pulado pelo
  // índice único (23505) — ver o cabeçalho.
  const paraEnviar: { email: string; envioId: string }[] = [];

  for (const email of enderecos) {
    const destinatario = await hash(email);
    const reserva = await supabase
      .from('envios')
      .insert({ tipo: 'aviso', referencia_id: id, destinatario, situacao: 'enviado' })
      .select('id')
      .maybeSingle();

    if (reserva.error) {
      if ((reserva.error as { code?: string }).code !== '23505') {
        console.error('[enviar-email] não deu para reservar:', reserva.error);
      }
      continue;  // já enviado antes, ou falha de gravação: não manda.
    }

    paraEnviar.push({ email, envioId: reserva.data!.id });
  }

  if (paraEnviar.length === 0) return responder({ ok: true, enviados: 0, ja_enviado: true });

  const mensagem = montar(aviso.titulo, [
    escapar(aviso.corpo).replace(/\n/g, '<br>'),
    `Você recebe este aviso porque tem um vínculo ativo com o Ateliê Afro Cultural. `
    + `Para conversar, é só responder este e-mail ou chamar no WhatsApp ${WHATSAPP}.`
  ]);

  let falhou: string | null = null;

  try {
    const resposta = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      // UMA MENSAGEM POR PESSOA, com um `to` de um elemento só — ver o
      // cabeçalho sobre por que nunca uma lista no mesmo `to`.
      body: JSON.stringify(paraEnviar.map(({ email }) => ({
        from: REMETENTE,
        to: [email],
        reply_to: RESPONDER_PARA,
        subject: aviso.titulo,
        html: mensagem.html,
        text: mensagem.texto
      })))
    });

    if (!resposta.ok) falhou = `${resposta.status}: ${(await resposta.text()).slice(0, 400)}`;
  } catch (erro) {
    falhou = `rede: ${String(erro).slice(0, 400)}`;
  }

  if (falhou) {
    // Todas as reservas viram 'falhou', e o índice PARCIAL libera a
    // retentativa — apertar o botão de novo alcança as mesmas pessoas.
    await supabase
      .from('envios')
      .update({ situacao: 'falhou', erro: falhou })
      .in('id', paraEnviar.map((p) => p.envioId));

    console.error('[enviar-email] o provedor recusou o lote:', falhou);
    return responder({ erro: 'falha_no_envio', detalhe: falhou }, 502);
  }

  return responder({ ok: true, enviados: paraEnviar.length });
}

/* =====================================================================
   A porta
   ===================================================================== */

Deno.serve(async (requisicao: Request) => {
  if (requisicao.method !== 'POST') {
    return responder({ erro: 'method_not_allowed' }, 405);
  }

  // A configuração é conferida ANTES de qualquer coisa: uma função sem
  // secret é uma função que responderia "enviado" sem enviar.
  if (!SUPABASE_URL || !SERVICE_ROLE || !RESEND_API_KEY || !CHAVE_DO_SITE) {
    console.error('[enviar-email] faltam secrets: confira SUPABASE_SERVICE_ROLE_KEY, '
      + 'RESEND_API_KEY e CHAVE_DE_ENVIO no painel do Supabase (Edge Functions → Secrets).');
    return responder({ erro: 'nao_configurada' }, 500);
  }

  // TRAVA 1 — a chave compartilhada. Ver o cabeçalho: a anon key é pública,
  // então sem isto qualquer pessoa chamaria a função.
  const recebida = requisicao.headers.get('x-chave-do-site') ?? '';
  if (!iguaisEmTempoConstante(recebida, CHAVE_DO_SITE)) {
    // Sem detalhe na resposta: dizer "chave errada" confirma que existe uma.
    return responder({ erro: 'nao_autorizado' }, 401);
  }

  let corpo: {
    tipo?: string; id?: string; evento_id?: string; email?: string; grupo?: string;
  };
  try {
    corpo = await requisicao.json();
  } catch {
    return responder({ erro: 'corpo_invalido' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false }
  });

  const tipo = corpo.tipo;

  // LISTA FECHADA, e ela é a mesma do `check` de `public.envios`. Divergindo,
  // um envio entraria com um tipo que nenhuma tela sabe ler.
  if (tipo !== 'inscricao' && tipo !== 'doacao' && tipo !== 'aviso') {
    return responder({ erro: 'pedido_invalido' }, 400);
  }

  // O RF28 alcança um GRUPO, e por isso ele tem um caminho próprio: em vez
  // de um destinatário, ele resolve uma lista. Sai antes para não misturar
  // com a lógica de "um e-mail só" abaixo.
  if (tipo === 'aviso') return await enviarAvisoParaGrupo(supabase, corpo);

  // ---------------------------------------------------------------
  // Os dados vêm do BANCO, nunca do payload — é o desenho inteiro.
  // ---------------------------------------------------------------
  let para: string;
  let mensagem: Mensagem;

  /**
   * O identificador do registro. É o que a trava de reenvio usa como
   * `referencia_id`, e ele SEMPRE sai do banco — nunca do payload.
   */
  let referencia: string;

  if (tipo === 'inscricao') {
    /*
     * A INSCRIÇÃO É ACHADA PELO PAR (evento, e-mail), E NÃO PELO ID.
     *
     * A razão é mecânica: `registrar_inscricao` (migration 010) devolve uma
     * das três palavras fechadas — `ok`, `lotado`, `indisponivel` — e não o
     * id da linha que criou. Trocar o retorno dela exigiria `drop function`
     * (o Postgres não muda tipo de retorno com `create or replace`), numa
     * migration já APLICADA em produção, a dois dias da entrega.
     *
     * A PROPRIEDADE DE SEGURANÇA CONTINUA A MESMA, e é o que importa aqui:
     * quem chamar esta função com um e-mail qualquer só consegue disparar
     * um envio se JÁ EXISTIR uma inscrição com aquele e-mail naquele
     * evento — e o e-mail para onde a mensagem vai é o que está GRAVADO na
     * linha, não o que veio no corpo. Ou seja, no pior caso alguém reenvia,
     * para a pessoa certa, a confirmação que ela já deveria ter recebido. E
     * nem isso: o índice único de `public.envios` recusa o segundo.
     *
     * O que continua impossível é o que a spec §9 queria impedir: mandar
     * UMA PALAVRA sua para alguém. Não há parâmetro de assunto, de corpo
     * nem de destinatário em lugar nenhum.
     *
     * A mais RECENTE, porque a mesma pessoa pode se inscrever num evento,
     * a equipe apagar a linha, e ela se inscrever de novo.
     */
    const eventoId = (corpo as { evento_id?: string }).evento_id;
    const emailPedido = (corpo as { email?: string }).email;

    if (typeof eventoId !== 'string' || typeof emailPedido !== 'string') {
      return responder({ erro: 'pedido_invalido' }, 400);
    }

    const { data, error } = await supabase
      .from('inscricoes')
      .select('id, nome, email, eh_menor, responsavel_nome, eventos(titulo, comeca_em, local)')
      .eq('evento_id', eventoId)
      .eq('email', emailPedido)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.error('[enviar-email] inscrição não encontrada:', error);
      return responder({ erro: 'registro_nao_encontrado' }, 404);
    }

    referencia = data.id;

    // O PostgREST decide entre objeto e lista pela cardinalidade, e as duas
    // formas aparecem em versões diferentes — mesma precaução de
    // servidor/dados/exportacao.ts.
    const evento = Array.isArray(data.eventos) ? data.eventos[0] : data.eventos;
    if (!evento) return responder({ erro: 'evento_nao_encontrado' }, 404);

    para = data.email;
    mensagem = mensagemDeInscricao({
      nome: data.nome,
      evento: evento.titulo,
      comeca_em: evento.comeca_em,
      local: evento.local,
      ehMenor: data.eh_menor,
      responsavel: data.responsavel_nome
    });
  } else {
    // A doação vem por ID, e aqui isso é possível porque quem chama é a
    // Action do PAINEL: a equipe está olhando a linha, então ela tem o id.
    const id = (corpo as { id?: string }).id;
    if (typeof id !== 'string') return responder({ erro: 'pedido_invalido' }, 400);
    referencia = id;

    const { data, error } = await supabase
      .from('doacoes')
      .select('doador_nome, doador_email, resposta, situacao, perfis(nome, email)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error('[enviar-email] doação não encontrada:', error);
      return responder({ erro: 'registro_nao_encontrado' }, 404);
    }

    // A doação pode ter vindo de quem tem conta OU de fora do site
    // (`doador_nome`/`doador_email` com `perfil_id` nulo — RF21).
    const pessoa = Array.isArray(data.perfis) ? data.perfis[0] : data.perfis;
    para = data.doador_email ?? pessoa?.email ?? '';
    const nome = data.doador_nome ?? pessoa?.nome ?? '';

    // SEM RESPOSTA ESCRITA, NÃO HÁ E-MAIL. Mandar um e-mail vazio "sobre
    // sua doação" seria pior que não mandar: a pessoa abre esperando uma
    // resposta e não encontra nenhuma.
    if (!para || !data.resposta) {
      return responder({ erro: 'sem_resposta_para_enviar' }, 409);
    }

    mensagem = mensagemDeDoacao({ nome, resposta: data.resposta, situacao: data.situacao });
  }

  // ---------------------------------------------------------------
  // TRAVA 2 — o índice único de `public.envios`. A verificação é do BANCO,
  // não deste código: duas chamadas simultâneas perderiam a corrida contra
  // um `select` feito aqui.
  //
  // A ORDEM IMPORTA E É ESTA: reserva primeiro, envia depois. Ao contrário,
  // uma falha na gravação DEPOIS de um envio bem-sucedido faria a próxima
  // chamada mandar de novo.
  // ---------------------------------------------------------------
  const destinatario = await hash(para.trim().toLowerCase());

  const reserva = await supabase
    .from('envios')
    .insert({ tipo, referencia_id: referencia, destinatario, situacao: 'enviado' })
    .select('id')
    .maybeSingle();

  if (reserva.error) {
    // 23505 é a violação do índice único: já foi enviado. NÃO é erro — é a
    // trava fazendo o trabalho dela, e a resposta certa é "tudo bem".
    if ((reserva.error as { code?: string }).code === '23505') {
      return responder({ ok: true, ja_enviado: true });
    }
    console.error('[enviar-email] não deu para reservar o envio:', reserva.error);
    return responder({ erro: 'falha_ao_registrar' }, 500);
  }

  const envio = await enviarPeloProvedor(para, mensagem);

  if (!envio.ok) {
    // A reserva vira 'falhou', e o índice PARCIAL (`where situacao =
    // 'enviado'`) libera a retentativa. Sem isso, uma falha de rede do
    // provedor trancaria aquela pessoa para sempre.
    await supabase
      .from('envios')
      .update({ situacao: 'falhou', erro: envio.erro })
      .eq('id', reserva.data?.id);

    console.error('[enviar-email] o provedor recusou:', envio.erro);
    return responder({ erro: 'falha_no_envio', detalhe: envio.erro }, 502);
  }

  return responder({ ok: true });
});
