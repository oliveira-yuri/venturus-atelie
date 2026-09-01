'use client';

import { useActionState, useEffect, useRef } from 'react';
import { salvarPublicacao } from '@/acoes/publicacoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import type { Publicacao } from '@/servidor/dados/publicacoes';
import { CampoFormulario } from './CampoFormulario';

/**
 * O formulário de escrever/editar notícia (RF04/RF33), ligado à Server
 * Action `salvarPublicacao`.
 *
 * MESMO DESENHO dos quatro formulários de conta, e de propósito: caixa de
 * aviso que nasce vazia e escondida com `role="alert"`, erro vinculado ao
 * campo por `aria-describedby` (componentes/CampoFormulario.ts), foco levado
 * ao primeiro campo com erro, texto do botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência — quem aprendeu a usar
 * /entrar já sabe usar isto.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST comum que o servidor atende com a MESMA
 * Action. Trocar isto por `onSubmit` + fetch quebraria a tela para quem está
 * sem script, em silêncio.
 *
 * SEM EDITOR DE TEXTO RICO (regra 7 do CLAUDE.md): `<textarea>` puro. O
 * texto vira parágrafos por linha em branco na hora de mostrar
 * (componentes/ListaNoticias.ts), que é a mesma convenção do `descricao` das
 * atividades — a única formatação que existe, e a única que não precisa de
 * biblioteca nenhuma nem abre injeção de marcação no site da ONG.
 *
 * `imagem_caminho`/`imagem_alt` NÃO estão aqui: upload é a Tarefa P3.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioPublicacao({ publicacao }: { publicacao?: Publicacao | null }) {
  const [estado, enviar, salvando] = useActionState(salvarPublicacao, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo de componentes/AbasEntrar.tsx: sem isto o
  // foco fica no botão depois de enviar e a mudança só existe para quem
  // enxerga a tela (regra 8). Num texto longo isso é pior ainda: o erro pode
  // estar a três telas de rolagem de distância do botão.
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
   *    apagar o que a pessoa escreveu. Foi defeito medido na Tarefa 3 da
   *    autenticação, e aqui custaria uma notícia inteira, não oito campos:
   *    com script porque o React 19 dá `reset()` no <form> ao fim de uma
   *    action; sem script porque a página é renderizada do zero.
   * 2. O que veio do banco (`publicacao`) — a primeira abertura da tela de
   *    edição.
   * 3. Vazio — notícia nova.
   *
   * `??`, e não `||`: com `||` um campo que a pessoa APAGOU de propósito
   * (string vazia) voltaria preenchido com o valor antigo do banco, e ela
   * apagaria de novo, e de novo.
   */
  const valor = (nome: 'titulo' | 'resumo' | 'corpo') =>
    estado.valores?.[nome] ?? publicacao?.[nome] ?? '';

  const editando = Boolean(publicacao?.id);

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

      <form ref={formulario} id="form-publicacao" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        {/*
          O id da notícia sendo editada. Campo escondido e NÃO um parâmetro
          fechado no servidor porque o `<form>` precisa mandá-lo no POST para
          funcionar sem JavaScript.

          ELE NÃO AUTORIZA NADA, e é importante dizer: quem manda o corpo da
          requisição escolhe este valor. O que impede alguém de editar o que
          não pode é `ehEquipe()` na Action e a RLS no banco (regras 5 e 6 do
          CLAUDE.md) — nunca o fato de o campo estar escondido. "Escondido"
          aqui quer dizer "não desenhado", não "protegido".
        */}
        <input type="hidden" name="id" value={publicacao?.id ?? ''} />

        <CampoFormulario nome="titulo" rotulo="Título" tipo="text" obrigatorio
                          ajuda="Aparece na lista e no topo da notícia."
                          erro={estado.erros?.titulo}
                          valorInicial={valor('titulo')} />

        <CampoFormulario nome="resumo" rotulo="Resumo" tipo="textarea"
                          ajuda="Opcional. Uma ou duas frases para dar a ideia geral."
                          erro={estado.erros?.resumo}
                          valorInicial={valor('resumo')} />

        <CampoFormulario nome="corpo" rotulo="Texto da notícia" tipo="textarea" obrigatorio
                          ajuda="Deixe uma linha em branco entre um parágrafo e outro."
                          erro={estado.erros?.corpo}
                          valorInicial={valor('corpo')} />

        {/* O erro de `id` não tem campo visível para se pendurar — o input é
            escondido —, então ele é mostrado aqui. Sem isto, um id inválido
            devolveria a mensagem geral e nada mais, e a pessoa não teria como
            saber o que fazer. */}
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
