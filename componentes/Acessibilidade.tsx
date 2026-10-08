'use client';
import { useEffect, useState } from 'react';
import { dividirParaLeitura } from '@/compartilhado/leitura-em-voz-alta';
import {
  ESCALAS, PADRAO, proximaEscala, lerPreferencias, gravarPreferencias,
  type Preferencias
} from '@/compartilhado/preferencias';

/**
 * Controles de tamanho de fonte e alto contraste.
 *
 * O servidor nao conhece o localStorage, entao renderiza SEMPRE no estado
 * neutro e o useEffect sincroniza depois. A aparencia correta ja foi aplicada
 * pelo script anti-piscada no <html>, entao ninguem ve o tamanho errado — so
 * o botao leva um instante para se marcar como ativo.
 *
 * =====================================================================
 * NOVO LAYOUT (08/10/2026): A BARRA VIROU O BLOCO "LEITURA" DA FOLHA DO MENU
 * =====================================================================
 *
 * Era uma barra fixa logo abaixo do cabeçalho, comandada pelo "Aa" — mais
 * uma faixa grudada no topo da tela de quem rola (Análise UX-UI, ponto 5:
 * "elementos flutuando por cima do conteúdo"). Agora mora DENTRO da folha
 * do menu (componentes/MenuMovel.tsx), e o "Aa" abre a folha já neste
 * bloco. Quem recolhe e revela é a folha; este componente não tem mais
 * estado de aberto/fechado.
 *
 * O QUE FOI PRESERVADO, e é a regra 8:
 *
 *   1. SEM JAVASCRIPT OS CONTROLES CONTINUAM NA PÁGINA: a folha chega aberta
 *      do servidor, no fluxo, e este bloco vem dentro dela. O "Aa" é um
 *      link para `#barra-acessibilidade` e leva a pessoa até aqui.
 *
 *   2. A ESCALA CONTINUA EM `--escala-fonte`, NÃO EM `zoom`: a escala é o
 *      `font-size` do <html> e todo tamanho do sistema está em rem (ver
 *      estilos/tokens.css), indo até 137,5%.
 *
 * O `id` continua `barra-acessibilidade`: o "Aa" aponta para ele, e os
 * testes de teclado também.
 */
export default function Acessibilidade() {
  const [preferencias, setPreferencias] = useState<Preferencias>({ ...PADRAO });
  const [lido, setLido] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  // "Ouvir esta página": só existe onde o navegador sabe falar. Começa false
  // no servidor e na hidratação, então sem a API (ou sem JavaScript) o botão
  // simplesmente não é desenhado — nunca um botão morto.
  const [sabeFalar, setSabeFalar] = useState(false);
  const [falando, setFalando] = useState(false);

  useEffect(() => {
    setSabeFalar(typeof window !== 'undefined' && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined');
    // Sair da página (navegação do roteador) para a leitura.
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);

  function alternarLeitura() {
    const voz = window.speechSynthesis;
    if (falando) {
      voz.cancel();
      setFalando(false);
      setAnuncio('Leitura parada');
      return;
    }
    const texto = (document.getElementById('conteudo') as HTMLElement | null)?.innerText ?? '';
    const trechos = dividirParaLeitura(texto);
    if (trechos.length === 0) return;
    voz.cancel();
    trechos.forEach((trecho, i) => {
      const fala = new SpeechSynthesisUtterance(trecho);
      fala.lang = 'pt-BR';
      if (i === trechos.length - 1) fala.onend = () => setFalando(false);
      fala.onerror = () => setFalando(false);
      voz.speak(fala);
    });
    setFalando(true);
    setAnuncio('Lendo a página em voz alta');
  }

  useEffect(() => {
    setPreferencias(lerPreferencias(window.localStorage));
    setLido(true);
  }, []);

  // So aplica ao documento; gravar e responsabilidade de executar(), e so por
  // clique — visitante que nunca tocou nos botoes nao grava preferencia
  // nenhuma (senao fica preso ao PADRAO de hoje se ele mudar no futuro).
  useEffect(() => {
    if (!lido) return;
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala-fonte', `${preferencias.escala}%`);
    // `data-fonte="grande"` deixa o CSS ajustar o que fica FIXO na tela (a
    // barra de atalhos do celular) quando a pessoa aumentou a letra — CSS
    // não consegue comparar o valor de uma custom property. O mesmo limite
    // está no script anti-piscada de app/layout.tsx.
    if (preferencias.escala > PADRAO.escala) raiz.setAttribute('data-fonte', 'grande');
    else raiz.removeAttribute('data-fonte');
    if (preferencias.contraste === 'alto') raiz.setAttribute('data-contraste', 'alto');
    else raiz.removeAttribute('data-contraste');
  }, [preferencias, lido]);

  function executar(acao: string) {
    setPreferencias((atual) => {
      const novo = { ...atual };
      if (acao === 'aumentar') novo.escala = proximaEscala(atual.escala, 1);
      if (acao === 'diminuir') novo.escala = proximaEscala(atual.escala, -1);
      if (acao === 'padrao') novo.escala = PADRAO.escala;
      if (acao === 'contraste') novo.contraste = atual.contraste === 'alto' ? 'normal' : 'alto';

      // Quem usa leitor de tela nao ve o texto crescer: precisa ser dito.
      setAnuncio(acao === 'contraste'
        ? (novo.contraste === 'alto' ? 'Alto contraste ativado' : 'Alto contraste desativado')
        : `Texto em ${novo.escala}%`);

      // Grava o objeto novo que acabamos de calcular, nao o estado antigo:
      // so por clique, nunca no mount.
      gravarPreferencias(window.localStorage, novo);
      return novo;
    });
  }

  const alto = lido && preferencias.contraste === 'alto';

  return (
    <div
      id="barra-acessibilidade"
      className="af-a11y"
      role="group"
      aria-label="Acessibilidade"
    >
      <span className="af-a11y__rotulo">Leitura</span>

      <button type="button" className="af-control" data-acao="diminuir"
        aria-label="Diminuir tamanho do texto"
        onClick={() => executar('diminuir')}
        disabled={lido && preferencias.escala === ESCALAS[0]}>A-</button>

      <button type="button" className="af-control" data-acao="padrao"
        aria-label="Tamanho normal do texto"
        onClick={() => executar('padrao')}>A</button>

      <button type="button" className="af-control" data-acao="aumentar"
        aria-label="Aumentar tamanho do texto"
        onClick={() => executar('aumentar')}
        disabled={lido && preferencias.escala === ESCALAS[ESCALAS.length - 1]}>A+</button>

      {/*
        O "✓" é o sinal VISÍVEL de ligado. Só cor não bastava: em alto
        contraste os tokens viram preto e branco, e o botão ligado ficava
        igual ao desligado (MEDIDO em 06/10/2026). Ele é `aria-hidden`
        porque o leitor de tela já anuncia o estado pelo `aria-pressed`.
      */}
      <button type="button" className="af-a11y__contraste" data-acao="contraste"
        aria-pressed={alto}
        onClick={() => executar('contraste')}>
        {alto ? <span aria-hidden="true">✓ </span> : null}Alto contraste
      </button>

      {sabeFalar ? (
        <button type="button" className="af-a11y__contraste" data-acao="ouvir"
          aria-pressed={falando}
          onClick={alternarLeitura}>
          {falando ? 'Parar de ouvir' : 'Ouvir esta página'}
        </button>
      ) : null}

      <p className="apenas-leitor-de-tela" role="status">{anuncio}</p>
    </div>
  );
}
