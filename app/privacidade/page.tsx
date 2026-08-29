// Conteúdo copiado literalmente de site/privacidade.html (regra 2 do
// CLAUDE.md: conteúdo real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <br> -> <br />, <main id="conteudo"> preservado, e o
// bloco <noscript> saiu — a navegação agora chega pronta no HTML do
// servidor (Cabecalho e Rodape em app/layout.tsx).
//
// Esta página não é item do menu principal (o site antigo já entregava
// <aac-header pagina-atual=""> aqui) — só é alcançada pelo link no rodapé.
export const metadata = {
  title: 'Política de privacidade — Ateliê Afro Cultural',
  description: 'Quais dados o Ateliê Afro Cultural coleta, para quê, por quanto tempo, e como pedir acesso ou exclusão.'
};

export default function Privacidade() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Política de privacidade</h1>

      <p className="destaque">
        Coletamos o mínimo necessário para responder você e organizar as atividades. Esta página
        diz exatamente o quê, para quê e por quanto tempo — em português claro, sem letra miúda.
      </p>

      <section aria-labelledby="titulo-responsavel">
        <h2 id="titulo-responsavel">Quem é responsável pelos seus dados</h2>
        <p>
          <strong>Ateliê Afro Cultural</strong> — CNPJ 24.369.179/0001-17<br />
          Rua Dr. Paulo Gatti, 135 — Vila Romero, São Paulo/SP — CEP 02468-030
        </p>
        <p>
          Para qualquer pedido sobre seus dados, fale conosco pelo e-mail
          <a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a> ou pelo WhatsApp
          <a href="https://wa.me/5511953968344" rel="noopener">(11) 95396-8344</a>.
        </p>
      </section>

      <section aria-labelledby="titulo-o-que">
        <h2 id="titulo-o-que">O que coletamos, e só quando você nos dá</h2>

        <h3>Ao se inscrever em um evento</h3>
        <p>
          Nome, e-mail e telefone. Se a inscrição for de uma criança ou adolescente, pedimos
          também o nome e o telefone da pessoa responsável, que é quem faz a inscrição.
        </p>
        <p>
          <strong>CPF só é pedido quando o evento exige</strong> — em geral porque uma instituição
          parceira nos obriga. Quando não é o caso, não pedimos.
        </p>
        <p>
          Perguntamos separadamente se você autoriza o uso de imagem. <strong>Sem essa
          autorização registrada, nenhuma foto vai para o site.</strong>
        </p>

        <h3>Ao criar uma conta</h3>
        <p>
          Nome, e-mail, senha e, se você quiser, telefone. A senha é guardada cifrada — nem nós
          conseguimos lê-la. Conta é só para quem tem 18 anos ou mais.
        </p>

        <h3>Ao enviar uma mensagem</h3>
        <p>Nome, e-mail, a mensagem e, se você informar, telefone e instituição.</p>

        <h3>Ao usar o site</h3>
        <p>
          Guardamos sua preferência de tamanho de letra e contraste no seu próprio navegador. Isso
          não sai do seu aparelho e não nos diz quem você é.
        </p>
        <p>
          Ao enviar um formulário, guardamos um <strong>código embaralhado</strong> derivado do seu
          endereço de internet, apenas para impedir envio automatizado em massa. O endereço em si
          não é guardado, e o código não permite chegar de volta até você.
        </p>
      </section>

      <section aria-labelledby="titulo-para-que">
        <h2 id="titulo-para-que">Para que usamos</h2>
        <ul className="lista-simples">
          <li>Confirmar sua inscrição e avisar sobre o evento</li>
          <li>Responder sua mensagem ou sua oferta de doação</li>
          <li>Organizar a lista de presença no dia da atividade</li>
          <li>Contar quantas pessoas participaram, para prestação de contas e editais — nesse caso usamos apenas números totais, sem nomes</li>
        </ul>
        <p>
          <strong>Não vendemos, não trocamos e não compartilhamos seus dados com ninguém</strong>
          para fins de publicidade.
        </p>
      </section>

      <section aria-labelledby="titulo-quem-ve">
        <h2 id="titulo-quem-ve">Quem enxerga</h2>
        <p>
          Apenas a equipe do Ateliê. Os dados ficam protegidos no banco por regras que impedem
          qualquer visitante do site de acessá-los, mesmo que tente diretamente.
        </p>
        <p>
          Usamos dois serviços para funcionar: o <strong>Supabase</strong>, que guarda os dados em
          servidores no Brasil (região São Paulo), e um serviço de envio de e-mail, usado só para
          entregar as mensagens que você mesmo pediu.
        </p>
        <p>
          Fora esses dois, o site não busca nada em servidores de terceiros. As letras que você está
          lendo, por exemplo, vêm do nosso próprio site — e não de um serviço de fontes que veria
          sua visita.
        </p>
        <p>
          O site também oferece o <strong>VLibras</strong>, tradutor para Libras mantido pelo
          governo brasileiro. Ao carregar, ele é buscado em um servidor externo — se isso for uma
          preocupação para você, o site funciona normalmente com JavaScript desativado.
        </p>
      </section>

      <section aria-labelledby="titulo-quanto-tempo">
        <h2 id="titulo-quanto-tempo">Por quanto tempo guardamos</h2>
        <ul className="lista-simples">
          <li><strong>Inscrições e presenças:</strong> enquanto forem necessárias para prestação de contas das atividades</li>
          <li><strong>Mensagens:</strong> até o atendimento ser concluído, e um tempo depois como histórico do contato</li>
          <li><strong>Conta:</strong> enquanto você quiser mantê-la</li>
          <li><strong>Registros de contenção de envio em massa:</strong> apagados em até um dia</li>
        </ul>
      </section>

      <section aria-labelledby="titulo-direitos">
        <h2 id="titulo-direitos">Seus direitos</h2>
        <p>Você pode, a qualquer momento e sem precisar justificar:</p>
        <ul className="lista-simples">
          <li>Pedir para ver quais dados seus temos</li>
          <li>Corrigir qualquer informação errada</li>
          <li>Pedir a exclusão dos seus dados</li>
          <li>Retirar uma autorização de uso de imagem que já tenha dado</li>
        </ul>
        <p>
          É só escrever para <a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a>.
          Respondemos assim que conseguirmos — somos uma equipe pequena, mas ninguém fica sem
          resposta.
        </p>
      </section>

      <section aria-labelledby="titulo-criancas">
        <h2 id="titulo-criancas">Sobre crianças e adolescentes</h2>
        <p>
          Nossas atividades atendem crianças a partir dos 10 anos, e levamos isso a sério. A
          inscrição de quem tem menos de 18 anos é sempre feita por uma pessoa responsável, que se
          identifica. Só publicamos foto de criança com autorização registrada de quem responde
          por ela.
        </p>
      </section>

      <p className="chamada-final">
        Última atualização: 25 de agosto de 2026.
      </p>
    </main>
  );
}
