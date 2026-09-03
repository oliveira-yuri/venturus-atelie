'use client';

import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { inscrever } from '@/acoes/inscricoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';
import { mascararTelefone } from './mascara-telefone';

/**
 * componentes/FormularioInscricao.tsx — a inscrição em evento (RF15),
 * ligada à Server Action `inscrever`.
 *
 * MESMO DESENHO de FormularioContato.tsx, e de propósito: caixa de aviso
 * com `role="alert"`, erro vinculado ao campo por `aria-describedby`, foco
 * levado ao primeiro campo com erro, texto do botão mudando enquanto envia.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo: a função devolvida por
 * `useActionState` vai direto no `action` do `<form>`, o Next serializa a
 * referência da Action no HTML, e sem script o navegador faz o POST comum
 * que o servidor atende com a MESMA Action.
 *
 * ===================================================================
 * OS CAMPOS DO RESPONSÁVEL FICAM SEMPRE VISÍVEIS
 * ===================================================================
 *
 * A tentação é escondê-los até a caixa "menor de 18 anos" ser marcada. Não
 * dá, e o motivo é o mesmo de `componentes/MenuMovel.tsx` e dos dois
 * painéis de /entrar: sem JavaScript não existe quem os revele, e o
 * resultado seria uma criança que não consegue ser inscrita — a RN02 exige
 * responsável, o banco recusa a linha sem ele, e a pessoa veria um erro
 * apontando para um campo que ela nunca viu.
 *
 * Eles ficam num `<fieldset>` próprio, com a explicação de quando
 * preencher. Quem está inscrevendo um adulto lê o título e pula.
 *
 * ===================================================================
 * O CPF SÓ EXISTE QUANDO O EVENTO EXIGE (RN06)
 * ===================================================================
 *
 * `exigeCpf` vem do EVENTO lido no banco, não de nada que a tela decida —
 * e `acoes/inscricoes.ts` valida a partir da mesma fonte, porque a Action é
 * alcançável sem passar por aqui (spec §4.5). Esconder o campo é decisão de
 * apresentação; a obrigatoriedade é do servidor.
 *
 * ===================================================================
 * A AUTORIZAÇÃO DE IMAGEM É OPCIONAL, E ISSO É REGRA DA ONG
 * ===================================================================
 *
 * A RN07 diz que nenhuma foto vai ao ar sem autorização registrada. Ela
 * NÃO diz que participar depende de autorizar — e condicionar o acesso à
 * arte à cessão da própria imagem é exatamente o que esta ONG não faz
 * (regra 1 do CLAUDE.md). A caixa desmarcada significa "não autorizou", e é
 * assim que a equipe a vê na lista.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioInscricao(
  { eventoId, exigeCpf }: { eventoId: string; exigeCpf: boolean }
) {
  const [estado, enviar, enviando] = useActionState(inscrever, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO. Aqui isso pesa mais que em qualquer outra tela: são até
  // nove campos, e o que errou pode estar muito acima da dobra.
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

      <form ref={formulario} id="form-inscricao" className="formulario" action={enviar}
            noValidate aria-describedby="aviso-formulario" onChange={mascararTelefone}>
        {/*
          De qual evento. Campo escondido porque a pessoa não escolhe: ela
          chegou pela página do evento. É ENTRADA DE USUÁRIO do mesmo jeito
          — `validarInscricao` confere que é um uuid, e o banco confere que
          o evento existe e está publicado.
        */}
        <input type="hidden" name="evento_id" value={eventoId} />

        <CampoFormulario nome="nome" rotulo="Nome de quem vai participar" tipo="text" obrigatorio
                          autoComplete="name"
                          erro={estado.erros?.nome}
                          valorInicial={valor('nome')} />

        <CampoFormulario nome="email" rotulo="E-mail" tipo="email" obrigatorio
                          autoComplete="email" inputMode="email"
                          ajuda="É por aqui que confirmamos a inscrição."
                          erro={estado.erros?.email}
                          valorInicial={valor('email')} />

        <CampoFormulario nome="telefone" rotulo="Telefone" tipo="tel"
                          autoComplete="tel" inputMode="tel"
                          ajuda="Opcional. Com DDD, como (11) 95396-8344."
                          erro={estado.erros?.telefone}
                          valorInicial={valor('telefone')} />

        {exigeCpf ? (
          <CampoFormulario nome="cpf" rotulo="CPF" tipo="text" obrigatorio
                            inputMode="numeric"
                            ajuda="Este evento acontece em parceria com uma instituição que pede
                                   o CPF de quem participa."
                            erro={estado.erros?.cpf}
                            valorInicial={valor('cpf')} />
        ) : null}

        {/*
          O `<fieldset>` dá ao grupo um nome que o leitor de tela anuncia ao
          entrar nele — sem ele, "Nome" apareceria duas vezes na página sem
          nada dizendo que o segundo é de outra pessoa.
        */}
        <fieldset className="formulario__grupo">
          <legend>Se quem vai participar tem menos de 18 anos</legend>

          <p className="campo__ajuda">
            O Ateliê atende crianças e adolescentes a partir de 10 anos. Nesse caso precisamos
            saber com quem falar — é só marcar a caixa abaixo e preencher os dois campos.
          </p>

          <CampoFormulario nome="eh_menor"
                            rotulo="Quem vai participar tem menos de 18 anos."
                            tipo="checkbox"
                            erro={estado.erros?.eh_menor}
                            valorInicial={valor('eh_menor')} />

          <CampoFormulario nome="responsavel_nome" rotulo="Nome do responsável" tipo="text"
                            erro={estado.erros?.responsavel_nome}
                            valorInicial={valor('responsavel_nome')} />

          <CampoFormulario nome="responsavel_telefone" rotulo="Telefone do responsável" tipo="tel"
                            inputMode="tel"
                            ajuda="Com DDD. É por ele que falamos com a família no dia."
                            erro={estado.erros?.responsavel_telefone}
                            valorInicial={valor('responsavel_telefone')} />
        </fieldset>

        {/*
          RN07. O texto explica o que acontece com a foto e diz que dá para
          participar sem autorizar — sem essa frase, uma caixa de imagem no
          meio de um formulário de inscrição parece obrigatória.
        */}
        <p className="campo__ajuda">
          Nas oficinas e apresentações a gente às vezes fotografa. Nenhuma foto vai para o site
          sem autorização registrada, e você pode participar sem autorizar — é só deixar a caixa
          abaixo desmarcada.
        </p>

        <CampoFormulario nome="autoriza_imagem" rotulo="Autorizo o Ateliê a usar fotos e vídeos em que eu apareça na divulgação das atividades." tipo="checkbox"
                          erro={estado.erros?.autoriza_imagem}
                          valorInicial={valor('autoriza_imagem')} />

        {/*
          Os `{' '}` são obrigatórios: sem eles o JSX come o espaço na
          fronteira texto-elemento. Ver o mesmo bloco em
          componentes/FormularioContato.tsx.
        */}
        <p className="campo__ajuda">
          Usamos estes dados só para organizar a atividade e falar com você sobre ela. O que
          guardamos, por quanto tempo, e como pedir a exclusão está na{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>

        <CampoFormulario nome="consentimento" rotulo="Concordo que o Ateliê use estes dados para organizar esta atividade." tipo="checkbox" obrigatorio
                          erro={estado.erros?.consentimento}
                          valorInicial={valor('consentimento')} />

        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Confirmar inscrição'}
        </button>
      </form>
    </>
  );
}
