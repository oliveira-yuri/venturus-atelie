'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Devolve ao leitor de tela o que a navegacao completa dava de graca.
 *
 * Com carregamento de pagina inteira o foco voltava ao topo e o titulo novo
 * era anunciado. A navegacao parcial do roteador nao faz nem um nem outro, e
 * a falha e silenciosa: a pagina troca e quem nao ve a tela continua no
 * contexto antigo.
 *
 * Dois mecanismos, dois papeis — nao sao redundantes:
 * - o foco no <h1> reposiciona a navegacao por teclado (Tab a partir dai
 *   percorre o conteudo da pagina nova, nao o que sobrou da antiga). Isto
 *   depende de existir `main h1`: sem elemento, nao ha o que focar;
 * - a regiao aria-live garante o anuncio sonoro independente do foco E
 *   independente de existir `main h1` — quando nao existe, o texto anunciado
 *   passa a ser `document.title`, que sempre existe.
 *
 * Ate a revisao final da fase 1 esse segundo item era falso no codigo: um
 * `if (!titulo) return;` saia da funcao ANTES do setAnuncio(), entao os dois
 * mecanismos morriam juntos exatamente no caso que o comentario prometia
 * cobrir. Media-se ao vivo no 404 (destino de nove dos onze itens do menu
 * ate a fase 2): foco no BODY e regiao aria-live vazia. app/not-found.tsx
 * devolveu o `main h1`; esta funcao deixou de depender dele para anunciar.
 *
 * "Heading level 1, {texto}" com foco em elemento tabindex=-1 e anunciado
 * pela maioria dos pares leitor+navegador (NVDA/JAWS com Firefox), mas ha
 * combinacoes documentadas (VoiceOver/Safari, alguns modos de navegacao por
 * texto do NVDA) em que isso chega atenuado ou sem o papel de cabecalho — a
 * regiao aria-live nao depende dessa variacao.
 *
 * O tabindex="-1" e aplicado por script, depois da hidratacao (dentro do
 * useEffect) — nunca no JSX renderizado pelo servidor. Isso importa por dois
 * motivos: nao gera divergencia de hidratacao (testes/hidratacao.test.mjs) e
 * nao entra na ordem natural de Tab, so no foco programatico via .focus().
 */
export default function FocoNaNavegacao() {
  const rota = usePathname();
  const primeira = useRef(true);
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    // Na primeira carga o navegador ja posiciona o foco e nao ha nada para
    // anunciar — o proprio carregamento da pagina e o anuncio.
    if (primeira.current) { primeira.current = false; return; }

    // O foco so tem para onde ir se houver `main h1`. Quando nao houver, a
    // funcao NAO retorna aqui: o anuncio abaixo continua saindo.
    const titulo = document.querySelector<HTMLElement>('main h1');
    if (titulo) {
      titulo.setAttribute('tabindex', '-1');
      titulo.focus();
    }

    // A regiao aria-live ja existe no DOM desde a primeira renderizacao
    // (retornada vazia abaixo) — criar a regiao e preenche-la no mesmo ciclo
    // e um erro comum que faz alguns leitores de tela nunca anunciarem nada.
    // Zerar antes do texto novo, com um instante entre os dois, garante uma
    // mutacao real mesmo que o efeito rode de novo antes do leitor de tela
    // processar a anterior.
    setAnuncio('');
    const tempo = setTimeout(() => {
      // document.title lido AQUI DENTRO, nao no corpo do efeito: o Next
      // aplica o metadata da rota nova de forma assincrona, e no instante em
      // que o efeito roda o titulo ainda pode ser o da rota anterior.
      const texto = titulo?.textContent?.trim() || document.title;
      setAnuncio(`Navegou para: ${texto}`);
    }, 100);
    return () => clearTimeout(tempo);
  }, [rota]);

  // Sem role="status": esse papel ja e usado pelo anuncio de
  // Acessibilidade.tsx, e um segundo elemento com role="status" faria
  // testes/acessibilidade-componente.test.mjs pegar o elemento errado
  // (o primeiro na ordem do DOM, que seria este). aria-live="polite" ja
  // basta para o leitor de tela tratar isto como regiao viva.
  return (
    <p aria-live="polite" className="apenas-leitor-de-tela">{anuncio}</p>
  );
}
