'use client';

import { useActionState, useEffect, useRef } from 'react';
import { salvarAtividade } from '@/acoes/atividades';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import type { AtividadeDoPainel } from '@/servidor/dados/conteudo';
import { CampoFormulario } from './CampoFormulario';

/**
 * O formulário de corrigir uma atividade (RF03/RF33), ligado à Server Action
 * `salvarAtividade`.
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
 * SEM EDITOR DE TEXTO RICO (regra 7 do CLAUDE.md): `<textarea>` puro. A
 * sinopse vira parágrafos por linha em branco na hora de mostrar
 * (componentes/CardAtividade.ts) — a mesma convenção das notícias, a única
 * formatação que existe e a única que não abre injeção de marcação no site
 * da ONG.
 *
 * ===================================================================
 * DEZ CAMPOS NUM CELULAR: A FICHA TÉCNICA FICA DOBRADA
 * ===================================================================
 *
 * Uma atividade tem título, resumo, sinopse e seis linhas de ficha técnica.
 * Empilhados, são dez campos e uma rolagem longa numa tela de 375px, com a
 * pessoa de pé (regra 4 do CLAUDE.md) — e o gesto mais comum aqui é corrigir
 * uma palavra do texto, não a ficha.
 *
 * Então os seis campos da ficha vivem dentro de um `<details>`, fechado por
 * padrão. É elemento NATIVO do HTML: abre e fecha sem uma linha de
 * JavaScript, o que era requisito (os formulários deste projeto funcionam
 * sem script). Nenhuma biblioteca, nenhum estado de React, nenhum `hidden`
 * controlado por classe.
 *
 * DUAS PRECAUÇÕES, porque um campo dobrado é um campo que pode sumir:
 *
 *  1. os campos continuam DENTRO do `<form>` e são enviados normalmente,
 *     abertos ou fechados — `<details>` fechado esconde, não desabilita;
 *  2. o bloco abre sozinho quando alguma coisa lá dentro voltou com erro
 *     (`open`, abaixo). Sem isso, uma recusa apontaria para um campo
 *     invisível, e o `focus()` do efeito abaixo cairia num elemento que a
 *     pessoa não vê.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

/** Os seis campos que vivem dentro do `<details>`, na ordem da ficha. */
const CAMPOS_DA_FICHA = ['genero', 'duracao', 'elenco', 'classificacao', 'local', 'rider'] as const;

type CampoDeTexto = 'titulo' | 'resumo' | 'descricao' | (typeof CAMPOS_DA_FICHA)[number];

/**
 * `atividade` é OPCIONAL desde o pedido V1: sem ela, o formulário é o de
 * uma atividade NOVA ("adicionar projeto"). Com ela, é o de correção — que
 * era o único caso até aqui.
 *
 * A diferença é só o `id`: vazio significa nova, e `acoes/atividades.ts`
 * deriva o apelido do título. Ver `apelidoDeAtividade`.
 */
