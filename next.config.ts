import type { NextConfig } from 'next';

const config: NextConfig = {
  // Os redirecionamentos das 15 URLs antigas entram na fase 2, quando as
  // páginas existirem. Redirecionar para rota inexistente é 404 com passo extra.
  reactStrictMode: true
};

export default config;
