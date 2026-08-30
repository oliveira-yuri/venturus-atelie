// Conteúdo copiado literalmente de site/entrar.html (regra 2 do CLAUDE.md:
// conteúdo real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// AS ABAS E OS DOIS FORMULÁRIOS FICAM SEM FUNCIONAR, DE PROPÓSITO — decisão
// da Tarefa A6. O envio (cadastrar/entrar, site/assets/js/dados/auth.js)
// depende de autenticação e de Server Actions, que são Bloco B, e o Bloco B
// depende por sua vez de uma configuração no dashboard do Supabase que
// ainda não foi feita (ver CLAUDE.md, "O que trava hoje"). Portar a TELA
// agora — sem prometer envio nenhum — é o que permite ao grupo ver o site
// completo antes do Bloco B existir.
//
// componentes/AbasEntrar.tsx concentra a única parte realmente interativa
// (a troca de aba, que não depende de backend nenhum) e os dois <form> com
// todo campo e botão desabilitado, mais o aviso "envio ainda não ativo" —
// ver o comentário daquele arquivo para o porquê de cada decisão.
import AbasEntrar from '@/componentes/AbasEntrar';

export const metadata = {
  title: 'Entrar — Ateliê Afro Cultural',
  description: 'Entre na sua conta do Ateliê Afro Cultural ou crie uma para se candidatar ao voluntariado e registrar doações.'
};

export default function Entrar() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Sua conta</h1>

      <p className="destaque">
        A conta serve para acompanhar sua candidatura ao voluntariado e o histórico das suas
        doações. Para se inscrever em um evento ou baixar material do acervo, não é preciso conta.
      </p>

      <AbasEntrar />
    </main>
  );
}
