import Link from 'next/link';

/**
 * Pagina de erro 404 do projeto, no lugar da que o Next entrega por padrao.
 *
 * Nao e um caso de borda: nove dos onze itens do menu principal ainda
 * apontam para rotas que so migram na fase 2 (ROTAS_PENDENTES em
 * testes/links-menu.test.mjs), entao esta e hoje a segunda pagina mais
 * alcancada do site.
 *
 * A pagina padrao do Next quebrava quatro coisas ao mesmo tempo, todas
 * medidas ao vivo antes desta correcao:
 *
 * 1. Sem <main id="conteudo">, o link "Pular para o conteúdo" do layout raiz
 *    (app/layout.tsx) apontava para um alvo inexistente — o primeiro
 *    elemento focavel da pagina levava a lugar nenhum.
 * 2. Sem `main h1`, componentes/FocoNaNavegacao.tsx nao tinha onde pousar o
 *    foco. (A parte do anuncio sonoro foi corrigida la, para nao depender
 *    mais disto; o foco, por definicao, precisa de um elemento.)
 * 3. `<h1 style="font-size:24px">`: px inline ignora --escala-fonte, o que
 *    torna o controle A+ inutil justamente nesta pagina — e acessibilidade
 *    e requisito da ONG, nao preferencia (regra 8 do CLAUDE.md).
 * 4. Texto em ingles dentro de um documento `lang="pt-BR"`, mais um segundo
 *    <title> somado ao do layout.
 *
 * O `metadata` abaixo substitui o titulo do layout raiz: sem ele, cair no
 * 404 vindo da home deixaria `document.title` inalterado — e "o titulo nao
 * mudou" e justamente um dos sintomas medidos.
 */
export const metadata = {
  title: 'Página não encontrada — Ateliê Afro Cultural',
  description: 'O endereço acessado não existe no site do Ateliê Afro Cultural.'
};

export default function NaoEncontrada() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Página não encontrada</h1>

      <p className="destaque">
        O endereço que você abriu não existe, ou a página ainda não está no ar.
      </p>

      <p>
        O site do Ateliê está sendo reconstruído aos poucos: algumas páginas do menu ainda estão
        em preparação e chegam nas próximas semanas.
      </p>

      <p className="chamada-final">
        <Link className="botao" href="/">Voltar para a página inicial</Link>
      </p>

      <p>
        Se você procurava alguma coisa específica, fale com a gente pelo WhatsApp ou pelo e-mail
        no rodapé desta página.
      </p>
    </main>
  );
}
