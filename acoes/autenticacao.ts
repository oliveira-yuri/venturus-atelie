/**
 * acoes/autenticacao.ts — entrar, criar conta, recuperar acesso e sair.
 *
 * ESTE ARQUIVO É UM ENDPOINT HTTP PÚBLICO, não uma função interna. É a coisa
 * mais importante a entender antes de mexer aqui (spec §4.5): o Next publica
 * cada função exportada de um arquivo `'use server'` numa URL, e qualquer
 * pessoa pode chamá-la com qualquer corpo, sem passar pelo formulário, sem
 * JavaScript, sem navegador. Toda validação que importa acontece AQUI. O que
 * o formulário faz na tela é conveniência para quem preenche, nunca defesa.
 *
 * Daí as duas regras que governam o arquivo inteiro:
 *
 *  1. Nada do FormData chega ao banco sem passar por nome explícito. Os
 *     campos são lidos um a um em `compartilhado/validacao.ts` e o objeto de
 *     `options.data` do signUp é montado chave por chave, logo abaixo.
 *     Espalhar um objeto vindo da requisição (`...campos`) seria reabrir a
 *     escalada de privilégio que a regra 6 do CLAUDE.md registra como já
 *     ocorrida: bastaria mandar `eh_equipe=true` no corpo. O banco tem um
 *     trigger contra isso, e mesmo assim não se depende só dele — o código e
 *     a política são um E, não um OU (ver servidor/supabase.ts).
 *  2. Erro do Supabase nunca vai cru para a tela. `compartilhado/erros.ts`
 *     traduz por código; o que não estiver mapeado vira mensagem genérica na
 *     tela e `console.error` no log do servidor, que passa a ser a única
 *     cópia do detalhe.
 *
 * FORMA DAS FUNÇÕES: `(anterior, dados) => EstadoFormulario`, o formato que
 * `useActionState` (React 19) espera. O estado anterior não é usado por
 * nenhuma delas — está na assinatura porque o React o passa.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ, e é de propósito:
 *  - não cria linha em `public.perfis`. O perfil nasce de um TRIGGER em
 *    `auth.users` (`public.criar_perfil()`, supabase/migrations/001_base.sql).
 *    O que este código controla são os nomes que vão em `options.data`, que
 *    é de onde o trigger lê;
 *  - não fala com o Supabase pelo navegador. Não existe cliente de Supabase
 *    no cliente neste projeto (spec §4.1) — `servidor/supabase.ts` é o único,
 *    e começa com `import 'server-only'`.
 *
 * DEPENDÊNCIA EXTERNA QUE AINDA NÃO ESTÁ RESOLVIDA: o projeto Supabase está
 * com confirmação de e-mail LIGADA (`mailer_autoconfirm: false`, medido em
 * 28/08/2026), e o envio nativo do Supabase tem cota baixíssima. Na prática,
 * hoje, criar conta e recuperar acesso chegam até o envio e podem falhar com
 * `over_email_send_rate_limit`. Isso não é defeito deste código: o fluxo
 * está certo, e a mensagem que a pessoa recebe nesse caso diz a verdade e
 * oferece WhatsApp e e-mail. Fecha de vez quando o Auth apontar para o SMTP
 * do Brevo (CLAUDE.md, "O que trava hoje", item 1).
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase } from '@/servidor/dados/degradacao';
import { mensagemDeErroDeAutenticacao } from '@/compartilhado/erros';
import { usuarioAtual } from '@/servidor/sessao';
import {
  lerCadastro, lerEntrada, lerRecuperacao, lerNovaSenha,
  validarCadastro, validarEntrada, validarRecuperacao, validarNovaSenha,
  apenasDigitos
} from '@/compartilhado/validacao';

/**
 * O que a tela recebe de volta.
 *
 * `erros` é indexado pelo atributo `name` do input — é assim que a Tarefa 3
 * consegue passar cada mensagem para o `erro` do CampoFormulario certo. Erro
 * que não pertence a um campo (credencial que não confere, limite de envio)
 * vem só em `mensagem`, porque apontar para um campo específico ali seria
 * mentira ou vazamento.
 */
