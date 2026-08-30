// Conteúdo copiado literalmente do HTML original de para-escolas.html — hoje a
// cópia congelada em testes/apoio/html-original/para-escolas.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <main id="conteudo"> preservado, e o bloco <noscript>
// saiu — a navegação agora chega pronta no HTML do servidor (Cabecalho e
// Rodape em app/layout.tsx). O link do catálogo perdeu o ".html"
// (/projetos.html -> /projetos) para casar com o esquema de rotas do Next;
// a página em si ainda não existe (fase futura). Esse link usa next/link, não
// <a> cru — ver o comentário equivalente em app/quem-somos/page.tsx.
//
// "Onde já estivemos" era populada no cliente por
// assets/js/paginas/prova-social.js, lendo listarClipping(). Agora que a
// camada de dados existe no servidor (Tarefa 10, servidor/dados/conteudo.ts)
// a página busca direto — sem round-trip nenhum no navegador. A decisão de
// desenhar a seção (ou omiti-la, se não houver registro de instituição ou
// programação) mora em componentes/SecaoOndeEstivemos.ts, testado à parte em
// testes/prova-social.test.mjs.
import Link from 'next/link';
import { listarClippingComOrigem } from '@/servidor/dados/conteudo';
import { SecaoOndeEstivemos } from '@/componentes/SecaoOndeEstivemos';

export const metadata = {
  title: 'Para escolas — Ateliê Afro Cultural',
  description: 'Contações de história e vivências brincantes para escolas e instituições, com faixas etárias, duração e o que a escola precisa providenciar.'
};

export default async function ParaEscolas() {
  const { registros: clipping, origem } = await listarClippingComOrigem();

  return (
    // data-origem-clipping é o único lugar do site onde dá para VER, de
    // fora, se o conteúdo veio do banco ou do JSON versionado. As duas
    // fontes carregam o mesmo conteúdo real da ONG (o seed nasce do JSON),
    // então a página é idêntica nos dois casos — e era exatamente por isso
    // que uma queda do Supabase, uma chave errada ou um grant faltando
    // passavam despercebidos em produção (CRÍTICO 1 da revisão final).
    //
    // Um atributo data-* não é conteúdo, não muda o texto lido por leitor de
    // tela e não revela credencial nenhuma: só diz "banco" ou "json". Quem
    // publicar o site pode abrir o código-fonte de /para-escolas e conferir
    // num segundo. testes/origem-dos-dados.test.mjs afirma "json" no modo
    // offline e "banco" no modo com credenciais.
    <main id="conteudo" className="conteudo" data-origem-clipping={origem}>
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
        <p><Link className="botao" href="/projetos">Ver o catálogo completo</Link></p>
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

      <SecaoOndeEstivemos registros={clipping} />

      <section aria-labelledby="titulo-solicitar">
        <h2 id="titulo-solicitar">Solicitar uma atividade</h2>
        <p>
          Conte para a gente qual atividade interessou, quantas crianças participariam e qual
          período você tem em mente. Respondemos pelo mesmo canal que você escolher.
        </p>
        <p className="abertura__acoes">
          <a className="botao" href="https://wa.me/5511953968344" rel="noopener">Falar pelo WhatsApp</a>{' '}
          <a className="botao botao--secundario" href="mailto:atelieafro@gmail.com">Enviar e-mail</a>
        </p>
      </section>
    </main>
  );
}
