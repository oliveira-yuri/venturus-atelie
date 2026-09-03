'use client';

import { useActionState, useEffect, useRef } from 'react';
import { salvarAviso } from '@/acoes/avisos';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioAviso.tsx — escrever ou corrigir um aviso do mural
 * (RF27).
 *
 * MESMO DESENHO dos outros formulários do painel, e funciona sem
 * JavaScript pelo mesmo mecanismo: a função de `useActionState` vai direto
 * no `action` do `<form>`, e o Next serializa a referência da Action no
 * HTML.
 *
 * ELE NÃO TEM BOTÃO DE PUBLICAR, e a ausência é a regra: `salvarAviso` não
 * conhece a coluna `publicado` (ver compartilhado/validacao.ts,
 * `colunasDoAviso`). Publicar é um botão separado, na lista — e enviar por
 * e-mail é um terceiro. Num mural INTERNO, escrever e publicar no mesmo
 * gesto põe texto na frente de gente que ainda não devia ver.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioAviso(
  { id, titulo, corpo }: { id?: string; titulo?: string; corpo?: string }
) {
  const [estado, enviar, enviando] = useActionState(salvarAviso, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  useEffect(() => {
    if (!jaRenderizou.current) { jaRenderizou.current = true; return; }
    if (estado.ok || !estado.mensagem) return;

    const alvo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? document.getElementById('aviso-formulario');
    alvo?.focus();
  }, [estado]);

  // O que a Action devolveu vence o que veio do banco: numa recusa, é o que
  // a pessoa acabou de escrever que precisa voltar à tela.
  const valor = (nome: string, doBanco?: string) => estado.valores?.[nome] ?? doBanco ?? '';

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

      <form ref={formulario} className="formulario" action={enviar}
            noValidate aria-describedby="aviso-formulario">
        {/* Vazio quando é aviso novo. `validarAviso` trata os dois casos. */}
        <input type="hidden" name="id" value={valor('id', id)} />

        <CampoFormulario nome="titulo" rotulo="Título" tipo="text" obrigatorio
                          ajuda="É o que aparece primeiro no mural."
                          erro={estado.erros?.titulo}
                          valorInicial={valor('titulo', titulo)} />

        <CampoFormulario nome="corpo" rotulo="Aviso" tipo="textarea" obrigatorio
                          ajuda="Escreva como você falaria. Linha em branco separa parágrafo."
                          erro={estado.erros?.corpo}
                          valorInicial={valor('corpo', corpo)} />

        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </>
  );
}
