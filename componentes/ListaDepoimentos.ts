import { createElement } from 'react';

/**
 * Os depoimentos APROVADOS, na página pública. Só texto e nome — nada de
 * data de moderação, nada de situação. `.ts` com createElement para caber
 * num teste do Node, como as outras listas.
 */
export type DepoimentoPublico = { id: string; nome: string; atividade: string | null; texto: string };

/** O texto vira parágrafos por linha em branco; nunca HTML (React escapa tudo). */
function paragrafos(texto: string): string[] {
  return texto.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
}

export function ListaDepoimentos({ depoimentos }: { depoimentos: DepoimentoPublico[] }) {
  if (depoimentos.length === 0) {
    return createElement(
      'p',
      { className: 'estado estado--vazio' },
      'Ainda não há depoimentos publicados. Quem participou de uma atividade pode escrever o '
      + 'primeiro, logo abaixo.'
    );
  }

  return createElement(
    'div',
    { className: 'lista-atividades' },
    depoimentos.map((depoimento) =>
      createElement(
        'figure',
        { className: 'atividade depoimento', key: depoimento.id },
        createElement(
          'blockquote',
          { className: 'depoimento__texto' },
          paragrafos(depoimento.texto).map((p, i) => createElement('p', { key: i }, p))
        ),
        createElement(
          'figcaption',
          { className: 'depoimento__autoria' },
          createElement('strong', null, depoimento.nome),
          depoimento.atividade ? ` · ${depoimento.atividade}` : null
        )
      )
    )
  );
}