export default function FormularioAtividade(
  { atividade }: { atividade?: AtividadeDoPainel }
) {
  const [estado, enviar, salvando] = useActionState(salvarAtividade, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo de componentes/AbasEntrar.tsx: sem isto o
  // foco fica no botão depois de enviar e a mudança só existe para quem
  // enxerga a tela (regra 8). Num texto longo isso é pior ainda: o erro pode
  // estar a três telas de rolagem de distância do botão.
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
   *    autenticação; aqui custaria a sinopse inteira, redigitada no celular);
   * 2. o que veio do banco (`atividade`) — a primeira abertura da tela;
   * 3. vazio.
   *
   * `??`, e não `||`: com `||` um campo que a pessoa APAGOU de propósito
   * (string vazia) voltaria preenchido com o valor antigo do banco, e ela
   * apagaria de novo, e de novo. E `??` já cobre o `null` que vem das
   * colunas opcionais.
   */
  // `atividade?.` desde que o formulário serve também para criar (pedido
  // V1): numa atividade nova não há linha nenhuma de onde tirar valor.
  const valor = (nome: CampoDeTexto) => estado.valores?.[nome] ?? atividade?.[nome] ?? '';

  /**
   * Os dois campos da capa, que existem no ESTADO e na LINHA com nomes
   * diferentes — `imagem_atual`/`imagem_alt` no formulário,
   * `imagem_caminho`/`imagem_alt` na linha. Mesma tradução de
   * componentes/FormularioPublicacao.tsx, e pelo mesmo motivo: unificar com
   * `valor` exigiria um tipo que aceitasse chaves inexistentes, e aí um
   * erro de digitação passaria calado.
   */
  const valorDaImagem = (nome: 'imagem_atual' | 'imagem_alt') => {
    const noEstado = estado.valores?.[nome];
    if (noEstado !== undefined) return noEstado;
    if (nome === 'imagem_atual') return atividade?.imagem_caminho ?? '';
    return atividade?.imagem_alt ?? '';
  };

  // O `<details>` abre sozinho se algum campo de dentro voltou com erro.
  const erroNaFicha = CAMPOS_DA_FICHA.some((nome) => Boolean(estado.erros?.[nome]));

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

      {/*
        `encType="multipart/form-data"` desde que o formulário aceita capa
        (pedido V1). Sem ele, SEM JavaScript, o navegador manda o NOME do
        arquivo em vez do conteúdo. Ver componentes/FormularioPublicacao.tsx.
      */}
      <form ref={formulario} id="form-atividade" className="formulario" action={enviar}
            noValidate aria-describedby="aviso" encType="multipart/form-data">
        {/*
          Qual das 11 está sendo corrigida. Campo escondido e NÃO um
          parâmetro fechado no servidor porque o `<form>` precisa mandá-lo no
          POST para funcionar sem JavaScript.

          ELE NÃO AUTORIZA NADA: quem manda o corpo da requisição escolhe
          este valor. O que impede alguém de alterar o que não pode é
          `ehEquipe()` na Action e a RLS no banco (regras 5 e 6 do
          CLAUDE.md) — nunca o fato de o campo estar escondido. "Escondido"
          aqui quer dizer "não desenhado", não "protegido".
        */}
        {/* VAZIO quando é atividade nova — é assim que a Action sabe que
            deve criar em vez de corrigir. */}
        <input type="hidden" name="id" value={atividade?.id ?? ''} />

        {/* O caminho da capa já gravada: sem ele, corrigir só o texto
            APAGARIA a capa. Ver componentes/FormularioPublicacao.tsx. */}
        <input type="hidden" name="imagem_atual" value={valorDaImagem('imagem_atual')} />

        <CampoFormulario nome="titulo" rotulo="Nome da atividade" tipo="text" obrigatorio
                          ajuda="Aparece como título do cartão na página de projetos."
                          erro={estado.erros?.titulo}
                          valorInicial={valor('titulo')} />

        <CampoFormulario nome="resumo" rotulo="Resumo" tipo="textarea"
                          ajuda="Opcional. Uma ou duas frases, antes da sinopse."
                          erro={estado.erros?.resumo}
                          valorInicial={valor('resumo')} />

        <CampoFormulario nome="descricao" rotulo="Sinopse" tipo="textarea"
                          ajuda="Opcional. Deixe uma linha em branco entre um parágrafo e outro."
                          erro={estado.erros?.descricao}
                          valorInicial={valor('descricao')} />

        <details className="painel__dobra" open={erroNaFicha || undefined}>
          {/*
            O `<summary>` diz O QUE ESTÁ DENTRO, e não só "Ficha técnica".
            DEFEITO VISTO ABRINDO A TELA (regra 10), não pelos testes: com
            `display: flex` no summary, Firefox e Chrome somem com o
            triângulo nativo — o bloco fechado virava uma caixa com um
            título, sem nada que dissesse que abre. A seta voltou pelo CSS
            (`.painel__dobra-titulo::after`), e a linha de dica abaixo do
            nome resolve a outra metade: num celular, saber o que tem lá
            dentro evita abrir para conferir.
          */}
          <summary className="painel__dobra-titulo">
            <span className="painel__dobra-nome">Ficha técnica</span>
            <span className="painel__dobra-dica">
              gênero, duração, elenco, classificação, local, o que precisa
            </span>
          </summary>

          {/* Dito dentro do bloco, e não só no rótulo de cada campo: o que
              fica vazio aqui simplesmente não aparece na página de projetos
              (componentes/CardAtividade.ts omite campo nulo). Sem esta
              frase, um campo em branco parece defeito. */}
          <p className="painel__dobra-ajuda">
            Tudo aqui é opcional. O que ficar em branco não aparece na página de projetos.
          </p>

          <CampoFormulario nome="genero" rotulo="Gênero" tipo="text"
                            erro={estado.erros?.genero} valorInicial={valor('genero')} />

          <CampoFormulario nome="duracao" rotulo="Duração" tipo="text"
                            erro={estado.erros?.duracao} valorInicial={valor('duracao')} />

          <CampoFormulario nome="elenco" rotulo="Elenco" tipo="text"
                            erro={estado.erros?.elenco} valorInicial={valor('elenco')} />

          <CampoFormulario nome="classificacao" rotulo="Classificação" tipo="text"
                            erro={estado.erros?.classificacao}
                            valorInicial={valor('classificacao')} />

          <CampoFormulario nome="local" rotulo="Local" tipo="text"
                            erro={estado.erros?.local} valorInicial={valor('local')} />

          <CampoFormulario nome="rider" rotulo="Precisa de" tipo="text"
                            ajuda="O que a atividade exige do espaço — som, microfone, palco."
                            erro={estado.erros?.rider} valorInicial={valor('rider')} />
        </details>

        <CampoFormulario nome="arquivo" rotulo="Imagem do projeto" tipo="file"
                          accept="image/*"
                          ajuda={atividade?.imagem_caminho
                            ? 'Este projeto já tem imagem. Escolher outra substitui a atual; '
                              + 'deixar em branco mantém a que está lá.'
                            : 'Opcional. Cartaz, ilustração ou foto de cena. JPG, PNG, GIF ou '
                              + 'WebP, até 4 MB.'}
                          erro={estado.erros?.arquivo} />

        <CampoFormulario nome="imagem_alt" rotulo="Descrição da imagem" tipo="text"
                          ajuda={'Obrigatória quando há imagem. Uma frase dizendo o que se vê, '
                            + 'para quem não pode ver.'}
                          erro={estado.erros?.imagem_alt}
                          valorInicial={valorDaImagem('imagem_alt')} />

        {/* O erro de `id` não tem campo visível para se pendurar — o input é
            escondido —, então ele é mostrado aqui. Sem isto, um id inválido
            devolveria a mensagem geral e nada mais. */}
        {estado.erros?.id
          ? <p className="campo__erro" role="alert">{estado.erros.id}</p>
          : null}

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={salvando}>
          {salvando ? 'Guardando...' : 'Guardar correção'}
        </button>
      </form>
    </>
  );
}
