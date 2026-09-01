'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { enviarContato } from '@/acoes/contato';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioContato.tsx — o formulário de /contato (RF07),
 * ligado à Server Action `enviarContato`.
 *
 * MESMO DESENHO dos formulários de conta e dos do painel, e de propósito:
 * caixa de aviso que nasce vazia e escondida com `role="alert"`, erro
 * vinculado ao campo por `aria-describedby` (componentes/
 * CampoFormulario.ts), foco levado ao primeiro campo com erro, texto do
 * botão mudando enquanto envia. Consistência entre telas vale mais que
 * preferência.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST comum que o servidor atende com a MESMA
 * Action. Trocar isto por `onSubmit` + fetch quebraria a tela para quem
 * está sem script, em silêncio.
 *
 * ===================================================================
 * A CAIXA DE AVISO SE CHAMA `aviso-formulario`, E NÃO `aviso`
 * ===================================================================
 *
 * Todas as outras telas usam `id="aviso"`. Aqui não dá: a PÁGINA
 * (app/contato/page.tsx) já desenha um `id="aviso"` para a confirmação que
 * chega pelo `?aviso=` depois do redirect de sucesso. No instante seguinte
 * a um envio que deu certo os dois existem no mesmo documento — um com o
 * texto da confirmação, este vazio e escondido — e dois elementos com o
 * mesmo id fazem `aria-describedby` e `label[for]` apontarem para o
 * primeiro que o navegador encontrar. É a mesma classe de defeito que o
 * `prefixo` de CampoFormulario existe para evitar (medido na Rodada de
 * correção 1 da Tarefa A6, com os dois painéis de /entrar).
 *
 * ===================================================================
 * DOIS AVISOS, DOIS PAPÉIS DIFERENTES
 * ===================================================================
 *
 * Este é `role="alert"`: ele aparece NO MEIO de uma página que já estava
 * aberta (a recusa volta sem trocar de endereço), e interromper é o
 * comportamento certo. O da página é `role="status"`, porque chega junto
 * com uma página nova.
 *
 * ===================================================================
 * O CONSENTIMENTO NÃO PROMETE NADA QUE A ONG NÃO TENHA DECLARADO
 * ===================================================================
 *
 * O texto da caixa diz o que a pessoa está afirmando — que o Ateliê pode
 * usar aqueles dados PARA RESPONDER ESTA MENSAGEM — e manda para
 * /privacidade, que é política real e escrita, em vez de inventar promessa
 * nova aqui (regra 2 do CLAUDE.md). O que /privacidade já diz sobre isto,
 * e por isso o link basta: quais campos são coletados ("Ao enviar uma
 * mensagem"), por quanto tempo ficam guardados, que não são vendidos nem
 * compartilhados, e como pedir a exclusão.
 *
 * A caixa é obrigatória em três camadas independentes: aqui (`obrigatorio`,
 * que é o `required` do HTML), na validação do servidor
 * (`validarContato`), e no banco — `constraint consentimento_obrigatorio
 * check (consentimento_dados)`, em supabase/migrations/004_pessoas.sql.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioContato() {
  const [estado, enviar, enviando] = useActionState(enviarContato, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo dos outros formulários: sem isto o foco
  // fica no botão depois de enviar e a mudança só existe para quem enxerga
  // a tela (regra 8). Numa mensagem longa isso é pior ainda, porque o campo
  // com erro pode estar fora da tela.
  useEffect(() => {
    if (!jaRenderizou.current) {
      jaRenderizou.current = true;
      return;
    }
    if (estado.ok || !estado.mensagem) return;

    const raiz = formulario.current;
    if (!raiz) return;

    const alvo = raiz.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? document.getElementById('aviso-formulario');
    alvo?.focus();
  }, [estado]);

  /**
   * O que a pessoa tinha escrito, devolvido pela Action que recusou.
   *
   * Sem isto toda recusa devolve o formulário em branco — com script porque
   * o React 19 dá `reset()` no <form> ao fim de uma action, e sem script
   * porque a página é renderizada do zero. Aqui o que se perderia é a
   * mensagem inteira.
   */
  const valor = (nome: string) => estado.valores?.[nome] ?? '';

  return (
    <>
      <div
        id="aviso-formulario"
        className={estado.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
        role="alert"
        tabIndex={-1}
        hidden={!estado.mensagem}
      >
        <p>{estado.mensagem}</p>
      </div>

      <form ref={formulario} id="form-contato" className="formulario" action={enviar}
            noValidate aria-describedby="aviso-formulario">
        <CampoFormulario nome="nome" rotulo="Seu nome" tipo="text" obrigatorio
                          autoComplete="name"
                          erro={estado.erros?.nome}
                          valorInicial={valor('nome')} />

        <CampoFormulario nome="email" rotulo="E-mail" tipo="email" obrigatorio
                          autoComplete="email" inputMode="email"
                          ajuda="É por aqui que respondemos."
                          erro={estado.erros?.email}
                          valorInicial={valor('email')} />

        <CampoFormulario nome="telefone" rotulo="Telefone" tipo="tel"
                          autoComplete="tel" inputMode="tel"
                          ajuda="Opcional. Com DDD, como (11) 95396-8344."
                          erro={estado.erros?.telefone}
                          valorInicial={valor('telefone')} />

        <CampoFormulario nome="instituicao" rotulo="Instituição" tipo="text"
                          autoComplete="organization"
                          ajuda="Opcional. Escola, empresa, coletivo, veículo de imprensa."
                          erro={estado.erros?.instituicao}
                          valorInicial={valor('instituicao')} />

        <CampoFormulario nome="mensagem" rotulo="Mensagem" tipo="textarea" obrigatorio
                          ajuda="Conte o que você precisa. Não tem forma certa."
                          erro={estado.erros?.mensagem}
                          valorInicial={valor('mensagem')} />

        {/*
          O link para a política NÃO cabe dentro de CampoFormulario: `rotulo`
          e `ajuda` são strings, e um link dentro de um <label> de caixa de
          marcar ainda tem outro problema — clicar no link marcaria a caixa.
          Por isso o texto explicativo é um parágrafo próprio, ANTES da
          caixa, e a caixa diz a afirmação em uma frase.

          Os `{' '}` são obrigatórios: sem eles o JSX come o espaço na
          fronteira texto-elemento e sai "na política de privacidade.Você"
          (o defeito real do e-mail colado que motivou
          testes/paridade-texto.test.mjs). Esta frase é comparada por
          igualdade em testes/contato.test.mjs, exatamente por isso.
        */}
        <p className="campo__ajuda">
          Usamos o que você escrever aqui só para responder você. O que guardamos, por quanto
          tempo, e como pedir a exclusão está na{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>

        <CampoFormulario nome="consentimento" rotulo="Concordo que o Ateliê use estes dados para responder minha mensagem." tipo="checkbox" obrigatorio
                          erro={estado.erros?.consentimento}
                          valorInicial={valor('consentimento')} />

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar mensagem'}
        </button>
      </form>
    </>
  );
}
