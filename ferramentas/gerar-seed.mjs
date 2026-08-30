/**
 * Gera supabase/seed.sql a partir dos JSON que o site ja consome.
 *
 * As duas fontes precisam nascer iguais: o site le o JSON de
 * dados-iniciais/ enquanto nao ha banco (servidor/dados/conteudo.ts), e o
 * banco e populado por este seed. Gerar em vez de escrever a mao e o que
 * impede as duas divergirem.
 *
 * Executar com: node ferramentas/gerar-seed.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const RAIZ = new URL('../dados-iniciais/', import.meta.url);

/** Escapa um valor para literal SQL. Null vira NULL, nunca a string "null". */
function sql(valor) {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  if (typeof valor === 'number') return String(valor);
  return `'${String(valor).replace(/'/g, "''")}'`;
}

function inserir(tabela, colunas, registros) {
  const linhas = registros
    .map((registro) => `  (${colunas.map((coluna) => sql(registro[coluna])).join(', ')})`)
    .join(',\n');

  return `insert into public.${tabela} (${colunas.join(', ')}) values\n${linhas}\n`
    + `on conflict (id) do nothing;\n`;
}

const atividades = JSON.parse(await readFile(new URL('atividades.json', RAIZ), 'utf8'));
const clipping = JSON.parse(await readFile(new URL('clipping.json', RAIZ), 'utf8'));

// As cinco areas de voluntariado nomeadas pela ONG (secao 5 do escopo, M5).
const areas = [
  { id: 'apoio-pedagogico', ordem: 1, nome: 'Apoio pedagógico e oficinas',
    descricao: 'Reforço escolar, contação de histórias, oficinas de percussão, dança, turbantes e artes manuais.' },
  { id: 'comunicacao', ordem: 2, nome: 'Comunicação e mídias',
    descricao: 'Fotos, vídeos, textos para redes sociais, divulgação de projetos e editais.' },
  { id: 'producao-eventos', ordem: 3, nome: 'Produção de eventos',
    descricao: 'Montagem de exposições, recepção de público, feiras culturais, apresentações.' },
  { id: 'acervo', ordem: 4, nome: 'Organização de acervo',
    descricao: 'Catalogação de livros, roupas, instrumentos musicais, fantasias e peças de memória ancestral.' },
  { id: 'administrativo', ordem: 5, nome: 'Apoio administrativo',
    descricao: 'Captação de recursos, planejamento de projetos, atendimento à comunidade.' }
];

const conteudo = `-- =====================================================================
-- Seed — conteudo real do Ateliê Afro Cultural
--
-- GERADO por ferramentas/gerar-seed.mjs a partir de
-- dados-iniciais/*.json. Nao editar a mao: edite o JSON e
-- rode o gerador de novo, para as duas fontes nao divergirem.
-- =====================================================================

${inserir('areas_voluntariado', ['id', 'nome', 'descricao', 'ordem'], areas)}
${inserir('atividades',
  ['id', 'titulo', 'resumo', 'descricao', 'genero', 'duracao', 'elenco',
   'classificacao', 'local', 'rider', 'publicado'], atividades)}
${inserir('clipping', ['id', 'tipo', 'titulo', 'detalhe', 'ano', 'publicado'],
  clipping.map((registro) => ({ ...registro, publicado: true })))}`;

await writeFile(new URL('../supabase/seed.sql', import.meta.url), conteudo);
console.log(`seed.sql gerado: ${areas.length} áreas, ${atividades.length} atividades, ${clipping.length} registros de clipping`);
