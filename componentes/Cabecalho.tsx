import Link from 'next/link';
import MenuMovel from './MenuMovel';
import Acessibilidade from './Acessibilidade';

/**
 * A marca aparece como tipografia, nao como imagem: a ONG so possui o
 * logotipo bordado nas camisetas, e inventar um simbolo contraria a regra de
 * conteudo. Quando o vetor chegar (decisao D9), entra aqui.
 */
export default function Cabecalho() {
  return (
    <header className="cabecalho">
      <div className="cabecalho__topo">
        <Link className="cabecalho__marca" href="/">
          <span className="cabecalho__marca-nome">Ateliê Afro Cultural</span>
        </Link>
        <Link className="cabecalho__entrar" href="/entrar">Entrar</Link>
        <MenuMovel />
        <Acessibilidade />
      </div>
    </header>
  );
}
