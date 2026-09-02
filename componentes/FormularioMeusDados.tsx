'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { salvarMeusDados } from '@/acoes/conta';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { formatarTelefone, TIPOS_DE_PESSOA } from '@/compartilhado/validacao';
import type { AvisoDaConta } from '@/compartilhado/avisos-da-conta';
import type { Perfil } from '@/servidor/dados/conta';
import { CampoFormulario } from './CampoFormulario';
import { mascararTelefone } from './mascara-telefone';

/**
 * O formulário de "Meus dados" da área do usuário (RF11), ligado à Server
 * Action `salvarMeusDados`.
 *
 * MESMO DESENHO dos outros formulários do projeto, e de propósito: caixa de
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
 * NÃO EXISTE CAMPO ESCONDIDO COM O `id` — E ISSO É A DECISÃO, NÃO UM ESQUECIMENTO
 * ===================================================================
 *
 * `componentes/FormularioAtividade.tsx` tem um `<input type="hidden"
 * name="id">`, porque lá o formulário precisa dizer QUAL das 11 atividades
 * está sendo corrigida. Aqui não: qual linha é atualizada vem da sessão
 * verificada, dentro da Action (`usuarioAtual()`), e nada no corpo da
 * requisição escolhe isso. Um campo escondido com o id daria a impressão de
 * que a escolha é do formulário — e "escondido" nunca quis dizer
 * "protegido".
 *
 * ===================================================================
 * O QUE ESTE FORMULÁRIO NÃO EDITA
 * ===================================================================
 *
 * E-mail, senha e os papéis (`eh_voluntario`/`eh_doador`) ficam de fora. O
 * porquê de cada um está escrito na TELA, em app/minha-conta/page.tsx, e não
 * aqui — quem precisa da explicação é quem está olhando, não quem lê o
 * código. `eh_equipe`, esse, não é assunto de tela nenhuma (regra 6 do
 * CLAUDE.md): ver o cabeçalho de acoes/conta.ts.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

/**
 * UMA CAIXA DE AVISO SÓ, E ISSO FOI DEFEITO VISTO ABRINDO A TELA (regra 10
 * do CLAUDE.md), não previsto.
 *
 * A primeira versão tinha DUAS: a da página, desenhada a partir do `?aviso=`
 * que a Action deixa na URL depois do redirect, e esta, com o
 * `estado.mensagem` do formulário. MEDIDO no Firefox, com sessão de verdade:
 * salvar (URL vira `?aviso=salvo`) e em seguida enviar algo inválido deixava
 * as duas na tela ao mesmo tempo — "Seus dados foram atualizados" logo acima
 * de "Confira o que está marcado abaixo e envie de novo". Duas frases que se
 * contradizem, e a errada em cima.
 *
 * Não dava para a página resolver sozinha: ela é Server Component e não
 * enxerga o estado do formulário. Então o aviso da URL desce para cá, e esta
 * caixa mostra SEMPRE a mensagem mais recente — a do envio que acabou de
 * acontecer, se houver; a que veio na URL, se não. Sem JavaScript vale o
 * mesmo, porque o POST re-renderiza esta mesma decisão no servidor.
 */
export default function FormularioMeusDados(
  { perfil, avisoDaUrl }: { perfil: Perfil; avisoDaUrl: AvisoDaConta | null }
) {
  const [estado, enviar, salvando] = useActionState(salvarMeusDados, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo de componentes/AbasEntrar.tsx: sem isto o
  // foco fica no botão depois de enviar, e a mudança só existe para quem
  // enxerga a tela (regra 8 do CLAUDE.md).
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
   *    apagar o que a pessoa escreveu (defeito medido na Tarefa 3 da
   *    autenticação: o React 19 dá `reset()` no <form> ao fim de uma action,
   *    e sem script a página é renderizada do zero);
   * 2. o que veio do banco (`perfil`) — a primeira abertura da tela;
   * 3. vazio.
   *
   * `??`, e não `||`: com `||` um campo que a pessoa APAGOU de propósito
   * (o telefone, por exemplo) voltaria preenchido com o valor antigo do
   * banco, e ela apagaria de novo, e de novo. E `??` já cobre o `null` que
   * vem das colunas opcionais.
   */
  const valor = (nome: 'nome' | 'telefone' | 'tipo_pessoa') =>
    estado.valores?.[nome] ?? perfil[nome] ?? '';

  // A mais recente vence: o envio que acabou de acontecer, se houver; senão
  // o que a Action deixou na URL antes de redirecionar. Ver acima.
  const mostrar = estado.mensagem
    ? { texto: estado.mensagem, ok: estado.ok }
    : avisoDaUrl;

  return (
    <>
      <div
        id="aviso"
        className={mostrar?.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
        role="alert"
        tabIndex={-1}
        hidden={!mostrar}
      >
        <p>{mostrar?.texto}</p>
      </div>

      <form ref={formulario} id="form-meus-dados" className="formulario" action={enviar}
            onChange={mascararTelefone} noValidate aria-describedby="aviso">
        <CampoFormulario nome="nome" rotulo="Nome" tipo="text" obrigatorio
                          autoComplete="name"
                          ajuda="É o nome que aparece no topo da tela quando você entra."
                          erro={estado.erros?.nome}
                          valorInicial={valor('nome')} />

        {/*
          O telefone chega do banco em dígitos crus (`colunasDoPerfil` grava
          assim, como `criarConta` já fazia) e é DESENHADO com a máscara. O
          contrário — mostrar 11953968344 — faria a pessoa achar que o número
          foi guardado errado e reescrevê-lo.
        */}
        <CampoFormulario nome="telefone" rotulo="Telefone" tipo="tel"
                          autoComplete="tel" inputMode="tel"
                          ajuda="Opcional, com DDD. É por ele que a ONG fala com você quando o e-mail não chega."
                          erro={estado.erros?.telefone}
                          valorInicial={formatarTelefone(valor('telefone'))} />

        <CampoFormulario nome="tipo_pessoa" rotulo="Você fala por" tipo="select"
                          opcoes={TIPOS_DE_PESSOA}
                          ajuda="Ajuda a ONG a saber se está falando com uma pessoa ou com uma organização."
                          erro={estado.erros?.tipo_pessoa}
                          valorInicial={valor('tipo_pessoa')} />

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={salvando}>
          {salvando ? 'Guardando...' : 'Guardar meus dados'}
        </button>
      </form>
    </>
  );
}
