'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import Link from 'next/link';
import { entrar, criarConta } from '@/acoes/autenticacao';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { formatarTelefone, TIPOS_DE_PESSOA_DECLARADOS } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';
import { mascararTelefone } from './mascara-telefone';

/**
 * As duas abas de /entrar ("Entrar" e "Criar conta") e os dois formulários
 * que elas mostram, ligados às Server Actions `entrar` e `criarConta`.
 *
 * O QUE MUDOU NA TAREFA 3: até aqui todo campo vinha `desabilitado` e a
 * caixa de aviso trazia um texto fixo dizendo que o envio "ainda não está
 * ativo" (Tarefa A6 — decisão correta enquanto não havia Action nenhuma).
 * As Actions existem desde a Tarefa 1, então aquele texto virou mentira e
 * saiu: o aviso volta a ser o que era no site antigo — uma caixa que nasce
 * VAZIA e escondida, e que só ganha conteúdo depois de uma tentativa de
 * envio (site/assets/js/paginas/entrar.js, mostrarAviso/limparAviso).
 *
 * FUNCIONA SEM JAVASCRIPT, e isso é medido, não suposto (ver
 * testes/formularios-conta.test.mjs, que envia os dois formulários com
 * `javascript.enabled=false` no Firefox). O que faz funcionar: a função
 * devolvida por `useActionState` vai direto no `action` do <form>, o Next
 * serializa a referência da Action no HTML (o <form> chega com
 * `method="post"` e o campo escondido `$ACTION_ID_...`), e sem script o
 * navegador faz o POST comum — o servidor roda a MESMA Action e devolve a
 * página inteira renderizada de novo. Trocar isto por `onSubmit` + fetch
 * quebraria os três formulários para quem está sem script, em silêncio.
 *
 * DUAS CONSEQUÊNCIAS DISSO, e as duas moldaram o código abaixo:
 *
 *  1. Sem script, o POST devolve uma página nova — todo `useState` deste
 *     componente nasce do zero. Se a aba atual fosse sempre 'entrar', quem
 *     enviasse "Criar conta" voltaria para a aba "Entrar" com o resultado
 *     do cadastro dentro de um painel que ela não está vendo. Por isso a
 *     aba inicial é DERIVADA da resposta (o `useState` com função inicial
 *     logo abaixo).
 *  2. Sem script, o painel que não é o atual não pode chegar com `hidden`
 *     — ninguém teria como abri-lo, e o formulário de criar conta ficaria
 *     inalcançável. Mesma lição de componentes/MenuMovel.tsx, escrita lá
 *     depois de um defeito real: o servidor entrega os dois painéis
 *     abertos, e o recolhimento só acontece DEPOIS de hidratar. Sem
 *     JavaScript a tela fica com os dois formulários um abaixo do outro —
 *     pior esteticamente, e a única alternativa a "o segundo formulário não
 *     existe".
 *
 * 'use client' pelo que precisa de navegador: a aba, o erro que a Action
 * devolveu, o foco até ele e a máscara de telefone. app/entrar/page.tsx
 * continua Server Component (export `metadata`).
 *
 * O QUE ESTE COMPONENTE NÃO FAZ: validar antes de enviar. A validação que
 * conta é a da Action (spec §4.5 — Server Action é endpoint HTTP público, e
 * qualquer pessoa manda qualquer corpo sem passar por esta tela); duplicá-la
 * aqui seria a mesma regra em dois lugares, livre para divergir. O `required`
 * dos campos obrigatórios continua no HTML, que é aviso do navegador, não
 * defesa — e `noValidate` no <form> mantém a mensagem de erro a mesma para
 * todo mundo, venha ela do navegador ou não.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

/**
 * Leva o foco ao primeiro campo com erro depois de um envio recusado.
 *
 * Mesmo comportamento (e mesmo motivo) de componentes/FormularioNovaSenha
 * .tsx, extraído aqui porque esta tela tem DOIS formulários: sem isto, quem
 * navega por teclado ou leitor de tela envia, o foco fica no botão, e a
 * única pista de que algo mudou é visual — a mensagem aparece acima, fora
 * do caminho. Se o erro não pertence a campo nenhum (credencial que não
 * confere, limite de envio), o foco vai para a caixa de aviso, que é
 * `tabIndex -1` justamente para poder recebê-lo sem entrar na ordem de
 * tabulação.
 */
