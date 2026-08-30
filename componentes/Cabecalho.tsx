'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MenuMovel from './MenuMovel';
import Acessibilidade from './Acessibilidade';
import { sair } from '@/acoes/autenticacao';

/**
 * O tipo é declarado AQUI, e não importado de `servidor/sessao.ts` (onde
 * `SessaoNoCabecalho` nasce), por causa da fronteira: aquele módulo começa
 * com `import 'server-only'`, e um Client Component que o importa quebra a
 * build de propósito. `import type` é apagado na compilação e passaria — mas
 * deixaria neste arquivo uma linha que só funciona porque um detalhe do
 * compilador a apaga. As duas formas são conferidas uma contra a outra em
 * `app/layout.tsx`, que enxerga os dois lados; se divergirem, o TypeScript
 * acusa lá.
 */
type SessaoNoCabecalho = { nome: string };

/**
 * A marca aparece como tipografia, nao como imagem: a ONG so possui o
 * logotipo bordado nas camisetas, e inventar um simbolo contraria a regra de
 * conteudo. Quando o vetor chegar (decisao D9), entra aqui.
 *
 * 'use client' e usePathname() entram na Tarefa A6, só para marcar
 * aria-current no link "Entrar" — mesmo comportamento de
 * site/assets/js/componentes/aac-header.js (`atual === 'entrar'`), que
 * marcava esse link tanto em entrar.html quanto em recuperar-acesso.html
 * (as duas páginas setavam `pagina-atual="entrar"` no custom element
 * antigo — MEDIDO lendo os dois arquivos, não suposto). A marca e o menu
 * (MenuMovel) continuam com sua própria lógica de rota atual.
 *
 * CUSTO MEDIDO (revisão da Rodada de correção 1 da Tarefa A6): virar Client
 * Component custa +416 bytes de JS por página — 0,07% do JS que o site já
 * servia — contra os 132 B que uma alternativa cirúrgica (só o link
 * "Entrar" como Client Component, Cabecalho continuando Server Component)
 * economizaria. Decisão de quem revisou: não vale reescrever por essa
 * diferença — o número fica registrado aqui para não precisar remedir se a
 * pergunta voltar.
 *
 * =====================================================================
 * A SESSÃO APARECE AQUI (Tarefa 4 da autenticação)
 * =====================================================================
 *
 * Até esta tarefa dava para entrar e o cabeçalho continuava dizendo
 * "Entrar", para sempre, sem nenhum jeito de sair. Quem entrava não tinha
 * como saber que tinha entrado — e num celular compartilhado pela equipe da
 * ONG (regra 4 do CLAUDE.md) "não dá para sair" significa a sessão de uma
 * pessoa ficar aberta na mão da seguinte.
 *
 * QUEM LÊ A SESSÃO NÃO É ESTE ARQUIVO. Client Component não fala com o
 * Supabase neste projeto (spec §4.1) — nem poderia, `servidor/` inteiro é
 * `import 'server-only'`. Quem pergunta é `app/layout.tsx`, que é Server
 * Component, e manda para cá o MÍNIMO: um nome. Nem id, nem e-mail, nem o
 * objeto de usuário do Supabase — tudo que entra por prop num Client
 * Component fica escrito, em texto legível, no HTML de toda página.
 *
 * E NADA DISTO AUTORIZA COISA ALGUMA. O cabeçalho decide o que DESENHAR.
 * Quem decide o que pode ser lido ou gravado é a RLS do banco, sempre (regra
 * 6). Se um dia aparecer um sinal de equipe aqui, ele serve para mostrar um
 * link a mais, nunca para liberar uma operação.
 *
 * "SAIR" É UM <form> COM SERVER ACTION, e não um botão com onClick: assim
 * ele funciona sem JavaScript, pelo mesmo mecanismo já medido nos
 * formulários de /entrar (o Next serializa a referência da Action no HTML e
 * o navegador faz um POST comum). Um `onClick` deixaria justamente quem está
 * sem script preso na sessão.
 *
 * NADA AQUI FICA ESCONDIDO ATRÁS DE `hidden`. É a lição que MenuMovel.tsx e
 * AbasEntrar.tsx já carregam escrita: o servidor entrega o que se vê, e o
 * que muda depois da hidratação é só recolhimento visual. Aqui o servidor
 * decide entre "Entrar" e "Sair" ANTES de mandar o HTML — sem script, a
 * pessoa vê o mesmo cabeçalho que com script.
 */
export default function Cabecalho({ sessao }: { sessao?: SessaoNoCabecalho | null }) {
  const rota = usePathname();
  const emEntrar = rota === '/entrar' || rota === '/recuperar-acesso';

  return (
    <header className="cabecalho">
      <div className="cabecalho__topo">
        <Link className="cabecalho__marca" href="/">
          <span className="cabecalho__marca-nome">Ateliê Afro Cultural</span>
        </Link>

        {sessao ? (
          /*
            SEM aria-current no "Sair", e isso é decisão, não esquecimento: o
            atributo marca "este link leva à página em que você está", e
            "Sair" não leva a página nenhuma — é uma ação. Quem está
            autenticado e abre /entrar não vê marcação em lugar nenhum do
            cabeçalho, o que está certo: nenhum controle visível ali aponta
            para /entrar.
          */
          <div className="cabecalho__sessao">
            {/*
              O nome é informação, não controle: fica como texto. O
              `aria-hidden` NÃO entra aqui — quem usa leitor de tela precisa
              saber com qual conta está, tanto quanto quem enxerga.
            */}
            <span className="cabecalho__sessao-nome">{sessao.nome}</span>
            <form action={sair}>
              <button type="submit" className="cabecalho__entrar cabecalho__sair">
                Sair
              </button>
            </form>
          </div>
        ) : (
          <Link className="cabecalho__entrar" href="/entrar" aria-current={emEntrar ? 'page' : undefined}>
            Entrar
          </Link>
        )}

        <MenuMovel />
        <Acessibilidade />
      </div>
    </header>
  );
}
