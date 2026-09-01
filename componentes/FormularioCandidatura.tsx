'use client';

import { useActionState, useEffect, useRef } from 'react';
import { candidatar } from '@/acoes/voluntariado';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import type { Area } from '@/servidor/dados/voluntariado';
import { LIMITE_MOTIVO } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioCandidatura.tsx — o formulário de
 * `/voluntariado/candidatura` (RF25), ligado à Server Action `candidatar`.
 *
 * MESMO DESENHO dos outros formulários do projeto, e de propósito: caixa de
 * aviso que nasce vazia e escondida com `role="alert"`, erro vinculado ao
 * campo por `aria-describedby` (componentes/CampoFormulario.ts), foco
 * levado ao primeiro erro, texto do botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST comum que o servidor atende com a MESMA
 * Action. Trocar isto por `onSubmit` + fetch quebraria a tela para quem
 * está sem script, em silêncio.
 *
 * ===================================================================
 * AS CINCO CAIXAS COMPARTILHAM O MESMO `name`, E ISSO É O QUE FAZ O
 * FORMULÁRIO HTML MANDAR UMA LISTA
 * ===================================================================
 *
 * É o único grupo assim no site. Três consequências, todas visíveis aqui:
 *
 *  1. cada caixa precisa de `valor` (o `value` do input), senão o navegador
 *    manda "on" e as cinco áreas ficam indistinguíveis. É a prop que
 *    nasceu com esta tarefa em CampoFormulario;
 *  2. cada caixa precisa de `prefixo`, senão as cinco geram o MESMO `id`
 *    (`campo-areas`) e todo `label[for=]` aponta para a primeira — o
 *    defeito que a Rodada de correção 1 da Tarefa A6 mediu no navegador
 *    com os dois painéis de /entrar;
 *  3. o que volta numa recusa não cabe numa chave só. `EstadoFormulario.
 *    valores` é `Record<string, string>` indexado pelo `name`, e aqui o
 *    `name` se repete — por isso a Action devolve `area:<id>` = 'on', uma
 *    chave por caixa marcada. As duas pontas do prefixo `area:` estão
 *    amarradas por testes/voluntariado.test.mjs.
 *
 * ===================================================================
 * O ERRO DAS ÁREAS FICA NO `<fieldset>`, NÃO NUMA CAIXA
 * ===================================================================
 *
 * "Escolha pelo menos uma área" não é erro de nenhuma das cinco caixas em
 * particular — é do grupo. Pendurá-lo na primeira faria o leitor de tela
 * anunciar a mensagem ao chegar em "Apoio pedagógico", como se aquela
 * opção estivesse errada. Por isso o `<fieldset>` é quem carrega
 * `aria-describedby` e `aria-invalid`, e é ele que recebe o foco
 * (`tabIndex={-1}`) — a mesma coisa que os outros formulários fazem com o
 * primeiro campo inválido.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

const ID_GRUPO = 'grupo-areas';
const ID_ERRO_AREAS = 'campo-areas-erro';

export default function FormularioCandidatura({ areas }: { areas: Area[] }) {
  const [estado, enviar, enviando] = useActionState(candidatar, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo dos outros formulários: sem isto o foco
  // fica no botão depois de enviar, e a mudança só existe para quem enxerga
  // a tela (regra 8 do CLAUDE.md).
  useEffect(() => {
    if (!jaRenderizou.current) {
      jaRenderizou.current = true;
      return;
    }
    if (estado.ok || !estado.mensagem) return;

    const raiz = formulario.current;
    if (!raiz) return;

    const alvo = raiz.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? document.getElementById('aviso');
    alvo?.focus();
  }, [estado]);

  /**
   * O que a pessoa tinha escolhido, devolvido pela Action que recusou.
   *
   * Sem isto toda recusa devolve o formulário em branco — com script porque
   * o React 19 dá `reset()` no <form> ao fim de uma action, e sem script
   * porque a página é renderizada do zero. Aqui o que se perderia são as
   * caixas marcadas e o texto escrito, no celular, de pé (regra 4).
   */
  const valor = (nome: string) => estado.valores?.[nome] ?? '';

  const erroDasAreas = estado.erros?.areas;

  return (
    <>
      <div
        id="aviso"
        className={estado.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
        role="alert"
        tabIndex={-1}
        hidden={!estado.mensagem}
      >
        <p>{estado.mensagem}</p>
      </div>

      <form ref={formulario} id="form-candidatura" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        {/*
          `grupo-campos--escolhas` leva o alvo de toque de cada área aos
          44px (RNF08). MEDIDO a 375px antes dele: 33px por linha, com cinco
          escolhas adjacentes — errar a de cima marca a de baixo. O porquê
          de ser uma classe própria, e não uma mudança em `.campo--caixa`,
          está em estilos/componentes.css.
        */}
        <fieldset
          className="grupo-campos grupo-campos--escolhas"
          id={ID_GRUPO}
          tabIndex={-1}
          aria-describedby={ID_ERRO_AREAS}
          aria-invalid={erroDasAreas ? 'true' : undefined}
        >
          <legend>Onde você quer ajudar?</legend>

          {/*
            A frase fica DENTRO do grupo, e não como `ajuda` de uma caixa:
            ela vale para as cinco. "Pode marcar mais de uma" é o que a
            /voluntariado já diz em texto ("Muita gente atua em duas"), e
            sem ela um grupo de caixas parece uma escolha única.
          */}
          <p className="campo__ajuda">Pode marcar mais de uma.</p>

          <p className="campo__erro" id={ID_ERRO_AREAS} role="alert">{erroDasAreas || null}</p>

          {areas.map((area) => (
            <CampoFormulario
              key={area.id}
              nome="areas"
              valor={area.id}
              prefixo={area.id}
              rotulo={area.nome}
              tipo="checkbox"
              ajuda={area.descricao}
              valorInicial={valor(`area:${area.id}`)}
            />
          ))}
        </fieldset>

        <CampoFormulario
          nome="mensagem"
          rotulo="Quer contar alguma coisa?"
          tipo="textarea"
          ajuda={'Opcional. Dias e horários que dão para você, o que você já fez, o que quer '
            + `aprender — o que ajudar a gente a começar a conversa. Até ${LIMITE_MOTIVO} `
            + 'caracteres.'}
          erro={estado.erros?.mensagem}
          valorInicial={valor('mensagem')}
        />

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar minha candidatura'}
        </button>
      </form>
    </>
  );
}
