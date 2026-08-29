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
 */
export default function Acessibilidade() {
  const [preferencias, setPreferencias] = useState<Preferencias>({ ...PADRAO });
  const [hidratado, setHidratado] = useState(false);
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    setPreferencias(lerPreferencias(window.localStorage));
    setHidratado(true);
  }, []);

  // So aplica ao documento; gravar e responsabilidade de executar(), e so por
  // clique — visitante que nunca tocou nos botoes nao grava preferencia
  // nenhuma (senao fica preso ao PADRAO de hoje se ele mudar no futuro).
  useEffect(() => {
    if (!hidratado) return;
    const raiz = document.documentElement;
    raiz.style.setProperty('--escala-fonte', `${preferencias.escala}%`);
    if (preferencias.contraste === 'alto') raiz.setAttribute('data-contraste', 'alto');
    else raiz.removeAttribute('data-contraste');
  }, [preferencias, hidratado]);

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

  const alto = hidratado && preferencias.contraste === 'alto';

  return (
    <div className="acessibilidade" role="group" aria-label="Acessibilidade">
      <button type="button" data-acao="diminuir" aria-label="Diminuir tamanho do texto"
        onClick={() => executar('diminuir')}
        disabled={hidratado && preferencias.escala === ESCALAS[0]}>A-</button>
      <button type="button" data-acao="padrao" aria-label="Tamanho normal do texto"
        onClick={() => executar('padrao')}>A</button>
      <button type="button" data-acao="aumentar" aria-label="Aumentar tamanho do texto"
        onClick={() => executar('aumentar')}
        disabled={hidratado && preferencias.escala === ESCALAS[ESCALAS.length - 1]}>A+</button>
      <button type="button" data-acao="contraste" aria-pressed={alto}
        onClick={() => executar('contraste')}>Alto contraste</button>
      <p className="apenas-leitor-de-tela" role="status">{anuncio}</p>
    </div>
  );
}