export type EstadoFormulario = {
  ok: boolean;
  mensagem: string;
  erros?: Record<string, string>;
  /**
   * O que a pessoa tinha escrito, devolvido para a tela repreencher o
   * formulário — indexado pelo `name` do campo, como `erros`. Caixa de
   * marcar vem como 'on' (marcada) ou '' (não).
   *
   * ACRESCENTADO NA TAREFA 3 POR DEFEITO MEDIDO, não por gosto: sem isto,
   * TODA recusa devolve o formulário em branco. Com script porque o React
   * 19 dá `reset()` no <form> ao fim de uma action; sem script porque a
   * página é renderizada de novo do zero. Medido nos dois caminhos, em
   * 30/08/2026, no cadastro: nome, e-mail, telefone e as quatro caixas
   * voltavam vazios, sobrando só as mensagens de erro. Quem esquece de
   * marcar a caixa de maioridade redigita oito campos — no celular, de pé,
   * que é o cenário real da regra 4 do CLAUDE.md.
   *
   * SENHA NUNCA ENTRA AQUI, em nenhuma das Actions. Devolvê-la significaria
   * escrevê-la no HTML da resposta — que fica no cache do navegador, no
   * histórico e em qualquer log de proxy pelo caminho. Redigitar a senha é
   * o preço, e é pequeno perto disso.
   */
  valores?: Record<string, string>;
};

/** Mensagem única para "o formulário voltou com campo errado". */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * Canais reais da ONG — os mesmos de compartilhado/erros.ts, de /contato e
 * de app/nova-senha/page.tsx. Estão aqui porque toda mensagem deste arquivo
 * que admite não ter conseguido resolver precisa terminar num canal que
 * funciona de verdade (regra 2 do CLAUDE.md: nada de contato inventado).
 */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

/**
 * A recusa de `definirNovaSenha` quando não há sessão.
 *
 * Diz o que houve (o link deixou de valer) e o que fazer (pedir outro), sem
 * jargão e sem culpar quem está lendo — seção 11 do escopo. Não é `erros`
 * de campo nenhum: o problema não está no que a pessoa digitou.
 */
const SEM_SESSAO_PARA_TROCAR_SENHA: EstadoFormulario = {
  ok: false,
  mensagem: 'O link que abriu esta página não vale mais — eles duram pouco tempo e servem uma '
    + 'vez só. Peça um link novo em "Esqueci minha senha" e abra o mais recente que chegar.'
};

/**
 * O sucesso do cadastro — e por que ele fala tanto do e-mail.
 *
 * O projeto Supabase está com `mailer_autoconfirm: false` (medido de novo
 * em 30/08/2026, Tarefa 3): a conta é gravada, mas a pessoa NÃO consegue
 * entrar antes de abrir o link de confirmação. Dizer só "conta criada"
 * mandaria todo mundo tentar entrar em seguida e bater em "falta confirmar
 * seu e-mail" sem saber por quê.
 *
 * E o link pode simplesmente não chegar: o envio nativo do Supabase tem
 * cota baixíssima e é o item 1 de "O que trava hoje" no CLAUDE.md. Por isso
 * a frase não promete prazo de entrega — nomeia o spam, que é a causa que a
 * pessoa consegue resolver sozinha, e oferece os canais reais da ONG para a
 * causa que ela não consegue. Quando o Auth apontar para o SMTP do Brevo,
 * a segunda metade pode encolher.
 */
