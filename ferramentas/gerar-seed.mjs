/**
 * Gera supabase/seed.sql a partir dos JSON que o site ja consome.
 *
 * As duas fontes precisam nascer iguais: o site le o JSON de
 * dados-iniciais/ enquanto nao ha banco (servidor/dados/conteudo.ts), e o
 * banco e populado por este seed. Gerar em vez de escrever a mao e o que
 * impede as duas divergirem.
 *
 * Executar com: node ferramentas/gerar-seed.mjs
 *
 * =====================================================================
 * ATENCAO — DESDE A TAREFA P4 DO PAINEL (31/08/2026) AS DUAS FONTES PODEM
 * DIVERGIR, E ESTE GERADOR SO CONHECE UMA DELAS
 * =====================================================================
 *
 * A equipe da ONG passou a corrigir o texto das 11 atividades pelo painel
 * (/admin/atividades, RF03). Essas correcoes vao para a TABELA do Supabase
 * e NAO voltam para dados-iniciais/atividades.json — ninguem atualiza o
 * repositorio a partir do painel, e nem poderia (o site em producao nao
 * grava no git).
 *
 * Entao, a partir da primeira correcao:
 *
 *  · o JSON deste diretorio passa a ser uma FOTOGRAFIA VELHA do conteudo,
 *    nao mais o espelho do banco;
 *  · o seed.sql gerado aqui herda essa fotografia. O
 *    `on conflict (id) do nothing` de cada insert protege as linhas que ja
 *    existem — ou seja, rodar este seed num banco que ja tem as 11 nao
 *    apaga correcao nenhuma —, mas RESTAURAR um banco a partir dele
 *    (banco novo, ou linhas apagadas antes) traz de volta o texto de antes
 *    das correcoes.
 *
 * ANTES DE RODAR ISTO CONTRA UM BANCO COM CONTEUDO EDITADO PELA EQUIPE:
 * exporte as 11 linhas da tabela `public.atividades` e atualize o JSON com
 * o que estiver la. E o unico jeito de as duas fontes voltarem a dizer a
 * mesma coisa.
 *
 * O contexto inteiro esta em servidor/dados/conteudo.ts (a fonte dupla) e
 * em acoes/atividades.ts (onde a divergencia nasce). O aviso abaixo e
 * impresso a CADA execucao, porque este comentario so e lido por quem abre
 * o arquivo.
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

// O aviso da fonte dupla, impresso a cada execução — ver o cabeçalho deste
// arquivo. Não é `console.warn` de enfeite: desde a Tarefa P4 do painel
// (RF03) o JSON pode estar ATRÁS do banco, e este arquivo acabou de virar
// SQL a partir dele.
console.warn(
  '\n[seed] ATENÇÃO: este seed sai de dados-iniciais/*.json, e desde 31/08/2026 a equipe da ONG\n'
  + '       corrige o texto das atividades pelo painel (/admin/atividades) — correção que fica\n'
  + '       só no banco e NÃO volta para o JSON. Se o banco de destino já foi editado pela\n'
  + '       equipe, exporte public.atividades e atualize o JSON ANTES de usar este arquivo para\n'
  + '       restaurar qualquer coisa: o `on conflict do nothing` protege linha existente, mas\n'
  + '       um banco novo populado por aqui volta ao texto de antes das correções.\n'
);
