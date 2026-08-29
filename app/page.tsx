export default function Home() {
  // main#conteudo e o alvo do link "Pular para o conteudo" (app/layout.tsx).
  // Sem um elemento com esse id, o link aponta para lugar nenhum — e o axe
  // acusa isso no portao da Tarefa 8. Segue o padrao das paginas do site
  // antigo (ex.: site/agenda.html): <main id="conteudo" class="conteudo">.
  return (
    <main id="conteudo" className="conteudo">
      <h1>Ateliê Afro Cultural</h1>
    </main>
  );
}
