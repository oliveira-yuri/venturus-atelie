import type { MetadataRoute } from 'next';
import { enderecoAbsoluto } from '@/compartilhado/endereco-do-site';
import { listarPublicadas } from '@/servidor/dados/publicacoes';

/**
 * /sitemap.xml — as páginas públicas, mais as notícias publicadas.
 *
 * Existir não abre o site para buscadores: enquanto o `noindex` da prévia
 * estiver de pé (CLAUDE.md, "O que trava hoje", item 0c) ele vence. Fica
 * pronto para o lançamento. As rotas de conta e o painel NÃO entram.
 */
const PAGINAS = [
  '/', '/quem-somos', '/para-escolas', '/projetos', '/agenda', '/noticias',
  '/galeria', '/acervo', '/voluntariado', '/doar', '/contato', '/privacidade'
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const noticias = await listarPublicadas();
  return [
    ...PAGINAS.map((caminho) => ({ url: enderecoAbsoluto(caminho) })),
    ...noticias.map((noticia) => ({
      url: enderecoAbsoluto(`/noticias/${noticia.id}`),
      lastModified: noticia.publicado_em ?? undefined
    }))
  ];
}
