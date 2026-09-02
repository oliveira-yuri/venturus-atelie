// Conteúdo copiado literalmente do HTML original de index.html — hoje a
// cópia congelada em testes/apoio/html-original/index.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo"> preservado, e o bloco <noscript> saiu — a
// navegação agora chega pronta no HTML do servidor (Cabecalho e Rodape em
// app/layout.tsx). Os links internos perderam o ".html" para casar com o
// esquema de rotas do Next.
//
// =====================================================================
// PARIDADE COM O HANDOFF DO DESIGN SYSTEM v1 (index.html §4–§9)
// =====================================================================
//
// O herói agora é `.af-hero` do sistema: faixa ocre, imagem atrás e o
// cartão creme de sombra dura avançando sobre ela (estilos/sistema.css). O
// `.abertura*` legado saiu.
//
// AS FOTOS (docs/info-venturus/, decididas com o dono do projeto): todas do
// COFUNDADOR Wil Oliveira — adulto, figura pública (imprensa nacional,
// Teatro Municipal). NENHUMA criança identificável vai ao ar (RN07, regra
// 9 — o público inclui crianças a partir de 10 anos). Quando faltar foto
// autorizada, `.af-ph` volta a ser o espaço declarado.
//
// O TEXTO VISÍVEL NÃO MUDOU. A numeração 01–04 dos tiles e a seta do link
// "Ler nossa história completa" são `::before`/`::after` em CSS, não markup
// — conteúdo gerado não entra no <main> e testes/paridade-texto.test.mjs
// (que compara o texto visível da home inteira) continua honesto.
//
// "Na mídia" continua vindo do servidor (servidor/dados/conteudo.ts) via
// componentes/SecaoNaMidia.ts, agora no markup `.af-media` do sistema
// (barra colorida de 6px à esquerda de cada item).
import Link from 'next/link';
import { listarClippingComOrigem } from '@/servidor/dados/conteudo';
import { avisoDaHome } from '@/compartilhado/avisos-da-home';
import AvisoDaHome from '@/componentes/AvisoDaHome';
import { SecaoNaMidia } from '@/componentes/SecaoNaMidia';

