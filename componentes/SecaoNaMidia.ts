import { createElement } from 'react';
import type { RegistroClipping } from '@/servidor/dados/conteudo';

/**
 * Registros de clipping que alimentam "Na mídia" na home: só o tipo
 * "midia". "instituicao" e "programacao" ficam de fora — esses alimentam
 * "Onde já estivemos" em /para-escolas (componentes/SecaoOndeEstivemos.ts).
 */
export function selecionarMidia(registros: RegistroClipping[]): RegistroClipping[] {
  return registros.filter((registro) => registro.tipo === 'midia');
}

/**
 * Seção "Na mídia" da home — ou nada.
 *
 * Mesma decisão de componentes/SecaoOndeEstivemos.ts (Tarefa 10, regra 2 do
 * CLAUDE.md): campo sem dado fica null e a página OMITE A SEÇÃO. Sem
 * nenhum registro do tipo "midia", a <section> inteira desaparece — nunca
 * sobra só o <h2> "Na mídia" sem nada embaixo, que era exatamente o defeito
 * que "Onde já estivemos" tinha antes daquela correção (o
 * <div id="lista-midia"> chegava vazio do servidor porque, no site
 * estático, quem o preenchia era assets/js/paginas/prova-social.js, no
 * cliente).
 *
 * Escrito com createElement em vez de JSX, de propósito — mesmo motivo do
 * arquivo irmão: fica um .ts puro, importável direto pelo runtime nativo do
 * Node (que despe os tipos), sem depender de nada que só funcione dentro de
 * uma requisição do Next. Isso deixa a omissão testável com
 * react-dom/server, sem subir o Next nem o Supabase.
 */
export function SecaoNaMidia({ registros }: { registros: RegistroClipping[] }) {
  const midia = selecionarMidia(registros);
  if (midia.length === 0) return null;

  return createElement(
    'section',
    { id: 'na-midia', 'aria-labelledby': 'titulo-midia-home' },
    createElement('h2', { id: 'titulo-midia-home' }, 'Na mídia'),
    createElement(
      'ul',
      { className: 'clipping' },
      midia.map((registro) =>
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