const MENSAGEM_CONTA_CRIADA =
  'Conta criada. Enviamos um e-mail com um link de confirmação: abra o link e depois volte '
  + 'para entrar — antes disso a entrada não funciona. Se o e-mail não chegar, olhe o spam e, '
  + `se ainda assim não aparecer, fale com a gente pelo WhatsApp ${WHATSAPP} ou pelo e-mail `
  + `${EMAIL_ATELIE}.`;

/**
 * Sem projeto Supabase configurado, autenticar é impossível — e é preciso
 * dizer isso, não fingir que a tentativa falhou por causa da senha.
 *
 * Acontece de verdade em dois lugares: na suíte offline (`npm test`, que roda
 * de propósito sem as variáveis) e num deploy da Netlify em que alguém
 * esqueceu de cadastrar SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL — o item 0e de
 * "O que trava hoje". Sem esta guarda, `obterCliente()` receberia `undefined`
 * como URL e o erro que chegaria à tela seria uma exceção de biblioteca.
 */
function semSupabase(): EstadoFormulario {
  console.error('[autenticacao] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhuma operação de conta funciona sem elas.');
  return {
    ok: false,
    mensagem: 'As contas ainda não estão disponíveis neste endereço. Fale com a gente pelo '
      + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE}.`
  };
}

/**
 * Traduz o erro do Supabase e registra o que não foi previsto.
 *
 * `rotulo` só entra no log: diz qual das operações falhou, para o log do
 * servidor não virar uma pilha de mensagens idênticas sem origem.
 */
function estadoDeFalha(erro: unknown, rotulo: string): EstadoFormulario {
  const traduzido = mensagemDeErroDeAutenticacao(erro);

  if (!traduzido.conhecido) {
    // Única cópia do detalhe: a tela recebe a mensagem genérica de propósito.
    console.error(`[autenticacao] ${rotulo}: erro não mapeado`, erro);
  }

  return {
    ok: false,
    mensagem: traduzido.mensagem,
    ...(traduzido.campo ? { erros: { [traduzido.campo]: traduzido.mensagem } } : {})
  };
}

/**
 * A URL pública deste site, para montar o link que vai dentro do e-mail.
 *
 * O site roda em três endereços (local, branch deploy, produção) e o link do
 * e-mail precisa apontar para o endereço de onde a pessoa pediu — mandar
 * alguém do branch deploy para produção a levaria a uma versão que não tem o
 * que ela pediu.
 *
 * Ordem, e por quê:
 *  1. `URL_DO_SITE` — a variável desta aplicação. É a única que alguém
 *     configura à mão, e a que vence todas as outras. PRECISA SER CADASTRADA
 *     NO PAINEL DA NETLIFY (Site configuration → Environment variables) com o
 *     endereço público, sem barra no fim. Sem prefixo `NEXT_PUBLIC_`: isto é
 *     lido só no servidor e não pode ser embutido no bundle do navegador.
 *  2. `DEPLOY_PRIME_URL` e `URL` — a Netlify injeta as duas sozinha.
 *     DEPLOY_PRIME_URL vem primeiro porque num branch deploy ela é o endereço
 *     COM o prefixo da branch, enquanto URL é sempre o de produção.
 *  3. Os cabeçalhos da requisição — para desenvolvimento local, onde nenhuma
 *     das outras existe e quebrar seria pior.
 *
 * SOBRE O PASSO 3: `Host` é cabeçalho do cliente, ou seja, controlado por
 * quem chama. Um `Host: site-falso.exemplo` faria o link do e-mail apontar
 * para lá. Duas coisas limitam o estrago, e nenhuma delas está neste arquivo:
 * o Supabase só aceita `redirectTo` que esteja na lista de Redirect URLs do
 * projeto (Authentication → URL Configuration) e ignora o resto, caindo no
 * Site URL; e a Netlify normaliza o Host do que entra pela CDN. Ainda assim,
 * o passo 3 é rede de segurança para desenvolvimento — em produção,
 * `URL_DO_SITE` deve estar cadastrada, e é isso que torna a questão teórica.
 * O formato é checado abaixo para não montar URL com lixo dentro.
 */
async function urlBaseDoSite(): Promise<string> {
  const configurada = process.env.URL_DO_SITE
    || process.env.DEPLOY_PRIME_URL
    || process.env.URL;

  if (configurada) return configurada.replace(/\/+$/, '');

  const cabecalhos = await headers();
  const host = cabecalhos.get('x-forwarded-host') || cabecalhos.get('host') || '';

  // Só o que é host de verdade: letras, dígitos, ponto, hífen e porta. Corta
  // Host com barra, arroba ou espaço, que é como se monta um endereço que
  // parece deste site e não é.
  if (!/^[a-zA-Z0-9.-]+(:\d+)?$/.test(host)) {
    console.error('[autenticacao] sem URL_DO_SITE e com Host inutilizável: '
      + 'o link do e-mail não pode ser montado.');
    return '';
  }

  const protocolo = cabecalhos.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  return `${protocolo}://${host}`;
}

