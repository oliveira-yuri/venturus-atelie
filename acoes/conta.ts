/**
 * acoes/conta.ts — a pessoa corrige os PRÓPRIOS dados (RF11).
 *
 * ===================================================================
 * ISTO É UM ENDPOINT HTTP PÚBLICO
 * ===================================================================
 *
 * O mesmo cabeçalho de acoes/publicacoes.ts, acoes/galeria.ts e
 * acoes/atividades.ts, e vale palavra por palavra: o Next publica cada
 * função exportada de um arquivo `'use server'` numa URL (spec §4.5).
 * Qualquer pessoa chama com qualquer corpo, sem passar pelo formulário, sem
 * navegador. A guarda da PÁGINA (`app/minha-conta/page.tsx`) não protege
 * nada aqui — Action não passa por página nem por layout.
 *
 * Por isso a função abaixo pergunta quem está autenticado por conta própria,
 * com a MESMA `usuarioAtual()` que a página usa (servidor/sessao.ts). Duas
 * respostas diferentes para a mesma pergunta seriam exatamente o buraco.
 * `testes/minha-conta.test.mjs` varre este arquivo exigindo isso de toda
 * Action nova.
 *
 * ===================================================================
 * A GUARDA AQUI É `usuarioAtual()`, NÃO `ehEquipe()` — E ISSO NÃO É
 * ESQUECIMENTO
 * ===================================================================
 *
 * Toda Action do PAINEL chama `ehEquipe()`. Esta não chama, e não pode
 * chamar: a área do usuário é de QUALQUER pessoa autenticada — voluntária,
 * doadora, quem só criou conta. Exigir equipe aqui trancaria todo mundo
 * fora dos próprios dados. A varredura do teste desta tarefa cobra o
 * contrário do que a do painel cobra, de propósito, e as duas existem para
 * que ninguém "conserte" uma copiando a outra.
 *
 * ===================================================================
 * `eh_equipe` NUNCA ENTRA AQUI (regra 6 do CLAUDE.md)
 * ===================================================================
 *
 * Esta é a única tela do site em que uma pessoa comum edita uma linha de
 * `public.perfis` — a mesma tabela e a mesma LINHA onde mora `eh_equipe`. É
 * exatamente o lugar por onde uma escalada de privilégio entra, e neste
 * projeto ela já aconteceu uma vez.
 *
 * Três travas independentes, nesta ordem:
 *
 *  1. `lerMeusDados` (compartilhado/validacao.ts) conhece TRÊS nomes de
 *     campo. `eh_equipe=true` no corpo da requisição não é lido por
 *     ninguém, então não existe para o resto do sistema;
 *  2. o objeto que vai ao `update` é `colunasDoPerfil(campos)` — três
 *     chaves escritas à mão, numa função pura que
 *     `testes/minha-conta.test.mjs` alimenta com um FormData hostil e prova
 *     que não deixa nada passar. NUNCA um spread (`...campos`): um spread
 *     aqui é o que a próxima pessoa copia;
 *  3. no banco, o trigger `proteger_papel_equipe`
 *     (supabase/migrations/001_base.sql) levanta exceção se `eh_equipe`
 *     mudar vindo de `anon` ou `authenticated`. MEDIDO em 01/09/2026 contra
 *     o Supabase real, com uma sessão de verdade:
 *     `PATCH /rest/v1/perfis?id=eq.<eu> {"eh_equipe":true}` respondeu
 *     `42501 somente a equipe altera o papel de equipe`.
 *
 * A terceira é a tranca; as duas primeiras são para que ela nunca precise
 * ser acionada. O trigger é a última linha, não a primeira.
 *
 * E O `id` DA LINHA VEM DA SESSÃO, NUNCA DO FORMULÁRIO. Não existe campo
 * `id` neste formulário e não existe leitura de `id` neste arquivo: o
 * `.eq('id', usuario.id)` usa o que `usuarioAtual()` devolveu, que veio de
 * `getUser()` — token verificado no servidor de autenticação, não cookie.
 * Um `id=<outra pessoa>` no corpo não tem por onde chegar; e se chegasse, a
 * política `perfis: cada pessoa edita o proprio registro`
 * (`using (id = auth.uid())`) recusaria.
 *
 * ===================================================================
 * O NOME É GRAVADO EM DOIS LUGARES, E ESSA É A DECISÃO CENTRAL DESTA TAREFA
 * ===================================================================
 *
 * `servidor/sessao.ts` lê o nome do CABEÇALHO do metadata da conta, não da
 * tabela — e o comentário de lá previa este dia por escrito:
 *
 *   "O DIA EM QUE ISSO DEIXA DE VALER: RF11, se ela permitir trocar o nome
 *    gravando só em `perfis`. Aí o cabeçalho mostraria o nome antigo para
 *    sempre, sem erro nenhum."
 *
 * Ele oferecia duas saídas: gravar nos dois lugares, ou trocar a leitura por
 * uma consulta a `perfis`. ESTA TAREFA ESCOLHEU GRAVAR NOS DOIS, e o porquê:
 *
 *  · a leitura acontece no LAYOUT RAIZ, ou seja, em toda página de quem
 *    está autenticado. Trocá-la por uma consulta custaria uma ida ao
 *    Postgres por página — e acrescentaria um caminho de falha no layout —
 *    para desenhar uma palavra. A gravação acontece uma vez, quando alguém
 *    resolve corrigir o próprio nome;
 *  · a divergência que sobra tem um dono e um teste. Só existe UM escritor
 *    de `perfis.nome` no código (esta função), e `testes/minha-conta.test.mjs`
 *    falha se ela parar de gravar o metadata junto. No dia em que RF26
 *    (gestão de voluntários) criar um segundo escritor, é o mesmo teste que
 *    vai cobrar a decisão de novo.
 *
 * A ORDEM IMPORTA: `perfis` primeiro, metadata depois. `perfis` é o
 * registro — é dele que a equipe lê, é ele que a RLS protege, e é ele que
 * precisa estar certo se só um dos dois der certo. O metadata é uma cópia
 * para desenhar um nome na tela.
 *
 * E O DESFECHO PARCIAL NÃO É SILENCIOSO: se a segunda gravação falhar, a
 * pessoa NÃO recebe "salvo" liso — recebe `?aviso=salvo-cabecalho-velho`,
 * que diz que os dados foram gravados e que só o nome do topo continua
 * antigo. Sem isso, o defeito seria exatamente o que o comentário de
 * sessao.ts descreve: o cabeçalho errado, para sempre, sem erro nenhum.
 *
 * `updateUser({ data })` MESCLA, não substitui — MEDIDO em 01/09/2026
 * contra o Auth real: mandando só `nome`, as outras chaves
 * (`telefone`, `tipo_pessoa`, `eh_voluntario`, `maioridade_confirmada`,
 * gravadas por `criarConta`) continuaram lá. Por isso só o `nome` é
 * mandado: é a ÚNICA chave do metadata que algum código deste projeto lê
 * depois do cadastro. Sincronizar as outras seria manter atualizada uma
 * cópia que ninguém consulta — e cada chave a mais é uma chave a mais para
 * divergir.
 *
 * ===================================================================
 * TERMINA EM redirect(), E ISSO É O QUE FAZ FUNCIONAR SEM JAVASCRIPT
 * ===================================================================
 *
 * POST-redirect-GET, como as Actions do painel. Aqui há um motivo a mais,
 * específico desta tela: o nome novo aparece no CABEÇALHO, que vive em
 * `app/layout.tsx`. Devolver `EstadoFormulario` re-renderiza a rota; uma
 * navegação de verdade re-renderiza o layout junto — que é o que faz a
 * pessoa ver o nome novo no topo no mesmo gesto em que o salvou. O porquê
 * completo está em compartilhado/avisos-da-conta.ts.
 *
 * `redirect()` sinaliza POR EXCEÇÃO e fica FORA de todo `try` — um catch em
 * volta o transformaria em "não foi possível gravar" logo depois de uma
 * gravação bem-sucedida.
 */
