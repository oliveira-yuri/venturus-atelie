'use client';

import { createElement, useEffect, useState } from 'react';

/**
 * "Mostrar / Ocultar" ao lado de um campo de senha.
 *
 * No celular, digitar uma senha às cegas, com o polegar, é causa comum de
 * "esqueci minha senha" — a pessoa errou ao CRIAR e nunca soube. O botão
 * deixa conferir o que foi digitado, e some quando a senha volta a ficar
 * escondida.
 *
 * SÓ EXISTE DEPOIS DE HIDRATAR. Sem JavaScript o botão seria um controle
 * morto, e controle morto é pior que ausente: a pessoa tocaria e nada
 * aconteceria. O servidor entrega o campo de senha puro, como sempre foi, e
 * o botão aparece no instante em que passa a funcionar — mesma disciplina do
 * "Aa" do cabeçalho (componentes/Cabecalho.tsx).
 *
 * MUDA O `type` DO <input> DIRETO NO DOM, e não por estado do React: o
 * campo vive em `CampoFormulario`, que é função pura e não sabe de estado, e
 * o `type` é uma propriedade fixa ('password') — o React só reescreve o que
 * muda entre renderizações, então não desfaz o que o botão fez.
 *
 * Escrito com createElement (arquivo `.ts`) pelo mesmo motivo de
 * CampoFormulario: o runtime nativo do Node o importa, e os testes o
 * renderizam sem subir o Next.
 */
export default function AlternarSenha({ alvo }: { alvo: string }) {
  const [hidratado, setHidratado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => { setHidratado(true); }, []);

  if (!hidratado) return null;

  function alternar() {
    const campo = document.getElementById(alvo) as HTMLInputElement | null;
    if (!campo) return;
    const proximo = !visivel;
    campo.type = proximo ? 'text' : 'password';
    setVisivel(proximo);
  }

  return createElement(
    'button',
    {
      type: 'button',
      className: 'campo__alternar',
      'aria-controls': alvo,
      'aria-pressed': visivel,
      onClick: alternar
    },
    visivel ? 'Ocultar' : 'Mostrar',
    createElement('span', { className: 'apenas-leitor-de-tela' }, ' senha')
  );
}
