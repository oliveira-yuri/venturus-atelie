// Conteúdo copiado literalmente de site/para-escolas.html (regra 2 do
// CLAUDE.md: conteúdo real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <main id="conteudo"> preservado, e o bloco <noscript>
// saiu — a navegação agora chega pronta no HTML do servidor (Cabecalho e
// Rodape em app/layout.tsx). O link do catálogo perdeu o ".html"
// (/projetos.html -> /projetos) para casar com o esquema de rotas do Next;
// a página em si ainda não existe (fase futura).
//
// "Onde já estivemos" ficava populada por assets/js/paginas/prova-social.js,
// que buscava listarClipping() da camada de dados antiga. Essa camada só
// nasce no servidor na Tarefa 10 (servidor/dados/conteudo.ts) e nenhuma
// página ainda a consome — por isso esta é uma das "três páginas sem dados"
// e a div fica vazia de propósito, como no HTML de origem antes do script
// rodar. Reativar quando uma tarefa de fase 2 ligar esta seção a
// listarClipping().
export const metadata = {
  title: 'Para escolas — Ateliê Afro Cultural',
  description: 'Contações de história e vivências brincantes para escolas e instituições, com faixas etárias, duração e o que a escola precisa providenciar.'
};

export default function ParaEscolas() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Para escolas e instituições</h1>

      <p className="destaque">
        Levamos contações de história performáticas e vivências brincantes até o seu espaço,
        trabalhando cultura e memória afro-brasileira com as crianças.
      </p>

      <section aria-labelledby="titulo-atividades-escola">
        <h2 id="titulo-atividades-escola">Que atividades existem</h2>
        <p>
          Nosso catálogo reúne contações de história performáticas, apresentações com fantoches e
          música ao vivo, e vivências de brincadeiras da cultura popular.
        </p>
        <p><a className="botao" href="/projetos">Ver o catálogo completo</a></p>
      </section>

      <section aria-labelledby="titulo-formato">
        <h2 id="titulo-formato">Formato e duração</h2>
        <dl className="ficha">
          <div><dt>Público</dt><dd>Crianças, jovens e adultos, de todas as etnias e faixas etárias</dd></div>
          <div><dt>Classificação</dt><dd>Livre</dd></div>
          <div><dt>Duração</dt><dd>50 minutos na maioria das atividades; algumas a combinar</dd></div>
          <div><dt>Local</dt><dd>Adaptável a qualquer espaço</dd></div>
        </dl>
      </section>

      <section aria-labelledby="titulo-providenciar">
        <h2 id="titulo-providenciar">O que a escola precisa providenciar</h2>
        <ul className="lista-simples">
          <li>Um espaço para a apresentação — adaptamos ao que a escola tiver</li>
          <li>1 caixa de som</li>
          <li>1 microfone, com ou sem fio, conforme a atividade</li>
        </ul>
        <p>A ficha técnica de cada atividade traz o que ela pede em detalhe.</p>
      </section>

      <section aria-labelledby="titulo-onde-estivemos">
        <h2 id="titulo-onde-estivemos">Onde já estivemos</h2>
        <div id="lista-instituicoes"></div>
      </section>

      <section aria-labelledby="titulo-solicitar">
        <h2 id="titulo-solicitar">Solicitar uma atividade</h2>
        <p>
          Conte para a gente qual atividade interessou, quantas crianças participariam e qual
          período você tem em mente. Respondemos pelo mesmo canal que você escolher.
        </p>
        <p className="abertura__acoes">
          <a className="botao" href="https://wa.me/5511953968344" rel="noopener">Falar pelo WhatsApp</a>
          <a className="botao botao--secundario" href="mailto:atelieafro@gmail.com">Enviar e-mail</a>
        </p>
      </section>
    </main>
  );
}
