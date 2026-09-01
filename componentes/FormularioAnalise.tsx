'use client';

import { useActionState, useEffect, useRef } from 'react';
import { responderDoacao } from '@/acoes/doacoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { OPCOES_DE_SITUACAO } from '@/compartilhado/doacoes';
import { LIMITE_RESPOSTA } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioAnalise.tsx — a tela de `/admin/doacoes/responder`
 * (RF20/RF21), ligada à Server Action `responderDoacao`.
 *
 * MESMO DESENHO dos outros formulários (aviso com `role="alert"`, erro
 * vinculado ao campo, foco no primeiro erro, botão que muda de texto), e
 * funciona SEM JAVASCRIPT pelo mesmo mecanismo: a função de
 * `useActionState` vai direto no `action` do `<form>`.
 *
 * ===================================================================
 * O `id` VIAJA NUM CAMPO ESCONDIDO, E É A ÚNICA COISA QUE VIAJA ALÉM DO
 * QUE A EQUIPE DIGITA
 * ===================================================================
 *
 * Nem a descrição, nem o nome de quem doou, nem o e-mail — nada disso vai
 * num `<input type="hidden">`. É a mesma disciplina de
 * componentes/ListaContatos.ts: o formulário leva o id e os campos que a
 * equipe preenche, e mais nada. O que a pessoa escreveu é registro, e um
 * campo escondido com o texto dela seria o caminho por onde ele voltaria
 * ao banco alterado.
 *
 * `lerAnalise` (compartilhado/validacao.ts) também não lê `descricao`, então
 * a trava é dupla: nada manda, e nada leria.
 *
 * ===================================================================
 * O CAMPO DE VALOR SÓ APARECE EM DOAÇÃO DE DINHEIRO
 * ===================================================================
 *
 * `tipoDaDoacao` é o `tipo` da LINHA, lido do banco pela página. Quando a
 * doação é de item, o campo simplesmente não é desenhado — e a Action
 * recusa um `valor` mandado assim mesmo (`validarAnalise`), porque a tela
 * não é a guarda. Desenhar um campo desabilitado no lugar diria à equipe
 * que existe um valor a preencher e que ela não tem permissão, o que é
 * falso nas duas metades.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export type PropsFormularioAnalise = {
  /** O uuid da doação — vai num campo escondido. */
  id: string;
  /** A situação atual, para o `<select>` nascer nela. */
  situacaoAtual: string;
  /** A resposta já escrita, se houver — corrigir é caso normal. */
  respostaAtual: string;
  /** O valor já registrado, em reais, já formatado para edição ('' se não houver). */
  valorAtual: string;
  /** O `tipo` da linha: decide se o campo de valor existe. */
  tipoDaDoacao: string;
};

export default function FormularioAnalise(
  { id, situacaoAtual, respostaAtual, valorAtual, tipoDaDoacao }: PropsFormularioAnalise
) {
  const [estado, enviar, enviando] = useActionState(responderDoacao, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

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
   * O que estava na tela volta em toda recusa.
   *
   * A RESERVA É O QUE ESTÁ NO BANCO, e não string vazia: na PRIMEIRA
   * renderização `estado.valores` é `undefined` (ninguém enviou nada
   * ainda), e é aí que o formulário precisa nascer com a situação e a
   * resposta atuais. Depois de uma recusa vale o que a equipe digitou —
   * senão a correção que ela acabou de fazer sumiria e ela reescreveria
   * tudo.
   */
  const valor = (nome: string, reserva: string) => estado.valores?.[nome] ?? reserva;

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

      <form ref={formulario} id="form-analise" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        <input type="hidden" name="id" value={id} />

        <CampoFormulario
          nome="situacao"
          rotulo="Em que pé está"
          tipo="select"
          opcoes={OPCOES_DE_SITUACAO}
          obrigatorio
          ajuda="Quem ofereceu vê esta situação na conta dele, com estas mesmas palavras."
          erro={estado.erros?.situacao}
          valorInicial={valor('situacao', situacaoAtual)}
        />

        <CampoFormulario
          nome="resposta"
          rotulo="Resposta para quem ofereceu"
          tipo="textarea"
          ajuda={'Aparece na conta da pessoa, do jeito que você escrever. Obrigatória quando '
            + `você recusa — uma recusa sem motivo não explica nada. Até ${LIMITE_RESPOSTA} `
            + 'caracteres.'}
          erro={estado.erros?.resposta}
          valorInicial={valor('resposta', respostaAtual)}
        />

        {tipoDaDoacao === 'recurso_financeiro' ? (
          <CampoFormulario
            nome="valor"
            rotulo="Quanto entrou, em reais"
            inputMode="text"
            ajuda={'Opcional, e só preencha quando o dinheiro já tiver entrado. Escreva com '
              + 'vírgula: 1.234,56. Deixe em branco se ainda não entrou.'}
            erro={estado.erros?.valor}
            valorInicial={valor('valor', valorAtual)}
          />
        ) : null}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar resposta'}
        </button>
      </form>
    </>
  );
}