'use server';

import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { obterCliente } from '@/servidor/supabase';
import { temSupabase, descrever } from '@/servidor/dados/degradacao';
import { usuarioAtual } from '@/servidor/sessao';
import { lerMeusDados, validarMeusDados, colunasDoPerfil } from '@/compartilhado/validacao';
import type { EstadoFormulario } from './autenticacao';

/** A tela para onde tudo volta. */
const MINHA_CONTA = '/minha-conta';

/** Mensagem única de "o formulário voltou com campo errado" — a das outras Actions. */
const CONFIRA_OS_CAMPOS = 'Confira o que está marcado abaixo e envie de novo.';

/**
 * A recusa de quem não tem (ou não tem mais) sessão.
 *
 * NÃO É `redirect('/entrar')`, ao contrário do que a PÁGINA faz, e a
 * diferença é o caso real: quem chega aqui é alguém que abriu a tela, ficou
 * um tempo corrigindo o telefone e teve a sessão vencida no meio. Mandar
 * para /entrar nesse instante apagaria o que foi digitado. A recusa devolve
 * `valores`, ou seja, o formulário volta preenchido: a pessoa entra em outra
 * aba, volta e envia de novo.
 *
 * É a mesma decisão que acoes/publicacoes.ts e acoes/atividades.ts tomam
 * para o formulário de texto delas, pelo mesmo motivo.
 */
