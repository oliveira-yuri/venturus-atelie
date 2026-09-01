import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioAtual } from '@/servidor/sessao';
import {
  buscarMeuPerfil, listarMinhasCandidaturas, listarMinhasDoacoes
} from '@/servidor/dados/conta';
import { avisoDaConta } from '@/compartilhado/avisos-da-conta';
import { candidaturaEmAndamento } from '@/compartilhado/candidatura';
import { FichaDaConta, MinhasCandidaturas, MinhasDoacoes } from '@/componentes/MinhaConta';
import FormularioMeusDados from '@/componentes/FormularioMeusDados';

/**
 * `/minha-conta` — a área do usuário (RF11): "consulta e edição dos próprios
 * dados, das próprias candidaturas e do próprio histórico de doações".
 *
 * ===================================================================
 * A GUARDA AQUI É UM REDIRECT, E A DO PAINEL É UM 404. NÃO É INCONSISTÊNCIA.
 * ===================================================================
 *
 * Quem ler as duas telas lado a lado vai achar que uma delas está errada.
 * Estão as duas certas, e a diferença é o que cada uma protege:
 *
 *  · `/admin` responde 404 para quem não é equipe porque a EXISTÊNCIA do
 *    painel é o que se recusa a contar. Dizer "você não tem permissão"
 *    informaria a qualquer pessoa que há um painel ali e que existe uma
 *    lista de quem entra nele (app/admin/layout.tsx);
 *  · `/minha-conta` não é segredo de ninguém. Que este site tenha área de
 *    conta está escrito em /entrar, no cabeçalho e no rodapé. O que ela
 *    exige é apenas estar autenticado — e a resposta certa para quem não
 *    está não é "isto não existe", é a tela de entrar. Um 404 aqui seria
 *    esconder de quem tem conta o caminho para a própria conta, e a pessoa
 *    concluiria que o site quebrou.
 *
 * Ou seja: 404 esconde a existência; redirect resolve a ausência de sessão.
 * As duas telas escolheram o que cabe a elas.
 *
 * SEM `?destino=`: o redirect vai para `/entrar` seco, e depois de entrar a
 * pessoa cai em `/` (é o que `entrar` faz, em acoes/autenticacao.ts). O
 * caminho de volta é o próprio cabeçalho, onde o nome de quem entrou virou
 * link para cá. Um parâmetro de destino seria um endereço vindo da URL
 * decidindo para onde o site manda alguém depois de autenticar — redirect
 * aberto —, e fechá-lo direito (só caminho interno, nunca `//host`) é código
 * novo para economizar um toque.
 *
 * ===================================================================
 * A GUARDA FICA NO CORPO DA PÁGINA **E** NO `generateMetadata`
 * ===================================================================
 *
 * É o achado da Tarefa P1 do painel, e ele NÃO é sobre `/admin`: vale para
 * qualquer rota protegida. MEDIDO lá — com a guarda só no layout, a página
 * filha renderiza do mesmo jeito e o conteúdo dela vai na resposta, atrás do
 * status; e um `export const metadata` com título vaza o título pelo mesmo
 * caminho, porque o Next resolve metadata fora da renderização do
 * componente.
 *
 * Aqui não há layout próprio para deixar a guarda — mais um motivo para ela
 * estar nos dois lugares. O que vazaria desta tela é nome, e-mail, telefone
 * e histórico de doação de uma pessoa.
 *
 * `redirect()` fica FORA de qualquer `try`: ele sinaliza por exceção, e um
 * catch em volta o transformaria em erro de dados — a mesma advertência que
 * acoes/autenticacao.ts carrega.
 *
 * ===================================================================
 * A GUARDA NÃO AUTORIZA NADA
 * ===================================================================
 *
 * Ela decide o que DESENHAR. Quem decide o que pode ser lido e gravado é a
 * RLS: `perfis: cada pessoa le o proprio registro`,
 * `voluntarios: a pessoa le a propria candidatura`,
 * `doacoes: o doador le as proprias` (migrations 001 e 004). O cliente deste
 * projeto usa a sessão de quem pediu e não existe chave de serviço no
 * repositório (spec §4.1) — mesmo que este `if` fosse contornado, o Postgres
 * devolveria só o que a política permite. E as consultas de
 * servidor/dados/conta.ts ainda filtram por `perfil_id` à mão, por um motivo
 * que está escrito lá e não é redundância.
 */

/**
 * O TÍTULO NÃO LEVA O NOME DE NINGUÉM, e isso é decisão.
 *
 * `generateMetadata` (e não `export const metadata`) porque a guarda precisa
 * rodar aqui também — ver acima. Mas o título é fixo: um "Conta de Fulana"
 * apareceria na aba do navegador, no histórico e em qualquer print da tela,
 * que é o cenário do celular compartilhado (regra 4 do CLAUDE.md).
 */
