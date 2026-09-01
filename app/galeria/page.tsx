import { listarAlbunsPublicados } from '@/servidor/dados/galeria';
import { ListaAlbuns } from '@/componentes/ListaAlbuns';

// Conteúdo copiado literalmente do HTML original de galeria.html — hoje a
// cópia congelada em testes/apoio/html-original/galeria.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// O QUE MUDOU NA TAREFA P3 DO PAINEL: até aqui esta página era inteiramente
// estática. RF05 não tinha camada de dados — o site antigo também não
// buscava nada aqui (não existe site/assets/js/dados/galeria.js, nem
// site/assets/js/paginas/galeria.js) — e o <div id="lista-albuns"> trazia o
// parágrafo de estado vazio direto no código. Agora ele traz os álbuns que
// a equipe publicou pelo painel (servidor/dados/galeria.ts, tabela
// public.midia), e o estado vazio virou o `mensagemVazio` de
// componentes/ListaAlbuns.ts.
//
// O TEXTO DO ESTADO VAZIO NÃO MUDOU UMA VÍRGULA, e não pode mudar sem
// decisão: ele é da Tarefa A4 (segunda exceção documentada à regra de não
// inventar conteúdo, aprovada no relatório daquela tarefa) e
// testes/paginas-vazias-a4.test.mjs compara as duas frases inteiras num
// regex só. Enquanto não houver foto publicada — e não há, porque não existe
// UMA autorização de uso de imagem registrada neste projeto (CLAUDE.md, "O
// que trava hoje", item 5) —, esta página continua exatamente como estava.
//
// O <div id="lista-albuns"> CONTINUA EXISTINDO, e não é decoração: ele é o
// id que testes/paridade-texto.test.mjs exclui da comparação byte a byte
// contra o HTML original (`idsExcluidos: ['lista-albuns']`). Sem ele, o
// texto de cada álbum publicado entraria na comparação e a página passaria a
// divergir do original a cada publicação da ONG.
//
// RN07 CONTINUA SENDO DO BANCO, não desta página: a consulta pede
// `publicado` E `autorizacao_registrada`, mas quem garante é a política de
// leitura de `public.midia` — ver o cabeçalho de servidor/dados/galeria.ts.
export const metadata = {
  title: 'Galeria — Ateliê Afro Cultural',
  description: 'Fotos e vídeos das ações e eventos do Ateliê Afro Cultural.'
};

const ESTADO_VAZIO = 'Ainda não publicamos nenhum álbum por aqui. As fotos e vídeos das nossas '
  + 'oficinas e apresentações só entram no ar depois da autorização de uso de imagem de quem '
  + 'aparece neles — assim que os primeiros álbuns estiverem prontos, você encontra os registros '
  + 'aqui.';

export default async function Galeria() {
  // Nunca lança: a política única de erro (servidor/dados/degradacao.ts) faz
  // banco fora do ar virar lista vazia com aviso `[dados]` no log. Aqui não
  // há JSON versionado irmão para cair — e não pode haver: sem autorização
  // de uso de imagem não existe foto para versionar, e a regra 2 proíbe
  // inventar uma.
  const albuns = await listarAlbunsPublicados();

  return (
    <main id="conteudo" className="conteudo">
      <h1>Galeria</h1>
      <p className="destaque">Registros das nossas ações, oficinas e apresentações.</p>
      <div id="lista-albuns">
        <ListaAlbuns albuns={albuns} mensagemVazio={ESTADO_VAZIO} />
      </div>
    </main>
  );
}