export default async function Home(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const { registros: clipping, origem } = await listarClippingComOrigem();

  // Quem acabou de criar conta chega aqui por redirect (pedido V1), e um
  // redirect não carrega estado. `?aviso=` é escrito por quem quiser, então
  // passa por LISTA FECHADA — o parâmetro escolhe uma frase nossa, nunca
  // traz uma. Mesma mecânica de /contato.
  const aviso = avisoDaHome((await searchParams).aviso);

  return (
    // data-origem-clipping segue o mesmo precedente de app/para-escolas/
    // page.tsx: única forma de ver de fora se o conteúdo veio do banco ou
    // do JSON versionado, sem mudar o texto lido por leitor de tela nem
    // revelar credencial nenhuma.
    <main id="conteudo" data-origem-clipping={origem}>
      {/*
        A confirmação vem ANTES do herói, e não no meio da página: depois do
        redirect o navegador entrega a página nova pelo começo, e uma
        confirmação abaixo da dobra é uma confirmação que ninguém lê.

        `role="status"` e não `alert`: esta caixa chega junto com uma página
        NOVA, não aparece no meio de uma que já estava aberta.

        Sem `?aviso=`, NADA é desenhado — nem uma caixa vazia. É o que
        mantém testes/paridade-texto.test.mjs comparando o texto desta
        página com o do HTML original sem precisar excluir esta parte.
      */}
      {aviso ? <AvisoDaHome aviso={aviso} /> : null}
      {/*
        HERÓI — `index.html` §4. Ordem no DOM: cartão primeiro, imagem
        depois (é o que `Home 1a Desktop.dc.html` desenha: cartão à
        esquerda, imagem à direita). No celular o CSS sobe a imagem para
        cima do cartão (`order: -1`) e o cartão avança sobre ela.
      */}
      <section className="af-hero">
        <div className="af-card af-card--hero">
          <h1 className="af-h1">Arte, memória e <em className="af-mark">pertencimento</em> — feitos à mão, todo dia</h1>
          <p className="af-text">
            Espaço educativo de criação, reflexão e valorização da cultura e memória
            afro brasileira, na Casa Verde, zona norte de São Paulo.
          </p>
          <div className="af-hero__acoes">
            {/* O {' '} entre os dois botões é o espaço que existe no HTML
                original (quebra de linha entre os <a>); testes/paridade-texto
                compara texto e ele conta. Visualmente o gap vem do flex. */}
            <Link className="af-btn af-btn--primary" href="/projetos">Conhecer nossos projetos</Link>{' '}
            <Link className="af-btn af-btn--outline" href="/agenda">Ver a agenda</Link>
          </div>
        </div>
        <picture>
          {/* Retrato 4:5 no desktop, 16:9 no restante — a mesma troca que o
              handoff faz entre `Home 1a` e `Home 1a Desktop`. */}
          <source media="(min-width: 64rem)" srcSet="/imagens/heroi-retrato.jpg" width={1000} height={1250} />
          <img
            className="af-hero__img"
            src="/imagens/heroi.jpg"
            width={1200}
            height={675}
            loading="eager"
            decoding="async"
            alt="Wil Oliveira, cofundador do Ateliê Afro Cultural, toca um atabaque ao lado do estandarte bordado da instituição."
          />
        </picture>
      </section>

      {/*
        Primeira das DUAS faixas listradas permitidas por página (a outra
        vem acima do rodapé, em componentes/Rodape.tsx). Decoração pura,
        então `aria-hidden` — e por isso ela também não entra na comparação
        de testes/paridade-texto.test.mjs, que lê texto.
      */}
      <div className="af-stripe" aria-hidden="true"></div>

      <div className="conteudo">
        <section aria-labelledby="titulo-caminhos">
          <h2 id="titulo-caminhos">Por onde começar</h2>
          <ul className="caminhos af-grid">
            <li className="caminho af-tile">
              <Link href="/quem-somos">
                <h3>Conhecer</h3>
                <p>Nossa história, quem idealizou o ateliê e os três setores de atuação.</p>
              </Link>
            </li>
            <li className="caminho af-tile af-tile--azul">
              <Link href="/agenda">
                <h3>Participar</h3>
                <p>Oficinas, apresentações e vivências abertas ao público. A inscrição não exige cadastro.</p>
              </Link>
            </li>
            <li className="caminho af-tile af-tile--marrom">
              <Link href="/voluntariado">
                <h3>Ser voluntário</h3>
                <p>Cinco áreas de atuação, do apoio pedagógico à organização do acervo.</p>
              </Link>
            </li>
            <li className="caminho af-tile af-tile--invertido">
              <Link href="/doar">
                <h3>Apoiar</h3>
                <p>Recebemos livros, instrumentos musicais, materiais de arte, itens de acervo e recursos financeiros.</p>
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="titulo-setores-home">
          <h2 id="titulo-setores-home">O que fazemos</h2>

          {/*
            Carrossel com encaixe no celular, grade de 2 e depois de 3
            colunas a partir do tablet — quem decide é CSS, não script
            (estilos/sistema.css). Cada setor tem uma foto 2:1 no topo, o
            espaço `.af-ph--wide` do handoff preenchido.
          */}
          <div className="af-hscroll">
          <article className="setor setor--com-imagem">
            <img
              className="setor__img"
              src="/imagens/setor-literario.jpg"
              width={1000}
              height={500}
              loading="lazy"
              decoding="async"
              alt="Wil Oliveira cercado de exemplares do livro infantil Cafú e o Café, de sua autoria."
            />
            <div className="setor__corpo">
              <h3>Literário</h3>
              <p>Livros de temática negra, leituras, pesquisas, contação de histórias e técnicas de teatro.</p>
            </div>
          </article>

          <article className="setor setor--com-imagem">
            <img
              className="setor__img"
              src="/imagens/setor-musical.jpg"
              width={1000}
              height={500}
              loading="lazy"
              decoding="async"
              alt="Wil Oliveira em cena no espetáculo Brasil Negreiro, tocando um instrumento de percussão."
            />
            <div className="setor__corpo">
              <h3>Musical</h3>
              <p>Cantigas, instrumentos e corporeidade negra: jongo, maculelê, maracatu, forró, samba, rap, hip hop e funk.</p>
            </div>
          </article>

          <article className="setor setor--com-imagem">
            <img
              className="setor__img"
              src="/imagens/setor-artistico.jpg"
              width={1000}
              height={500}
              loading="lazy"
              decoding="async"
              alt="Wil Oliveira de chapéu de palha com um tambor, diante de um painel grafitado e do estandarte do ateliê."
            />
            <div className="setor__corpo">
              <h3>Artístico criativo</h3>
              <p>Pintura em tela, materiais reciclados para figurinos e cenários, desenho, escultura e colagem.</p>
            </div>
          </article>

          </div>

          <p><Link className="link-historia" href="/quem-somos">Ler nossa história completa</Link></p>
        </section>

        <section aria-labelledby="titulo-escolas-home" className="af-card af-card--dark">
          <h2 id="titulo-escolas-home">É de uma escola ou instituição?</h2>
          <p>
            Levamos contações de história e vivências brincantes até o seu espaço. Todas as
            atividades se adaptam a qualquer local e têm classificação livre.
          </p>
          <p><Link className="botao botao--ocre" href="/para-escolas">Ver como funciona</Link></p>
        </section>

        <SecaoNaMidia registros={clipping} />
      </div>
    </main>
  );
}