export async function generateMetadata() {
  if (!await usuarioAtual()) redirect('/entrar');

  return {
    title: 'Sua conta — Ateliê Afro Cultural',
    description: 'Seus dados, suas candidaturas ao voluntariado e suas doações registradas.',
    // Mesma marca do painel (app/admin/layout.tsx): área de conta não é
    // conteúdo público. NÃO confundir com o `noindex` de PRÉVIA que sai no
    // lançamento em três lugares (CLAUDE.md, item 0c) — este não sai nunca,
    // e `/minha-conta` também entra em FORA_DO_BUSCADOR, em app/robots.ts.
    robots: { index: false, follow: false }
  };
}

/** Canais reais da ONG — os mesmos de /doar, /contato e acoes/autenticacao.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

export default async function MinhaConta(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/entrar');

  // O ID VEM DAQUI, da sessão verificada — nunca de `searchParams`. As três
  // consultas o recebem como argumento; ver o cabeçalho de
  // servidor/dados/conta.ts.
  const { valor: perfil, degradou: perfilDegradou } = await buscarMeuPerfil(usuario.id);
  const { valor: candidaturas, degradou: candidaturasDegradaram } =
    await listarMinhasCandidaturas(usuario.id);
  const { valor: doacoes, degradou: doacoesDegradaram } = await listarMinhasDoacoes(usuario.id);

  // O resultado da última Action chega pela URL (a Action termina em
  // redirect, que é o que a faz funcionar sem JavaScript, e um redirect não
  // carrega estado). `?aviso=` é escrito por quem quiser, então passa por
  // LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDaConta((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo">
      <h1>Sua conta</h1>

      {/*
        O AVISO DA URL NÃO É DESENHADO AQUI, e isso foi defeito visto abrindo
        a tela (regra 10 do CLAUDE.md). A primeira versão tinha uma caixa
        nesta posição, e o formulário tinha a dele: depois de salvar (a URL
        fica com `?aviso=salvo`), um envio inválido em seguida deixava as
        duas na tela ao mesmo tempo — "Seus dados foram atualizados" logo
        acima de "Confira o que está marcado abaixo".

        A página é Server Component e não enxerga o estado do formulário,
        então quem decide qual das duas mensagens vale é o próprio
        formulário: `aviso` desce para ele como prop. Ver o comentário de
        componentes/FormularioMeusDados.tsx.
      */}

      <p className="destaque">
        Aqui ficam os seus dados, as suas candidaturas ao voluntariado e as doações registradas
        no seu nome. Só você e a equipe do Ateliê enxergam esta página.
      </p>

      <section aria-labelledby="titulo-meus-dados">
        <h2 id="titulo-meus-dados">Meus dados</h2>

        {/*
          TRÊS DESFECHOS, e o do meio é o que costuma faltar: o perfil
          carregou, o banco não respondeu, ou a conta não tem linha em
          `public.perfis`. O terceiro acontece de verdade — conta criada à
          mão no painel do Supabase antes de o trigger `criar_perfil()`
          rodar. Tratar os dois últimos como o mesmo "erro" mandaria a
          pessoa tentar de novo para sempre num caso que só a ONG resolve.
        */}
        {perfil
          ? (
            <>
              {/*
                O FORMULÁRIO VEM ANTES DA FICHA, e a ordem é consequência da
                caixa de aviso ter descido para dentro dele (ver acima): com
                a ficha na frente, a mensagem de "seus dados foram
                atualizados" nascia uma tela de rolagem abaixo do topo, num
                celular (regra 4). E lê bem assim: primeiro o que se muda,
                depois o que a ONG tem registrado e esta tela não muda —
                inclusive o e-mail, que a seção seguinte explica por que
                fica de fora.
              */}
              <FormularioMeusDados perfil={perfil} avisoDaUrl={aviso} />
              <FichaDaConta perfil={perfil} />
            </>
          )
          : perfilDegradou
            ? (
              <p className="estado estado--erro">
                Não deu para carregar seus dados agora — o banco de dados não respondeu. Nada foi
                perdido: atualize a página em alguns instantes.
              </p>
            )
            : (
              <p className="estado estado--erro">
                Sua conta existe, mas não encontramos o cadastro ligado a ela. Fale com a gente
                pelo WhatsApp {WHATSAPP} ou pelo e-mail {EMAIL_ATELIE} para arrumarmos isso.
              </p>
            )}
      </section>

      <section aria-labelledby="titulo-senha-email">
        <h2 id="titulo-senha-email">Senha e e-mail</h2>

        {/*
          A SENHA SE TROCA EM /nova-senha, e isso não é um atalho: aquela
          página mostra o formulário para quem TEM SESSÃO, e `definirNovaSenha`
          confere a sessão de novo antes de gravar (acoes/autenticacao.ts).
          Quem está aqui tem sessão — a mesma que o link do e-mail produziria.
          Não há código novo, não há um segundo caminho de troca de senha para
          divergir do primeiro.

          O QUE ISSO NÃO FAZ, e está no relatório desta tarefa como
          preocupação: pedir a senha atual antes de trocar. Quem pegar um
          celular com a sessão aberta troca a senha sem saber a antiga — e
          isso já era verdade antes desta tela existir (bastava digitar
          /nova-senha na barra). O link não cria o risco; torna-o visível.
        */}
        <p>
          Você já está identificado, então não precisa esperar nenhum e-mail para trocar a senha.
        </p>

        {/*
          `.botao`, e não um link no meio do parágrafo: isto é uma AÇÃO, e
          alvo de ação precisa de 44px de altura (RNF08, regra 4 do
          CLAUDE.md). MEDIDO no Firefox: como link em linha corrida ele saía
          com 20px de altura — o mesmo tamanho de uma palavra de texto.
          `.botao` já traz `min-height: var(--alvo-toque)`, e é a mesma caixa
          que /doar usa para "Falar pelo WhatsApp".
        */}
        <p>
          <Link className="botao botao--secundario" href="/nova-senha">Trocar minha senha</Link>
        </p>

        {/*
          O E-MAIL FICA DE FORA, e a tela diz por quê. Trocar de e-mail dispara
          uma confirmação enviada para o endereço novo, e o envio do projeto
          hoje é o nativo do Supabase, com cota baixíssima (CLAUDE.md, "O que
          trava hoje", item 1). Uma troca que fica pela metade tranca a pessoa
          fora da conta. Sem prometer prazo: o texto oferece os canais reais
          da ONG, que é o que resolve hoje.
        */}
        <p>
          Trocar o e-mail ainda não dá para fazer por aqui: seria preciso confirmar o endereço
          novo por e-mail, e esse envio ainda não é confiável no site. Se o seu e-mail mudou,
          fale com a gente pelo WhatsApp {WHATSAPP} ou pelo e-mail {EMAIL_ATELIE}.
        </p>
      </section>

      <section aria-labelledby="titulo-candidaturas">
        <h2 id="titulo-candidaturas">Minhas candidaturas ao voluntariado</h2>

        <MinhasCandidaturas
          candidaturas={candidaturas}
          degradou={candidaturasDegradaram}
        />

        {/*
          O BOTÃO SÓ APARECE PARA QUEM NÃO TEM CANDIDATURA EM ANDAMENTO, e é
          a mesma regra que a tela de candidatura e a Server Action aplicam
          (compartilhado/candidatura.ts). Oferecer "Candidatar-se" a quem já
          se candidatou seria oferecer um gesto que o servidor recusa — e,
          pior, uma linha repetida que só a equipe do Ateliê consegue
          apagar (não há política de delete para a própria pessoa em
          `public.voluntarios`).

          `.botao`, e não um link em linha corrida: isto é uma AÇÃO, e alvo
          de ação precisa de 44px de altura (RNF08, regra 4 do CLAUDE.md) —
          a mesma medição que motivou o "Trocar minha senha" acima.
        */}
        {candidaturaEmAndamento(candidaturas)
          ? (
            <p>
              As áreas em que o Ateliê precisa de gente estão na{' '}
              <Link href="/voluntariado">página de voluntariado</Link>.
            </p>
          )
          : (
            <p className="abertura__acoes">
              <Link className="botao" href="/voluntariado/candidatura">
                Candidatar-se ao voluntariado
              </Link>
            </p>
          )}
      </section>

      <section aria-labelledby="titulo-doacoes">
        <h2 id="titulo-doacoes">Minhas doações</h2>

        <MinhasDoacoes doacoes={doacoes} degradou={doacoesDegradaram} />

        {/*
          O BOTÃO APARECE SEMPRE, ao contrário do de candidatar-se logo
          acima — e a assimetria é decisão, não descuido.

          Lá o botão some para quem já tem candidatura em andamento, porque
          candidatar-se duas vezes é oferecer um gesto que o servidor recusa
          (e uma linha repetida que só a equipe consegue apagar). Aqui doar
          duas vezes são DUAS doações, as duas legítimas: quem doou livros em
          março e um tambor em agosto fez duas coisas. Esconder o botão de
          quem já doou seria esconder o caminho justamente de quem mais
          apoia a ONG. O argumento inteiro está em acoes/doacoes.ts.

          `.botao`, e não um link em linha corrida: isto é uma AÇÃO, e alvo
          de ação precisa de 44px de altura (RNF08, regra 4 do CLAUDE.md) —
          a mesma medição que motivou o "Trocar minha senha" acima.
        */}
        <p className="abertura__acoes">
          <Link className="botao" href="/doar/ofertar">Oferecer uma doação</Link>
        </p>

        <p>
          As formas de doar estão na <Link href="/doar">página de doações</Link>.
        </p>
      </section>

      {/*
        NÃO HÁ SEÇÃO DE INSCRIÇÕES EM EVENTOS, e a ausência é deliberada: a
        tabela `public.inscricoes` não tem política de leitura para a própria
        pessoa NEM coluna que ligue uma inscrição a uma conta (decisão D4:
        inscrição sem conta). Um bloco ali diria "você não tem inscrição"
        para quem tem três. O motivo inteiro, com a medição, está no fim de
        servidor/dados/conta.ts.

        E o RF11 também não pede: ele fala de dados, candidaturas e doações.
      */}
    </main>
  );
}