const SEM_SESSAO = 'Sua sessão não vale mais. Entre de novo em outra aba e envie outra vez — '
  + 'o que você escreveu continua nesta tela.';

/**
 * Sem projeto Supabase configurado não há onde gravar. Acontece de verdade
 * na suíte offline (`npm test`) e num deploy sem as variáveis no painel da
 * Netlify (CLAUDE.md, "O que trava hoje", item 0e).
 *
 * Na prática ninguém vê esta mensagem, porque sem Supabase `usuarioAtual()`
 * já devolveu `null` e a recusa acima veio antes — ela existe para o caso de
 * a ordem mudar, e para o log, que é onde a causa aparece.
 */
function semSupabase(): string {
  console.error('[conta] SUPABASE_URL/SUPABASE_CHAVE_PUBLICAVEL não estão no ambiente: '
    + 'nenhum dado de perfil pode ser gravado.');
  return 'O banco de dados não está configurado neste endereço, então não dá para gravar agora.';
}

/**
 * A mensagem de falha de gravação. Genérica na tela, detalhada no log — a
 * regra 2 de acoes/autenticacao.ts: erro do Supabase nunca vai cru para
 * quem está usando.
 */
function naoDeuParaGravar(): string {
  return 'Não deu para gravar agora. Tente de novo em alguns instantes — o que você escreveu '
    + 'continua nesta tela e nada se perdeu.';
}

/**
 * RF11 — grava nome, telefone e tipo de pessoa da PRÓPRIA pessoa.
 *
 * Forma `(anterior, dados) => EstadoFormulario`: o que `useActionState` do
 * React 19 espera. O estado anterior não é usado — está na assinatura porque
 * o React o passa.
 */
