/**
 * acoes/doacoes.ts — o ciclo de doações (RF19–RF22), gravando em
 * `public.doacoes`.
 *
 * TRÊS ACTIONS, DOIS PÚBLICOS:
 *
 *   · `ofertar`          — RF19, quem quer doar. Guarda: `usuarioAtual()`;
 *   · `responderDoacao`  — RF20/RF21, a equipe. Guarda: `ehEquipe()`;
 *   · `registrarDoacao`  — RF21, a equipe. Guarda: `ehEquipe()`.
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO
 * ===================================================================
 *
 * O mesmo cabeçalho das Actions do painel, de acoes/conta.ts e de
 * acoes/voluntariado.ts, e vale palavra por palavra: o Next publica cada
 * função exportada de um arquivo `'use server'` numa URL (spec §4.5).
 * Qualquer pessoa chama com qualquer corpo, sem passar pelo formulário, sem
 * navegador. A guarda das PÁGINAS não protege nada aqui — Action não passa
 * por página nem por layout, e a varredura de
 * `testes/painel-guarda.test.mjs` lê `app/admin/**` e NÃO alcança este
 * arquivo.
 *
 * Por isso cada função abaixo pergunta por conta própria quem está do outro
 * lado, com as MESMAS funções que as páginas usam (`servidor/sessao.ts`,
 * `servidor/permissao.ts`). Duas respostas diferentes para a mesma pergunta
 * seriam exatamente o buraco. `testes/doacoes.test.mjs` varre este arquivo
 * exigindo isso de toda Action nova, e exigindo que as duas da equipe usem
 * `ehEquipe()` e a pública NÃO use.
 *
 * ===================================================================
 * OFERTAR EXIGE CONTA. A DECISÃO, E O ARGUMENTO CONTRA A ALTERNATIVA.
 * ===================================================================
 *
 * A mesma pergunta que `acoes/voluntariado.ts` enfrentou na RF25, e a mesma
 * resposta — mas por um caminho mais curto, porque aqui o ESQUEMA já
 * decidiu antes de qualquer argumento de produto. Duas travas
 * independentes, em supabase/migrations/004_pessoas.sql:
 *
 *  1. O GRANT. `grant select, insert, update, delete on public.voluntarios,
 *     public.voluntario_areas, public.doacoes to authenticated;` — e nada
 *     para `anon`. Uma inserção anônima responde `42501 permission denied`
 *     ANTES de chegar à RLS. Compare com `public.contatos`, que tem
 *     `grant insert on public.contatos to anon` de propósito: ali a
 *     escrita pública foi decidida e escrita no banco; aqui não;
 *  2. A POLÍTICA. `doacoes: o doador oferta — with check (perfil_id =
 *     auth.uid())`. Para quem não está autenticado `auth.uid()` é nulo,
 *     `perfil_id = null` avalia NULL, e NULL não é `true`: a linha não
 *     entra nem com o grant. Não existe linha possível sem sessão.
 *
 * Ou seja: ofertar sem conta não é uma opção de desenho que esta tarefa
 * recusou — é uma migration nova, e migration não é desta tarefa.
 *
 * OS TRÊS MOTIVOS DA RF25, APLICADOS AQUI. A alternativa considerada era a
 * mesma de lá: gravar em `public.contatos` com `origem = 'doacao'` (o valor
 * existe no `check` daquela coluna) para quem não tem conta. RECUSADA, e os
 * três motivos ficam MAIS fortes, não menos:
 *
 *   1. lá se perderiam as ÁREAS; aqui se perderia a CONVERSA INTEIRA.
 *      `contatos` tem `situacao` de atendimento (novo/em contato/
 *      concluído) e mais nada: não tem `tipo`, não tem `valor`, não tem
 *      `resposta`, não tem `recebida_em`. O RF20 (análise) e o RF21
 *      (registro do recebido) não teriam onde morar — a doação viraria uma
 *      mensagem lida, e "recebemos R$ 300" não teria coluna;
 *   2. lá se perderia a SITUAÇÃO que a pessoa acompanha; aqui isso é
 *      LITERALMENTE UM REQUISITO NUMERADO. O RF22 é "histórico de doações"
 *      e a seção existe desenhada em /minha-conta desde a RF11, esperando
 *      esta tarefa. Uma doação anônima nunca apareceria lá;
 *   3. lá seria uma segunda porta para a mesma coisa dentro do registro
 *      central de contatos (RF29); aqui, idem — e a equipe passaria a
 *      atender doações em duas telas com regras diferentes, uma delas sem
 *      o botão de "recebida".
 *
 * E HÁ UM QUARTO MOTIVO QUE A RF25 NÃO TINHA, e é o que torna o preço
 * pequeno: o esquema JÁ PREVIU quem não tem conta, só que pelo outro lado
 * do balcão. `perfil_id` é nulo-permitido, existem `doador_nome` e
 * `doador_email`, e a `constraint identificacao_obrigatoria` aceita a linha
 * com um ou com o outro. O comentário da migration diz para que isso serve,
 * com todas as letras: "Doacao registrada pela equipe pode nao ter perfil:
 * veio de fora do site". É `registrarDoacao`, abaixo.
 *
 * ENTÃO O PREÇO, DITO EM VOZ ALTA, é menor que o da candidatura: quem não
 * tem conta não oferta POR ESTA TELA, mas a doação dela não se perde — ela
 * fala pelo WhatsApp ou pelo e-mail (que continuam em /doar, na mesma
 * página) e a equipe registra. O que essa pessoa não tem é o
 * acompanhamento em /minha-conta, e a tela diz isso em vez de deixá-la
 * descobrir sozinha.
 *
 * ===================================================================
 * ESTE ARQUIVO NÃO PROCESSA PAGAMENTO, E NÃO EXISTE MEIO DE PAGAMENTO AQUI
 * ===================================================================
 *
 * RN08, e a /doar já diz em texto: "Este site não processa pagamentos. Ele
 * registra o que foi doado e a resposta que demos". A chave Pix da ONG não
 * existe (decisão D7, pendente com o grupo), e nada nesta tarefa a inventa.
 * Não há cobrança, não há gateway, não há recibo — a coluna `valor` é o
 * REGISTRO do que a ONG diz ter recebido, escrito pela equipe depois do
 * fato, e nunca pela pessoa que oferta (`lerOferta` não lê `valor` em
 * caminho nenhum).
 *
 * ===================================================================
 * `redirect()` FICA FORA DO `try`
 * ===================================================================
 *
 * Ele sinaliza POR EXCEÇÃO. Um catch em volta o transformaria em "não deu
 * para enviar" logo depois de uma gravação bem-sucedida — e a pessoa
 * ofertaria de novo, criando uma segunda linha idêntica que só a equipe
 * consegue distinguir. Vale igual para `notFound()`.
 */
