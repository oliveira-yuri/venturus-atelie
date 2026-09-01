/**
 * Acervo (RF36/RF37) — a equipe sobe um material pelo celular, e ele
 * aparece em /acervo com "Abrir para ler" e "Baixar material" depois de
 * publicado.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE SESSÃO DE EQUIPE UTILIZÁVEL: ninguém concedeu `eh_equipe` a
 * conta nenhuma (CLAUDE.md, "O que trava hoje", item 2). Então **nenhum
 * upload real acontece** — nem para o Storage, nem para a tabela — aqui nem
 * em lugar nenhum, e nenhum teste deste arquivo afirma nada sobre isso.
 *
 * O que sobra, e é mais do que parece:
 *
 *   1. AS DECISÕES PURAS: o que conta como PDF (pelos BYTES, não pela
 *      extensão), o que conta como tamanho aceitável, que caminho um
 *      arquivo ganha no bucket, com que NOME ele chega na pasta de
 *      downloads de quem baixa, o que o `?aviso=` da URL pode dizer de
 *      volta, e — o mais importante — QUE COLUNAS chegam ao `insert`.
 *   2. O LIMITE DE CORPO DA SERVER ACTION com PDF de verdade, contra o
 *      servidor de verdade. Ver a seção 2.
 *   3. O QUE AS DUAS LISTAS DESENHAM (a pública e a do painel),
 *      renderizando os componentes com `react-dom/server` sem subir o Next.
 *   4. QUE AS SERVER ACTIONS NÃO ESQUEÇAM A GUARDA — varredura do
 *      código-fonte de acoes/acervo.ts. A varredura de
 *      testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5).
 *   5. A RECUSA, por HTTP: as duas rotas novas respondem 404 para anônimo e
 *      não vazam nada do painel no HTML servido.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta:
 *
 *   · nenhum byte foi escrito no bucket `acervo` nem em `public.acervo` por
 *     este código, em ambiente nenhum. O upload, o insert, a remoção do
 *     órfão, o `revalidatePath` e o caminho de sucesso das três Actions só
 *     podem ser exercitados com uma sessão de equipe;
 *   · **o cabeçalho `Content-Disposition` que o Storage responde para uma
 *     URL com `?download=`**. O bucket está vazio (medido em 01/09/2026:
 *     `storage.from('acervo').list()` devolve `[]`), e subir exige a mesma
 *     sessão que não existe. O que FOI medido é a URL que
 *     `getPublicUrl(caminho, { download })` produz;
 *   · o limite de corpo de função da NETLIFY — esta branch nunca foi
 *     publicada (CLAUDE.md, item 0). É ele, e não o Next, que decide o teto
 *     de 4 MB da tela: ver a seção 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerMaterial, validarMaterial, colunasDoMaterial, tipoDoDocumento, caminhoDoMaterial,
  nomeParaBaixar, emMegabytes, LIMITE_MATERIAL_BYTES, LIMITE_ARQUIVO_BYTES, LIMITE_TITULO,
  LIMITE_RESUMO, LIMITE_TEMA, LIMITE_FAIXA_ETARIA, TIPOS_DE_MATERIAL_ACEITOS,
  BYTES_PARA_RECONHECER
} from '../compartilhado/validacao.ts';
import { avisoDoAcervo, avisoDaGaleria, avisoDaLista } from '../compartilhado/avisos-do-painel.ts';
import { ListaMateriais } from '../componentes/ListaMateriais.ts';
import { ListaMateriaisDoPainel } from '../componentes/ListaMateriaisDoPainel.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const UUID = '7b2e4c10-9d3a-4f51-8c6d-2e1a0b9c8d7f';

/** Bytes que COMEÇAM como um PDF de verdade ("%PDF-"), com recheio. */
function pdfFalso(bytes = 64) {
  const conteudo = new Uint8Array(bytes);
  conteudo.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0);
  return conteudo;
}

function arquivo(nome, bytes, tipo = 'application/pdf') {
  return new File([bytes], nome, { type: tipo });
}

/** Um FormData com um arquivo de verdade dentro. */
function formulario(campos, comArquivo) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  if (comArquivo) dados.set('arquivo', comArquivo);
  return dados;
}

