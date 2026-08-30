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
 * função) e precisa se remontar no navegador. Isso NÃO custa o layout: o
 * `app/layout.tsx` continua envolvendo esta página (é `global-error.tsx`
 * que substituiria o layout raiz, e ele não existe aqui de propósito — ver
 * abaixo), então cabeçalho, rodapé, link de pular, controles de
 * acessibilidade e VLibras chegam normalmente.
 *
 * POR QUE NÃO HÁ `app/global-error.tsx`: ele só entra em cena quando o
 * PRÓPRIO layout raiz falha, e nesse caso substitui o layout inteiro — teria
 * de redesenhar `<html>`, `<body>`, cabeçalho e rodapé por conta própria,
 * uma segunda cópia do layout para manter em dia. NÃO MEDIDO nenhum caminho
 * real que derrube o layout raiz hoje. Decisão consciente a cinco dias da
 * entrega: uma rede, bem feita, em vez de duas, sendo que a segunda
 * envelheceria sozinha.
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
          `reset` remonta o trecho que falhou sem recarregar a página
          inteira. É a única coisa nesta tela que depende de JavaScript, e
          por isso NÃO é o único caminho de volta: o link abaixo funciona
          sem script nenhum.
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
