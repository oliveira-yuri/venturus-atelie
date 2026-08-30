// Conteúdo copiado literalmente do HTML original de index.html — hoje a
// cópia congelada em testes/apoio/html-original/index.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo"> preservado, e o bloco <noscript> saiu — a
// navegação agora chega pronta no HTML do servidor (Cabecalho e Rodape em
// app/layout.tsx). Os links internos (/projetos.html, /agenda.html,
// /voluntariado.html, /doar.html, /quem-somos.html, /para-escolas.html)
// perderam o ".html" para casar com o esquema de rotas do Next; a maioria
// dessas páginas ainda não existe (chegam em fases futuras) — mesma
// situação que app/quem-somos/page.tsx e app/para-escolas/page.tsx já
// tratam, e usam next/link mesmo assim (nunca <a> cru para rota interna: um
// <a> cru faz recarga completa e passa ao largo de
// componentes/FocoNaNavegacao.tsx).
//
// O <main id="conteudo"> original NÃO carrega class="conteudo" (ao
// contrário de quem-somos e para-escolas): a home tem a seção "abertura",
// de largura cheia, fora do container centralizado, e só o restante das
// seções entra num <div class="conteudo"> — essa é a diferença estrutural
// entre esta página e as outras duas já portadas. Preservada aqui.
//
// "Na mídia" era populada no cliente por assets/js/paginas/prova-social.js,
// lendo listarClipping() e filtrando tipo === 'midia' (o <div
// id="lista-midia"> chegava vazio no HTML estático). Agora que a camada de
// dados existe no servidor (servidor/dados/conteudo.ts) a página busca
// direto — sem round-trip no navegador, mesmo padrão que
// app/para-escolas/page.tsx já usa para "Onde já estivemos". A decisão de
// desenhar a seção (ou omiti-la, sem nenhum registro do tipo "midia") mora
// em componentes/SecaoNaMidia.ts, espelhando componentes/SecaoOndeEstivemos
// .ts — mesmo teste de omissão, mesmo motivo (regra 2 do CLAUDE.md).
import Link from 'next/link';
import { listarClippingComOrigem } from '@/servidor/dados/conteudo';
import { SecaoNaMidia } from '@/componentes/SecaoNaMidia';

export default async function Home() {
  const { registros: clipping, origem } = await listarClippingComOrigem();

  return (
    // data-origem-clipping segue o mesmo precedente de app/para-escolas/
    // page.tsx: única forma de ver de fora se o conteúdo veio do banco ou
    // do JSON versionado, sem mudar o texto lido por leitor de tela nem
    // revelar credencial nenhuma.
    <main id="conteudo" data-origem-clipping={origem}>
      <section className="abertura">
        <div className="abertura__conteudo">
          <div className="abertura__peca">
            <h1>Arte, memória e <em>pertencimento</em> — feitos à mão, todo dia</h1>
            <p className="abertura__slogan">
              Espaço educativo de criação, reflexão e valorização da cultura e memória
              afro brasileira, na Casa Verde, zona norte de São Paulo.
            </p>
            <p className="abertura__acoes">
              <Link className="botao" href="/projetos">Conhecer nossos projetos</Link>{' '}
              <Link className="botao botao--secundario" href="/agenda">Ver a agenda</Link>
            </p>
          </div>
        </div>
      </section>

      <div className="conteudo">
        <section aria-labelledby="titulo-caminhos">
          <h2 id="titulo-caminhos">Por onde começar</h2>
          <ul className="caminhos">
            <li className="caminho">
              <Link href="/quem-somos">
                <h3>Conhecer</h3>
                <p>Nossa história, quem idealizou o ateliê e os três setores de atuação.</p>
              </Link>
            </li>
            <li className="caminho">
              <Link href="/agenda">
                <h3>Participar</h3>
                <p>Oficinas, apresentações e vivências abertas ao público. A inscrição não exige cadastro.</p>
              </Link>
            </li>
            <li className="caminho">
              <Link href="/voluntariado">
                <h3>Ser voluntário</h3>
                <p>Cinco áreas de atuação, do apoio pedagógico à organização do acervo.</p>
              </Link>
            </li>
            <li className="caminho">
              <Link href="/doar">
                <h3>Apoiar</h3>
                <p>Recebemos livros, instrumentos musicais, materiais de arte, itens de acervo e recursos financeiros.</p>
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="titulo-setores-home">
          <h2 id="titulo-setores-home">O que fazemos</h2>

          <article className="setor">
            <h3>Literário</h3>
            <p>Livros de temática negra, leituras, pesquisas, contação de histórias e técnicas de teatro.</p>
          </article>

          <article className="setor">
            <h3>Musical</h3>
            <p>Cantigas, instrumentos e corporeidade negra: jongo, maculelê, maracatu, forró, samba, rap, hip hop e funk.</p>
          </article>

          <article className="setor">
            <h3>Artístico criativo</h3>
            <p>Pintura em tela, materiais reciclados para figurinos e cenários, desenho, escultura e colagem.</p>
          </article>

          <p><Link href="/quem-somos">Ler nossa história completa</Link></p>
        </section>

        <section aria-labelledby="titulo-escolas-home">
          <h2 id="titulo-escolas-home">É de uma escola ou instituição?</h2>
          <p>
            Levamos contações de história e vivências brincantes até o seu espaço. Todas as
            atividades se adaptam a qualquer local e têm classificação livre.
          </p>
          <p><Link className="botao" href="/para-escolas">Ver como funciona</Link></p>
        </section>

        <SecaoNaMidia registros={clipping} />
      </div>
    </main>
  );
}
