'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A confirmação das ações do painel (pedido V1).
 *
 * =====================================================================
 * UM COMPONENTE SÓ, MONTADO UMA VEZ, QUE COBRE TODOS OS FORMULÁRIOS
 * =====================================================================
 *
 * O pedido é "popup para confirmar todas as ações do admin". As ações do
 * painel são `<form>` com Server Action espalhados por seis listas escritas
 * em `createElement` — componentes de SERVIDOR, que não podem abrir diálogo
 * nenhum.
 *
 * Em vez de converter as seis em Client Components (mais JavaScript em toda
 * tela, e seis lugares para esquecer), este componente escuta o evento de
 * `submit` no DOCUMENTO, na fase de captura. Qualquer formulário que
 * carregue `data-confirmar` é interceptado — inclusive os que ainda não
 * existem. A lista só precisa acrescentar um atributo.
 *
 * `capture: true` importa: sem ele, um `onSubmit` do React já teria rodado
 * antes, e a interceptação chegaria tarde.
 *
 * =====================================================================
 * SEM JAVASCRIPT NÃO HÁ POPUP — E A DEGRADAÇÃO É DESENHADA, NÃO ACIDENTE
 * =====================================================================
 *
 * Este arquivo é `'use client'`: sem script ele não roda, o `submit` não é
 * interceptado, e o formulário envia direto. É o comportamento de hoje.
 *
 * A pergunta que isso levanta é séria: então quem está sem script perde a
 * proteção? Para as ações REVERSÍVEIS (publicar, tirar do ar, mudar a
 * situação de um contato), sim — e o custo é um toque a mais para desfazer,
 * porque desfazer existe.
 *
 * Para as DESTRUTIVAS, não: apagar foto e apagar material já são PÁGINA de
 * confirmação (`/admin/galeria/apagar`, `/admin/acervo/apagar`), que
 * funciona sem script porque é navegação comum. O diálogo daqui se soma a
 * ela; não a substitui. Foi por isso que aquelas páginas nasceram — um
 * `confirm()` não existe sem JavaScript, e este projeto tem gente usando o
 * site sem ele.
 *
 * =====================================================================
 * A CONFIRMAÇÃO DUPLA É DIGITAR, NÃO CLICAR DUAS VEZES
 * =====================================================================
 *
 * O pedido pede confirmação dupla para o que é destrutivo. Dois cliques
 * seguidos, num celular, são um gesto só — o dedo já está descendo. Por
 * isso `data-confirmar-palavra` exige DIGITAR o nome do que se vai apagar:
 * é a única forma de "duplo" que obriga a pessoa a ler o que está na tela.
 *
 * A comparação ignora caixa e espaço das pontas. Exigir precisão de
 * maiúscula num nome que a própria equipe escreveu seria transformar a
 * proteção em obstáculo.
 */
type Pedido = {
  formulario: HTMLFormElement;
  titulo: string;
  corpo: string;
  rotulo: string;
  palavra: string | null;
};

export default function ConfirmacaoDeAcoes() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [digitado, setDigitado] = useState('');
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // `confirmado` é uma marca no próprio formulário, e não estado do React:
  // depois de `requestSubmit()` este componente é reexecutado, e um estado
  // seria lido antes de a submissão acontecer.
  useEffect(() => {
    function aoEnviar(evento: SubmitEvent) {
      const alvo = evento.target;
      if (!(alvo instanceof HTMLFormElement)) return;

      const texto = alvo.dataset.confirmar;
      if (!texto) return;
      if (alvo.dataset.confirmado === 'sim') {
        // Já passou pelo diálogo: deixa seguir, e limpa a marca para que a
        // próxima vez volte a perguntar.
        delete alvo.dataset.confirmado;
        return;
      }

      evento.preventDefault();
      evento.stopPropagation();

      setDigitado('');
      setPedido({
        formulario: alvo,
        titulo: alvo.dataset.confirmarTitulo || 'Confirmar',
        corpo: texto,
        rotulo: alvo.dataset.confirmarRotulo || 'Confirmar',
        palavra: alvo.dataset.confirmarPalavra || null
      });
    }

    document.addEventListener('submit', aoEnviar, { capture: true });
    return () => document.removeEventListener('submit', aoEnviar, { capture: true });
  }, []);

  // `showModal()` (e não o atributo `open`) é o que dá o comportamento de
  // diálogo de verdade: fundo inerte, Esc fecha, foco preso dentro. É
  // trabalho do navegador — reimplementar prisão de foco à mão é onde esse
  // tipo de componente costuma errar.
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (pedido && !elemento.open) {
      elemento.showModal();
      // O foco vai para o campo quando há palavra a digitar; senão o
      // navegador já o põe no primeiro controle.
      campo.current?.focus();
    }
    if (!pedido && elemento.open) elemento.close();
  }, [pedido]);

  function cancelar() {
    setPedido(null);
    setDigitado('');
  }

  function confirmar() {
    if (!pedido) return;
    pedido.formulario.dataset.confirmado = 'sim';
    // `requestSubmit` dispara o evento de submit de novo (agora com a
    // marca), o que faz a Server Action do React rodar normalmente.
    // `submit()` puro NÃO dispara o evento — e a Action nunca aconteceria.
    pedido.formulario.requestSubmit();
    setPedido(null);
    setDigitado('');
  }

  const precisaDigitar = Boolean(pedido?.palavra);
  const confere = !precisaDigitar
    || digitado.trim().toLowerCase() === (pedido?.palavra ?? '').trim().toLowerCase();

  return (
    <dialog
      ref={dialogo}
      className="af-dialogo"
      aria-labelledby="dialogo-titulo"
      /* Esc e clique no fundo fecham: `onClose` cobre os dois, porque o
         navegador emite `close` em ambos. Sem isto o estado ficaria
         apontando para um diálogo já fechado, e a próxima ação não abriria. */
      onClose={cancelar}
      onClick={(evento) => { if (evento.target === dialogo.current) cancelar(); }}
    >
      {pedido ? (
        <div className="af-dialogo__caixa">
          <h2 id="dialogo-titulo" className="af-dialogo__titulo">{pedido.titulo}</h2>
          <p className="af-dialogo__corpo">{pedido.corpo}</p>

          {precisaDigitar ? (
            <p className="af-dialogo__campo">
              <label htmlFor="dialogo-palavra">
                Para confirmar, escreva <strong>{pedido.palavra}</strong>
              </label>
              <input
                id="dialogo-palavra"
                ref={campo}
                type="text"
                autoComplete="off"
                value={digitado}
                onChange={(evento) => setDigitado(evento.target.value)}
              />
            </p>
          ) : null}

          <div className="af-dialogo__acoes">
            {/*
              CANCELAR VEM PRIMEIRO, e é o que recebe o foco quando não há
              palavra a digitar. Numa tela pequena, o botão sob o polegar
              precisa ser o que não faz nada.
            */}
            <button type="button" className="af-dialogo__cancelar" onClick={cancelar}>
              Cancelar
            </button>
            <button
              type="button"
              className={pedido.palavra ? 'af-dialogo__confirmar af-dialogo__confirmar--perigo'
                : 'af-dialogo__confirmar'}
              disabled={!confere}
              onClick={confirmar}
            >
              {pedido.rotulo}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
