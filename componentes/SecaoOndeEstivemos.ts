import { createElement } from 'react';
import type { RegistroClipping } from '@/servidor/dados/conteudo';

/**
 * Registros de clipping que alimentam "Onde já estivemos" em /para-escolas:
 * onde o Ateliê já esteve ("instituicao") e programações recorrentes
 * ("programacao"). "midia" fica de fora — essa alimenta "Na mídia" (fase 2).
 */
export function selecionarInstituicoes(registros: RegistroClipping[]): RegistroClipping[] {
  return registros.filter(
    (registro) => registro.tipo === 'instituicao' || registro.tipo === 'programacao'
  );
}

/**
 * Seção "Onde já estivemos" — ou nada.
 *
 * Regra 2 do CLAUDE.md: campo sem dado fica null e a página OMITE a seção.
 * Aqui "sem dado" é lista vazia: sem clipping do tipo instituição/
 * programação, a <section> inteira desaparece — nunca sobra só o título sem
 * conteúdo embaixo, que foi o defeito que o usuário reportou em
 * /para-escolas (o <div id="lista-instituicoes"> chegava vazio do servidor
 * porque quem o preenchia era o JavaScript de cliente do site antigo).
 *
 * Mora em componentes/, não em servidor/dados/, de propósito (Rodada de
 * correção 1 da Tarefa 10): este arquivo é apresentação — decide o que
 * desenhar a partir de uma lista já carregada — não acesso a dado. Todo
 * módulo de servidor/dados/ carrega `import 'server-only'`, e esse era o
 * único que não carregava; a revisão comprovou que dava pra importar este
 * componente de um Client Component sem erro nenhum, quebrando em silêncio
 * a regra "tudo em servidor/dados/ é barrado no cliente". Aqui, sem
 * `server-only`, a ausência é a normalidade do diretório, não uma exceção
 * escondida.
 *
 * Escrito com createElement em vez de JSX, de propósito: assim este módulo
 * é um .ts puro, sem `next/headers` nem nenhuma outra dependência que só
 * funcione dentro de uma requisição do Next, e
 * testes/prova-social.test.mjs consegue importá-lo direto pelo runtime do
 * Node (que despe os tipos nativamente) e provar a omissão renderizando de
 * verdade com react-dom/server — sem precisar subir o Next nem o Supabase.
 */
export function SecaoOndeEstivemos({ registros }: { registros: RegistroClipping[] }) {
  const instituicoes = selecionarInstituicoes(registros);
  if (instituicoes.length === 0) return null;

  return createElement(
    'section',
    { 'aria-labelledby': 'titulo-onde-estivemos' },
    createElement('h2', { id: 'titulo-onde-estivemos' }, 'Onde já estivemos'),
    createElement(
      'ul',
      { className: 'clipping' },
      instituicoes.map((registro) =>
        createElement(
          'li',
          { className: 'clipping__item', key: registro.id },
          createElement('strong', null, registro.titulo),
          registro.detalhe
            ? createElement('span', { className: 'clipping__detalhe' }, registro.detalhe)
            : null,
          registro.ano
            ? createElement('span', { className: 'clipping__ano' }, registro.ano)
            : null
        )
      )
    )
  );
}