/**
 * Para onde o link do e-mail leva.
 *
 * `/auth/confirm` é a rota que troca o código do link pela sessão — criada na
 * Tarefa 2. Ela é o destino tanto da confirmação de conta nova quanto da
 * recuperação de senha; é lá que se decide para onde a pessoa segue depois.
 */
async function urlDeConfirmacao(): Promise<string | undefined> {
  const base = await urlBaseDoSite();
  return base ? `${base}/auth/confirm` : undefined;
}

/**
 * RF10 — entrar com e-mail e senha.
 *
 * No sucesso vai para `/`, e não para uma área da pessoa: a área do usuário
 * (RF11) ainda não existe. Quando existir, é aqui que o destino muda.
 */
export async function entrar(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerEntrada(dados);
  const { valido, erros } = validarEntrada(campos);

  // O e-mail volta para a tela em toda recusa; a senha, nunca (ver
  // `valores` em EstadoFormulario).
  const valores = { email: campos.email ?? '' };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!temSupabase()) return { ...semSupabase(), valores };

  // redirect() lança para funcionar (é assim que o Next interrompe a Action),
  // então NADA de chamá-lo dentro do try: o catch abaixo o engoliria e a
  // pessoa autenticada ficaria vendo "não foi possível" na tela.
  let falha: EstadoFormulario | null = null;

  try {
    const supabase = await obterCliente();
    const { error } = await supabase.auth.signInWithPassword({
      email: campos.email!,
      password: campos.senha!
    });
    if (error) falha = estadoDeFalha(error, 'entrar');
  } catch (erro) {
    falha = estadoDeFalha(erro, 'entrar (exceção)');
  }

  if (falha) return { ...falha, valores };

  redirect('/');
}

/**
 * RF08/RF09/RF12 — criar conta.
 *
 * NÃO redireciona no sucesso: com a confirmação de e-mail ligada, a sessão
 * ainda não existe: o próximo passo da pessoa é sair do site e abrir o
 * e-mail. Mandá-la para a home nesse instante esconderia justamente a
 * instrução de que ela precisa.
 */
