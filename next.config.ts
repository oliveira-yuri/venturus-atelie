import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true

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
