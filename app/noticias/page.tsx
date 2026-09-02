import { listarPublicadas } from '@/servidor/dados/publicacoes';
import { ListaNoticias } from '@/componentes/ListaNoticias';

// Conteúdo copiado literalmente do HTML original de noticias.html — hoje a
// cópia congelada em testes/apoio/html-original/noticias.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// O QUE MUDOU NA TAREFA P2 DO PAINEL: até aqui esta página era inteiramente
// estática. RF04 não tinha camada de dados — o site antigo também não
// buscava nada aqui (não existe site/assets/js/dados/noticias.js) — e o
// <div id="lista-noticias"> trazia o parágrafo de estado vazio direto no
// código. Agora ele traz o que a equipe publicou pelo painel
// (servidor/dados/publicacoes.ts, tabela public.publicacoes), e o estado
// vazio virou o `mensagemVazio` de componentes/ListaNoticias.ts.
//
// O TEXTO DO ESTADO VAZIO NÃO MUDOU UMA VÍRGULA, e não pode mudar sem
// decisão: ele é da Tarefa A4 (segunda exceção documentada à regra de não
// inventar conteúdo, aprovada no relatório daquela tarefa,
// .superpowers/sdd/2026-08-29-fase-2-bloco-a/tarefa-A4-report.md) e
// testes/paginas-vazias-a4.test.mjs compara as duas frases inteiras num
// regex só. Enquanto a tabela estiver vazia — e ela está, porque a ONG ainda
// não publicou nada —, esta página continua exatamente como estava.
//
// O <div id="lista-noticias"> CONTINUA EXISTINDO, e não é decoração: ele é o
// id que testes/paridade-texto.test.mjs exclui da comparação byte a byte
// contra o HTML original (`idsExcluidos: ['lista-noticias']`). Sem ele, o
// texto de cada notícia publicada entraria na comparação e a página passaria
// a divergir do original a cada publicação da ONG.
export const metadata = {
  title: 'Notícias — Ateliê Afro Cultural',
  description: 'Notícias, campanhas e resultados do Ateliê Afro Cultural.'
};

const ESTADO_VAZIO = 'Ainda não publicamos nenhuma notícia por aqui. Siga a gente no Instagram '
  + 'ou fale pelo WhatsApp para saber das novidades enquanto esta página ganha as primeiras '
  + 'publicações.';

export default async function Noticias() {
  // Nunca lança: a política única de erro (servidor/dados/degradacao.ts) faz
  // banco fora do ar virar lista vazia com aviso `[dados]` no log. Aqui não
  // há JSON versionado irmão para cair — não existe notícia real no
  // repositório e a regra 2 proíbe inventar uma —, então o estado vazio é o
  // comportamento certo, e o log é o único lugar onde ele se distingue de
  // "não há notícia".
  const publicacoes = await listarPublicadas();

  return (
    <main id="conteudo" className="conteudo">
      <h1>Notícias</h1>
      <p className="destaque">O que anda acontecendo no ateliê.</p>

      <div className="af-stripe" aria-hidden="true" />
      <div id="lista-noticias">
        <ListaNoticias publicacoes={publicacoes} mensagemVazio={ESTADO_VAZIO} />
      </div>
    </main>
  );
}