export async function criarConta(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerCadastro(dados);

  // exigirPapel: false — ver OpcoesCadastro em compartilhado/validacao.ts.
  const { valido, erros } = validarCadastro(campos, { exigirPapel: false });

  // Tudo que a pessoa escreveu, menos a senha — este é o formulário longo,
  // e é aqui que perder o preenchimento dói mais.
  const valores = {
    nome: campos.nome ?? '',
    email: campos.email ?? '',
    telefone: campos.telefone ?? '',
    voluntario: campos.papeis?.includes('voluntario') ? 'on' : '',
    doador: campos.papeis?.includes('doador') ? 'on' : '',
    maioridade: campos.maioridade ? 'on' : '',
    consentimento: campos.consentimento ? 'on' : ''
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!temSupabase()) return { ...semSupabase(), valores };

  const telefone = apenasDigitos(campos.telefone);

  try {
    const supabase = await obterCliente();
    const { error } = await supabase.auth.signUp({
      email: campos.email!,
      password: campos.senha!,
      options: {
        // CHAVE POR CHAVE, nunca espalhando `campos`. É daqui que
        // public.criar_perfil() lê (raw_user_meta_data), e os nomes precisam
        // bater com o SQL da migration 001. `eh_equipe` não está aqui e não
        // pode estar: o trigger não o lê, e a regra 6 do CLAUDE.md existe
        // porque essa escalada já aconteceu neste projeto uma vez.
        data: {
          nome: campos.nome,
          telefone: telefone || null,
          // A tabela aceita 'fisica' ou 'juridica' e o formulário não
          // pergunta. Quem se cadastra pelo site é pessoa física; conta de
          // organização é assunto do Bloco B.
          tipo_pessoa: 'fisica',
          eh_voluntario: campos.papeis!.includes('voluntario'),
          eh_doador: campos.papeis!.includes('doador'),
          // A caixa é obrigatória e já foi validada acima (RN01/RF12).
          maioridade_confirmada: true
        },
        emailRedirectTo: await urlDeConfirmacao()
      }
    });

    if (error) return { ...estadoDeFalha(error, 'criarConta'), valores };

    // Sucesso NÃO devolve `valores`: aqui o formulário terminou o que
    // tinha para fazer, e o próximo passo é abrir o e-mail. Devolver o
    // preenchimento deixaria na tela um cadastro que parece por enviar.
    //
    // UMA RESPOSTA SÓ, DE PROPÓSITO. Com a confirmação de e-mail ligada, o
    // Supabase responde a um e-mail JÁ CADASTRADO com um usuário de mentira
    // (`identities: []`) em vez de erro, para não contar a estranhos quem tem
    // conta aqui. Distinguir esse caso na tela desfaria a proteção — então
    // não se distingue, e quem já tinha conta descobre pelo e-mail que
    // recebe, que é o canal que só a dona do endereço lê.
    return { ok: true, mensagem: MENSAGEM_CONTA_CRIADA };
  } catch (erro) {
    return { ...estadoDeFalha(erro, 'criarConta (exceção)'), valores };
  }
}

/**
 * RF10 — pedir o link para criar senha nova.
 *
 * A RESPOSTA É A MESMA tendo conta ou não. Se a tela dissesse "não achei esse
 * e-mail", este formulário viraria um jeito de descobrir quem tem conta no
 * site — enumeração de usuário — e as pessoas cadastradas aqui incluem
 * voluntárias e doadoras da ONG. O Supabase, por isso mesmo, também não
 * devolve erro para e-mail inexistente.
 */
export async function solicitarRecuperacao(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerRecuperacao(dados);
  const { valido, erros } = validarRecuperacao(campos);
  const valores = { email: campos.email };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  if (!temSupabase()) return { ...semSupabase(), valores };

  try {
    const supabase = await obterCliente();
    const destino = await urlDeConfirmacao();
    const { error } = await supabase.auth.resetPasswordForEmail(
      campos.email,
      destino ? { redirectTo: destino } : {}
    );

    // Falhou o envio: dizer "enviamos" seria mentira, e "esse e-mail não
    // existe" seria entregar quem tem conta. A saída é falar do envio, que é
    // o que de fato não aconteceu, sem dizer nada sobre o e-mail.
    if (error) return { ...estadoDeFalha(error, 'solicitarRecuperacao'), valores };

    return {
      ok: true,
      mensagem: 'Se existir conta com esse e-mail, enviamos um link para criar uma senha nova. '
        + 'O link vale por pouco tempo — se não chegar em alguns minutos, olhe o spam.'
    };
  } catch (erro) {
    return { ...estadoDeFalha(erro, 'solicitarRecuperacao (exceção)'), valores };
  }
}

