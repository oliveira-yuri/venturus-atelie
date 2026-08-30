// Conteúdo copiado literalmente do HTML original de noticias.html — hoje a
// cópia congelada em testes/apoio/html-original/noticias.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// Página inteiramente estática: RF04 (notícias e campanhas) não tem tabela
// nem módulo de dados — o site antigo já não buscava nada aqui (não existe
// site/assets/js/dados/noticias.js, nem site/assets/js/paginas/noticias.js;
// confirmado olhando o diretório). O HTML original já trazia o parágrafo
// de estado vazio direto, sem JavaScript no meio.
//
// TEXTO DO ESTADO VAZIO ATUALIZADO NA TAREFA A4: o original ("Nenhuma
// notícia publicada ainda.") é a mesma classe de defeito que a agenda e o
// acervo tinham — um título e uma frase seca, sem dizer o que fazer. O
// texto abaixo é a segunda exceção documentada no brief da Tarefa A4 à
// regra de não inventar conteúdo: aprovado no relatório daquela tarefa
// (.superpowers/sdd/2026-08-29-fase-2-bloco-a/tarefa-A4-report.md) antes de
// a tarefa fechar.
export const metadata = {
  title: 'Notícias — Ateliê Afro Cultural',
  description: 'Notícias, campanhas e resultados do Ateliê Afro Cultural.'
};

export default function Noticias() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Notícias</h1>
      <p className="destaque">O que anda acontecendo no ateliê.</p>
      <div id="lista-noticias">
        <p className="estado estado--vazio">
          Ainda não publicamos nenhuma notícia por aqui. Siga a gente no Instagram ou fale pelo
          WhatsApp para saber das novidades enquanto esta página ganha as primeiras publicações.
        </p>
      </div>
    </main>
  );
}
