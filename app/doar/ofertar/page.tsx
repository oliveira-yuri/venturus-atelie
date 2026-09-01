import Link from 'next/link';
import { usuarioAtual } from '@/servidor/sessao';
import FormularioOferta from '@/componentes/FormularioOferta';

/**
 * `/doar/ofertar` — o gesto que /doar promete: RF19.
 *
 * ===================================================================
 * É UMA ROTA PRÓPRIA, E NÃO UMA SEÇÃO DENTRO DE /doar
 * ===================================================================
 *
 * As duas formas foram consideradas, e a decisão é a mesma de
 * `/voluntariado/candidatura` (RF25), pelos mesmos três motivos:
 *
 *  · /doar já é uma página longa no celular — abertura, "O que recebemos",
 *    "Como doar", "Doação em dinheiro", "Uma palavra sobre transparência".
 *    Um formulário no fim seria a quinta tela de rolagem (regra 4 do
 *    CLAUDE.md);
 *  · quem chega aqui precisa saber POR QUE ofertar exige conta, e essa
 *    explicação não cabe dentro de uma seção sobre o que a ONG recebe;
 *  · testes/paridade-texto.test.mjs compara o texto do <main> de /doar com
 *    o do HTML original congelado. Uma rota nova não mexe naquela
 *    comparação; o que mexe é o botão que leva até aqui — uma seção NOVA em
 *    /doar, declarada em `idsAcrescentados` (o mesmo mecanismo que o
 *    formulário de contato do RF07 usou), com o resto do <main> continuando
 *    comparado palavra por palavra.
 *
 * ===================================================================
 * A PÁGINA É PÚBLICA E NÃO REDIRECIONA — AO CONTRÁRIO DE /minha-conta
 * ===================================================================
 *
 * `/minha-conta` manda quem não tem sessão para /entrar, porque lá não há
 * nada a dizer sem sessão: a tela É os dados da pessoa. Aqui há, e é o
 * principal: por que ofertar exige conta, e o que fazer se você não quiser
 * criar uma. Quem cair aqui vindo de /doar sem estar autenticado precisa
 * ler isso, não ser teleportado para um formulário de login que não explica
 * nada.
 *
 * Como consequência, esta rota entra em PAGINAS_PRONTAS_FORA_DO_MENU
 * (testes/apoio/rotas-migracao.mjs), ao lado de /voluntariado/candidatura e
 * /recuperar-acesso: página pública de verdade, com <main> e conteúdo
 * próprio, que só não é item de menu porque se chega nela por um botão de
 * outra página.
 *
 * ===================================================================
 * DOIS DESFECHOS, E NÃO TRÊS
 * ===================================================================
 *
 * `/voluntariado/candidatura` tem três: sem sessão, com candidatura em
 * andamento, e o formulário. Aqui o do meio NÃO EXISTE, de propósito —
 * doar duas vezes são duas doações, as duas legítimas (quem doou livros em
 * março e um tambor em agosto fez duas coisas). Uma trava de duplicidade
 * recusaria a segunda doação de quem mais apoia a ONG. O argumento inteiro,
 * e o que sobra contra o envio acidental em dobro, está no comentário de
 * `ofertar`, em acoes/doacoes.ts.
 *
 * O QUE ESTA PÁGINA NÃO FAZ: cobrar, receber pagamento, mostrar chave Pix
 * ou prometer recibo. RN08, e a /doar já diz em texto ("Este site não
 * processa pagamentos"). A chave Pix da ONG não existe — decisão D7,
 * pendente com o grupo — e nada aqui a inventa.
 */

export const metadata = {
  title: 'Oferecer uma doação — Ateliê Afro Cultural',
  description: 'Conte ao Ateliê Afro Cultural o que você quer doar. A gente responde dizendo se conseguimos receber.'
};

/** Canais reais da ONG — os mesmos de /doar, /contato e compartilhado/erros.ts. */
const WHATSAPP = '(11) 95396-8344';
const EMAIL_ATELIE = 'atelieafro@gmail.com';

