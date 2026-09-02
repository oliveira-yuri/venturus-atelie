'use client';
import { useEffect, useState } from 'react';
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
 * O DESIGN SYSTEM v1 MUDOU O LUGAR, NAO O MECANISMO
 * =====================================================================
 *
 * Antes: os quatro botoes ficavam soltos na faixa do cabecalho, visiveis
 * sempre. Agora sao uma BARRA propria, abaixo da faixa ocre, comandada pelo
 * botao "Aa" — que e' o que o sistema desenha (e o que o pedido V1 chama de
 * "acessibilidade acoplada ao menu").
 *
 * DUAS COISAS FORAM PRESERVADAS CONTRA O HANDOFF, e as duas sao a regra 8:
 *
 *   1. A BARRA CHEGA ABERTA DO SERVIDOR. O handoff escreve
 *      `<div class="af-a11y" hidden>` e revela por script — o que deixaria
 *      quem esta sem JavaScript sem NENHUM controle de tamanho de texto,
 *      num site cuja ONG pediu "textos grandes". Aqui `af-a11y--recolhida`
 *      so' entra depois de `hidratado`, e no desktop o CSS a mantem visivel
 *      sempre (ha' espaco, e o principio 6 do proprio sistema diz que a
 *      acessibilidade faz parte da interface, nao de um menu escondido).
 *
 *   2. A ESCALA CONTINUA EM `--escala-fonte`, NAO EM `zoom`. O handoff usa
 *      `document.documentElement.style.zoom = 0.92 | 1 | 1.1`. Aqui a
 *      escala e' o `font-size` do <html> e todo tamanho do sistema esta' em
 *      rem (ver estilos/tokens.css). Motivos: `zoom` cria contexto de
 *      empilhamento e briga com o `position: sticky` do cabecalho novo; ele
 *      escala tambem o que NAO e' texto; e a faixa do handoff vai so' ate'
 *      110%, contra os 137,5% daqui.
 *
 * O ESTADO DE ABERTO/FECHADO NAO MORA AQUI. O botao "Aa" fica dentro da
 * faixa ocre e a barra fica fora dela; duas instancias separadas nao
 * compartilhariam `useState`. Quem guarda e' componentes/Cabecalho.tsx.
 */
export default function Acessibilidade({
  hidratado,
  aberta
}: {
  hidratado: boolean;
  aberta: boolean;
}) {
  const [preferencias, setPreferencias] = useState<Preferencias>({ ...PADRAO });
  const [lido, setLido] = useState(false);
  const [anuncio, setAnuncio] = useState('');

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

  // Recolhida so' depois de hidratar. Sem JavaScript esta classe nunca entra
  // e a barra fica aberta — ver o bloco no topo deste arquivo.
  const classes = ['af-a11y'];
  if (hidratado && !aberta) classes.push('af-a11y--recolhida');

  return (
    <div
      id="barra-acessibilidade"
      className={classes.join(' ')}
      role="group"
      aria-label="Acessibilidade"
    >
      <span className="af-a11y__rotulo">Acessibilidade</span>

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

      <button type="button" className="af-a11y__contraste" data-acao="contraste"
        aria-pressed={alto}
        onClick={() => executar('contraste')}>Alto contraste</button>

      <p className="apenas-leitor-de-tela" role="status">{anuncio}</p>
    </div>
  );
}