'use server';

import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { usuarioAtual } from '@/servidor/sessao';
import { ehEquipe } from '@/servidor/permissao';
import { buscarDoacaoDoPainel } from '@/servidor/dados/doacoes';
import { TIPOS_DE_DOACAO } from '@/compartilhado/doacoes';
import {
  lerOferta, validarOferta, colunasDaOferta,
  lerAnalise, validarAnalise, colunasDaAnalise,
  lerRegistro, validarRegistro, colunasDoRegistro,
  ehIdentificador
} from '@/compartilhado/validacao';
import { mensagemDeErroDeEnvio } from '@/compartilhado/erros';
import { avisar } from '@/servidor/email';
import type { EstadoFormulario } from './autenticacao';

/** Onde a doação registrada aparece para quem doou — e para onde `ofertar` leva. */
const MINHA_CONTA = '/minha-conta';

/** A tela da oferta — revalidada junto, porque nada nela muda sozinho. */
const OFERTAR = '/doar/ofertar';

/** A fila da equipe. */
const LISTA = '/admin/doacoes';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/** Canais reais da ONG — os mesmos de /doar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/** Os `tipo` que existem, como lista de strings — a lista fechada mora em compartilhado/doacoes.ts. */
const TIPOS_VALIDOS = TIPOS_DE_DOACAO.map((tipo) => tipo.valor);

/**
 * A recusa de quem não tem (ou não tem mais) sessão, no formulário público.
 *
 * NÃO É `redirect('/entrar')`, ao contrário do que a PÁGINA faz para quem
 * chega sem conta, e a diferença é o caso real: quem chega AQUI sem sessão
 * é, quase sempre, alguém que abriu a tela, ficou escrevendo o que quer
 * doar e teve a sessão vencida no meio. Mandar para /entrar nesse instante
 * apagaria o texto. A recusa devolve `valores`, ou seja, o formulário volta
 * preenchido.
 *
 * É a mesma decisão de acoes/conta.ts, acoes/voluntariado.ts e das Actions
 * do painel.
 */
