// Conteúdo copiado literalmente do HTML original de contato.html — hoje a
// cópia congelada em testes/apoio/html-original/contato.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// ===================================================================
// AGORA TEM FORMULÁRIO (RF07) — e o comentário que dizia o contrário saiu
// ===================================================================
//
// Até esta tarefa esta página era migração 1:1 e o comentário aqui
// explicava por quê: site/contato.html NUNCA teve formulário (commit
// 70cc9b7, fase 01 — só os canais diretos e o endereço), e a Tarefa A6, que
// portou a rota, não podia inventar os campos, os rótulos e o texto de
// consentimento sem violar a regra 2 do CLAUDE.md.
//
// O que mudou não foi a regra: foi o mandato. Esta tarefa é o RF07, e a
// regra 2 continua sendo obedecida onde ela de fato manda — o texto do
// CONSENTIMENTO não promete nada que a ONG não tenha declarado; ele aponta
// para /privacidade, que é política real e escrita (ver o cabeçalho de
// componentes/FormularioContato.tsx). Rótulo e texto de ajuda de campo são
// escritos por quem implementa, como nas quatro tarefas anteriores.
//
// ===================================================================
// O FORMULÁRIO VEM DEPOIS DOS CANAIS DIRETOS, E ISSO É DECISÃO
// ===================================================================
//
// Telefone, WhatsApp e e-mail são canais que a ONG lê hoje, todos os dias.
// A mensagem enviada por aqui vai para `public.contatos`, e desde o RF29
// (01/09/2026) existe a TELA da equipe para ler esse registro:
// /admin/contatos. A ordem NÃO mudou por causa disso, e a decisão foi
// revisitada: a fila do painel depende de alguém da equipe abrir o painel,
// e o WhatsApp toca no bolso. Enquanto a ONG não tiver rotina de abrir a
// tela, pôr o formulário acima dos canais continua sendo empurrar quem tem
// pressa para o caminho mais lento.
//
// A ordem também é o que mantém testes/paridade-texto.test.mjs honesto: a
// <section> nova é excluída da comparação com o HTML original (ela é texto
// que não existia lá), e o resto do <main> continua comparado palavra por
// palavra, na mesma ordem de antes.
import FormularioContato from '@/componentes/FormularioContato';
import { avisoDeContato } from '@/compartilhado/avisos-de-contato';

export const metadata = {
  title: 'Contato — Ateliê Afro Cultural',
  description: 'Telefone, WhatsApp, e-mail, redes sociais e endereço do Ateliê Afro Cultural, na Casa Verde, São Paulo.'
};

export default async function Contato(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  // O resultado de um envio bem-sucedido chega pela URL: `enviarContato`
  // termina em redirect (POST-redirect-GET, que é o que impede a mensagem
  // de ser reenviada num F5), e um redirect não carrega estado. `?aviso=` é
  // escrito por quem quiser, então passa por LISTA FECHADA — o parâmetro
  // escolhe uma frase nossa, nunca traz uma.
  const aviso = avisoDeContato((await searchParams).aviso);

  return (
    <main id="conteudo" className="conteudo">
      <h1>Fale com a gente</h1>

      {/*
        A confirmação fica AQUI, logo abaixo do título, e não junto ao
        formulário lá embaixo: depois do redirect o navegador entrega a
        página nova pelo começo, e uma confirmação a três telas de rolagem
        de distância é uma confirmação que ninguém lê. É a mesma posição, e
        pelo mesmo motivo, do aviso das telas do painel.

        `role="status"` e não `role="alert"`: esta caixa chega junto com uma
        página NOVA, não aparece no meio de uma que já estava aberta —
        `alert` anuncia interrupções. A recusa, que é o caso oposto, é
        `role="alert"` e mora dentro do formulário
        (componentes/FormularioContato.tsx).

        Quando não há `?aviso=`, NADA é desenhado aqui — nem uma caixa
        vazia. É o que mantém testes/paridade-texto.test.mjs comparando o
        texto desta página com o do HTML original sem precisar excluir esta
        parte.
      */}
      {aviso
        ? (
          <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
            <p>{aviso.texto}</p>
          </div>
        )
        : null}

      <p className="destaque">
        Escolas, instituições, empresas, imprensa ou qualquer pessoa que queira conhecer o
        ateliê: escreva pelo canal que preferir.
      </p>

      <section aria-labelledby="titulo-canais">
        <h2 id="titulo-canais">Canais diretos</h2>
        <dl className="ficha">
          <div><dt>Telefone</dt><dd><a href="tel:+5511953968344">(11) 95396-8344</a></dd></div>
          <div><dt>WhatsApp</dt><dd><a href="https://wa.me/5511953968344" rel="noopener">(11) 95396-8344</a></dd></div>
          <div><dt>E-mail</dt><dd><a href="mailto:atelieafro@gmail.com">atelieafro@gmail.com</a></dd></div>
          <div><dt>Instagram</dt><dd><a href="https://instagram.com/atelie_afrocultural" rel="noopener">@atelie_afrocultural</a></dd></div>
          <div><dt>TikTok</dt><dd><a href="https://tiktok.com/@ateli.afro.cultur" rel="noopener">@ateli.afro.cultur</a></dd></div>
          <div><dt>YouTube</dt><dd><a href="https://www.youtube.com/channel/UCWeZ-53etejdUzUi3eR81zg" rel="noopener">Nosso canal</a></dd></div>
        </dl>
      </section>

      {/*
        SEÇÃO NOVA (RF07). É ela que sai da comparação de
        testes/paridade-texto.test.mjs, pelo id do próprio título — o texto
        daqui não existe no HTML original, e não poderia existir. A
        fronteira texto-elemento que essa exclusão deixa de observar (o
        parágrafo com o link para /privacidade) é comparada por igualdade em
        testes/contato.test.mjs; está registrado em COBERTURA_DAS_EXCLUSOES.
      */}
      <section aria-labelledby="titulo-mensagem">
        <h2 id="titulo-mensagem">Ou mande uma mensagem por aqui</h2>
        <FormularioContato />
      </section>

      <section aria-labelledby="titulo-endereco-contato">
        <h2 id="titulo-endereco-contato">Onde estamos</h2>
        <address className="endereco">
          Rua Dr. Paulo Gatti, 135 — Vila Romero<br />
          São Paulo/SP — CEP 02468-030
        </address>
        <p>Nossa sede fica no bairro da Casa Verde, zona norte de São Paulo.</p>
      </section>
    </main>
  );
}