function useFocoNoErro(estado: EstadoFormulario, formulario: RefObject<HTMLFormElement | null>) {
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
  }, [estado, formulario]);
}

export default function AbasEntrar() {
  const [estadoEntrar, enviarEntrar, entrando] = useActionState(entrar, ESTADO_INICIAL);
  const [estadoCriar, enviarCriar, criando] = useActionState(criarConta, ESTADO_INICIAL);

  // A aba inicial é derivada da resposta — ver a consequência 1 no
  // cabeçalho. Com JavaScript a função só roda na primeira renderização, e
  // a partir daí quem manda é o clique da pessoa; sem JavaScript ela roda a
  // cada POST, que é exatamente quando precisa rodar.
  const [abaAtual, setAbaAtual] = useState<'entrar' | 'criar'>(
    () => (estadoCriar.mensagem ? 'criar' : 'entrar')
  );

  // Ver a consequência 2 no cabeçalho: `hidden` só depois de hidratar.
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => { setHidratado(true); }, []);

  const formularioEntrar = useRef<HTMLFormElement>(null);
  const formularioCriar = useRef<HTMLFormElement>(null);
  useFocoNoErro(estadoEntrar, formularioEntrar);
  useFocoNoErro(estadoCriar, formularioCriar);

  // UMA caixa de aviso para os dois formulários, como no HTML original
  // (`<div id="aviso">` fora dos dois painéis) — e `id` é único, então não
  // pode haver duas. Ela mostra o resultado do formulário da aba atual; sem
  // JavaScript a aba atual já é a de quem acabou de enviar.
  const estadoVisivel = abaAtual === 'criar' ? estadoCriar : estadoEntrar;

  const trocarAba = (destino: 'entrar' | 'criar') => setAbaAtual(destino);

  return (
    <>
      <div className="abas" role="tablist" aria-label="Entrar ou criar conta">
        <button type="button" id="aba-entrar" role="tab" aria-selected={abaAtual === 'entrar'}
                aria-controls="painel-entrar" onClick={() => trocarAba('entrar')}>
          Entrar
        </button>{' '}
        <button type="button" id="aba-criar" role="tab" aria-selected={abaAtual === 'criar'}
                aria-controls="painel-criar" onClick={() => trocarAba('criar')}>
          Criar conta
        </button>
      </div>

      {/* Nasce vazia e escondida, como no HTML original — e `role="alert"`
          para o leitor de tela anunciar a resposta assim que ela aparece,
          sem a pessoa ir procurar. `tabIndex -1` para poder receber o foco
          quando o erro não é de campo nenhum. Mesma estrutura de
          componentes/FormularioNovaSenha.tsx. */}
      <div
        id="aviso"
        className={estadoVisivel.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
        role="alert"
        tabIndex={-1}
        hidden={!estadoVisivel.mensagem}
      >
        <p>{estadoVisivel.mensagem}</p>
      </div>

      <section id="painel-entrar" role="tabpanel" aria-labelledby="aba-entrar"
               hidden={hidratado && abaAtual !== 'entrar'}>
        <form ref={formularioEntrar} id="form-entrar" className="formulario" action={enviarEntrar}
              noValidate aria-describedby="aviso">
          <CampoFormulario nome="email" rotulo="E-mail" tipo="email" prefixo="entrar"
                            autoComplete="email" inputMode="email" obrigatorio
                            erro={estadoEntrar.erros?.email}
                            valorInicial={estadoEntrar.valores?.email} />

          <CampoFormulario nome="senha" rotulo="Senha" tipo="password" prefixo="entrar"
                            autoComplete="current-password" obrigatorio
                            erro={estadoEntrar.erros?.senha} />

          {/* O texto muda junto com o estado: um botão que só troca de cor
              não diz nada a quem não vê a cor (regra 8). */}
          <button type="submit" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>

          <p><Link href="/recuperar-acesso">Esqueci minha senha</Link></p>
        </form>
      </section>

      <section id="painel-criar" role="tabpanel" aria-labelledby="aba-criar"
               hidden={hidratado && abaAtual !== 'criar'}>
        <form ref={formularioCriar} id="form-criar" className="formulario" action={enviarCriar}
              noValidate aria-describedby="aviso" onChange={mascararTelefone}>
          <CampoFormulario nome="nome" rotulo="Nome completo" tipo="text" prefixo="criar"
                            autoComplete="name" obrigatorio erro={estadoCriar.erros?.nome}
                            valorInicial={estadoCriar.valores?.nome} />

          <CampoFormulario nome="email" rotulo="E-mail" tipo="email" prefixo="criar"
                            autoComplete="email" inputMode="email" obrigatorio
                            ajuda="É por aqui que respondemos você."
                            erro={estadoCriar.erros?.email}
                            valorInicial={estadoCriar.valores?.email} />

          <CampoFormulario nome="telefone" rotulo="Telefone" tipo="tel" prefixo="criar"
                            autoComplete="tel" inputMode="numeric"
                            ajuda="Opcional. Com DDD, como (11) 95396-8344."
                            erro={estadoCriar.erros?.telefone}
                            valorInicial={estadoCriar.valores?.telefone} />

          {/*
            TIPO DE PESSOA (pedido V1). Antes o cadastro não perguntava e
            `acoes/autenticacao.ts` gravava 'fisica' fixo — uma escola ou
            empresa entrava como pessoa física e só descobria depois, em
            /minha-conta.

            `TIPOS_DE_PESSOA_DECLARADOS` é a lista de /minha-conta FILTRADA
            (sem "Prefiro não dizer"): aqui o dado NASCE, e aceitar vazio
            seria o padrão silencioso de novo. Em /minha-conta, que edita um
            dado existente numa coluna que aceita nulo, recusar continua
            valendo. Ver o comentário daquela constante.

            Sem `valorInicial` padrão: quem se cadastra ESCOLHE. Um padrão
            pré-marcado é o mesmo defeito de antes, só que visível.
          */}
          <CampoFormulario nome="tipo_pessoa" rotulo="Esta conta é de" tipo="select"
                            prefixo="criar" obrigatorio opcoes={TIPOS_DE_PESSOA_DECLARADOS}
                            ajuda="Uma pessoa, ou uma instituição (escola, empresa, coletivo)."
                            erro={estadoCriar.erros?.tipo_pessoa}
                            valorInicial={estadoCriar.valores?.tipo_pessoa} />

          <CampoFormulario nome="senha" rotulo="Senha" tipo="password" prefixo="criar"
                            autoComplete="new-password" obrigatorio
                            ajuda="Pelo menos 8 caracteres."
                            erro={estadoCriar.erros?.senha} />

          <fieldset className="grupo-campos">
            <legend>Como você quer participar?</legend>
            <CampoFormulario nome="voluntario" rotulo="Quero ser voluntário ou voluntária"
                              tipo="checkbox" prefixo="criar"
                              valorInicial={estadoCriar.valores?.voluntario} />
            <CampoFormulario nome="doador" rotulo="Quero doar ou apoiar"
                              tipo="checkbox" prefixo="criar"
                              valorInicial={estadoCriar.valores?.doador} />
          </fieldset>

          <CampoFormulario nome="maioridade" tipo="checkbox" obrigatorio prefixo="criar"
                            rotulo="Confirmo que tenho 18 anos ou mais"
                            ajuda="Crianças e adolescentes participam das atividades por inscrição feita por um responsável, sem precisar de conta."
                            erro={estadoCriar.erros?.maioridade}
                            valorInicial={estadoCriar.valores?.maioridade} />

          <CampoFormulario nome="consentimento" tipo="checkbox" obrigatorio prefixo="criar"
                            rotulo="Concordo com o uso dos meus dados"
                            ajuda="Usamos seu nome, e-mail e telefone apenas para falar com você sobre voluntariado e doações."
                            erro={estadoCriar.erros?.consentimento}
                            valorInicial={estadoCriar.valores?.consentimento} />

          <button type="submit" disabled={criando}>{criando ? 'Criando...' : 'Criar conta'}</button>
        </form>
      </section>
    </>
  );
}
