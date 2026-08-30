'use client';

import { useActionState, useEffect, useRef } from 'react';
import { definirNovaSenha } from '@/acoes/autenticacao';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';

/**
 * componentes/FormularioNovaSenha.tsx — os dois campos de senha de
 * /nova-senha, ligados à Server Action `definirNovaSenha`.
 *
 * CLIENT COMPONENT SÓ PELO QUE PRECISA DE NAVEGADOR: mostrar o erro que a
 * Action devolveu e levar o foco até ele. A página continua Server Component
 * (app/nova-senha/page.tsx exporta `metadata` e é ela quem decide, no
 * servidor, se este formulário chega a existir) — mesma divisão de
 * componentes/AbasEntrar.tsx e componentes/MenuMovel.tsx.
 *
 * FUNCIONA SEM JAVASCRIPT, e isso não é acidente: `useActionState` devolve
 * uma função que o React usa como `action` do <form>, e o Next serializa a
 * referência da Action no HTML. Sem script, o navegador faz o POST comum, o
 * servidor executa a mesma Action e devolve a página renderizada de novo —
 * o que se perde é só o foco automático no erro, não o envio. Se um dia
 * alguém trocar isto por `onSubmit` + fetch, a troca de senha deixa de
 * funcionar para quem está sem script, em silêncio.
 *
 * IMPORTAR A ACTION DIRETO é o que permite o parágrafo acima: o Next
 * substitui o import por uma referência à URL da Action no bundle do
 * navegador — o código de `acoes/autenticacao.ts` (e, com ele,
 * `servidor/supabase.ts` e as credenciais) NÃO vai para o cliente. É por
 * isso que o `import 'server-only'` daquele arquivo não quebra este import,
 * e é testes/vazamento.test.mjs que continua provando que nada escapou.
 *
 * O QUE ESTE COMPONENTE NÃO FAZ: validar antes de enviar. A validação que
 * conta é a da Action (spec §4.5 — endpoint HTTP público), e duplicá-la aqui
 * seria a mesma regra em dois lugares, livre para divergir. Quando a Tarefa
 * 3 decidir levar `compartilhado/validacao.ts` também para o navegador, é
 * dela a decisão e é lá que ela vale para os três formulários de uma vez.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioNovaSenha() {
  const [estado, enviar, pendente] = useActionState(definirNovaSenha, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO. Sem isto, quem navega por teclado ou leitor de tela envia
  // o formulário e o foco fica no botão, no fim da página, enquanto a
  // mensagem aparece acima — a pessoa não é levada a nada, e a única pista
  // de que algo aconteceu é visual. Prioridade: o primeiro campo marcado
  // como inválido (é onde está a correção a fazer); se o erro não é de
  // campo nenhum (link vencido, limite de envio), o aviso, que é `tabIndex
  // -1` justamente para poder receber foco sem entrar na ordem de tabulação.
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
      {/* role="alert" para o leitor de tela anunciar assim que a mensagem
          aparece. `hidden` quando não há mensagem: uma caixa vazia com
          borda e sombra no meio da tela é ruído — mesma estrutura de
          /recuperar-acesso e /entrar, onde o aviso é permanente porque lá
          ele não reage a envio nenhum. */}
      <div
        id="aviso"
        className={estado.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
        role="alert"
        tabIndex={-1}
        hidden={!estado.mensagem}
      >
        <p>{estado.mensagem}</p>
      </div>

      <form ref={formulario} id="form-nova-senha" className="formulario" action={enviar} noValidate>
        <CampoFormulario
          nome="senha"
          rotulo="Senha nova"
          tipo="password"
          autoComplete="new-password"
          obrigatorio
          ajuda="Pelo menos 8 caracteres."
          erro={estado.erros?.senha}
        />

        <CampoFormulario
          nome="confirmacao"
          rotulo="Escreva a senha de novo"
          tipo="password"
          autoComplete="new-password"
          obrigatorio
          ajuda="As duas precisam ser iguais. Esta tela não mostra o que você digita."
          erro={estado.erros?.confirmacao}
        />

        <button type="submit" disabled={pendente}>
          {pendente ? 'Salvando...' : 'Salvar senha nova'}
        </button>
      </form>
    </>
  );
}
