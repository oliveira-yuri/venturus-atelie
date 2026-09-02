import Link from 'next/link';
import { QrCodeDeTeste } from '@/componentes/QrCodeDeTeste';

// Conteúdo copiado literalmente do HTML original de doar.html — hoje a
// cópia congelada em testes/apoio/html-original/doar.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// A ARMADILHA DO JSX COME ESPAÇOS (restrições globais #3): mesma situação
// de app/para-escolas/page.tsx — quebra de linha entre os dois
// <a class="botao"...> de "abertura__acoes" vira espaço na tela e precisa
// de {' '} explícito. O parágrafo do aviso sem chave Pix também usa {' '}
// nas duas pontas do link de WhatsApp, por segurança: o texto original
// (site/assets/js/paginas/doar.js) quebra linha bem no meio de "fale com a
// gente pelo WhatsApp", dentro do próprio <a> — condensado aqui num só
// texto, sem quebra, para não depender de onde o formatador do editor
// decidir cortar a linha.
//
// A CHAVE PIX (D7 do escopo) AINDA NÃO EXISTE — decisão pendente com a
// ONG (ver "O que trava hoje" do CLAUDE.md e RF23 na tabela de status). O
// PRÓPRIO site/assets/js/paginas/doar.js já resolvia isso hoje: `const
// CHAVE_PIX = null` e um `if` que troca o bloco exibido. Este porte
// preserva EXATAMENTE essa decisão e o texto que ela mostra quando não há
// chave — não omite a seção "Doação em dinheiro" (o h2 continua fazendo
// sentido sozinho, e a ONG quer que doações em dinheiro apareçam como
// possibilidade), mas NUNCA escreve uma chave inventada nem um texto de
// "em breve" genérico: o texto abaixo é o mesmo aviso real que já está no
// ar, explicando o motivo (conta institucional em organização) e dando um
// canal imediato (WhatsApp) para quem quer doar agora mesmo. Quando D7
// for resolvida, troca-se CHAVE_PIX por uma string e o ramo `if` já
// existente passa a desenhar o outro bloco (também portado abaixo, mesmo
// texto do original) — sem precisar redesenhar a seção.
export const metadata = {
  title: 'Apoiar — Ateliê Afro Cultural',
  description: 'Como apoiar o Ateliê Afro Cultural: livros, instrumentos musicais, materiais de arte, itens de acervo e recursos financeiros.'
};

// =====================================================================
// CHAVE DE TESTE — NÃO PODE IR PARA O LANÇAMENTO REAL
// =====================================================================
//
// A decisão D7 (a chave Pix real da ONG) continua PENDENTE: a conta
// institucional ainda está sendo organizada. O dono do projeto pediu, em
// 02/09/2026, uma chave de teste e um QR falso para a apresentação — com a
// ressalva, dele mesmo, de deixar explícito na tela que é de teste.
//
// É o que este bloco faz, em três lugares que se reforçam: a caixa de aviso
// acima da chave, a tarja DENTRO do QR (que sobrevive a uma captura de
// tela) e a legenda abaixo dele.
//
// QUANDO A CHAVE DE VERDADE CHEGAR: trocar as duas constantes abaixo, pôr
// `PIX_E_DE_TESTE` em `false`, e trocar `QrCodeDeTeste` por um QR de
// verdade — que é uma decisão à parte, porque gerar QR exige biblioteca
// (regra 7 do CLAUDE.md) ou a imagem pronta vinda do banco da ONG.
//
// O site está com `noindex` em quatro lugares enquanto isso (item 0c de "O
// que trava hoje"), então nada disto é achável por busca. Mesmo assim:
// nenhuma chave de teste pode sobreviver ao dia do lançamento. Há item no
// CLAUDE.md e teste que falha se a marca de teste sumir com a chave ainda
// sendo a de exemplo.
const CHAVE_PIX: string | null = 'chaveteste-123';
const PIX_E_DE_TESTE = true;

