'use client';

import Link from 'next/link';
import { mensagemDeErro } from '@/compartilhado/erros';

/**
 * A PÁGINA DE ERRO 500 DO PROJETO, no lugar da que o Next entrega por
 * padrão.
 *
 * O 404 ganhou dono na fase 1 (app/not-found.tsx). O 500 nunca teve — e a
 * revisão final do Bloco A mediu o custo: com SUPABASE_URL apontando para
 * host inalcançável, /voluntariado, /agenda e /acervo respondiam 500 com
 * `<html id="__next_error__">`, ou seja SEM cabeçalho, SEM rodapé, SEM
 * `<main id="conteudo">`, SEM o link "Pular para o conteúdo", SEM os
 * controles A+/contraste e SEM VLibras. Exatamente os quatro defeitos que
 * motivaram not-found.tsx, de novo, por outra porta.
 *
 * A CAUSA DAQUELE 500 ESPECÍFICO foi corrigida na origem
 * (servidor/dados/degradacao.ts: as quatro tabelas degradam em vez de
 * lançar). Este arquivo NÃO é aquela correção — é a rede para o que
 * escapar dela: um `throw` novo em qualquer Server Component, um defeito
 * de renderização, uma dependência que quebra num deploy futuro.
 *
 * PRECISA SER CLIENT COMPONENT: é contrato do App Router — o Next só aceita
 * `error.tsx` com 'use client', porque o componente recebe `reset` (uma
 * função) e precisa se remontar no navegador.
 *
 * =====================================================================
 * ESTA REDE SÓ FUNCIONA PARA QUEM TEM JAVASCRIPT. LEIA ANTES DE CONFIAR
 * NELA.
 *
 * MEDIDO (30/08/2026, `throw` proposital num Server Component,
 * `next build` + `next start`, resposta lida com fetch, sem navegador):
 *
 *   status:                 500
 *   <html id="__next_error__">  presente
 *   <body>:                 7.441 bytes, e o conteúdo dele é
 *                           `<div hidden></div>` mais scripts — nada mais
 *   menu principal:         ausente
 *   <main id="conteudo">:   ausente
 *   controles A+/contraste: ausente
 *   rodapé:                 ausente
 *   <h1>Esta página não carregou</h1>: AUSENTE do HTML servido
 *
 * (Buscar as strings "pular-para-conteudo" e "Voltar para a página
 * inicial" no HTML dá "encontrado", e isso ENGANA: elas aparecem só dentro
 * do payload RSC serializado nos `self.__next_f.push(...)` — são dado para
 * a hidratação, não marcação renderizada. Medir por substring no HTML
 * inteiro, aqui, dá o resultado errado.)
 *
 * No Firefox COM JavaScript a mesma URL mostra o layout completo e o
 * `<h1>` daqui. O motivo é estrutural, não um defeito a corrigir: o
 * boundary de erro do React não roda durante a renderização no servidor —
 * a tela abaixo só passa a existir depois de hidratar.
 *
 * CONSEQUÊNCIA, dita em voz alta porque é o que alguém precisa saber ao
 * decidir se vale reforçar: **sem JavaScript, um erro que escape da
 * degradação entrega tela branca com 500.** Nenhum cabeçalho, nenhum
 * rodapé, nenhum caminho de volta. Num projeto que mantém
 * `testes/sem-javascript.test.mjs` e põe a navegação alternativa num
 * `<noscript>` do HTML estático, isso é uma lacuna real, não um detalhe.
 *
 * Por que ainda assim vale a pena, e por que não foi resolvido agora: a
 * correção de verdade é NÃO CHEGAR AQUI, e é ela que foi feita
 * (servidor/dados/degradacao.ts — as quatro tabelas degradam, e é o único
 * caminho de erro que este projeto sabia produzir). Esta tela cobre o
 * resto para a maioria das visitas. Cobrir também quem está sem script
 * exigiria uma página de erro renderizada NO SERVIDOR, o que no App Router
 * significa outro mecanismo (um `<noscript>` no layout raiz, ou tratar o
 * erro dentro da própria página em vez de deixá-lo subir) — desenho novo,
 * não ajuste, e a cinco dias da entrega isso é decisão de quem coordena.
 * =====================================================================
 *
 * O layout raiz (`app/layout.tsx`) continua envolvendo esta página — é
 * `global-error.tsx` que o substituiria, e ele não existe aqui de propósito
 * (ver abaixo). Só que, pelo que está medido acima, esse envolvimento se
 * materializa na hidratação, não no HTML servido.
 *
 * POR QUE NÃO HÁ `app/global-error.tsx`: ele só entra em cena quando o
 * PRÓPRIO layout raiz falha, e nesse caso substitui o layout inteiro — teria
 * de redesenhar `<html>`, `<body>`, cabeçalho e rodapé por conta própria,
 * uma segunda cópia do layout para manter em dia. NÃO MEDIDO nenhum caminho
 * real que derrube o layout raiz hoje. Decisão consciente a cinco dias da
 * entrega: uma rede, bem feita, em vez de duas, sendo que a segunda
 * envelheceria sozinha.
 *
 * SEM TESTE NENHUM, e isto é lacuna conhecida, não esquecimento. Nenhum
 * arquivo de `testes/` exercita esta tela — a única menção a ela em
 * `testes/` é um comentário em `testes/degradacao.test.mjs`. Exercitá-la
 * exige um `throw` deliberado num Server Component, que é como a medição
 * acima foi feita à mão: fazer isso dentro da suíte pede uma rota de
 * defeito proposital, fechada por variável de ambiente, no mesmo espírito
 * de `/diagnostico/origem-dos-dados`. Não foi feito na revisão final do
 * Bloco A e continua em aberto — enquanto estiver, toda afirmação deste
 * arquivo vale só até alguém medir de novo. Registrado também no
 * CLAUDE.md, em "O que trava hoje".
 *
 * O TEXTO vem de compartilhado/erros.ts, onde a regra da seção 11 do escopo
 * já mora (dizer o que houve e o que fazer, sem se desculpar, sem jargão e
 * sem código de erro na tela) — e há teste que recusa "desculpe", "ops" e
 * palavra técnica vazando: testes/erros.test.mjs.
 *
 * SEM `px` INLINE e sem tamanho fixo: a página padrão do Next usava
 * `font-size:24px` inline, que ignora --escala-fonte e torna o controle A+
 * inútil justamente na hora em que a pessoa mais precisa ler (regra 8 do
 * CLAUDE.md). Aqui só há classes do projeto.
 */

