'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ofertar } from '@/acoes/doacoes';
import type { EstadoFormulario } from '@/acoes/autenticacao';
import { OPCOES_DE_TIPO, TIPOS_DE_DOACAO } from '@/compartilhado/doacoes';
import { LIMITE_OFERTA } from '@/compartilhado/validacao';
import { CampoFormulario } from './CampoFormulario';
import { mascararDinheiro } from './mascara-dinheiro';

/**
 * componentes/FormularioOferta.tsx — o formulário de `/doar/ofertar`
 * (RF19), ligado à Server Action `ofertar`.
 *
 * MESMO DESENHO dos outros formulários do projeto, e de propósito: caixa de
 * aviso que nasce vazia e escondida com `role="alert"`, erro vinculado ao
 * campo por `aria-describedby` (componentes/CampoFormulario.ts), foco
 * levado ao primeiro erro, texto do botão mudando enquanto envia.
 * Consistência entre telas vale mais que preferência.
 *
 * FUNCIONA SEM JAVASCRIPT pelo mesmo mecanismo medido na Tarefa 3 da
 * autenticação: a função devolvida por `useActionState` vai direto no
 * `action` do `<form>`, o Next serializa a referência da Action no HTML, e
 * sem script o navegador faz o POST comum que o servidor atende com a MESMA
 * Action. Trocar isto por `onSubmit` + fetch quebraria a tela para quem
 * está sem script, em silêncio.
 *
 * ===================================================================
 * DOIS CAMPOS, E O QUE NÃO ESTÁ AQUI É A PARTE IMPORTANTE
 * ===================================================================
 *
 * NÃO HÁ CAMPO DE VALOR. Quem oferta dinheiro escreve quanto pretende doar
 * na descrição, em português, como escreveria numa mensagem — e a coluna
 * `valor` só é preenchida pela EQUIPE, depois, com o que de fato entrou
 * (RF21). A razão: um campo "valor" num formulário público transforma uma
 * intenção em número, e número entra em relatório. A ONG passaria a ter uma
 * linha dizendo "R$ 500" para uma doação que talvez nunca chegue — e quem
 * ofertou veria o próprio valor na tela como se estivesse registrado.
 * `lerOferta` (compartilhado/validacao.ts) não lê `valor` em caminho
 * nenhum, então nem uma requisição montada à mão o grava.
 *
 * NÃO HÁ NOME, E-MAIL NEM TELEFONE. Quem oferta tem conta (ver o cabeçalho
 * de acoes/doacoes.ts), e esses dados estão em `public.perfis`. Pedi-los de
 * novo seria coleta acima do mínimo (RNF09) e criaria uma segunda resposta
 * para "quem é esta pessoa".
 *
 * NÃO HÁ CAIXA DE CONSENTIMENTO, ao contrário de /contato, e pelo mesmo
 * motivo de FormularioCandidatura: quem oferta JÁ TEM CONTA, e o
 * consentimento foi dado no cadastro. Uma segunda caixa sem coluna onde
 * gravar — `public.doacoes` não tem `consentimento_dados` — seria teatro.
 */

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensagem: '' };