/** Um material de exemplo. NÃO é conteúdo da ONG — é dado de teste. */
function exemplo(mudancas = {}) {
  return {
    id: UUID,
    titulo: 'Cartilha de teste',
    descricao: 'Dado de teste, não é material da ONG.',
    tema: 'Educação',
    faixa_etaria: 'Ensino fundamental',
    arquivo_caminho: 'educacao/7b2e4c10.pdf',
    tamanho_bytes: 2_500_000,
    publicado: false,
    criado_em: '2026-09-01T15:00:00.000Z',
    url: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/educacao/7b2e4c10.pdf',
    ...mudancas
  };
}

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('o formulário é lido campo a campo, e campo que não está na lista não existe', () => {
  const dados = formulario({
    titulo: 'Cartilha', descricao: 'Texto', tema: 'Educação', faixa_etaria: 'Fundamental',
    // Os campos que uma requisição montada à mão tentaria injetar.
    // `publicado: true` no corpo é literalmente "pôr no site sem apertar
    // publicar"; `arquivo_caminho` é apontar a linha para OUTRO arquivo do
    // bucket; `tamanho_bytes` é fazer a ficha mentir sobre o download.
    publicado: 'true',
    downloads: '9999',
    arquivo_caminho: '../identidade/logo.png',
    tamanho_bytes: '1'
  }, arquivo('m.pdf', pdfFalso()));

  const lido = lerMaterial(dados);

  assert.deepEqual(
    Object.keys(lido).sort(),
    ['arquivo', 'descricao', 'faixaEtaria', 'id', 'tema', 'titulo']
  );
  assert.equal(lido.titulo, 'Cartilha');
  assert.ok(lido.arquivo instanceof File);
});

test('AS COLUNAS DO INSERT são seis, e `publicado`/`downloads` não estão entre elas', () => {
  // A trava da regra 6 do CLAUDE.md nesta tela: `colunasDoMaterial` é o
  // objeto que vai literalmente para o `.insert()` de acoes/acervo.ts.
  const campos = lerMaterial(formulario({
    titulo: 'Cartilha', publicado: 'true', downloads: '9999', eh_equipe: 'true'
  }, arquivo('m.pdf', pdfFalso())));

  const linha = colunasDoMaterial(campos, 'educacao/uuid.pdf', 12345);

  assert.deepEqual(
    Object.keys(linha).sort(),
    ['arquivo_caminho', 'descricao', 'faixa_etaria', 'tamanho_bytes', 'tema', 'titulo']
  );
  assert.equal('publicado' in linha, false,
    'o material precisa nascer fora do ar pela AUSÊNCIA da chave — um `false` escrito à mão é '
    + 'o que alguém "parametriza" depois');
  assert.equal('downloads' in linha, false);
  assert.equal(linha.arquivo_caminho, 'educacao/uuid.pdf', 'o caminho é ARGUMENTO, nosso');
  assert.equal(linha.tamanho_bytes, 12345, 'o tamanho é medido do arquivo, não recebido');
});

test('texto vazio vira NULL, não string vazia — a ficha do acervo omite o que é nulo', () => {
  const campos = lerMaterial(formulario({ titulo: 'Só o nome' }, arquivo('m.pdf', pdfFalso())));
  const linha = colunasDoMaterial(campos, 'material/uuid.pdf', 10);

  assert.equal(linha.descricao, null);
  assert.equal(linha.tema, null);
  assert.equal(linha.faixa_etaria, null);
});

test('título e arquivo são obrigatórios, e os dois erros voltam de uma vez', () => {
  const { valido, erros } = validarMaterial(lerMaterial(formulario({})));

  assert.equal(valido, false);
  assert.ok(erros.titulo, 'faltou o erro de título');
  assert.ok(erros.arquivo, 'faltou o erro de arquivo');
});

test('tema, faixa etária e descrição são OPCIONAIS — exigi-los faria a equipe inventar', () => {
  // Regra 2 do CLAUDE.md pelo avesso: campo obrigatório sem dado real é
  // convite a preencher qualquer coisa. O cartão omite o que for nulo.
  const { valido, erros } = validarMaterial(lerMaterial(formulario(
    { titulo: 'Ficha técnica' },
    arquivo('m.pdf', pdfFalso())
  )));

  assert.equal(valido, true, `recusou o mínimo: ${JSON.stringify(erros)}`);
});

