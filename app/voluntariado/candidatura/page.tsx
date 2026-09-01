import Link from 'next/link';
import { usuarioAtual } from '@/servidor/sessao';
import { listarAreasComEstado } from '@/servidor/dados/voluntariado';
import { listarMinhasCandidaturas } from '@/servidor/dados/conta';
import { candidaturaEmAndamento } from '@/compartilhado/candidatura';
import { SITUACAO_DA_CANDIDATURA, dataPorExtenso } from '@/componentes/MinhaConta';
import FormularioCandidatura from '@/componentes/FormularioCandidatura';

/**
 * `/voluntariado/candidatura` — o gesto que /voluntariado promete: RF25.
 *
 * ===================================================================
 * É UMA ROTA PRÓPRIA, E NÃO UMA SEÇÃO DENTRO DE /voluntariado
 * ===================================================================
 *
 * As duas formas foram consideradas. O que decidiu:
 *
 *  · /voluntariado já é uma página longa no celular — abertura, cinco
 *    cartões de área, "Como funciona". Um formulário no fim seria a quarta
 *    tela de rolagem (regra 4 do CLAUDE.md);
 *  · o link "Quero me candidatar" daquela página apontava para /entrar, o
 *    que é honesto mas seco: quem já tem conta era mandado para uma tela de
 *    login sem saber por quê. Agora ele aponta para cá, e é ESTA página que
 *    explica a exigência de conta — para quem tem e para quem não tem;
 *  · testes/paridade-texto.test.mjs compara o texto do <main> de
 *    /voluntariado com o do HTML original congelado. Uma seção nova ali
 *    exigiria mais uma exclusão naquele arquivo; uma rota nova não exige
 *    nenhuma, e o texto migrado continua comparado palavra por palavra.
 *    (O link mudou de destino, não de texto.)
 *
 * ===================================================================
 * A PÁGINA É PÚBLICA E NÃO REDIRECIONA — AO CONTRÁRIO DE /minha-conta
 * ===================================================================
 *
 * `/minha-conta` manda quem não tem sessão para /entrar, porque lá não há
 * nada a dizer sem sessão: a tela É os dados da pessoa. Aqui há, e é o
 * principal: POR QUE candidatar-se exige conta. Quem cair aqui vindo de
 * /voluntariado sem estar autenticado precisa ler isso, não ser
 * teleportado para um formulário de login que não explica nada — e um
 * redirect faria exatamente isso.
 *
 * Como consequência, esta rota entra em PAGINAS_PRONTAS_FORA_DO_MENU
 * (testes/apoio/rotas-migracao.mjs), ao lado de /recuperar-acesso: página
 * pública de verdade, com <main> e conteúdo próprio, que só não é item de
 * menu porque se chega nela por um botão de outra página.
 *
 * ===================================================================
 * TRÊS DESFECHOS, E O DO MEIO É O QUE COSTUMA FALTAR
 * ===================================================================
 *
 *  1. sem sessão → a explicação e o caminho para criar conta ou entrar;
 *  2. com sessão E com candidatura em andamento → a candidatura que já
 *     existe, com situação e data. NÃO o formulário: candidatar-se não tem
 *     desfazer (não há política de delete para a própria pessoa em
 *     `public.voluntarios` — MEDIDO), então oferecer um segundo envio é
 *     oferecer uma linha repetida que só a equipe consegue limpar;
 *  3. com sessão e sem candidatura → o formulário.
 *
 * A REGRA DO CASO 2 É A MESMA QUE A SERVER ACTION APLICA
 * (compartilhado/candidatura.ts). Esta tela não é a guarda — Action é
 * endpoint HTTP público e não passa por página nenhuma —, mas as duas
 * precisam responder igual, senão a tela esconde um formulário que o
 * servidor aceitaria, ou oferece um que ele recusa.
 */

export const metadata = {
  title: 'Candidatar-se ao voluntariado — Ateliê Afro Cultural',
  description: 'Escolha as áreas em que você quer ajudar no Ateliê Afro Cultural e envie sua candidatura.'
};

