// Conteúdo copiado literalmente do HTML original de recuperar-acesso.html — hoje a
// cópia congelada em testes/apoio/html-original/recuperar-acesso.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <main id="conteudo" class="conteudo"> preservado,
// <noscript> saiu (a navegação chega pronta no HTML do servidor, via
// app/layout.tsx).
//
// NÃO É ITEM DO MENU — mesma situação de /privacidade
// (testes/apoio/rotas-migracao.mjs: PAGINAS_PRONTAS_FORA_DO_MENU). O
// cabeçalho antigo (site/assets/js/componentes/aac-header.js) marcava o
// link "Entrar" como página atual tanto em entrar.html quanto em
// recuperar-acesso.html (as duas usavam `pagina-atual="entrar"`) —
// componentes/Cabecalho.tsx replica isso pela rota (usePathname).
//
// O FORMULÁRIO ENVIA DE VERDADE desde a Tarefa 3 da autenticação: ele vive
// em componentes/FormularioRecuperar.tsx (Client Component) e chama a
// Server Action `solicitarRecuperacao` (acoes/autenticacao.ts, Tarefa 1).
// Esta página segue Server Component — é ela quem exporta `metadata` — e o
// aviso fixo que dizia "o envio ainda não está ativo" saiu junto com o
// envio desligado.
import FormularioRecuperar from '@/componentes/FormularioRecuperar';

export const metadata = {
  title: 'Recuperar acesso — Ateliê Afro Cultural',
  description: 'Recupere o acesso à sua conta do Ateliê Afro Cultural.'
};

export default function RecuperarAcesso() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Recuperar acesso</h1>
      <p className="destaque">
        Escreva o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
      </p>

      <FormularioRecuperar />
    </main>
  );
}