test('espaço em branco não é título: "   " é recusado como vazio', () => {
  const { erros } = validarMaterial(
    lerMaterial(formulario({ titulo: '   ' }, arquivo('m.pdf', pdfFalso())))
  );

  assert.ok(erros.titulo);
});

test('cada campo de texto tem limite, e a mensagem diz qual é', () => {
  const campos = lerMaterial(formulario({
    titulo: 'a'.repeat(LIMITE_TITULO + 1),
    descricao: 'b'.repeat(LIMITE_RESUMO + 1),
    tema: 'c'.repeat(LIMITE_TEMA + 1),
    faixa_etaria: 'd'.repeat(LIMITE_FAIXA_ETARIA + 1)
  }, arquivo('m.pdf', pdfFalso())));

  const { erros } = validarMaterial(campos);

  assert.match(erros.titulo, new RegExp(String(LIMITE_TITULO)));
  assert.match(erros.descricao, new RegExp(String(LIMITE_RESUMO)));
  assert.match(erros.tema, new RegExp(String(LIMITE_TEMA)));
  assert.match(erros.faixa_etaria, new RegExp(String(LIMITE_FAIXA_ETARIA)));
});

test('arquivo grande demais é recusado com o tamanho, o limite e o que fazer', () => {
  const grande = { size: LIMITE_MATERIAL_BYTES + 1, name: 'm.pdf' };
  const campos = lerMaterial(formulario({ titulo: 'Cartilha' }, arquivo('m.pdf', pdfFalso())));

  const { erros } = validarMaterial({ ...campos, arquivo: grande });

  assert.match(erros.arquivo, /o limite é 4,0 MB/);
  assert.match(erros.arquivo, /comprimir PDF|PDF reduzido/,
    'a mensagem precisa dizer O QUE FAZER, não só que passou do limite');
});

test('o teto do acervo é o MESMO da galeria, e é derivado dele de propósito', () => {
  // A causa dos dois é a mesma e não é nossa: o limite de corpo de função da
  // plataforma (ver o comentário de LIMITE_MATERIAL_BYTES). Se alguém
  // separar os dois números sem medir a Netlify, este teste cai — e é para
  // cair, porque a conversa que falta é sobre a plataforma, não sobre PDF.
  assert.equal(LIMITE_MATERIAL_BYTES, LIMITE_ARQUIVO_BYTES);
  assert.equal(emMegabytes(LIMITE_MATERIAL_BYTES), '4,0 MB');
});

test('arquivo de tamanho zero conta como "nenhum arquivo" — é o que o navegador manda', () => {
  const dados = formulario({ titulo: 'Cartilha' }, arquivo('vazio.pdf', new Uint8Array(0)));

  assert.equal(lerMaterial(dados).arquivo, null);
  assert.ok(validarMaterial(lerMaterial(dados)).erros.arquivo);
});

test('texto no campo de arquivo não vira arquivo', () => {
  const dados = formulario({ titulo: 'Cartilha', arquivo: 'nao-sou-arquivo.pdf' });
  assert.equal(lerMaterial(dados).arquivo, null);
});

test('id que não é uuid é recusado antes de chegar ao Postgres', () => {
  const { erros } = validarMaterial(lerMaterial(formulario(
    { titulo: 'Cartilha', id: 'nao-sou-uuid' },
    arquivo('m.pdf', pdfFalso())
  )));

  assert.ok(erros.id);
});

// --- o tipo vem dos BYTES ---

test('reconhece PDF pela assinatura "%PDF-"', () => {
  const reconhecido = tipoDoDocumento(pdfFalso(BYTES_PARA_RECONHECER));

  assert.ok(reconhecido, 'não reconheceu um PDF');
  assert.equal(reconhecido.extensao, 'pdf');
  assert.equal(reconhecido.tipo, 'application/pdf');
});

test('EXTENSÃO MENTINDO: um arquivo de texto chamado "cartilha.pdf" é recusado', () => {
  // O `accept` do input é sugestão para o seletor de arquivos, e o
  // Content-Type vem do cliente. Server Action é endpoint HTTP público
  // (spec §4.5): os dois são entrada de usuário. O que não dá para forjar
  // sem de fato ser aquilo são os primeiros bytes.
  const texto = new TextEncoder().encode('isto aqui nao e um pdf de jeito nenhum');
  assert.equal(tipoDoDocumento(texto), null);
});