export default async function Ofertar() {
  const usuario = await usuarioAtual();

  return (
    <main id="conteudo" className="conteudo">
      <h1>Oferecer uma doação</h1>

      {/*
        O TEXTO É O DA /doar, porque é o que a ONG já diz e é verdade:
        "Conte para a gente o que você pretende doar. Respondemos dizendo se
        conseguimos receber e combinamos juntos a entrega". Nada foi
        inventado aqui (regra 2 do CLAUDE.md) — o que muda é que agora esse
        "conte para a gente" tem um lugar no site, além do WhatsApp.
      */}
      <p className="destaque">
        Conte o que você pretende doar. A gente responde dizendo se conseguimos receber e
        combina com você a entrega — se você traz até a sede na Casa Verde, se buscamos, ou se
        encontramos um meio-termo.
      </p>

      {usuario ? null : (
        <section aria-labelledby="titulo-precisa-de-conta">
          <h2 id="titulo-precisa-de-conta">Para oferecer por aqui é preciso ter uma conta</h2>

          {/*
            A explicação diz o que a conta RESOLVE, não o que ela exige —
            mesma disciplina de /voluntariado/candidatura. E as duas coisas
            são verificáveis nesta mesma tela: a doação fica ligada a você
            (é o que /minha-conta mostra) e a ONG sabe com quem está
            falando quando responder. Nada de "por motivos de segurança".
          */}
          <p>
            É pela conta que a sua oferta fica ligada a você: você acompanha em “Sua conta” se a
            gente conseguiu receber, com a resposta escrita — e a gente sabe com quem está
            falando quando entrar em contato.
          </p>

          <p className="abertura__acoes">
            <Link className="botao" href="/entrar">Criar conta ou entrar</Link>{' '}
            <Link className="botao botao--secundario" href="/doar">Voltar para “Apoiar”</Link>
          </p>

          {/*
            O PREÇO DA DECISÃO, DITO À PESSOA QUE O PAGA. Sem conta ela não
            oferta por esta tela — mas a doação dela não se perde: a equipe
            registra o que chegou por WhatsApp, e-mail ou na porta da sede
            (é /admin/doacoes/registrar). O que ela não terá é o
            acompanhamento nesta página, e a frase não esconde isso.
          */}
          <p>
            Se preferir não criar conta, fale com a gente pelo WhatsApp {WHATSAPP} ou pelo
            e-mail {EMAIL_ATELIE}: a gente combina por ali e registra a doação por aqui. Só o
            acompanhamento pelo site é que depende de ter conta.
          </p>
        </section>
      )}

      {usuario ? (
        <section aria-labelledby="titulo-formulario">
          <h2 id="titulo-formulario">Sua oferta</h2>
          <FormularioOferta />
        </section>
      ) : null}

      <section aria-labelledby="titulo-o-que-acontece">
        <h2 id="titulo-o-que-acontece">O que acontece depois</h2>
        {/*
          As mesmas etapas que /doar já promete ("Respondemos dizendo se
          conseguimos receber e combinamos juntos a entrega"), escritas do
          ponto de vista de quem acabou de enviar. Não promete prazo:
          ninguém prometeu (regra 2 do CLAUDE.md), e a ONG é uma equipe
          pequena.
        */}
        <ol className="lista-simples">
          <li>A oferta fica registrada e aparece em “Sua conta”, como “ofertada”</li>
          <li>A gente lê e responde dizendo se conseguimos receber</li>
          <li>Combinamos juntos a entrega, e quando chegar a gente marca como recebida</li>
        </ol>

        {/*
          RN08 REPETIDA AQUI, e não só em /doar: esta é a tela onde alguém
          procuraria um "pagar agora". A frase é a mesma da seção "Uma
          palavra sobre transparência" daquela página.
        */}
        <p>
          Este site <strong>não processa pagamentos</strong>. Ele registra o que foi doado e a
          resposta que demos, para que nada se perca e para que você saiba em que pé está a sua
          oferta. As formas de doar em dinheiro estão na{' '}
          <Link href="/doar">página de apoio</Link>.
        </p>
      </section>
    </main>
  );
}
