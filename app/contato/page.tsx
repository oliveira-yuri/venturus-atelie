// Conteúdo copiado literalmente de site/contato.html (regra 2 do CLAUDE.md:
// conteúdo real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// SEM FORMULÁRIO, DE PROPÓSITO — decisão da Tarefa A6, que porta esta rota
// junto com /entrar e /recuperar-acesso. O título da tarefa agrupa as três
// como "telas com formulário", mas site/contato.html NUNCA teve um: git log
// confirma que a página nasceu (commit 70cc9b7, fase 01) só com os canais
// diretos e o endereço — RF07 ("Formulário de contato geral", ver a tabela
// de status do CLAUDE.md) está listado como "falta — depende da tela e do
// envio" porque a TELA em si nunca foi desenhada, nem no site estático.
// Inventar agora os campos desse formulário (rótulos, textos de ajuda,
// mensagem de consentimento) violaria a regra 2 do CLAUDE.md — a única
// exceção de conteúdo novo aprovada para esta tarefa é o aviso de "envio
// ainda não ativo" em /entrar e /recuperar-acesso, que JÁ têm formulário
// real no HTML de origem. Por isso esta página é uma migração 1:1, sem
// aviso nenhum: não há nada aqui que prometa enviar e não envie.
export const metadata = {
  title: 'Contato — Ateliê Afro Cultural',
  description: 'Telefone, WhatsApp, e-mail, redes sociais e endereço do Ateliê Afro Cultural, na Casa Verde, São Paulo.'
};

export default function Contato() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Fale com a gente</h1>

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