test('imagem, ZIP e executável não passam por material', () => {
  const casos = {
    jpeg: [0xff, 0xd8, 0xff, 0xe0],
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    zip: [0x50, 0x4b, 0x03, 0x04],
    elf: [0x7f, 0x45, 0x4c, 0x46]
  };

  for (const [nome, cabecalho] of Object.entries(casos)) {
    const bytes = new Uint8Array(BYTES_PARA_RECONHECER);
    bytes.set(cabecalho, 0);
    assert.equal(tipoDoDocumento(bytes), null, `${nome} passou por material`);
  }
});

test('PDF com lixo ANTES da assinatura é recusado — a exigência é estrita de propósito', () => {
  // A especificação do PDF tolera bytes antes do "%PDF-", e muitos leitores
  // também. Aceitar isso aqui significaria aceitar qualquer arquivo que
  // ESCONDA um PDF dentro. Se um dia um material de verdade for recusado por
  // isto, o conserto é medir aquele arquivo — não afrouxar às cegas.
  const bytes = new Uint8Array(BYTES_PARA_RECONHECER);
  bytes.set([0x00, 0x00, 0x25, 0x50, 0x44, 0x46, 0x2d], 0);
  assert.equal(tipoDoDocumento(bytes), null);
});

test('arquivo curto demais para ter assinatura não é material (e não estoura)', () => {
  assert.equal(tipoDoDocumento(new Uint8Array([0x25, 0x50])), null);
  assert.equal(tipoDoDocumento(new Uint8Array(0)), null);
});

test('o accept do input lista exatamente os tipos que o servidor reconhece', () => {
  // Se os dois divergirem, o seletor do celular esconde um arquivo que o
  // servidor aceitaria, ou oferece um que ele vai recusar depois do upload.
  assert.equal(TIPOS_DE_MATERIAL_ACEITOS, 'application/pdf');
});

// --- o caminho no bucket e o nome do download ---

test('NOME DE ARQUIVO NÃO ENTRA NO CAMINHO, e sem tema a pasta é "material"', () => {
  assert.equal(caminhoDoMaterial('Educação Antirracista', 'pdf', 'abc-123'),
    'educacao-antirracista/abc-123.pdf');
  assert.equal(caminhoDoMaterial('', 'pdf', 'abc-123'), 'material/abc-123.pdf');
});

test('tema com travessia de diretório ou caractere estranho vira pasta inofensiva', () => {
  for (const perigoso of ['../../identidade', '/', '..', '   ', '???', 'a/b/c']) {
    const caminho = caminhoDoMaterial(perigoso, 'pdf', 'id');
    assert.doesNotMatch(caminho, /\.\./, `"${perigoso}" deixou ".." no caminho`);
    assert.equal(caminho.split('/').length, 2, `"${perigoso}" produziu mais de uma pasta`);
    assert.match(caminho, /^[a-z0-9-]+\/id\.pdf$/, `"${perigoso}" produziu "${caminho}"`);
  }
});

test('o nome do DOWNLOAD sai do título, com a extensão vinda do caminho guardado', () => {
  // Sem isto o material chegaria à pasta de downloads de uma professora como
  // "7b2e4c10-....pdf" — impossível de reconhecer.
  assert.equal(
    nomeParaBaixar('Cartilha do Mês da Consciência Negra', 'educacao/7b2e4c10.pdf'),
    'cartilha-do-mes-da-consciencia-negra.pdf'
  );
});

test('o nome do download passa por lista branca: nada de barra, aspas ou quebra de linha', () => {
  // Ele vai para dentro de um Content-Disposition e para o nome de um
  // arquivo no disco de outra pessoa — dois lugares onde isso é segurança.
  for (const hostil of ['../../etc/passwd', 'a"; rm -rf /', 'linha\nnova', '   ']) {
    const nome = nomeParaBaixar(hostil, 'material/id.pdf');
    assert.match(nome, /^[a-z0-9-]+\.pdf$/, `"${hostil}" produziu "${nome}"`);
    assert.doesNotMatch(nome, /\.\./);
  }
});

test('título que não sobra letra nenhuma ainda produz um nome utilizável', () => {
  assert.equal(nomeParaBaixar('???', 'material/id.pdf'), 'material.pdf');
});

