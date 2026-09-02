// Conteúdo copiado literalmente do HTML original de quem-somos.html — hoje a
// cópia congelada em testes/apoio/html-original/quem-somos.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <br> -> <br />, <main id="conteudo"> preservado, e o
// bloco <noscript> saiu — a navegação agora chega pronta no HTML do
// servidor (Cabecalho e Rodape em app/layout.tsx). O link para o catálogo
// perdeu o ".html" (/projetos.html -> /projetos) para casar com o esquema
// de rotas do Next; a página em si ainda não existe (chega em fase futura).
//
// Esse link usa next/link, nao <a> cru (revisao final da fase 1). Um <a> cru
// para rota interna faz carga de pagina inteira e passa ao largo de
// componentes/FocoNaNavegacao.tsx — hoje seria inocuo, porque /projetos cai
// no 404 e o Next recarrega a pagina de qualquer jeito, mas as 12 paginas da
// fase 2 vao copiar o padrao que virem aqui.
import Link from 'next/link';
import { Mapa } from '@/componentes/Mapa';

export const metadata = {
  title: 'Quem somos — Ateliê Afro Cultural',
  description: 'A história do Ateliê Afro Cultural, seus idealizadores e os três setores de atuação: literário, musical e artístico criativo.'
};

export default function QuemSomos() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Quem somos</h1>

      <p className="destaque">
        O Ateliê Afro Cultural é um espaço educativo de reflexão, criação e valorização da cultura
        e memória afro brasileira.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-sankofa">
        <h2 id="titulo-sankofa">Sankofa</h2>
        <p>
          Sankofa é um símbolo africano representado por um pássaro que volta a cabeça à sua cauda,
          da filosofia do povo Akan, de Gana. Ele mostra que nunca é tarde para voltar e apanhar
          aquilo que ficou para trás. É essa ideia que dá origem ao Ateliê Afro Cultural.
        </p>
      </section>

      <section aria-labelledby="titulo-onde">
        <h2 id="titulo-onde">Onde estamos</h2>
        <p>
          Ficamos no bairro da Casa Verde, zona norte de São Paulo, um lugar de grande e
          importantíssima historicidade e presença negra. O ateliê propõe atividades que
          possibilitam aproximar as crianças da riqueza cultural afro-brasileira, aprofundando o
          estudo das raízes culturais africanas, visando elevar o respeito e a autoestima da
          criança, na sua percepção e atuação sobre si mesma e seu lugar no mundo.
        </p>
        <p>
          Sabemos que há necessidade de trabalhar e conscientizar o público infantil acerca das
          práticas e representações que configuram o racismo.
        </p>

        {/*
          O MAPA (pedido V1). Aqui a seção não tem o endereço escrito — ela
          fala do BAIRRO, não da rua. O endereço completo está no rodapé de
          toda página e em /contato, e o mapa mostra o mesmo ponto. Ver
          componentes/Mapa.ts.
        */}
        <Mapa />
      </section>

      <section aria-labelledby="titulo-idealizadores">
        <h2 id="titulo-idealizadores">Quem idealizou</h2>
        <p>
          <strong>Wil Oliveira</strong> e <strong>Nathália (Nathy) Monteiro</strong> são um casal de
          artistas e os idealizadores da instituição. Juntos somam habilidades artísticas como
          pesquisa acerca da cultura afro-brasileira, contação de histórias, brincantes de cultura
          popular, dança, música, atuação e escrita, sempre envolvendo a temática afro brasileira e
          a cultura popular.
        </p>
        <p>
          O ateliê ganhou sede na Casa Verde em janeiro de 2020. O casal ficou conhecido em rede
          nacional ao participar do programa Caldeirão do Huck, na Rede Globo, na véspera do Dia
          Internacional Contra a Discriminação Racial.
        </p>
      </section>

      <section aria-labelledby="titulo-setores">
        <h2 id="titulo-setores">Nossos três setores</h2>

        <article className="setor">
          <h3>Literário</h3>
          <p>
            Com livros da temática negra, abrange leituras, pesquisas, análises, reflexões e
            dinâmicas como contação de histórias, exercícios e técnicas de teatro. Todo o conteúdo
            é centralizado na temática negra.
          </p>
        </article>

        <article className="setor">
          <h3>Musical</h3>
          <p>
            Onde as crianças têm contato direto com a musicalidade afro brasileira, através de
            cantigas, instrumentos e corporeidade negra, como por exemplo os movimentos da capoeira.
            A musicalidade de raiz africana forneceu os mais belos elementos da cultura de
            resistência brasileira, desde o jongo, maculelê, maracatu, forró, samba, rap, hip hop,
            funk e tantos outros estilos musicais marcados pela presença de elementos milenares de
            identidade afro.
          </p>
        </article>

        <article className="setor">
          <h3>Artístico criativo</h3>
          <p>
            Onde as crianças exploram sua imaginação através de pinturas em tela, trabalhos com
            materiais reciclados para criar figurinos e cenários, desenhos, esculturas, colagem e
            tantas outras técnicas, para que desenvolvam habilidades artísticas criativas.
          </p>
        </article>
      </section>

      <section aria-labelledby="titulo-publico">
        <h2 id="titulo-publico">Para quem</h2>
        <p>
          Crianças, jovens e adultos, de todas as etnias, descendências e faixas etárias.
        </p>
      </section>

      <p className="chamada-final">
        <Link className="botao" href="/projetos">Conhecer nossos projetos</Link>
      </p>
    </main>
  );
}
