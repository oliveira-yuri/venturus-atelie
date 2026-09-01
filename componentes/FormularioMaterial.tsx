'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { enviarMaterial } from '@/acoes/acervo';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';
import {
  LIMITE_MATERIAL_BYTES, LIMITE_TITULO, LIMITE_RESUMO, LIMITE_TEMA, LIMITE_FAIXA_ETARIA,
  TIPOS_DE_MATERIAL_ACEITOS, emMegabytes
} from '@/compartilhado/validacao';

/**
 * O formulário de subir material do acervo (RF37), ligado à Server Action
 * `enviarMaterial`.
 *
 * IRMÃO DE componentes/FormularioMidia.tsx, e de propósito: mesma caixa de
 * aviso com `role="alert"`, mesmo erro vinculado ao campo por
 * `aria-describedby` (componentes/CampoFormulario.ts), mesmo foco levado ao
 * primeiro campo com erro, mesmo texto de botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência — e quem for mexer
 * numa das duas precisa saber que a outra existe.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST multipart comum que o servidor atende
 * com a MESMA Action.
 *
 * O QUE O SCRIPT ACRESCENTA — e é tudo enfeite útil, nunca requisito:
 *
 *   1. O AVISO DE TAMANHO ANTES DE ENVIAR. Sem ele, um PDF de 6 MB é
 *      enviado inteiro por uma rede de celular para só então ser recusado
 *      pelo servidor. O servidor continua sendo quem decide
 *      (`validarMaterial`) — isto só evita a viagem.
 *   2. O NOME E O TAMANHO do arquivo escolhido, escritos na tela. No
 *      celular o seletor fecha e não sobra confirmação nenhuma de qual
 *      arquivo foi escolhido — e aqui isso importa mais que na galeria: um
 *      PDF não tem miniatura, e "Documento.pdf" e "Documento (1).pdf"
 *      moram na mesma pasta.
 *   3. "Enviando o material..." enquanto sobe. Um envio de 3 MB em rede de
 *      celular demora, e uma tela parada parece travada — a pessoa aperta
 *      de novo, e sobem dois.
 *
 * ===================================================================
 * O QUE ESTA TELA NÃO TEM, E POR QUÊ
 * ===================================================================
 *
 * NÃO TEM CAIXA DE AUTORIZAÇÃO DE USO DE IMAGEM. A RN07 é sobre a imagem de
 * pessoas, e material de acervo é documento feito para circular — pedir
 * aqui uma declaração que não se aplica ensinaria a marcar sem ler, que é
 * exatamente o que a caixa da galeria existe para evitar.
 *
 * NÃO TEM PRÉVIA DO PDF. Um `<iframe>` ou `<embed>` com o arquivo escolhido
 * dependeria de `blob:`, que a política de conteúdo deste projeto não
 * permite (middleware.ts) — daria um retângulo em branco, em silêncio. O
 * nome e o tamanho resolvem o que falta saber.
 *
 * NÃO TEM PROGRESSO REAL (uma barra que anda): exigiria `XMLHttpRequest`
 * com `upload.onprogress`, ou seja, mandar o formulário por script em vez
 * de pela Action — e aí a tela só funcionaria COM JavaScript, que é o
 * contrário do que este projeto faz.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioMaterial() {
  const [estado, enviar, enviando] = useActionState(enviarMaterial, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  /** O que o script sabe sobre o arquivo escolhido. `null` = nada escolhido. */
  const [escolhido, setEscolhido] = useState<{ nome: string; bytes: number } | null>(null);

  // FOCO NO ERRO — mesmo motivo de componentes/FormularioMidia.tsx: sem
  // isto o foco fica no botão depois de enviar, e a mudança só existe para
  // quem enxerga a tela (regra 8).
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
   * O que a pessoa já tinha escrito, devolvido pela Action que recusou.
   *
   * O ARQUIVO NÃO ESTÁ AQUI e não pode estar: nenhum navegador deixa um
   * site preencher um `<input type="file">`. É por isso que a mensagem de
   * recusa da Action diz, com todas as letras, que o arquivo precisa ser
   * escolhido de novo (ver acoes/acervo.ts).
   */
  const valor = (nome: 'titulo' | 'descricao' | 'tema' | 'faixa_etaria') =>
    estado.valores?.[nome] ?? '';

  const grandeDemais = escolhido !== null && escolhido.bytes > LIMITE_MATERIAL_BYTES;

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

      <form ref={formulario} id="form-material" className="formulario" action={enviar}
            noValidate aria-describedby="aviso" encType="multipart/form-data">

        <CampoFormulario
          nome="arquivo" rotulo="Arquivo do material" tipo="file" obrigatorio
          accept={TIPOS_DE_MATERIAL_ACEITOS}
          ajuda={`PDF, até ${emMegabytes(LIMITE_MATERIAL_BYTES)}. Se o material está em Word `
            + 'ou em slides, exporte como PDF antes.'}
          erro={estado.erros?.arquivo}
        />

        {/*
          O que o script acrescenta ao campo de arquivo (ver o cabeçalho).
          Fica FORA do CampoFormulario porque não é erro do servidor: é uma
          observação nossa sobre o que está escolhido AGORA, e some quando a
          pessoa escolhe outro.

          `role="status"` e não `alert`: não interrompe — a pessoa acabou de
          fazer um gesto e isto é a resposta dele.
        */}
        <p className={grandeDemais ? 'midia__escolhido midia__escolhido--grande' : 'midia__escolhido'}
           role="status" hidden={escolhido === null}>
          {escolhido === null
            ? null
            : grandeDemais
              ? `${escolhido.nome} — ${emMegabytes(escolhido.bytes)}. Este arquivo passa do `
                + `limite de ${emMegabytes(LIMITE_MATERIAL_BYTES)}. Um PDF costuma caber depois `
                + 'de reduzido: procure "comprimir PDF" no celular, ou "salvar como PDF '
                + 'reduzido" no computador.'
              : `Escolhido: ${escolhido.nome} — ${emMegabytes(escolhido.bytes)}.`}
        </p>

        <CampoFormulario
          nome="titulo" rotulo="Nome do material" tipo="text" obrigatorio
          ajuda={'É o que aparece na lista do acervo e o que as pessoas procuram na busca. Até '
            + `${LIMITE_TITULO} caracteres.`}
          erro={estado.erros?.titulo}
          valorInicial={valor('titulo')}
        />

        <CampoFormulario
          nome="descricao" rotulo="Descrição" tipo="textarea"
          ajuda={'Opcional. Uma ou duas frases sobre o que tem dentro — elas entram na busca do '
            + `acervo junto com o nome e o tema. Até ${LIMITE_RESUMO} caracteres.`}
          erro={estado.erros?.descricao}
          valorInicial={valor('descricao')}
        />

        <CampoFormulario
          nome="tema" rotulo="Tema" tipo="text"
          ajuda={'Opcional. Um rótulo curto, do jeito que vocês falam — ele aparece na ficha do '
            + `material e ajuda quem procura. Até ${LIMITE_TEMA} caracteres.`}
          erro={estado.erros?.tema}
          valorInicial={valor('tema')}
        />

        <CampoFormulario
          nome="faixa_etaria" rotulo="Para quem é" tipo="text"
          ajuda={'Opcional. Por exemplo: "ensino fundamental", "a partir de 10 anos", "para '
            + `educadores". Até ${LIMITE_FAIXA_ETARIA} caracteres.`}
          erro={estado.erros?.faixa_etaria}
          valorInicial={valor('faixa_etaria')}
        />

        {estado.erros?.id
          ? <p className="campo__erro" role="alert">{estado.erros.id}</p>
          : null}

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando o material...' : 'Subir material'}
        </button>

        <p className="midia__demora" role="status" hidden={!enviando}>
          {enviando
            ? 'Enviando o material. Em rede de celular isto pode levar um tempo — não feche esta '
              + 'tela e não aperte de novo.'
            : null}
        </p>
      </form>

      {/*
        O ouvinte do campo de arquivo mora aqui, e não num `onChange` do
        CampoFormulario, pelo mesmo motivo escrito em FormularioMidia.tsx:
        aquele componente é `.ts` puro, renderizado também por testes do
        Node, e pendurar um handler nele o transformaria em componente de
        cliente — quebrando os quatro formulários de conta, que o usam de
        dentro do servidor.
      */}
      <OuvirArquivo aoEscolher={setEscolhido} />
    </>
  );
}

/**
 * Liga o `change` do `<input name="arquivo">` ao estado da tela.
 *
 * Componente separado, e não um `useEffect` no meio do formulário, para que
 * a leitura de cima fique sobre o que a tela DESENHA. Ele não desenha nada.
 *
 * O seletor é `#form-material`, e não `#form-midia`: as duas telas nunca
 * aparecem juntas, mas um seletor genérico as ligaria no dia em que
 * aparecessem.
 */
function OuvirArquivo(
  { aoEscolher }: { aoEscolher: (escolhido: { nome: string; bytes: number } | null) => void }
) {
  useEffect(() => {
    const campo = document.querySelector<HTMLInputElement>('#form-material input[name="arquivo"]');
    if (!campo) return;

    const aoMudar = () => {
      const arquivo = campo.files?.[0];
      aoEscolher(arquivo ? { nome: arquivo.name, bytes: arquivo.size } : null);
    };

    campo.addEventListener('change', aoMudar);
    return () => campo.removeEventListener('change', aoMudar);
  }, [aoEscolher]);

  return null;
}
