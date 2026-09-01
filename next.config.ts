import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // ===================================================================
  // O LIMITE DE CORPO DAS SERVER ACTIONS — MEDIDO ANTES DE DESENHAR A TELA
  // DA GALERIA (Tarefa P3), não depois.
  // ===================================================================
  //
  // MEDIDO em 01/09/2026 (Next 16.3.3, `next build` + `next start`,
  // POST multipart cru para a Action de /recuperar-acesso, com um arquivo
  // de tamanho crescente no corpo):
  //
  //   PADRÃO (sem esta chave):
  //     0,5 MB -> 200      0,9 MB -> 200
  //     1,0 MB -> 500      1,2 MB -> 500      3 MB -> 500
  //     5,0 MB -> 500      8,0 MB -> 500
  //
  //   COM `bodySizeLimit: '8mb'`:
  //     0,5 / 0,9 / 1 / 1,2 / 2 / 3 / 5 MB -> 200
  //     8 MB -> 500 (o corpo multipart passa de 8 MB por causa do
  //                  cabeçalho de cada parte)
  //
  // O QUE O 500 ENTREGA, e é a parte que decidiu o desenho: o Next lança
  // `Error: Body exceeded 1 MB limit` com `statusCode: 413` **no log do
  // servidor**, e responde ao navegador **500 Internal Server Error com o
  // corpo em texto puro** — sem layout, sem cabeçalho, sem uma frase que
  // explique o que houve. Foto de celular tem 3 a 8 MB: com o padrão, a
  // PRIMEIRA foto real da ONG bateria nisso, no celular, no meio de um
  // evento, e a tela diria "Internal Server Error".
  //
  // E o erro acontece ANTES de a Action rodar: nenhuma validação nossa
  // alcança um corpo grande demais. Ou seja, este número não é ajuste de
  // desempenho — ele decide se a mensagem de recusa é NOSSA ou é um 500 cru.
  //
  // POR QUE 8 MB, e não o tamanho que a tela aceita (4 MB, em
  // `LIMITE_ARQUIVO_BYTES`, compartilhado/validacao.ts): a folga entre os
  // dois É a faixa em que a pessoa recebe a nossa frase ("esta foto tem
  // 6,2 MB; o limite é 4 MB; ...") em vez do 500. Sem folga, todo arquivo
  // acima do limite cairia no erro cru — exatamente o que esta medição
  // existe para evitar. Acima de 8 MB o 500 volta, e isso está dito em voz
  // alta no relatório e no comentário de acoes/galeria.ts; com JavaScript o
  // formulário barra antes de enviar (componentes/FormularioMidia.tsx), o
  // que também poupa o plano de dados de quem está num celular.
  //
  // O QUE ESTE NÚMERO NÃO RESOLVE, e não foi medido: a Netlify tem limite
  // PRÓPRIO de corpo de função, e esta branch NUNCA foi publicada
  // (CLAUDE.md, "O que trava hoje", item 0). Um corpo que passe do limite
  // da plataforma morre antes de chegar ao Next, e a mensagem seria da
  // Netlify, não nossa. É por isso que o limite da tela é 4 MB e não 8:
  // 4 MB binários viram ~5,3 MB depois da codificação que a plataforma usa
  // para passar o corpo à função, o que deixa margem sob o limite
  // documentado de 6 MB. NÃO MEDIDO — conferir no primeiro deploy real,
  // subindo uma foto de ~3,5 MB.
  //
  // É GLOBAL, vale para TODA Server Action do site (as quatro de conta
  // incluídas): não existe configuração por Action no Next 16. O custo é
  // aceitar corpo maior nos formulários de texto também — que continuam
  // recusando o conteúdo pelo tamanho de cada campo (LIMITE_TITULO e
  // irmãos, em compartilhado/validacao.ts).
  experimental: {
    serverActions: { bodySizeLimit: '8mb' }
  }

  // Os redirects das 14 URLs antigas com `.html` (Tarefa A7) NÃO vivem aqui.
  // Tentativa original: `redirects()` + `headers()` (para acrescentar
  // Cache-Control). MEDIDO, na rodada de correção 1 — o roteador do Next
  // zera `resHeaders` (`resHeaders: null`, em node_modules/next/dist/
  // server/lib/router-utils/resolve-routes.js) exatamente no ramo que
  // processa um redirect vindo daqui, descartando qualquer `headers()`
  // casado com o mesmo `source` antes de a resposta sair. Os redirects
  // moraram em `middleware.ts`, que constrói a resposta com
  // `NextResponse.redirect()` e mantém controle total sobre os cabeçalhos.
  // Lista única em `compartilhado/redirects-antigos.ts`.
};

export default config;
