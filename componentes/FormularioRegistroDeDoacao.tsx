'use client';

import { useActionState, useEffect, useRef } from 'react';
import { registrarDoacao } from '@/acoes/doacoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { OPCOES_DE_TIPO } from '@/compartilhado/doacoes';
import { LIMITE_OFERTA } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioRegistroDeDoacao.tsx — a tela de
 * `/admin/doacoes/registrar` (RF21), ligada à Server Action
 * `registrarDoacao`.
 *
 * É a doação que chegou POR FORA do site: pelo WhatsApp, pelo e-mail, ou
 * na porta da sede. A outra ponta da decisão "ofertar exige conta" — o
 * argumento inteiro está no cabeçalho de acoes/doacoes.ts.
 *
 * MESMO DESENHO dos outros formulários, e funciona SEM JAVASCRIPT pelo
 * mesmo mecanismo (a função de `useActionState` vai direto no `action` do
 * `<form>`).
 *
 * ===================================================================
 * NÃO HÁ CAMPO DE SITUAÇÃO, E ISSO É O QUE A TELA É
 * ===================================================================
 *
 * A linha nasce `recebida` (o literal está em `colunasDoRegistro`, não no
 * FormData). Esta tela existe para o que JÁ CHEGOU — é o que o título dela
 * diz, e é o que a equipe está fazendo quando a abre. Uma doação combinada
 * por fora e ainda não entregue não entra aqui de propósito: registrar uma
 * promessa como fato é o começo de uma prestação de contas que não fecha.
 *
 * ===================================================================
 * NÃO HÁ CAMPO PARA LIGAR A DOAÇÃO A UMA CONTA
 * ===================================================================
 *
 * `perfil_id` fica nulo, sempre, e `lerRegistro` não o lê em caminho
 * nenhum. Um campo desses deixaria a equipe (ou quem montasse a requisição)
 * pendurar uma doação na conta de qualquer pessoa — e ela apareceria em
 * "Sua conta" dessa pessoa como se ela tivesse doado.
 *
 * Quando quem doou TEM conta, o caminho certo é a própria pessoa ofertar em
 * /doar/ofertar, e a equipe responder. A tela diz isso.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioRegistroDeDoacao() {
  const [estado, enviar, enviando] = useActionState(registrarDoacao, ESTADO_INICIAL);
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

      <form ref={formulario} id="form-registro" className="formulario" action={enviar}
            noValidate aria-describedby="aviso">
        <CampoFormulario
          nome="doador_nome"
          rotulo="Quem doou"
          obrigatorio
          autoComplete="off"
          ajuda="Como a pessoa (ou a organização) se apresentou. É o único jeito de saber de quem é a doação."
          erro={estado.erros?.doador_nome}
          valorInicial={valor('doador_nome')}
        />

        <CampoFormulario
          nome="doador_email"
          rotulo="E-mail de quem doou"
          tipo="email"
          inputMode="email"
          autoComplete="off"
          ajuda="Opcional. Se só houver WhatsApp, deixe em branco e anote o contato na descrição."
          erro={estado.erros?.doador_email}
          valorInicial={valor('doador_email')}
        />

        <CampoFormulario
          nome="tipo"
          rotulo="O que foi doado"
          tipo="select"
          opcoes={OPCOES_DE_TIPO}
          obrigatorio
          erro={estado.erros?.tipo}
          valorInicial={valor('tipo')}
        />

        <CampoFormulario
          nome="descricao"
          rotulo="Descrição"
          tipo="textarea"
          obrigatorio
          ajuda={'O que chegou, quando, e por onde — do jeito que ajudar a equipe a lembrar '
            + `depois. Até ${LIMITE_OFERTA} caracteres.`}
          erro={estado.erros?.descricao}
          valorInicial={valor('descricao')}
        />

        <CampoFormulario
          nome="valor"
          rotulo="Quanto entrou, em reais"
          inputMode="text"
          ajuda={'Só para doação em dinheiro. Escreva com vírgula: 1.234,56. Deixe em branco '
            + 'quando for item.'}
          erro={estado.erros?.valor}
          valorInicial={valor('valor')}
        />

        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Registrar doação recebida'}
        </button>
      </form>
    </>
  );
}
