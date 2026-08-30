import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // As 14 URLs antigas com `.html` (site estático, fase 1) para a rota limpa
  // correspondente (Tarefa A7). Já circularam: matéria da Folha, WhatsApp,
  // Instagram — sem isso cada uma vira 404 no dia do deploy. Ver
  // testes/redirects.test.mjs para o porquê de 301 em vez de 308.
  //
  // `statusCode: 301` explícito, não `permanent: true` — o atalho do Next
  // mapeia `permanent: true` para 308 (ver node_modules/next/dist/lib/
  // redirect-status.js), e a decisão registrada foi 301.
  //
  // FALTA DE PROPÓSITO: `/admin/index.html`. O painel (Bloco B) nunca
  // existiu no ar — não tem conta de administrador, não tem rota `/admin`
  // neste app — e redirecionar para uma rota que não existe é o "404 com
  // passo extra" que este comentário sempre rejeitou. Fica de fora até o
  // Bloco B publicar `/admin`; a decisão e o teste que a guarda estão em
  // testes/redirects.test.mjs.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', statusCode: 301 },
      { source: '/quem-somos.html', destination: '/quem-somos', statusCode: 301 },
      { source: '/projetos.html', destination: '/projetos', statusCode: 301 },
      { source: '/agenda.html', destination: '/agenda', statusCode: 301 },
      { source: '/noticias.html', destination: '/noticias', statusCode: 301 },
      { source: '/galeria.html', destination: '/galeria', statusCode: 301 },
      { source: '/acervo.html', destination: '/acervo', statusCode: 301 },
      { source: '/para-escolas.html', destination: '/para-escolas', statusCode: 301 },
      { source: '/voluntariado.html', destination: '/voluntariado', statusCode: 301 },
      { source: '/doar.html', destination: '/doar', statusCode: 301 },
      { source: '/contato.html', destination: '/contato', statusCode: 301 },
      { source: '/entrar.html', destination: '/entrar', statusCode: 301 },
      { source: '/recuperar-acesso.html', destination: '/recuperar-acesso', statusCode: 301 },
      { source: '/privacidade.html', destination: '/privacidade', statusCode: 301 }
    ];
  }
};

export default config;
