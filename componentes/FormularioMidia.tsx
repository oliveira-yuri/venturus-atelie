'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { enviarMidia } from '@/acoes/galeria';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { CampoFormulario } from './CampoFormulario';
import {
  LIMITE_ARQUIVO_BYTES, LIMITE_ALBUM, LIMITE_ALT, LIMITE_LEGENDA,
  TIPOS_ACEITOS, emMegabytes
} from '@/compartilhado/validacao';

/**
 * O formulário de subir foto (RF05/RF33/RN07), ligado à Server Action
 * `enviarMidia`.
 *
 * MESMO DESENHO dos outros formulários do site, e de propósito: caixa de
 * aviso que nasce vazia e escondida com `role="alert"`, erro vinculado ao
 * campo por `aria-describedby` (componentes/CampoFormulario.ts), foco levado
 * ao primeiro campo com erro, texto do botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST multipart comum que o servidor atende
 * com a MESMA Action. `<input type="file">` dentro de `<form>` é HTML de
 * 1995: envio de arquivo nunca precisou de script.
 *
 * O QUE O SCRIPT ACRESCENTA — e é tudo enfeite útil, nunca requisito:
 *
 *   1. O AVISO DE TAMANHO ANTES DE ENVIAR. Sem ele, uma foto de 6 MB é
 *      enviada inteira por uma rede de celular para só então ser recusada
 *      pelo servidor. O plano de dados de quem trabalha na ONG é o preço
 *      disso. O servidor continua sendo quem decide (`validarMidia`) — isto
 *      só evita a viagem.
 *   2. O NOME E O TAMANHO do arquivo escolhido, escritos na tela. No
 *      celular o seletor fecha e não sobra confirmação nenhuma de qual foto
 *      foi escolhida.
 *   3. "Enviando a foto..." enquanto sobe. Um envio de 3 MB em rede de
 *      celular demora, e uma tela parada parece travada — a pessoa aperta
 *      de novo, e sobem duas.
 *
 * ===================================================================
 * POR QUE NÃO HÁ PRÉVIA DA IMAGEM NEM BARRA DE PROGRESSO DE VERDADE
 * ===================================================================
 *
 * PRÉVIA: `URL.createObjectURL` produz um endereço `blob:`, que a política
 * de conteúdo deste projeto não permite em `img-src` (middleware.ts) — daria
 * uma imagem em branco, em silêncio. A alternativa sem mexer na CSP é
 * `FileReader.readAsDataURL`, que transforma uma foto de 4 MB numa string de
 * ~5,5 MB dentro da memória do celular. Nenhuma das duas paga o que custa:
 * o seletor do próprio telefone acabou de mostrar a foto, um gesto atrás. O
 * que falta ali é saber QUAL arquivo ficou escolhido, e isso o nome e o
 * tamanho resolvem.
 *
 * PROGRESSO REAL (uma barra que anda): exigiria `XMLHttpRequest` com
 * `upload.onprogress`, ou seja, mandar o formulário por script em vez de
 * pela Action — e aí a tela só funcionaria COM JavaScript, que é o
 * contrário do que este projeto faz. Um estado indeterminado honesto
 * ("estou enviando, pode demorar") é o que dá para prometer sem quebrar
 * quem está sem script.
 *
 * ===================================================================
 * A CAIXA DE AUTORIZAÇÃO — RN07, REGRA 9 DO CLAUDE.md
 * ===================================================================
 *
 * Ela NÃO diz "aceito os termos". Diz o que a pessoa está AFIRMANDO: que
 * existe autorização de uso de imagem registrada para quem aparece naquela
 * foto. O público da ONG inclui crianças a partir de 10 anos, e é por isso
 * que não há uma única foto no site até hoje.
 *
 * E ELA NÃO É `required`, de propósito. Marcar como obrigatória tornaria a
 * caixa um obstáculo a vencer — e a saída óbvia de quem está com pressa é
 * marcar sem ler. Sem ela a foto sobe e fica GUARDADA, sem poder ir ao ar;
 * o painel diz isso no item, com a frase inteira. A escolha é entre "vai ao
 * ar" e "fica guardada", não entre "envia" e "não envia".
 *
 * SÓ IMAGEM, sem vídeo, e é limite desta tarefa: a coluna `tipo` aceita
 * 'video', mas o corpo de uma Server Action vai até 8 MB neste projeto (ver
 * next.config.ts, com a medição) e vídeo de celular passa disso em poucos
 * segundos. Vídeo pede outro caminho (link para o Instagram/YouTube da ONG,
 * ou upload direto para o Storage), que é decisão de outra tarefa.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioMidia() {
  const [estado, enviar, enviando] = useActionState(enviarMidia, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const jaRenderizou = useRef(false);

  /** O que o script sabe sobre o arquivo escolhido. `null` = nada escolhido. */
  const [escolhido, setEscolhido] = useState<{ nome: string; bytes: number } | null>(null);

  // FOCO NO ERRO — mesmo motivo de componentes/AbasEntrar.tsx e
  // FormularioPublicacao.tsx: sem isto o foco fica no botão depois de
  // enviar, e a mudança só existe para quem enxerga a tela (regra 8).
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
   * site preencher um `<input type="file">` — seria o site escolhendo um
   * arquivo do disco de quem está do outro lado. É por isso que a mensagem
   * de recusa da Action diz, com todas as letras, que a foto precisa ser
   * escolhida de novo (ver acoes/galeria.ts).
   */
  const valor = (nome: 'album' | 'alt' | 'legenda' | 'autorizacao') =>
    estado.valores?.[nome] ?? '';

  const grandeDemais = escolhido !== null && escolhido.bytes > LIMITE_ARQUIVO_BYTES;

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

      <form ref={formulario} id="form-midia" className="formulario" action={enviar}
            noValidate aria-describedby="aviso" encType="multipart/form-data">

        <CampoFormulario
          nome="arquivo" rotulo="Foto" tipo="file" obrigatorio
          accept={TIPOS_ACEITOS}
          ajuda={`JPG, PNG, GIF ou WebP, até ${emMegabytes(LIMITE_ARQUIVO_BYTES)}. `
            + 'Vídeo ainda não entra por aqui.'}
          erro={estado.erros?.arquivo}
        />

        {/*
          O que o script acrescenta ao campo de arquivo (ver o cabeçalho).
          Fica FORA do CampoFormulario porque não é erro do servidor: é uma
          observação nossa sobre o que está escolhido AGORA, e some quando a
          pessoa escolhe outra.

          `role="status"` e não `alert`: não interrompe — a pessoa acabou de
          fazer um gesto e isto é a resposta dele.
        */}
        <p className={grandeDemais ? 'midia__escolhido midia__escolhido--grande' : 'midia__escolhido'}
           role="status" hidden={escolhido === null}>
          {escolhido === null
            ? null
            : grandeDemais
              ? `${escolhido.nome} — ${emMegabytes(escolhido.bytes)}. Esta foto passa do limite de `
                + `${emMegabytes(LIMITE_ARQUIVO_BYTES)}. No celular, ao escolher a foto, procure a `
                + 'opção de enviar em tamanho médio (ou "otimizado") em vez do tamanho real.'
              : `Escolhida: ${escolhido.nome} — ${emMegabytes(escolhido.bytes)}.`}
        </p>

        <CampoFormulario
          nome="album" rotulo="Álbum" tipo="text" obrigatorio
          ajuda={'O nome da oficina, do evento ou do projeto. Fotos com o mesmo nome de álbum '
            + `aparecem juntas na galeria do site. Até ${LIMITE_ALBUM} caracteres.`}
          erro={estado.erros?.album}
          valorInicial={valor('album')}
        />

        <CampoFormulario
          nome="alt" rotulo="Descrição da foto" tipo="textarea" obrigatorio
          ajuda={'Para quem não pode ver a foto. Diga o que aparece nela — "crianças tocando '
            + 'tambor numa roda", por exemplo. Não é a legenda: é a descrição. Até '
            + `${LIMITE_ALT} caracteres.`}
          erro={estado.erros?.alt}
          valorInicial={valor('alt')}
        />

        <CampoFormulario
          nome="legenda" rotulo="Legenda" tipo="textarea"
          ajuda={'Opcional. O texto que aparece embaixo da foto no site, para quem enxerga. Até '
            + `${LIMITE_LEGENDA} caracteres.`}
          erro={estado.erros?.legenda}
          valorInicial={valor('legenda')}
        />

        {/*
          RN07. A frase é a declaração inteira, não um "aceito" — ver o
          cabeçalho deste arquivo. Ela fica por último, imediatamente acima
          do botão, porque é a última coisa a ser lida antes de enviar.
        */}
        <div className="midia__autorizacao">
          <CampoFormulario
            nome="autorizacao"
            tipo="checkbox"
            rotulo={'Declaro que existe autorização de uso de imagem registrada para todas as '
              + 'pessoas que aparecem nesta foto — e, no caso de crianças e adolescentes, '
              + 'autorização de quem é responsável por elas.'}
            ajuda={'Sem esta declaração a foto sobe e fica guardada, mas NÃO vai para o site. '
              + 'Você pode subir de novo depois, com a caixa marcada.'}
            erro={estado.erros?.autorizacao}
            valorInicial={valor('autorizacao')}
          />
        </div>

        {estado.erros?.id
          ? <p className="campo__erro" role="alert">{estado.erros.id}</p>
          : null}

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). "Enviando a foto..." é o
            estado indeterminado honesto — ver o cabeçalho. */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando a foto...' : 'Subir foto'}
        </button>

        <p className="midia__demora" role="status" hidden={!enviando}>
          {enviando
            ? 'Enviando a foto. Em rede de celular isto pode levar um tempo — não feche esta '
              + 'tela e não aperte de novo.'
            : null}
        </p>
      </form>

      {/*
        O ouvinte do campo de arquivo mora aqui, e não num `onChange` do
        CampoFormulario, por um motivo: aquele componente é `.ts` puro,
        renderizado também por testes do Node, e pendurar um handler nele o
        transformaria em componente de cliente — quebrando os quatro
        formulários de conta, que o usam de dentro do servidor.

        `useEffect` sem dependência de estado: registra uma vez, quando a
        tela hidrata. Sem script nada disso existe, e o formulário continua
        funcionando — é a definição de enfeite.
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
 */
function OuvirArquivo(
  { aoEscolher }: { aoEscolher: (escolhido: { nome: string; bytes: number } | null) => void }
) {
  useEffect(() => {
    const campo = document.querySelector<HTMLInputElement>('#form-midia input[name="arquivo"]');
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