export async function salvarMeusDados(
  _anterior: EstadoFormulario,
  dados: FormData
): Promise<EstadoFormulario> {
  const campos = lerMeusDados(dados);
  const { valido, erros } = validarMeusDados(campos);

  // TUDO o que a pessoa escreveu volta em toda recusa. Sem isto, um erro de
  // telefone devolve o formulário em branco — defeito medido na Tarefa 3 da
  // autenticação (ver `valores` em EstadoFormulario). CAMPO A CAMPO, e não
  // `{ ...campos }`, mesmo sendo só a volta para a tela: um spread aqui é um
  // spread que a próxima pessoa copia para o objeto de baixo, o que vai ao
  // banco. A regra 6 do CLAUDE.md só se sustenta enquanto não houver, neste
  // arquivo, um exemplo de como espalhar o que veio da requisição.
  const valores = {
    nome: campos.nome,
    telefone: campos.telefone,
    tipo_pessoa: campos.tipo_pessoa
  };

  if (!valido) return { ok: false, mensagem: CONFIRA_OS_CAMPOS, erros, valores };

  // A GUARDA. `usuarioAtual()` pergunta ao Supabase (`getUser()`), não
  // confia no cookie — ver servidor/sessao.ts. É a MESMA função que a página
  // usa.
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, mensagem: SEM_SESSAO, valores };

  if (!temSupabase()) return { ok: false, mensagem: semSupabase(), valores };

  // Três chaves, montadas numa função pura e testada. Ver o cabeçalho.
  const linha = colunasDoPerfil(campos);

  let falha: EstadoFormulario | null = null;
  let cabecalhoAtualizado = false;

  try {
    const supabase = await obterCliente();

    // `.select('id')` AQUI É DIFERENTE do caso de `inscricoes`/`contatos`,
    // onde pedir a linha de volta faz a escrita PARECER que falhou porque a
    // leitura é negada (CLAUDE.md, arquitetura). Em `perfis` a pessoa lê o
    // próprio registro (`using (id = auth.uid() or eh_equipe())`), então o
    // retorno volta — e é a única forma de saber se o `update` acertou
    // alguma linha: um update que não casa nenhuma é SUCESSO no PostgREST,
    // com zero linhas. Sem isto, uma conta sem linha em `perfis` (existe:
    // conta criada à mão no painel do Supabase antes de o trigger
    // `criar_perfil()` rodar) responderia "atualizado" sem ter gravado nada.
    const { data, error } = await supabase
      .from('perfis')
      .update(linha)
      .eq('id', usuario.id)
      .select('id');

    if (error) {
      console.error('[conta] salvar perfil:', descrever(error));
      falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
    } else if (!Array.isArray(data) || data.length === 0) {
      falha = {
        ok: false,
        valores,
        mensagem: 'Não encontramos seu cadastro para atualizar. O que você escreveu continua '
          + 'nesta tela. Fale com a gente pelo WhatsApp (11) 95396-8344 ou pelo e-mail '
          + 'atelieafro@gmail.com.'
      };
    } else {
      // A SEGUNDA GRAVAÇÃO — ver o cabeçalho. Só o `nome`, e só depois de a
      // primeira ter dado certo: sincronizar uma cópia com um valor que não
      // entrou no registro seria pior que não sincronizar.
      const { error: erroDoMetadata } = await supabase.auth.updateUser({
        data: { nome: campos.nome }
      });

      if (erroDoMetadata) {
        console.error('[conta] o nome foi gravado em public.perfis mas NÃO no metadata da '
          + 'conta, que é de onde servidor/sessao.ts lê o nome do cabeçalho: '
          + `${descrever(erroDoMetadata)}. As duas fontes ficaram divergentes até a próxima `
          + 'entrada.');
      } else {
        cabecalhoAtualizado = true;
      }
    }
  } catch (erro) {
    console.error('[conta] salvar perfil (exceção):', descrever(erro));
    falha = { ok: false, mensagem: naoDeuParaGravar(), valores };
  }

  if (falha) return falha;

  // O layout raiz desenha o nome do cabeçalho em TODA rota, então o que
  // envelheceu não é uma página: é o cache do roteador inteiro de quem está
  // autenticado. Sem isto, a pessoa salvaria o nome, voltaria para a home
  // pelo menu e veria o nome antigo lá.
  revalidatePath('/', 'layout');

  // FORA do try — ver o cabeçalho.
  redirect(`${MINHA_CONTA}?aviso=${cabecalhoAtualizado ? 'salvo' : 'salvo-cabecalho-velho'}`);
}
