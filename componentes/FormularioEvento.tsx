'use client';

import { useActionState, useEffect, useRef } from 'react';
import { salvarEvento } from '@/acoes/eventos';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import type { EventoDoPainel } from '@/servidor/dados/eventos';
import { momentoLocalDe } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * O formulário de cadastrar/corrigir evento (RF13), ligado à Server Action
 * `salvarEvento`.
 *
 * MESMO DESENHO dos outros formulários do site, e de propósito: caixa de
 * aviso que nasce vazia e escondida com `role="alert"`, erro vinculado ao
 * campo por `aria-describedby` (componentes/CampoFormulario.ts), foco levado
 * ao primeiro campo com erro, texto do botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST comum que o servidor atende com a MESMA
 * Action.
 *
 * ===================================================================
 * AS DUAS DATAS SÃO HORA DE PAREDE, DOS DOIS LADOS
 * ===================================================================
 *
 * O `<input type="datetime-local">` manda "2026-11-05T19:00", sem fuso — é
 * a hora que a pessoa escreveu, e a hora que ela quer dizer é a de São
 * Paulo. A conversão para o instante do banco acontece no SERVIDOR
 * (`instanteDeSaoPaulo`, em compartilhado/validacao.ts), nunca aqui: este
 * componente roda no navegador de quem está usando, e converter no cliente
 * significaria converter no fuso DELE — que é o mesmo defeito de sempre, só
 * que com outra vítima.
 *
 * `momentoLocalDe()` é o caminho de volta, e é a única coisa de fuso que
 * este arquivo faz: ele transforma o instante gravado na hora de parede que
 * o campo sabe mostrar. É importado de compartilhado/, ou seja, é a MESMA
 * função dos dois lados — sem isso, abrir um evento das 19h num servidor em
 * UTC mostraria "22:00" no campo e quem apertasse "Guardar" sem mexer em
 * nada empurraria o evento três horas para a frente, a cada edição.
 *
 * SEM EDITOR DE TEXTO RICO (regra 7 do CLAUDE.md): `<textarea>` puro na
 * descrição, como no formulário de notícia.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioEvento({ evento }: { evento?: EventoDoPainel | null }) {
  const [estado, enviar, salvando] = useActionState(salvarEvento, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo de componentes/AbasEntrar.tsx: sem isto o
  // foco fica no botão depois de enviar e a mudança só existe para quem
  // enxerga a tela (regra 8).
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
   * O QUE APARECE EM CADA CAMPO, e a ordem importa.
   *
   * 1. O que a Action devolveu (`estado.valores`) — uma recusa não pode
   *    apagar o que a pessoa escreveu (o React 19 dá `reset()` no <form> ao
   *    fim de uma action; sem script a página é renderizada do zero);
   * 2. o que veio do banco — a primeira abertura da tela de edição;
   * 3. vazio — evento novo.
   *
   * `??`, e não `||`: com `||` um campo que a pessoa APAGOU de propósito
   * (string vazia) voltaria preenchido com o valor antigo do banco, e ela
   * apagaria de novo, e de novo.
   */
  const texto = (nome: 'titulo' | 'descricao' | 'local' | 'faixa_etaria') =>
    estado.valores?.[nome] ?? evento?.[nome] ?? '';

  /**
   * As duas datas, com a conversão de volta. O `??` cobre o mesmo caso de
   * cima; a diferença é que aqui o valor do banco precisa ser traduzido de
   * instante para hora de parede antes de virar `defaultValue`.
   */
  const momento = (nome: 'comeca_em' | 'termina_em') => {
    const daAction = estado.valores?.[nome];
    if (daAction !== undefined) return daAction;

    const doBanco = evento?.[nome];
    return doBanco ? momentoLocalDe(doBanco) : '';
  };

  const editando = Boolean(evento?.id);

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

      <form ref={formulario} id="form-evento" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        {/*
          O id do evento sendo editado. Campo escondido e NÃO um parâmetro
          fechado no servidor porque o `<form>` precisa mandá-lo no POST para
          funcionar sem JavaScript.

          ELE NÃO AUTORIZA NADA: quem manda o corpo da requisição escolhe este
          valor. O que impede alguém de editar o que não pode é `ehEquipe()`
          na Action e a RLS no banco (regras 5 e 6 do CLAUDE.md) — nunca o
          fato de o campo estar escondido. "Escondido" aqui quer dizer "não
          desenhado", não "protegido".
        */}
        <input type="hidden" name="id" value={evento?.id ?? ''} />

        <CampoFormulario nome="titulo" rotulo="Nome do evento" tipo="text" obrigatorio
                          ajuda="Aparece na agenda do site, em destaque."
                          erro={estado.erros?.titulo}
                          valorInicial={texto('titulo')} />

        <CampoFormulario nome="comeca_em" rotulo="Começa em" tipo="datetime-local" obrigatorio
                          ajuda="Dia e hora de São Paulo — a mesma hora que você diria para
                                 quem vai participar."
                          erro={estado.erros?.comeca_em}
                          valorInicial={momento('comeca_em')} />

        <CampoFormulario nome="termina_em" rotulo="Termina em" tipo="datetime-local"
                          ajuda="Opcional. Deixe em branco se não tiver hora para acabar."
                          erro={estado.erros?.termina_em}
                          valorInicial={momento('termina_em')} />

        <CampoFormulario nome="local" rotulo="Onde" tipo="text"
                          ajuda="Opcional. O nome do lugar ou o endereço."
                          erro={estado.erros?.local}
                          valorInicial={texto('local')} />

        <CampoFormulario nome="faixa_etaria" rotulo="Para quem" tipo="text"
                          ajuda='Opcional. Uma frase curta, como "Livre" ou "A partir de 10 anos".'
                          erro={estado.erros?.faixa_etaria}
                          valorInicial={texto('faixa_etaria')} />

        <CampoFormulario nome="descricao" rotulo="Descrição" tipo="textarea"
                          ajuda="Opcional. O que vai acontecer. Se houver vaga limitada ou algo
                                 para levar, escreva aqui."
                          erro={estado.erros?.descricao}
                          valorInicial={texto('descricao')} />

        {/* O erro de `id` não tem campo visível para se pendurar — o input é
            escondido —, então ele é mostrado aqui. Sem isto, um id inválido
            devolveria a mensagem geral e nada mais. */}
        {estado.erros?.id
          ? <p className="campo__erro" role="alert">{estado.erros.id}</p>
          : null}

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={salvando}>
          {salvando ? 'Guardando...' : (editando ? 'Guardar alterações' : 'Guardar rascunho')}
        </button>
      </form>
    </>
  );
}
