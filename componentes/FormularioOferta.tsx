'use client';

import { useActionState, useEffect, useRef } from 'react';
import { ofertar } from '@/acoes/doacoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { OPCOES_DE_TIPO } from '@/compartilhado/doacoes';
import { LIMITE_OFERTA } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioOferta.tsx — o formulário de `/doar/ofertar`
 * (RF19), ligado à Server Action `ofertar`.
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
 * DOIS CAMPOS, E O QUE NÃO ESTÁ AQUI É A PARTE IMPORTANTE
 * ===================================================================
 *
 * NÃO HÁ CAMPO DE VALOR. Quem oferta dinheiro escreve quanto pretende doar
 * na descrição, em português, como escreveria numa mensagem — e a coluna
 * `valor` só é preenchida pela EQUIPE, depois, com o que de fato entrou
 * (RF21). A razão: um campo "valor" num formulário público transforma uma
 * intenção em número, e número entra em relatório. A ONG passaria a ter uma
 * linha dizendo "R$ 500" para uma doação que talvez nunca chegue — e quem
 * ofertou veria o próprio valor na tela como se estivesse registrado.
 * `lerOferta` (compartilhado/validacao.ts) não lê `valor` em caminho
 * nenhum, então nem uma requisição montada à mão o grava.
 *
 * NÃO HÁ NOME, E-MAIL NEM TELEFONE. Quem oferta tem conta (ver o cabeçalho
 * de acoes/doacoes.ts), e esses dados estão em `public.perfis`. Pedi-los de
 * novo seria coleta acima do mínimo (RNF09) e criaria uma segunda resposta
 * para "quem é esta pessoa".
 *
 * NÃO HÁ CAIXA DE CONSENTIMENTO, ao contrário de /contato, e pelo mesmo
 * motivo de FormularioCandidatura: quem oferta JÁ TEM CONTA, e o
 * consentimento foi dado no cadastro. Uma segunda caixa sem coluna onde
 * gravar — `public.doacoes` não tem `consentimento_dados` — seria teatro.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioOferta() {
  const [estado, enviar, enviando] = useActionState(ofertar, ESTADO_INICIAL);
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
   * O que a pessoa tinha escrito, devolvido pela Action que recusou.
   *
   * Sem isto toda recusa devolve o formulário em branco — com script porque
   * o React 19 dá `reset()` no <form> ao fim de uma action, e sem script
   * porque a página é renderizada do zero. Aqui o que se perderia é a
   * descrição inteira, escrita no celular, de pé (regra 4).
   */
  const valor = (nome: string) => estado.valores?.[nome] ?? '';

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

      <form ref={formulario} id="form-oferta" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        <CampoFormulario
          nome="tipo"
          rotulo="O que você quer doar"
          tipo="select"
          opcoes={OPCOES_DE_TIPO}
          obrigatorio
          ajuda="Se for mais de uma coisa, escolha a principal e conte o resto abaixo."
          erro={estado.erros?.tipo}
          valorInicial={valor('tipo')}
        />

        <CampoFormulario
          nome="descricao"
          rotulo="Conte o que é"
          tipo="textarea"
          obrigatorio
          ajuda={'Quantos livros, que instrumento, que tipo de material — e, se já souber, '
            + 'como pretende entregar. A gente responde dizendo se conseguimos receber. '
            + `Até ${LIMITE_OFERTA} caracteres.`}
          erro={estado.erros?.descricao}
          valorInicial={valor('descricao')}
        />

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar minha oferta'}
        </button>
      </form>
    </>
  );
}
