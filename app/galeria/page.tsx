// Conteúdo copiado literalmente do HTML original de galeria.html — hoje a
// cópia congelada em testes/apoio/html-original/galeria.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// Página inteiramente estática: RF05 (galeria) não tem tabela nem módulo de
// dados — o site antigo já não buscava nada aqui (não existe
// site/assets/js/dados/galeria.js, nem site/assets/js/paginas/galeria.js;
// confirmado olhando o diretório). O HTML original já trazia o parágrafo
// de estado vazio direto, sem JavaScript no meio.
//
// TEXTO DO ESTADO VAZIO ATUALIZADO NA TAREFA A4, mesma decisão de
// app/noticias/page.tsx (ver o comentário lá): segunda exceção documentada
// no brief à regra de não inventar conteúdo, aprovada no relatório daquela
// tarefa antes de fechar. Este texto além disso dá o motivo real de a
// galeria estar vazia — RN07 do escopo (nenhuma foto no ar sem autorização
// de uso de imagem registrada) e o "O que trava hoje" do CLAUDE.md (nenhuma
// autorização de uso de imagem existe ainda) — em vez de um silêncio que
// parece esquecimento.
export const metadata = {
  title: 'Galeria — Ateliê Afro Cultural',
  description: 'Fotos e vídeos das ações e eventos do Ateliê Afro Cultural.'
};

export default function Galeria() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Galeria</h1>
      <p className="destaque">Registros das nossas ações, oficinas e apresentações.</p>
      <div id="lista-albuns">
        <p className="estado estado--vazio">
          Ainda não publicamos nenhum álbum por aqui. As fotos e vídeos das nossas oficinas e
          apresentações só entram no ar depois da autorização de uso de imagem de quem aparece
          neles — assim que os primeiros álbuns estiverem prontos, você encontra os registros
          aqui.
        </p>
      </div>
    </main>
  );
}
