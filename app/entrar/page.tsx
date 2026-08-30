// Conteúdo copiado literalmente do HTML original de entrar.html — hoje a
// cópia congelada em testes/apoio/html-original/entrar.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// OS DOIS FORMULÁRIOS ENVIAM DE VERDADE desde a Tarefa 3 da autenticação.
// Até ela, todo campo vinha `desabilitado` e um aviso fixo explicava que o
// envio não existia (decisão da Tarefa A6, correta enquanto não havia
// Server Action nenhuma). Agora "Entrar" chama `entrar` e "Criar conta"
// chama `criarConta` (acoes/autenticacao.ts, Tarefa 1), e aquele aviso saiu
// — a caixa voltou a ser o que era no site antigo: nasce vazia e só mostra
// o resultado de uma tentativa.
//
// O QUE CONTINUA FALTANDO, e não é desta página: com a confirmação de
// e-mail ligada no Supabase (`mailer_autoconfirm: false`), quem cria conta
// só consegue entrar depois de abrir o link que chega por e-mail — e o
// envio nativo tem cota baixíssima (CLAUDE.md, "O que trava hoje", item 1).
// A mensagem de sucesso do cadastro diz isso.
//
// componentes/AbasEntrar.tsx concentra tudo que precisa de navegador (a
// troca de aba, o erro por campo, o foco, a máscara de telefone) — ver o
// comentário daquele arquivo para o porquê de cada decisão, inclusive por
// que os dois painéis chegam abertos no HTML do servidor.
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