/** Canais reais da ONG — os mesmos de /doar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

export default async function Candidatura() {
  const usuario = await usuarioAtual();

  // AS ÁREAS SÃO LIDAS SEMPRE, inclusive para quem não tem sessão: elas são
  // conteúdo público (RF24) e é o que dá substância à explicação de quem
  // ainda não entrou — dizer "escolha suas áreas" sem mostrar quais seria
  // pedir um voto de confiança. A bandeira de degradação vem junto porque
  // um formulário SEM caixa nenhuma não é um formulário: é um botão que
  // sempre recusa.
  const { valor: areas, degradou } = await listarAreasComEstado();

  // Só para quem está autenticado: a consulta é da própria pessoa e a RLS
  // devolveria vazio de qualquer forma, mas perguntar por quem não tem
  // sessão seria uma ida ao banco por visita anônima, para desenhar nada.
  const minhas = usuario ? await listarMinhasCandidaturas(usuario.id) : null;
  const emAndamento = minhas ? candidaturaEmAndamento(minhas.valor) : null;

  return (
    <main id="conteudo" className="conteudo">
      <h1>Candidatar-se ao voluntariado</h1>

      <p className="destaque">
        Voluntariar aqui é somar com a gente na criação, na reflexão e na valorização da cultura
        e memória afro brasileira. Escolha as áreas em que você quer ajudar e conte um pouco de
        você — a gente lê e entra em contato para conversar.
      </p>

      {usuario ? null : (
        <section aria-labelledby="titulo-precisa-de-conta">
          <h2 id="titulo-precisa-de-conta">Para se candidatar é preciso ter uma conta</h2>

          {/*
            A explicação é curta e diz o que a conta RESOLVE, não o que ela
            exige. Duas coisas verdadeiras e verificáveis nesta mesma tela:
            a candidatura fica ligada a você (é o que /minha-conta mostra) e
            a ONG sabe com quem está falando. Nada de "por motivos de
            segurança", que não explica nada.
          */}
          <p>
            É pela conta que a sua candidatura fica ligada a você: você acompanha a situação dela
            em “Sua conta”, e a gente sabe com quem está falando quando entrar em contato.
          </p>
          <p>
            Para criar conta é preciso ter 18 anos ou mais. Crianças e adolescentes participam das
            atividades por inscrição feita por um responsável.
          </p>

          <p className="abertura__acoes">
            <Link className="botao" href="/entrar">Criar conta ou entrar</Link>{' '}
            <Link className="botao botao--secundario" href="/voluntariado">Ver as áreas</Link>
          </p>

          <p>
            Se preferir não criar conta, fale com a gente pelo WhatsApp {WHATSAPP} ou pelo e-mail{' '}
            {EMAIL_ATELIE} — a gente conversa por ali do mesmo jeito.
          </p>
        </section>
      )}

      {usuario && emAndamento ? (
        <section aria-labelledby="titulo-ja-candidatado">
          <h2 id="titulo-ja-candidatado">Você já se candidatou</h2>

          {/*
            A situação e a data vêm dos MESMOS lugares que a área do usuário
            usa (componentes/MinhaConta.ts), e não de um segundo vocabulário
            escrito aqui: duas listas de palavras para as mesmas quatro
            situações divergiriam na primeira vez que alguém melhorasse uma
            frase.
          */}
          <p className="estado">
            {SITUACAO_DA_CANDIDATURA[emAndamento.situacao] ?? emAndamento.situacao}
            {' — enviada em '}
            <time dateTime={emAndamento.criado_em}>
              {dataPorExtenso(emAndamento.criado_em)}
            </time>
            .
          </p>

          <p>
            Não precisa mandar de novo. Se quiser mudar as áreas ou desistir, chame no WhatsApp{' '}
            {WHATSAPP}: a candidatura só a equipe do Ateliê consegue alterar.
          </p>

          <p className="abertura__acoes">
            <Link className="botao" href="/minha-conta">Ver na minha conta</Link>
          </p>
        </section>
      ) : null}

      {usuario && !emAndamento ? (
        <section aria-labelledby="titulo-formulario">
          <h2 id="titulo-formulario">Sua candidatura</h2>

          {areas.length > 0
            ? <FormularioCandidatura areas={areas} />
            : (
              /*
                SEM ÁREAS NÃO HÁ FORMULÁRIO, e os dois motivos possíveis
                recebem frases diferentes — a distinção que
                servidor/dados/degradacao.ts diz que a tela normalmente não
                consegue fazer, e que aqui ela consegue porque a consulta
                devolve a bandeira. Desenhar um <form> sem nenhuma caixa
                seria oferecer um botão que sempre recusa.
              */
              <p className="estado estado--erro">
                {degradou
                  ? 'Não deu para carregar as áreas agora — o banco de dados não respondeu. '
                    + 'Atualize a página em alguns instantes; nada foi perdido.'
                  : 'As áreas de atuação ainda estão sendo organizadas. Fale com a gente pelo '
                    + `WhatsApp ${WHATSAPP} ou pelo e-mail ${EMAIL_ATELIE} que explicamos `
                    + 'pessoalmente.'}
              </p>
            )}
        </section>
      ) : null}

      <section aria-labelledby="titulo-o-que-acontece">
        <h2 id="titulo-o-que-acontece">O que acontece depois</h2>
        {/*
          As mesmas três etapas de /voluntariado ("Como funciona"), escritas
          do ponto de vista de quem acabou de enviar. Não promete prazo:
          ninguém prometeu (regra 2 do CLAUDE.md), e a tela de gestão de
          voluntários (RF26) ainda não existe.
        */}
        <ol className="lista-simples">
          <li>A candidatura fica registrada com o Ateliê e aparece em “Sua conta”</li>
          <li>A gente lê e entra em contato para conversar</li>
          <li>Combinamos juntos o que faz sentido para você e para o ateliê</li>
        </ol>
      </section>
    </main>
  );
}
