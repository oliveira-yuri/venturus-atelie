'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { solicitarRecuperacao } from '@/acoes/autenticacao';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioRecuperar.tsx — o campo de e-mail de
 * /recuperar-acesso, ligado à Server Action `solicitarRecuperacao` (RF10).
 *
 * Mesmo desenho de componentes/FormularioNovaSenha.tsx, e de propósito: as
 * três telas de conta (entrar, criar conta, recuperar acesso, senha nova)
 * respondem do mesmo jeito — caixa de aviso que nasce vazia e escondida,
 * `role="alert"` para o resultado ser anunciado, erro vinculado ao campo
 * por `aria-describedby` (componentes/CampoFormulario.ts), foco levado ao
 * primeiro campo com erro, e o texto do botão mudando enquanto envia.
 *
 * Até a Tarefa 3 o campo e o botão vinham `desabilitado`, com um aviso fixo
 * dizendo que o envio não estava ativo. O aviso saiu junto com o envio
 * desligado — ver o cabeçalho de componentes/AbasEntrar.tsx.
 *
 * FUNCIONA SEM JAVASCRIPT (medido em testes/formularios-conta.test.mjs): a
 * função de `useActionState` vai direto no `action` do <form>, e sem script
 * o navegador faz o POST comum que o servidor atende com a mesma Action.
 *
 * 'use client' só pelo que precisa de navegador; app/recuperar-acesso/
 * page.tsx continua Server Component (export `metadata`).
 *
 * O FORMULÁRIO CONTINUA NA TELA DEPOIS DO SUCESSO, e isso é decisão: a
 * resposta é a mesma tendo conta ou não (ver `solicitarRecuperacao` em
 * acoes/autenticacao.ts — dizer "não achei esse e-mail" transformaria esta
 * tela num jeito de descobrir quem tem conta aqui), então quem escreveu o
 * e-mail errado precisa poder corrigir e enviar de novo sem voltar página
 * nenhuma.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioRecuperar() {
  const [estado, enviar, pendente] = useActionState(solicitarRecuperacao, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo escrito em componentes/FormularioNovaSenha
  // .tsx: sem isto o foco fica no botão e a mudança só existe para quem
  // enxerga a tela.
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

      <form ref={formulario} id="form-recuperar" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        <CampoFormulario nome="email" rotulo="E-mail" tipo="email"
                          autoComplete="email" inputMode="email" obrigatorio
                          erro={estado.erros?.email}
                          valorInicial={estado.valores?.email} />
        <button type="submit" disabled={pendente}>
          {pendente ? 'Enviando...' : 'Enviar link'}
        </button>
        <p><Link href="/entrar">Voltar para entrar</Link></p>
      </form>
    </>
  );
}
