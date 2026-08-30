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
// O FORMULÁRIO FICA SEM FUNCIONAR, DE PROPÓSITO — mesma decisão de
// /entrar (Tarefa A6): o envio (recuperarAcesso, site/assets/js/dados/
// auth.js) depende de autenticação e de Server Actions, Bloco B. O campo e
// o botão vêm desabilitados, com um aviso visível no lugar do envio.
import Link from 'next/link';
import { CampoFormulario } from '@/componentes/CampoFormulario';

export const metadata = {
  title: 'Recuperar acesso — Ateliê Afro Cultural',
  description: 'Recupere o acesso à sua conta do Ateliê Afro Cultural.'
};

const AVISO_RECUPERAR =
  'O envio do link de recuperação ainda não está ativo. Fale com a gente pelo WhatsApp '
  + '(11) 95396-8344 ou pelo e-mail atelieafro@gmail.com.';

export default function RecuperarAcesso() {
  return (
    <main id="conteudo" className="conteudo">
      <h1>Recuperar acesso</h1>
      <p className="destaque">
        Escreva o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
      </p>

      {/* Aviso permanente — ver o comentário do mesmo elemento em
          componentes/AbasEntrar.tsx: aqui não há envio para reagir a, então
          fica sempre visível, sem `hidden`. */}
      <div id="aviso" className="aviso">
        <p>{AVISO_RECUPERAR}</p>
      </div>

      <form id="form-recuperar" className="formulario" noValidate aria-describedby="aviso">
        <CampoFormulario nome="email" rotulo="E-mail" tipo="email"
                          autoComplete="email" inputMode="email" obrigatorio desabilitado />
        <button type="submit" disabled>Enviar link</button>
        <p><Link href="/entrar">Voltar para entrar</Link></p>
      </form>
    </main>
  );
}
