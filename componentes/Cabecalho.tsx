'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MenuMovel from './MenuMovel';
import Acessibilidade from './Acessibilidade';

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
 */
export default function Cabecalho() {
  const rota = usePathname();
  const emEntrar = rota === '/entrar' || rota === '/recuperar-acesso';

  return (
    <header className="cabecalho">
      <div className="cabecalho__topo">
        <Link className="cabecalho__marca" href="/">
          <span className="cabecalho__marca-nome">Ateliê Afro Cultural</span>
        </Link>
        <Link className="cabecalho__entrar" href="/entrar" aria-current={emEntrar ? 'page' : undefined}>
          Entrar
        </Link>
        <MenuMovel />
        <Acessibilidade />
      </div>
    </header>
  );
}