/**
 * RF10 — gravar a senha nova, depois de chegar pelo link do e-mail.
 *
 * O CAMINHO INTEIRO, porque esta função só faz sentido no meio dele: a
 * pessoa pede o link em /recuperar-acesso (`solicitarRecuperacao`), o
 * Supabase manda um e-mail apontando para `/auth/confirm?token_hash=...&
 * type=recovery`, aquela rota chama `verifyOtp` — que É o que grava o
 * cookie de sessão — e manda para /nova-senha. Quando esta Action roda, a
 * pessoa JÁ TEM SESSÃO; é essa sessão que autoriza a troca.
 *
 * E É POR ISSO QUE A SESSÃO É CONFERIDA AQUI, e não só na página. Server
 * Action é endpoint HTTP público (spec §4.5): qualquer pessoa pode fazer
 * POST nesta função sem nunca ter aberto /nova-senha e sem ter clicado em
 * link nenhum. A página não mostrar o formulário é conveniência de tela; o
 * que impede uma troca de senha sem autorização é a linha `if (!usuario)`
 * abaixo. Removê-la não quebra tela nenhuma — quebra o site inteiro.
 *
 * O `updateUser` troca a senha de QUEM ESTÁ NA SESSÃO, sempre: não existe
 * parâmetro de "qual usuário". Não há como esta Action alterar a senha de
 * outra pessoa, mesmo com o corpo da requisição inteiro sob controle de
 * quem chama — o alvo vem do cookie verificado, nunca do FormData.
 */
export async function definirNovaSenha(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerNovaSenha(dados);
  const { valido, erros } = validarNovaSenha(campos);
  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros };

  if (!temSupabase()) return semSupabase();

  // redirect() FORA do try — mesmo motivo de `entrar` acima: ele lança para
  // funcionar, e o catch o engoliria.
  let falha: EstadoFormulario | null = null;

  try {
    // A GUARDA. usuarioAtual() pergunta ao Supabase (getUser), não confia no
    // cookie — ver servidor/sessao.ts.
    const usuario = await usuarioAtual();
    if (!usuario) return SEM_SESSAO_PARA_TROCAR_SENHA;

    const supabase = await obterCliente();
    const { error } = await supabase.auth.updateUser({ password: campos.senha! });
    if (error) falha = estadoDeFalha(error, 'definirNovaSenha');
  } catch (erro) {
    falha = estadoDeFalha(erro, 'definirNovaSenha (exceção)');
  }

  if (falha) return falha;

  // Vai para `/` e não para /entrar: a sessão continua válida depois da
  // troca — a pessoa está autenticada, mandá-la para a tela de entrar seria
  // pedir de novo a senha que ela acabou de criar. Quando a área do usuário
  // existir (RF11, Bloco B), é aqui que o destino muda.
  redirect('/');
}

/**
 * Sair. Sem estado de formulário: é um botão, não um formulário com campos.
 *
 * Vai para `/` no fim porque a página de onde se sai pode ser uma que exija
 * sessão (nenhuma exige ainda; o painel do Bloco B vai exigir), e continuar
 * nela depois de sair mostraria uma tela que já não é da pessoa.
 *
 * Erro no signOut não impede a saída: o cookie de sessão local é apagado de
 * qualquer forma pelo cliente do @supabase/ssr, e prender alguém numa sessão
 * porque o servidor de autenticação não respondeu é o pior desfecho possível
 * aqui — especialmente em celular emprestado ou compartilhado, que é o
 * cenário real da equipe (regra 4 do CLAUDE.md).
 */
export async function sair(): Promise<void> {
  if (temSupabase()) {
    try {
      const supabase = await obterCliente();
      const { error } = await supabase.auth.signOut();
      if (error) console.error('[autenticacao] sair:', error);
    } catch (erro) {
      console.error('[autenticacao] sair (exceção):', erro);
    }
  }

  redirect('/');
}