// --- os avisos da URL ---

test('o aviso do acervo vem de LISTA FECHADA — a URL escolhe uma frase nossa, nunca traz uma', () => {
  assert.equal(avisoDoAcervo('publicado').ok, true);
  assert.equal(avisoDoAcervo('erro').ok, false);
  assert.equal(avisoDoAcervo('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDoAcervo('toString'), null, 'herdado do protótipo de Object não é aviso');
  assert.equal(avisoDoAcervo(undefined), null);
});

test('o aviso de "tirado do ar" DIZ que o arquivo continua acessível — o bucket é público', () => {
  // É o ponto em que esta tela difere da galeria, e é o que impede a equipe
  // de usar "Tirar do ar" achando que resolveu o caso do arquivo errado.
  const aviso = avisoDoAcervo('retirado');
  assert.match(aviso.texto, /endereço/);
  assert.match(aviso.texto, /Apagar/);
});

test('as listas de aviso são separadas: uma chave de outra tela não vale no acervo', () => {
  assert.equal(avisoDoAcervo('publicada'), null, '"publicada" é da galeria/notícias, não daqui');
  assert.equal(avisoDaGaleria('enviado'), null);
  assert.equal(avisoDaLista('enviado'), null);
});

// =====================================================================
// 2. O LIMITE DE CORPO DA SERVER ACTION, MEDIDO COM PDF DE VERDADE
// =====================================================================
//
// A Tarefa P3 mediu isto com foto e a tabela está em next.config.ts. Esta
// tarefa mediu de novo, com PDF, porque material de acervo é maior que foto
// e a pergunta do brief era essa:
//
//   3 MB -> 200   4 MB -> 200   5 MB -> 200   5,5 MB -> 200
//   6 MB -> 200   7 MB -> 200   7,5 MB -> 200
//   8 MB -> 500 (Internal Server Error, texto puro)   9 MB -> 500
//
// A CONCLUSÃO QUE DECIDIU A TELA: o Next local aceitaria até ~7,5 MB, ou
// seja, **o teto de 4 MB da tela não vem do Next — vem da Netlify**, cujo
// limite de corpo de função é 6 MB já contando a codificação, e que NUNCA
// foi exercitada (CLAUDE.md, item 0). Por isso `LIMITE_MATERIAL_BYTES` é
// derivado de `LIMITE_ARQUIVO_BYTES` em vez de ser um número novo.
//
// O teste abaixo trava a metade que dá para medir daqui: que um corpo do
// tamanho do maior material real da ONG ("Eu Griot .pdf", 5,3 MiB) CHEGA à
// Action. Se alguém apagar o `bodySizeLimit` de next.config.ts, ele fica
// vermelho junto com os dois da galeria.
// =====================================================================

/** Os campos escondidos que identificam a Server Action de um `<form>`. */
async function camposDaAction(rota, idDoForm) {
  const html = await fetch(`${BASE}${rota}`).then((r) => r.text());
  const form = html.match(new RegExp(`<form id="${idDoForm}"[\\s\\S]*?</form>`));
  assert.ok(form, `não achei o <form id="${idDoForm}"> em ${rota}`);

  const ocultos = [...form[0].matchAll(/<input type="hidden" name="(\$ACTION[^"]*)"(?: value="([^"]*)")?\/>/g)];
  assert.ok(ocultos.length > 0, 'o form não traz os campos escondidos da Server Action');

  return ocultos.map(([, nome, valor]) => [
    nome,
    (valor ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  ]);
}

test('um PDF do tamanho do maior material da ONG (5,3 MB) CHEGA à Server Action', async () => {
  // Usa uma Action alcançável sem sessão (a de /recuperar-acesso): o que se
  // mede aqui é o CORPO, não a Action.
  const ocultos = await camposDaAction('/recuperar-acesso', 'form-recuperar');

  const corpo = new FormData();
  for (const [nome, valor] of ocultos) corpo.set(nome, valor);
  corpo.set('email', 'ninguem@exemplo.com');
  corpo.set('recheio', new File(
    [pdfFalso(Math.round(5.3 * 1024 * 1024))], 'material.pdf', { type: 'application/pdf' }
  ));

  // `origin` igual ao host: as Server Actions do Next recusam requisição de
  // outra origem, e é o que um navegador manda ao enviar o form.
  const resposta = await fetch(`${BASE}/recuperar-acesso`, {
    method: 'POST', redirect: 'manual', headers: { origin: BASE }, body: corpo
  });

  assert.notEqual(
    resposta.status, 500,
    'um corpo de 5,3 MB voltou 500. É o limite padrão do Next (1 MB) de volta: alguém apagou\n'
    + '  `experimental.serverActions.bodySizeLimit` de next.config.ts. O efeito no celular da\n'
    + '  ONG é "Internal Server Error" em texto puro — e aqui a conclusão maior cai junto: a\n'
    + '  de que o teto de 4 MB da tela vem da Netlify, não do Next.'
  );
});

// =====================================================================
// 3. O que as duas listas desenham
// =====================================================================

function renderizarPainel(materiais, extras = {}) {
  return renderToStaticMarkup(createElement(ListaMateriaisDoPainel, {
    materiais, acaoAlternar: '/acao', caminhoApagar: '/admin/acervo/apagar', degradou: false,
    ...extras
  }));
}

function renderizarPublica(materiais, mensagemVazio = 'Ainda não há material publicado.') {
  return renderToStaticMarkup(createElement(ListaMateriais, { materiais, mensagemVazio }));
}

test('painel: material guardado ganha "Publicar"; no ar, ganha "Tirar do ar"', () => {
  assert.match(renderizarPainel([exemplo()]), /Publicar/);

  const noAr = renderizarPainel([exemplo({ publicado: true })]);
  assert.match(noAr, /Tirar do ar/);
  assert.doesNotMatch(noAr, />Publicar</);
});

test('painel: os dois estados estão ESCRITOS no cartão, não só na cor', () => {
  assert.match(renderizarPainel([exemplo()]), /Guardado/);
  assert.match(renderizarPainel([exemplo({ publicado: true })]), /No ar/);
});

test('painel: publicar/tirar do ar é um <form> com POST — é o que funciona sem JavaScript', () => {
  const html = renderizarPainel([exemplo()]);

  const form = html.match(/<form[^>]*class="material__form"[^>]*>/);
  assert.ok(form, 'o publicar/tirar do ar não é um <form>');
  assert.match(form[0], /action="\/acao"/);
  assert.match(html, /<input type="hidden" name="id" value="7b2e4c10/);
  assert.match(html, /<input type="hidden" name="acao" value="publicar"/);
  assert.match(html, /<button type="submit"/);
});

test('painel: cada material tem um jeito de ABRIR o arquivo — um PDF não tem miniatura', () => {
  // É o que substitui a miniatura da galeria. Sem isto, a equipe não tem
  // como confirmar que o que subiu foi o material certo, que é justamente o
  // erro que "Apagar" existe para corrigir.
  const html = renderizarPainel([exemplo()]);

  assert.match(html, /Abrir o arquivo/);
  assert.match(html, /href="https:\/\/exemplo\.supabase\.co[^"]*7b2e4c10\.pdf"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener"/);
  assert.match(html, /abre em outra aba/,
    'mudança de contexto sem aviso escrito é o que leitor de tela não perdoa (regra 8)');
});

test('painel: a lista AVISA que "Tirar do ar" não tira o arquivo do ar', () => {
  // O bucket `acervo` é público de propósito. Sem esta frase, quem subiu o
  // arquivo errado usaria o botão mais próximo e acharia que resolveu.
  const html = renderizarPainel([exemplo()]);

  assert.match(html, /endereço público/);
  // `&quot;` porque react-dom/server escapa aspas também em nó de texto — a
  // mesma entidade que testes/lista-materiais.test.mjs já trata.
  assert.match(html, /&quot;Apagar&quot;/);
});

test('painel: "Apagar" é um LINK para a tela de confirmação, não um botão que apaga', () => {
  const html = renderizarPainel([exemplo()]);
  assert.match(html, /href="\/admin\/acervo\/apagar\?id=7b2e4c10[^"]*"/);
});

test('painel: cada botão diz DE QUAL material é, para quem navega por botões', () => {
  const html = renderizarPainel([exemplo({ titulo: 'Cartilha de teste' })]);
  const marcas = html.match(/— Cartilha de teste/g) ?? [];
  assert.ok(marcas.length >= 3, `só ${marcas.length} botão(ões) identificaram o material`);
});

test('painel: consulta que falhou NÃO vira lista vazia — diria que o envio se perdeu', () => {
  const html = renderizarPainel([], { degradou: true });

  assert.match(html, /class="estado estado--erro"/);
  assert.match(html, /Nada foi perdido/);
  assert.doesNotMatch(html, /Nenhum material subiu ainda/);
});

test('painel: lista vazia diz o que fazer e que subir não publica', () => {
  const html = renderizarPainel([]);

  assert.match(html, /Nenhum material subiu ainda/);
  assert.match(html, /só aparece no site quando você publicar/);
});

test('pública: cada material ganha DOIS caminhos — abrir para ler e baixar', () => {
  // RF36. O atributo `download` do HTML é ignorado entre origens (o arquivo
  // está sempre em outra origem), então quem faz o download acontecer é o
  // `?download=` da URL — ver servidor/dados/acervo.ts.
  const html = renderizarPublica([{
    ...exemplo(),
    urlDownload: 'https://exemplo.supabase.co/storage/v1/object/public/acervo/educacao/'
      + '7b2e4c10.pdf?download=cartilha-de-teste.pdf'
  }]);

  assert.match(html, /Abrir para ler/);
  assert.match(html, /Baixar material/);
  assert.match(html, /\?download=cartilha-de-teste\.pdf/,
    'o link de baixar perdeu o `?download=` — sem ele o navegador só ABRE o PDF, e o botão '
    + 'volta a prometer o que não faz');
});

test('pública: o link de ABRIR não leva `?download=` — senão os dois fariam a mesma coisa', () => {
  const html = renderizarPublica([{ ...exemplo(), urlDownload: 'https://exemplo/x.pdf?download=a.pdf' }]);

  const abrir = html.match(/<a class="botao botao--secundario" href="([^"]+)"/);
  assert.ok(abrir, 'o link de abrir sumiu');
  assert.doesNotMatch(abrir[1], /download=/);
});

// =====================================================================
// 4. A trava das Server Actions: nenhuma esquece a guarda
// =====================================================================

const ARQUIVO_DAS_ACTIONS = fileURLToPath(new URL('../acoes/acervo.ts', import.meta.url));

/** O código de cada `export async function` do arquivo, sem comentários. */
async function corpoDasActions() {
  const codigo = (await readFile(ARQUIVO_DAS_ACTIONS, 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');

  const inicios = [...codigo.matchAll(/export async function (\w+)/g)];
  assert.ok(inicios.length > 0, 'nenhuma Server Action encontrada — o teste não verificou nada');

  return inicios.map((achado, i) => {
    const inicio = achado.index;
    const proxima = i + 1 < inicios.length ? inicios[i + 1].index : -1;
    return { nome: achado[1], corpo: codigo.slice(inicio, proxima === -1 ? undefined : proxima) };
  });
}

test('toda Server Action do acervo chama ehEquipe() por conta própria', async () => {
  // A varredura de testes/painel-guarda.test.mjs exige `ehEquipe()` em toda
  // página sob `app/admin/`. Server Action NÃO é página: o Next a publica
  // numa URL própria (spec §4.5), e qualquer pessoa pode chamá-la com
  // qualquer corpo, sem passar pela tela e sem JavaScript.
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) problemas.push(`${nome}: não chama ehEquipe()`);
  }

  assert.deepEqual(
    problemas, [],
    'Server Action do acervo sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto. Ver o cabeçalho de acoes/acervo.ts.'
  );
});

test('a Action que sobe arquivo NUNCA escreve `publicado` nem `downloads`', async () => {
  const enviar = (await corpoDasActions()).find(({ nome }) => nome === 'enviarMaterial');
  assert.ok(enviar, 'enviarMaterial sumiu — este teste precisa ser revisto');

  assert.doesNotMatch(enviar.corpo, /publicado/,
    'enviarMaterial menciona `publicado`. O material nasce fora do ar pela AUSÊNCIA da chave '
    + 'no insert — um `false` escrito à mão é o que alguém "parametriza" depois.');
  assert.doesNotMatch(enviar.corpo, /downloads/,
    'enviarMaterial menciona `downloads` — a contagem não pode entrar pelo corpo da requisição');
});

test('nenhuma Action do acervo espalha o FormData num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

test('o nome do arquivo recebido nunca vira caminho no bucket', async () => {
  const codigo = (await readFile(ARQUIVO_DAS_ACTIONS, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

  // `arquivo.name` é o nome escolhido por quem enviou. Ele carregaria "../",
  // barra, e o nome de um documento pessoal — que num bucket de leitura
  // PÚBLICA vira dado exposto na URL.
  assert.doesNotMatch(codigo, /arquivo\.name/,
    'o nome do arquivo recebido está sendo usado. O caminho sai de `caminhoDoMaterial`, com '
    + 'um uuid e a extensão vinda dos BYTES.');
});

test('a Action de alternar confere se o update ACERTOU alguma linha', async () => {
  const alternar = (await corpoDasActions()).find(({ nome }) => nome === 'alternarMaterial');
  assert.ok(alternar, 'alternarMaterial sumiu — este teste precisa ser revisto');

  // Um update que não casa linha nenhuma é SUCESSO no PostgREST, com zero
  // linhas. Sem o `.select('id')`, publicar um material apagado por outra
  // pessoa responderia "Publicado" sem ter publicado nada.
  assert.match(alternar.corpo, /\.select\('id'\)/);
});

test('apagar remove o ARQUIVO antes da linha — a ordem é a decisão, não detalhe', async () => {
  const apagar = (await corpoDasActions()).find(({ nome }) => nome === 'apagarMaterial');
  assert.ok(apagar, 'apagarMaterial sumiu — este teste precisa ser revisto');

  const posicaoDoRemove = apagar.corpo.indexOf('.remove(');
  const posicaoDoDelete = apagar.corpo.indexOf('.delete()');

  assert.ok(posicaoDoRemove > 0, 'apagarMaterial não remove o arquivo do bucket');
  assert.ok(posicaoDoDelete > 0, 'apagarMaterial não apaga a linha');
  assert.ok(
    posicaoDoRemove < posicaoDoDelete,
    'a linha está sendo apagada ANTES do arquivo. Num bucket público isso deixa o pior '
    + 'desfecho possível: arquivo invisível para a equipe e baixável por quem tiver o endereço.'
  );
});

// =====================================================================
// 5. A recusa, contra o servidor de verdade
// =====================================================================

const ROTAS_NOVAS = ['/admin/acervo', '/admin/acervo/apagar'];

test('as duas telas novas do painel respondem 404 para anônimo', async () => {
  for (const rota of ROTAS_NOVAS) {
    const resposta = await fetch(`${BASE}${rota}`, { redirect: 'manual' });
    assert.equal(resposta.status, 404,
      `${rota} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
  }
});

test('nada das telas do acervo vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tarefa.
  for (const rota of ROTAS_NOVAS) {
    const html = await fetch(`${BASE}${rota}`).then((resposta) => resposta.text());

    for (const marca of [
      'Subir um material', 'Materiais já enviados', 'material__estado', 'material__botao',
      'Subir material', 'Apagar este material para sempre', 'Nenhum material subiu ainda',
      'Abrir o arquivo'
    ]) {
      assert.ok(!html.includes(marca),
        `a resposta de ${rota} servida a quem não é equipe contém "${marca}"`);
    }

    assert.match(html, /<title>Página não encontrada/, `${rota} não devolveu o 404 do projeto`);
  }
});

test('a tela de apagar não conta nem se um material existe: id inventado também é 404', async () => {
  const resposta = await fetch(`${BASE}/admin/acervo/apagar?id=${UUID}`);
  assert.equal(resposta.status, 404);
});

test('/acervo continua respondendo 200 e servindo o estado vazio', async () => {
  // No modo offline da suíte não há Supabase configurado: a consulta não sai,
  // `listarMateriais()` devolve lista vazia e a página mostra o mesmo texto
  // de antes desta tarefa. É o que prova que os dois links novos não
  // quebraram a página pública.
  const resposta = await fetch(`${BASE}/acervo`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  assert.match(html, /<div id="lista-acervo">/,
    'o <div id="lista-acervo"> sumiu — é o id que testes/paridade-texto.test.mjs exclui da '
    + 'comparação com o HTML original');
  assert.match(html, /class="estado estado--vazio"/);
});