const SEM_SESSAO = 'Sua sessão não vale mais. Entre de novo em outra aba e envie outra vez — '
  + 'o que você escreveu continua nesta tela.';

/**
 * A recusa de quem não é (ou deixou de ser) equipe, nos formulários do
 * painel.
 *
 * NÃO É `notFound()`, ao contrário do que as PÁGINAS do painel fazem, e a
 * diferença é o caso real: quem chega aqui quase sempre é alguém da equipe
 * que ficou escrevendo uma resposta e teve a sessão vencida no meio.
 * Responder 404 nesse instante apagaria a tela — e com ela o texto.
 *
 * Não conta nada a quem não deveria saber: para chegar até aqui já é
 * preciso ter o identificador desta Action, que só existe no HTML de uma
 * tela que responde 404 para quem não é equipe.
 */
const SEM_PERMISSAO = 'Sua sessão de equipe não vale mais (ou nunca valeu). Entre de novo em '
  + 'outra aba e envie outra vez — o que você escreveu continua nesta tela.';

/**
 * Sem projeto Supabase configurado não há onde gravar. Acontece de verdade
 * na suíte offline (`npm test`) e num deploy sem as variáveis no painel da
 * Netlify (CLAUDE.md, "O que trava hoje", item 0e).
 *
 * Na prática ninguém vê estas mensagens, porque sem Supabase
 * `usuarioAtual()`/`ehEquipe()` já responderam antes — elas existem para o
 * caso de a ordem mudar, e para o log, que é onde a causa aparece.
 */
