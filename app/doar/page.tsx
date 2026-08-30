// Conteúdo copiado literalmente de site/doar.html (regra 2 do CLAUDE.md:
// conteúdo real da ONG, nunca inventado). Conversão mecânica: class ->
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

// Decisão pendente D7 — ver o comentário no topo do arquivo. `null` aqui é
// o mesmo estado que site/assets/js/paginas/doar.js tem em produção hoje.
const CHAVE_PIX: string | null = null;

export default function Doar() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Apoiar o Ateliê</h1>

      <p className="destaque">
        O Ateliê Afro Cultural é um espaço de arte, cultura e memória. O que mais nos fortalece
        são materiais que viram atividade com as crianças — e recursos que sustentam o trabalho.
      </p>

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

      <section aria-labelledby="titulo-financeiro">
        <h2 id="titulo-financeiro">Doação em dinheiro</h2>
        <div id="dados-pix">
          {CHAVE_PIX ? (
            <div className="aviso aviso--sucesso">
              <p><strong>Chave Pix:</strong> {CHAVE_PIX}</p>
              <p>Depois de transferir, avise a gente para registrarmos sua doação.</p>
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