export default function FormularioOferta() {
  const [estado, enviar, enviando] = useActionState(ofertar, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  /*
    QUAL CAMPO MOSTRAR, e por que isso depende de `hidratado`.

    Antes de o React assumir a página, `hidden` não pode esconder nada: sem
    script ninguém revelaria o campo de volta, e a pessoa ficaria sem um dos
    dois. Então o HTML do servidor traz OS DOIS abertos, e o recolhimento só
    começa depois da hidratação — o mesmo mecanismo da gaveta do menu e da
    barra de acessibilidade.

    O valor inicial vem do que a Action devolveu (numa recusa) ou da
    primeira opção do select, que agora não tem mais placeholder.
  */
  const [tipo, setTipo] = useState(estado.valores?.tipo ?? TIPOS_DE_DOACAO[0].valor);
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => { setHidratado(true); }, []);
  const ehDinheiro = tipo === 'recurso_financeiro';

  function aoTrocarTipo(evento: { target: EventTarget | null }) {
    const alvo = evento.target;
    if (alvo instanceof HTMLSelectElement && alvo.name === 'tipo') setTipo(alvo.value);
  }
  const jaRenderizou = useRef(false);

  // FOCO NO ERRO — mesmo motivo dos outros formulários: sem isto o foco
  // fica no botão depois de enviar, e a mudança só existe para quem enxerga
  // a tela (regra 8 do CLAUDE.md).
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
   * O que a pessoa tinha escrito, devolvido pela Action que recusou.
   *
   * Sem isto toda recusa devolve o formulário em branco — com script porque
   * o React 19 dá `reset()` no <form> ao fim de uma action, e sem script
   * porque a página é renderizada do zero. Aqui o que se perderia é a
   * descrição inteira, escrita no celular, de pé (regra 4).
   */
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

      {/*
        `onChange` NO <form>, e não no campo: o evento chega por borbulhamento
        e alcança tanto o select de tipo quanto o campo de quantia dentro de
        `CampoFormulario`, que não expõe `onChange` próprio. É o mesmo
        mecanismo de componentes/mascara-telefone.ts.

        Os dois handlers convivem porque cada um checa o `name` do alvo antes
        de agir — a máscara só mexe em `quantia`, a troca de tipo só em `tipo`.
      */}
      <form ref={formulario} id="form-oferta" className="formulario" action={enviar}
            noValidate aria-describedby="aviso"
            onChange={(evento) => { mascararDinheiro(evento); aoTrocarTipo(evento); }}>
        {/*
          O VALOR INICIAL É O QUE TIRA O "Escolha uma opção" (pedido V1).

          `CampoFormulario` acrescenta a opção vazia sozinho em todo select
          OBRIGATÓRIO SEM valor inicial, e por um motivo real: um select sem
          ela já chega com a primeira selecionada, e num campo obrigatório
          isso é um padrão silencioso — foi assim que `tipo_pessoa` gravou
          'fisica' para todo mundo no cadastro.

          AQUI O RISCO NÃO EXISTE, e é o que justifica a exceção: os dois
          tipos abrem CAMPOS DIFERENTES. Quem quer doar dinheiro e deixa o
          select em "Um item" vê um campo de texto pedindo "conte o que é" —
          a escolha errada aparece na tela antes do envio. Nos outros selects
          do projeto (tipo de pessoa, situação) as opções não mudam nada
          visível, e lá a opção vazia continua.

          O SERVIDOR NÃO AFROUXOU: `validarOferta` continua recusando tipo
          vazio e tipo fora da lista.
        */}
        <CampoFormulario
          nome="tipo"
          rotulo="O que você quer doar"
          tipo="select"
          opcoes={OPCOES_DE_TIPO}
          obrigatorio
          ajuda="Se for mais de uma coisa, escolha a principal e conte o resto abaixo."
          erro={estado.erros?.tipo}
          valorInicial={valor('tipo') || TIPOS_DE_DOACAO[0].valor}
        />

        {/*
          ===================================================================
          UM CAMPO POR TIPO — E OS DOIS CHEGAM ABERTOS SEM JAVASCRIPT
          ===================================================================

          O pedido V1 quer um campo de TEXTO para item e um campo de QUANTIA
          para dinheiro. Com script, o irrelevante é escondido assim que a
          pessoa escolhe.

          SEM SCRIPT, OS DOIS FICAM VISÍVEIS, e isso é deliberado: não há
          quem revele um campo escondido, e a pessoa veria um erro apontando
          para um campo que nunca apareceu. É a mesma decisão dos campos de
          responsável em FormularioInscricao.tsx e dos dois painéis de
          /entrar.

          Quem decide qual dos dois vale é o SERVIDOR, pelo tipo escolhido
          (`validarOferta`) — preencher os dois não é erro, o outro é
          ignorado.
        */}
        <div hidden={hidratado && ehDinheiro}>
          <CampoFormulario
            nome="descricao"
            rotulo="Conte o que é"
            tipo="textarea"
            ajuda={'Quantos livros, que instrumento, que tipo de material — e, se já souber, '
              + 'como pretende entregar. A gente responde dizendo se conseguimos receber. '
              + `Até ${LIMITE_OFERTA} caracteres.`}
            erro={estado.erros?.descricao}
            valorInicial={valor('descricao')}
          />
        </div>

        <div hidden={hidratado && !ehDinheiro}>
          <CampoFormulario
            nome="quantia"
            rotulo="Quanto você quer doar (R$)"
            tipo="text"
            inputMode="numeric"
            ajuda={'Digite só os números — os centavos entram sozinhos, como numa maquininha. '
              + 'Pode ser um valor aproximado: a gente combina o resto quando responder. '
              + 'O site não cobra nada e não recebe pagamento.'}
            erro={estado.erros?.quantia}
            valorInicial={valor('quantia')}
          />
        </div>

        {/* O texto muda junto com o estado: um botão que só troca de cor não
            diz nada a quem não vê a cor (regra 8). */}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar minha oferta'}
        </button>
      </form>
    </>
  );
}