function semSupabase(): string {
  console.error('[doacoes] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma doação pode ser gravada.');

  return 'O registro de doações não está disponível neste endereço. Fale com a gente pelo '
    + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} — os dois funcionam.`;
}

/**
 * RF19 — registra a oferta de doação da PRÓPRIA pessoa.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura
 * porque o React o passa.
 *
 * SEM REGRA DE "JÁ OFERTOU", ao contrário de acoes/voluntariado.ts, e a
 * diferença é o objeto: candidatar-se duas vezes é a mesma candidatura
 * repetida (e a pessoa não consegue apagar); DOAR duas vezes são duas
 * doações, as duas legítimas — quem doou livros em março e um tambor em
 * agosto fez duas coisas. Uma trava de duplicidade aqui recusaria a segunda
 * doação de quem mais apoia a ONG.
 *
 * O que sobra contra o envio acidental em dobro é o POST-redirect-GET
 * (atualizar a página depois não repete a gravação) e o botão que desabilita
 * enquanto envia, para quem tem JavaScript. Duas ofertas idênticas em
 * seguida a equipe resolve olhando — e, ao contrário da candidatura, ela
 * PODE resolver: a política `doacoes: equipe gerencia` é `for all`.
 */
export async function ofertar(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerOferta(dados);

  // TUDO o que a pessoa escreveu volta em toda recusa (defeito medido na
  // Tarefa 3 da autenticação: o React 19 dá `reset()` no <form> ao fim de
  // uma action, e sem script a página é renderizada do zero).
  const valores: Record<string, string> = { tipo: campos.tipo, descricao: campos.descricao };

  // A GUARDA. `usuarioAtual()` pergunta ao Supabase (`getUser()`), não
  // confia no cookie — ver servidor/sessao.ts. É a MESMA função que a
  // página usa.
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, mensagem: SEM_SESSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  const { valido, erros } = validarOferta(campos, TIPOS_VALIDOS);
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  const linha = colunasDaOferta(campos, usuario.id);

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    /**
     * SEM `.select()`, e isto é o contrário de acoes/voluntariado.ts — a
     * assimetria convida a "corrigir" o lado errado, por isso está escrita
     * nos dois arquivos.
     *
     * Lá o id que volta é o que a SEGUNDA tabela precisa referenciar (a
     * candidatura grava áreas depois). Aqui não há segunda tabela: a
     * doação é uma linha só, e nada neste código usa o id dela. Pedir a
     * linha de volta seria trazer para o servidor um dado que ninguém lê —
     * funcionaria (a política `doacoes: o doador le as proprias` permite),
     * mas é ida de rede por nada.
     *
     * NÃO É o caso de `inscricoes`/`contatos`, onde pedir a linha de volta
     * faz a inserção PARECER que falhou porque a leitura é negada. Aqui
     * seria só inútil, não perigoso — e a distinção importa para quem vier
     * depois: se um dia esta Action precisar do id, pode pedir.
     */
    const { error } = await supabase.from('doacoes').insert(linha);

    if (error) {
      const traduzido = mensagemDeErroDeEnvio(error);

      console.error(
        `[doacoes] não deu para gravar a oferta${traduzido.conhecido ? '' : ' (causa não prevista)'}:`,
        descrever(error)
      );

      falha = { ok: false, mensagem: traduzido.mensagem, valores };
    }
  } catch (erro) {
    console.error('[doacoes] ofertar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  // As DUAS telas que mudam com isto: a área do usuário, que passa a listar
  // a doação, e a fila da equipe.
  revalidatePath(MINHA_CONTA);
  revalidatePath(OFERTAR);
  revalidatePath(LISTA);

  // FORA do try — ver o cabeçalho. POST-redirect-GET: sem isto, atualizar a
  // página depois de enviar reenvia a oferta.
  //
  // O DESTINO É A ÁREA DO USUÁRIO, e não esta mesma tela com um aviso: lá a
  // doação APARECE, com a situação escrita. Uma confirmação que mostra o
  // registro vale mais que uma que promete que ele existe — e é a mesma
  // tela onde a pessoa vai acompanhar a resposta da ONG (RF22).
  // PARA A HOME, pelo mesmo motivo da candidatura (pedido V1: "mostrar
  // popup/na página agradecimento pela doação"). O link para acompanhar a
  // oferta vai dentro do aviso — ver compartilhado/avisos-da-home.ts.
  redirect('/?aviso=doacao');
}

/**
 * RF20/RF21 — a equipe responde a uma doação e registra o que foi recebido.
 *
 * UMA ACTION SÓ PARA AS DUAS COISAS, e isso é decisão: "aceitar" e
 * "registrar como recebida" são o mesmo gesto em momentos diferentes da
 * mesma conversa, e separá-las em duas Actions faria a tela ter dois
 * formulários competindo pelo mesmo campo de resposta. O que muda entre
 * elas é a situação escolhida — e os carimbos, que `colunasDaAnalise`
 * decide a partir da linha atual.
 *
 * Forma `(anterior, dados) => EstadoFormulario` porque a tela é um
 * formulário com erro por campo, como a de escrever notícia. As Actions do
 * painel que são BOTÃO (alternarPublicacao, mudarSituacao) usam
 * `(dados) => void` e respondem `notFound()`; esta não pode, porque há
 * texto escrito a preservar.
 */
export async function responderDoacao(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerAnalise(dados);

  const valores: Record<string, string> = {
    situacao: campos.situacao,
    resposta: campos.resposta,
    valor: campos.valor
  };

  // A guarda, antes de tocar em qualquer coisa.
  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // `id` é uuid (`gen_random_uuid()`, 004_pessoas.sql) — ao contrário do id
  // de atividade, que é `text`. Um valor malformado daria erro de sintaxe
  // no Postgres (22P02); recusar antes é o que impede um "não deu para
  // fazer isso" genérico de esconder uma requisição montada à mão.
  if (!ehIdentificador(campos.id)) {
    return {
      ok: false,
      valores,
      mensagem: 'Esta doação não foi encontrada. Volte para a lista e abra de novo.'
    };
  }

  // LER ANTES DE ESCREVER, por dois motivos que não dá para contornar: os
  // carimbos (`respondida_em`/`recebida_em` só nascem uma vez — o PostgREST
  // não tem `coalesce` no update) e o `tipo`, que decide se o campo de valor
  // faz sentido. `buscarDoacaoDoPainel` já é degradável e nunca lança.
  const { valor: atual, degradou } = await buscarDoacaoDoPainel(campos.id);

  if (degradou) {
    return {
      ok: false,
      valores,
      mensagem: 'Não deu para ler esta doação agora — o banco de dados não respondeu. Nada foi '
        + 'perdido, e nada foi alterado: tente de novo em alguns instantes.'
    };
  }

  if (!atual) {
    return {
      ok: false,
      valores,
      mensagem: 'Esta doação não existe mais. Volte para a lista — pode ser que alguém da '
        + 'equipe já tenha mexido nela.'
    };
  }

  const { valido, erros } = validarAnalise(campos, atual.tipo);
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  const linha = colunasDaAnalise(campos, atual, new Date().toISOString());

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    /**
     * `.select('id')` AQUI É OBRIGATÓRIO, como no update de
     * acoes/publicacoes.ts e no de acoes/contatos.ts: quem chama é equipe,
     * que lê tudo (`doacoes: equipe gerencia`, `for all`), e sem o retorno
     * um update que não casa linha nenhuma é SUCESSO COM ZERO LINHAS no
     * PostgREST. Responder uma doação que outra pessoa da equipe apagou no
     * mesmo minuto diria "guardado" sem ter guardado nada.
     *
     * O objeto é montado chave por chave por `colunasDaAnalise`, nunca
     * `{ ...campos }`: um spread aqui é o caminho pelo qual um `descricao`
     * no corpo da requisição chegaria ao banco — e o que a pessoa escreveu
     * é REGISTRO (regra 6 do CLAUDE.md aplicada ao texto de terceiro, a
     * mesma de acoes/contatos.ts).
     */
    const { data, error } = await supabase
      .from('doacoes')
      .update(linha)
      .eq('id', campos.id)
      .select('id');

    if (error) {
      console.error('[doacoes] responder:', descrever(error));
      falha = { ok: false, mensagem: mensagemDeErroDeEnvio(error).mensagem, valores };
    } else if (!Array.isArray(data) || data.length === 0) {
      falha = {
        ok: false,
        valores,
        mensagem: 'Nada foi guardado: esta doação não está mais lá. Volte para a lista e '
          + 'confira — pode ser que alguém da equipe tenha mexido nela ao mesmo tempo.'
      };
    }
  } catch (erro) {
    console.error('[doacoes] responder (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  /*
   * RF20 — A RESPOSTA VAI TAMBÉM POR E-MAIL, e não só para /minha-conta.
   *
   * O escopo pede "resposta de aceite ou recusa por e-mail". Até aqui a
   * resposta era GRAVADA e lida em /minha-conta (RF22) — o que serve a quem
   * tem conta e volta ao site, e não serve a quem ofertou e foi embora
   * esperando notícia. Uma resposta que a pessoa precisa ir buscar não é
   * uma resposta.
   *
   * `avisar()` nunca lança (ver o cabeçalho de servidor/email.ts), e o
   * resultado NÃO decide se a Action deu certo: a resposta já está gravada
   * neste ponto, e a pessoa a lê em /minha-conta de qualquer jeito. O que
   * ele muda é a FRASE que a equipe lê ao voltar para a lista — porque
   * "respondida" e "respondida, mas o e-mail não saiu" mandam a equipe
   * fazer coisas diferentes: a segunda pede um WhatsApp.
   *
   * A Edge Function busca a doação pelo id e monta a mensagem com o texto
   * que a equipe ESCREVEU. Nenhuma palavra do e-mail vem daqui.
   */
  const avisou = await avisar({ tipo: 'doacao', id: campos.id });

  // A área do usuário muda: é lá que quem doou lê a resposta (RF22).
  revalidatePath(MINHA_CONTA);
  revalidatePath(LISTA);

  // FORA do try. O que a Action tem a dizer viaja no `?aviso=`, por lista
  // fechada (`avisoDeDoacoes`, em compartilhado/avisos-do-painel.ts): um
  // redirect não carrega estado, e ecoar texto vindo da URL seria deixar
  // qualquer pessoa escrever uma mensagem dentro do painel da ONG.
  redirect(`${LISTA}?aviso=${avisou ? 'respondida' : 'respondida-sem-email'}`);
}

/**
 * RF21 — a equipe registra uma doação que chegou POR FORA do site.
 *
 * É a outra ponta da decisão "ofertar exige conta" (ver o cabeçalho): quem
 * não tem conta fala pelo WhatsApp, pelo e-mail ou na porta da sede, e a
 * doação entra por aqui, com `doador_nome`/`doador_email` no lugar de
 * `perfil_id`.
 *
 * A LINHA NASCE 'recebida', e o literal está em `colunasDoRegistro`, não
 * no FormData: esta tela existe para o que JÁ CHEGOU. Uma doação prometida
 * por fora e ainda não entregue não tem lugar aqui de propósito — quem
 * combinou a entrega pelo WhatsApp continua a conversa por lá, e registrar
 * uma promessa como se fosse fato é o começo de uma prestação de contas
 * que não fecha.
 */
export async function registrarDoacao(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerRegistro(dados);

  const valores: Record<string, string> = {
    doador_nome: campos.doador_nome,
    doador_email: campos.doador_email,
    tipo: campos.tipo,
    descricao: campos.descricao,
    valor: campos.valor
  };

  if (!await ehEquipe()) return { ok: false, mensagem: SEM_PERMISSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  const { valido, erros } = validarRegistro(campos, TIPOS_VALIDOS);
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  const linha = colunasDoRegistro(campos, new Date().toISOString());

  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();

    // SEM `.select()`, mesmo motivo do insert de `ofertar`: nada neste
    // código usa o id da linha nova. A política que permite este insert é
    // `doacoes: equipe gerencia` (`for all ... with check (eh_equipe())`) —
    // e NÃO `doacoes: o doador oferta`, que exige `perfil_id = auth.uid()`
    // e recusaria esta linha, onde `perfil_id` é nulo. As duas políticas
    // são permissivas e o Postgres as combina com OR: basta uma passar.
    const { error } = await supabase.from('doacoes').insert(linha);

    if (error) {
      console.error('[doacoes] registrar:', descrever(error));
      falha = { ok: false, mensagem: mensagemDeErroDeEnvio(error).mensagem, valores };
    }
  } catch (erro) {
    console.error('[doacoes] registrar (exceção):', descrever(erro));
    falha = { ok: false, mensagem: mensagemDeErroDeEnvio(erro).mensagem, valores };
  }

  if (falha) return falha;

  // Nenhuma tela pública muda: esta doação não tem `perfil_id`, então ela
  // não aparece na área de conta de ninguém. Só a fila da equipe.
  revalidatePath(LISTA);

  redirect(`${LISTA}?aviso=registrada`);
}

/*
 * ===================================================================
 * O QUE ESTE ARQUIVO NÃO FAZ, E POR QUÊ
 * ===================================================================
 *
 * NÃO HÁ `delete`, EM CAMINHO NENHUM. O banco permite (a política é
 * `for all` e `authenticated` tem `grant delete`); quem recusa é este
 * arquivo, e `testes/doacoes.test.mjs` falha no dia em que um `delete`
 * aparecer aqui. Três motivos, os mesmos de acoes/contatos.ts e
 * acoes/atividades.ts:
 *
 *  · uma doação registrada é PRESTAÇÃO DE CONTAS. Apagar o que a ONG
 *    recebeu é o oposto do que a seção "Uma palavra sobre transparência"
 *    de /doar promete;
 *  · apagar não tem desfazer, e aconteceria num celular, de pé, no meio de
 *    um evento (regra 4 do CLAUDE.md);
 *  · o que a equipe de fato quer, quando quer apagar, é dizer "não deu para
 *    receber" — e isso é `situacao = 'recusada'` com o motivo escrito, que
 *    a pessoa lê em /minha-conta. O caminho existe e é melhor.
 *
 * O QUE ISSO CUSTA, dito em voz alta: /privacidade promete que a pessoa
 * pode "pedir a exclusão dos seus dados", e esta tela NÃO faz isso. Quem
 * precisar apagar uma doação a pedido de quem a ofereceu depende de quem
 * cuida do site, no SQL Editor do Supabase. A tela diz isso por escrito
 * (componentes/ListaDoacoes.ts) em vez de deixar a equipe procurando um
 * botão que não existe — mesma decisão, mesma frase, da tela de mensagens.
 *
 * NÃO HÁ EDIÇÃO DA `descricao`. O que a pessoa escreveu é registro:
 * `lerAnalise` não lê esse campo, então ele não existe para o resto do
 * sistema.
 *
 * NÃO HÁ NADA QUE COBRE, CONFIRME OU PROMETA PAGAMENTO. Ver o cabeçalho.
 */