export default function Doar() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Apoiar o Ateliê</h1>

      <p className="destaque">
        O Ateliê Afro Cultural é um espaço de arte, cultura e memória. O que mais nos fortalece
        são materiais que viram atividade com as crianças — e recursos que sustentam o trabalho.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-aceitamos">
        <h2 id="titulo-aceitamos">O que recebemos</h2>
        <ul className="lista-simples">
          <li><strong>Livros</strong> de temática negra, para crianças, jovens e adultos</li>
          <li><strong>Instrumentos musicais</strong> — percussão, cordas, o que houver</li>
          <li><strong>Materiais de arte</strong>: tintas, telas, papéis, tecidos, materiais recicláveis</li>
          <li><strong>Itens de acervo</strong>: peças de memória ancestral, fantasias, figurinos</li>
          <li><strong>Recursos financeiros</strong>, que ajudam a manter o espaço e as atividades</li>
        </ul>
        <p>
          Não recebemos alimentos nem roupas. Não é falta de reconhecimento pela intenção — é que
          nosso trabalho é com arte e cultura, e outras organizações fazem esse acolhimento muito
          melhor do que nós faríamos.
        </p>
      </section>

      <section aria-labelledby="titulo-como-doar">
        <h2 id="titulo-como-doar">Como doar</h2>
        <p>
          Conte para a gente o que você pretende doar. Respondemos dizendo se conseguimos receber
          e combinamos juntos a entrega — se você traz até a sede na Casa Verde, se buscamos, ou
          se encontramos um meio-termo.
        </p>
        <p className="abertura__acoes">
          <a className="botao" href="https://wa.me/5511953968344" rel="noopener">Falar pelo WhatsApp</a>{' '}
          <a className="botao botao--secundario" href="mailto:atelieafro@gmail.com">Enviar e-mail</a>
        </p>
      </section>

      {/*
        SEÇÃO NOVA, ACRESCENTADA PELO RF19 — não existe no HTML original.
        Ela entra ENTRE duas seções existentes ("Como doar" e "Doação em
        dinheiro"), e não no fim, pelo mesmo motivo que o formulário de
        contato (RF07) entrou no meio de /contato: assim o texto migrado
        continua sendo lido na mesma ordem, e a leitura fica natural — a
        seção anterior acaba de dizer "conte para a gente o que você
        pretende doar", e esta oferece o lugar de contar.

        Ela sai da comparação de testes/paridade-texto.test.mjs por
        `idsAcrescentados: ['titulo-oferecer']` — a espécie de exclusão que
        cobra a AUSÊNCIA do id no HTML original, e não a presença. O resto
        do <main> continua comparado palavra por palavra, e a cobertura da
        fronteira texto-elemento desta seção está registrada em
        COBERTURA_DAS_EXCLUSOES.

        NADA AQUI PROMETE MEIO DE PAGAMENTO. A chave Pix continua não
        existindo (decisão D7), e a seção seguinte continua dizendo isso com
        as palavras que já estavam no ar.
      */}
      <section aria-labelledby="titulo-oferecer">
        <h2 id="titulo-oferecer">Registrar sua oferta pelo site</h2>
        <p>
          Se você tem conta aqui, dá para contar por escrito o que pretende doar e acompanhar a
          nossa resposta em “Sua conta” — sem depender de lembrar em que conversa ficou.
        </p>
        <p className="abertura__acoes">
          <Link className="botao" href="/doar/ofertar">Oferecer uma doação</Link>
        </p>
      </section>

      <section aria-labelledby="titulo-financeiro">
        <h2 id="titulo-financeiro">Doação em dinheiro</h2>
        <div id="dados-pix">
          {CHAVE_PIX ? (
            <div className="pix">
              {PIX_E_DE_TESTE ? (
                <p className="pix__marca-de-teste" role="status">
                  <strong>Esta chave é de teste.</strong> O Ateliê ainda está organizando a
                  conta institucional — nenhuma transferência para a chave abaixo chega à
                  ONG. Para doar de verdade hoje,{' '}
                  <a href="https://wa.me/5511953968344" rel="noopener">fale pelo WhatsApp</a>.
                </p>
              ) : null}

              <p className="pix__chave">
                <span className="pix__rotulo">Chave Pix</span>
                <span className="pix__valor">{CHAVE_PIX}</span>
              </p>

              <QrCodeDeTeste chave={CHAVE_PIX} />

              {/* A legenda que o pedido V1 exige, logo abaixo do QR. Ela é
                  a TERCEIRA marca (a primeira é a caixa acima, a segunda é
                  a tarja dentro da própria imagem) — e é a que fica junto
                  do gesto de apontar a câmera. */}
              <p className="pix__legenda">
                QR Code de exemplo, apenas para demonstração — ele não funciona.
              </p>

              <p>
                Depois de transferir,{' '}
                <a href="https://wa.me/5511953968344" rel="noopener">avise a gente</a>{' '}
                para registrarmos sua doação. O site não recebe pagamento e não emite
                recibo: quem registra o que chegou é a equipe, depois do fato.
              </p>
            </div>
          ) : (
            <div className="aviso">
              <p>
                Estamos organizando a conta institucional para receber doações em dinheiro
                com a transparência que o assunto merece.
              </p>
              <p>
                Enquanto isso,{' '}
                <a href="https://wa.me/5511953968344" rel="noopener">fale com a gente pelo WhatsApp</a>{' '}
                que explicamos exatamente para onde vai o recurso e quem recebe.
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="titulo-transparencia">
        <h2 id="titulo-transparencia">Uma palavra sobre transparência</h2>
        <p>
          Este site <strong>não processa pagamentos</strong>. Ele registra o que foi doado e a
          resposta que demos, para que nada se perca e para que você saiba em que pé está a sua
          oferta.
        </p>
      </section>
    </main>
  );
}