export default function Erro({
  // O Next passa a prop com o nome `error` — o nome faz parte do contrato do
  // App Router e não pode ser traduzido na assinatura. Renomeado aqui na
  // desestruturação para `erro`, que é como o corpo o chama (comentários e
  // nomes em português, restrições globais).
  error: erro,
  reset
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  const { titulo } = mensagemDeErro(erro ?? null, 'esta página');

  return (
    <main id="conteudo" className="conteudo">
      <h1>Esta página não carregou</h1>

      <p className="destaque">{titulo}</p>

      <p>
        O site continua no ar. Se acontecer de novo, o problema é nosso e não seu — nos avise
        pelo WhatsApp ou pelo e-mail no rodapé desta página.
      </p>

      <p className="chamada-final">
        {/*
          Dois caminhos de volta, e os DOIS dependem de JavaScript — porque
          a tela inteira depende (ver o bloco MEDIDO no topo do arquivo).
          `reset` remonta o trecho que falhou sem recarregar a página;
          o link recarrega a home inteira, o que também resolve quando o
          erro foi de estado. Quem chega aqui sem script não vê nem um nem
          outro: vê 500 em branco.
        */}
        <button type="button" className="botao" onClick={() => reset()}>
          Tentar de novo
        </button>{' '}
        <Link className="botao botao--secundario" href="/">
          Voltar para a página inicial
        </Link>
      </p>
    </main>
  );
}
