/**
 * Galeria (RF05/RF33/RN07) — a Tarefa P3 do painel: a equipe sobe uma foto
 * do celular, e ela aparece em /galeria depois de publicada.
 *
 * ===================================================================
 * O QUE DÁ PARA MEDIR HOJE, E O QUE NÃO DÁ
 * ===================================================================
 *
 * NÃO EXISTE SESSÃO DE EQUIPE UTILIZÁVEL (CLAUDE.md, "O que trava hoje",
 * itens 1 e 2). Então **nenhum upload real acontece** — nem para o Storage,
 * nem para a tabela — aqui nem em lugar nenhum, e nenhum teste deste arquivo
 * afirma nada sobre isso.
 *
 * O que sobra, e é mais do que parece, são seis coisas:
 *
 *   1. AS DECISÕES PURAS: o que conta como imagem (pelos BYTES, não pela
 *      extensão), o que conta como tamanho aceitável, que caminho um arquivo
 *      ganha no bucket, o que o `?aviso=` da URL pode dizer de volta. Moram
 *      em compartilhado/validacao.ts e compartilhado/avisos-do-painel.ts
 *      justamente para caberem aqui.
 *   2. O LIMITE DE CORPO DA SERVER ACTION, contra o servidor de verdade —
 *      o achado que decidiu o desenho desta tarefa. Ver a seção 2.
 *   3. O QUE AS DUAS LISTAS DESENHAM, renderizando os componentes com
 *      `react-dom/server` sem subir o Next. É a única forma de a tela do
 *      painel ter verificação antes de alguém conseguir entrar.
 *   4. QUE AS SERVER ACTIONS NÃO ESQUEÇAM A GUARDA — varredura do
 *      código-fonte de acoes/galeria.ts. A varredura de
 *      testes/painel-guarda.test.mjs cobre `app/admin/**` e NÃO alcança
 *      Actions, que são endpoint HTTP público (spec §4.5).
 *   5. A RECUSA, por HTTP: as duas rotas novas respondem 404 para anônimo e
 *      não vazam nada do painel no HTML servido.
 *   6. A CSP DEIXANDO A FOTO CARREGAR — e continuando a NÃO deixar o
 *      navegador falar com o Supabase. Ver a seção 6.
 *
 * O QUE FICA SEM MEDIÇÃO, dito em voz alta: nenhum byte foi escrito no
 * bucket `galeria` nem em `public.midia` por este código, em ambiente
 * nenhum. O upload, o insert, a remoção do órfão, o `revalidatePath` e o
 * caminho de sucesso das três Actions só podem ser exercitados com uma
 * sessão de equipe. E o limite de corpo de função da NETLIFY não foi medido
 * — esta branch nunca foi publicada (CLAUDE.md, item 0).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  lerMidia, validarMidia, tipoDaImagem, caminhoNoBucket, emMegabytes,
  LIMITE_ARQUIVO_BYTES, LIMITE_ALBUM, LIMITE_ALT, LIMITE_LEGENDA,
  BYTES_PARA_RECONHECER, TIPOS_ACEITOS
} from '../compartilhado/validacao.ts';
import { avisoDaGaleria, avisoDaLista } from '../compartilhado/avisos-do-painel.ts';
import { ListaAlbuns } from '../componentes/ListaAlbuns.ts';
import { ListaMidia } from '../componentes/ListaMidia.ts';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const UUID = '9c1d5b7e-2a44-4f0b-8b6e-1f2c3d4e5a6b';

/** Uma peça de exemplo. NÃO é conteúdo da ONG — é dado de teste. */
function exemplo(mudancas = {}) {
  return {
    id: UUID,
    album: 'Oficina de percussão',
    tipo: 'imagem',
    caminho: 'oficina-de-percussao/9c1d5b7e.jpg',
    alt: 'Crianças tocando tambor numa roda',
    legenda: null,
    autorizacao_registrada: true,
    publicado: false,
    criado_em: '2026-09-01T15:00:00.000Z',
    url: 'https://exemplo.supabase.co/storage/v1/object/public/galeria/x.jpg',
    ...mudancas
  };
}

/** Um FormData com um arquivo de verdade dentro. */
function formulario(campos, arquivo) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  if (arquivo) dados.set('arquivo', arquivo);
  return dados;
}

/** Bytes que COMEÇAM como um JPEG de verdade (FF D8 FF), com recheio. */
function jpegFalso(bytes = 64) {
  const conteudo = new Uint8Array(bytes);
  conteudo.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return conteudo;
}

function arquivo(nome, bytes, tipo = 'image/jpeg') {
  return new File([bytes], nome, { type: tipo });
}

// =====================================================================
// 1. As decisões puras
// =====================================================================

test('o formulário é lido campo a campo, e campo que não está na lista não existe', () => {
  const dados = formulario({
    album: 'Oficina', alt: 'Descrição', legenda: 'Legenda', autorizacao: 'on',
    // Os dois campos que uma requisição montada à mão tentaria injetar. Se
    // `lerMidia` espalhasse o FormData num objeto, eles chegariam ao insert —
    // e `publicado: true` no corpo é literalmente "publicar a foto de uma
    // criança sem apertar publicar".
    publicado: 'true',
    autorizacao_registrada: 'true',
    caminho: '../../identidade/logo.png'
  }, arquivo('foto.jpg', jpegFalso()));

  const lido = lerMidia(dados);

  assert.deepEqual(Object.keys(lido).sort(), ['album', 'alt', 'arquivo', 'autorizacao', 'id', 'legenda']);
  assert.equal(lido.album, 'Oficina');
  assert.equal(lido.autorizacao, true);
  assert.ok(lido.arquivo instanceof File);
});

test('álbum, descrição e arquivo são obrigatórios, e os três erros voltam de uma vez', () => {
  const { valido, erros } = validarMidia(lerMidia(formulario({})));

  assert.equal(valido, false);
  assert.ok(erros.album, 'faltou o erro de álbum');
  assert.ok(erros.alt, 'faltou o erro de descrição');
  assert.ok(erros.arquivo, 'faltou o erro de arquivo');
});

test('o `alt` é exigido e a mensagem diz PARA QUEM ele serve — é acessibilidade, não burocracia', () => {
  const { erros } = validarMidia(lerMidia(formulario({ album: 'x' })));

  // Regra 8 do CLAUDE.md. Uma mensagem "campo obrigatório" faria a pessoa
  // escrever qualquer coisa para passar; esta diz o que escrever e por quê.
  assert.match(erros.alt, /para quem não pode vê-la/);
});

test('espaço em branco não é descrição: "   " é recusado como vazio', () => {
  const { erros } = validarMidia(
    lerMidia(formulario({ album: '  ', alt: '   ' }, arquivo('f.jpg', jpegFalso())))
  );

  assert.ok(erros.album);
  assert.ok(erros.alt);
});

test('legenda é opcional — foto sem legenda é válida', () => {
  const { valido, erros } = validarMidia(lerMidia(formulario(
    { album: 'Oficina', alt: 'Crianças numa roda' },
    arquivo('f.jpg', jpegFalso())
  )));

  assert.equal(valido, true, `recusou sem legenda: ${JSON.stringify(erros)}`);
});

test('a autorização NÃO é obrigatória para enviar — ela decide se a foto pode ir ao ar', () => {
  // RN07 pela porta certa: sem a declaração a foto sobe e fica guardada.
  // Se ela fosse `required`, a caixa viraria obstáculo a vencer, e a saída
  // óbvia de quem está com pressa é marcar sem ler — ver o cabeçalho de
  // componentes/FormularioMidia.tsx.
  const { valido } = validarMidia(lerMidia(formulario(
    { album: 'Oficina', alt: 'Crianças numa roda' },
    arquivo('f.jpg', jpegFalso())
  )));

  assert.equal(valido, true, 'o envio foi recusado por falta de autorização — a regra é outra');
});

test('caixa de autorização: só conta como marcada o que de fato é marcação', () => {
  const marcada = (valor) =>
    lerMidia(formulario({ autorizacao: valor })).autorizacao;

  assert.equal(marcada('on'), true, '"on" é o que o navegador manda');
  // Quem chama a Action à mão pode mandar qualquer coisa. Um `Boolean(valor)`
  // distraído promoveria as quatro abaixo — e aqui a consequência é a foto de
  // uma criança na internet.
  for (const mentira of ['false', '0', 'off', 'não']) {
    assert.equal(marcada(mentira), false, `"${mentira}" não pode valer como autorização`);
  }
});

test('arquivo grande demais é recusado com o tamanho, o limite e o que fazer', () => {
  const grande = { size: LIMITE_ARQUIVO_BYTES + 1, name: 'f.jpg' };
  const dados = new FormData();
  dados.set('album', 'Oficina');
  dados.set('alt', 'Crianças numa roda');
  // Um File de 4 MB de verdade em cada rodada seria lento à toa: o que a
  // validação olha é `size`, e é isso que este objeto tem.
  dados.set('arquivo', Object.assign(new File([new Uint8Array(4)], 'f.jpg'), {}));
  const campos = lerMidia(dados);
  const { erros } = validarMidia({ ...campos, arquivo: grande });

  assert.match(erros.arquivo, /o limite é 4,0 MB/);
  assert.match(erros.arquivo, /tamanho médio/,
    'a mensagem precisa dizer O QUE FAZER, não só que passou do limite');
});

test('arquivo de tamanho zero conta como "nenhum arquivo" — é o que o navegador manda', () => {
  const dados = formulario({ album: 'Oficina', alt: 'Roda' }, arquivo('vazio.jpg', new Uint8Array(0)));

  assert.equal(lerMidia(dados).arquivo, null);
  assert.ok(validarMidia(lerMidia(dados)).erros.arquivo);
});

test('texto no campo de arquivo não vira arquivo', () => {
  // A precaução 1 do bloco "Leitura do FormData", do outro lado: lá um File
  // no campo de senha viraria "[object File]"; aqui uma string no campo de
  // arquivo não pode virar um arquivo.
  const dados = formulario({ album: 'Oficina', alt: 'Roda', arquivo: 'nao-sou-arquivo.jpg' });
  assert.equal(lerMidia(dados).arquivo, null);
});

// --- o tipo vem dos BYTES ---

test('reconhece JPEG, PNG, GIF e WebP pela assinatura', () => {
  const casos = [
    ['jpg', [0xff, 0xd8, 0xff, 0xdb]],
    ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    // WebP: "RIFF" + 4 bytes de tamanho + "WEBP"
    ['webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]]
  ];

  for (const [extensao, cabecalho] of casos) {
    const bytes = new Uint8Array(BYTES_PARA_RECONHECER);
    bytes.set(cabecalho, 0);
    const reconhecido = tipoDaImagem(bytes);
    assert.ok(reconhecido, `não reconheceu ${extensao}`);
    assert.equal(reconhecido.extensao, extensao);
  }
});

test('EXTENSÃO MENTINDO: um arquivo de texto chamado "foto.jpg" é recusado', () => {
  // O `accept` do input é sugestão para o seletor de arquivos, e o
  // Content-Type vem do cliente. Server Action é endpoint HTTP público
  // (spec §4.5): os dois são entrada de usuário. O que não dá para forjar
  // sem de fato ser aquilo são os primeiros bytes.
  const texto = new TextEncoder().encode('isto aqui nao e uma foto de jeito nenhum');
  assert.equal(tipoDaImagem(texto), null);
});

test('PDF, ZIP e vídeo MP4 não passam por imagem', () => {
  const casos = {
    pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
    zip: [0x50, 0x4b, 0x03, 0x04],
    mp4: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]
  };

  for (const [nome, cabecalho] of Object.entries(casos)) {
    const bytes = new Uint8Array(BYTES_PARA_RECONHECER);
    bytes.set(cabecalho, 0);
    assert.equal(tipoDaImagem(bytes), null, `${nome} passou por imagem`);
  }
});

test('"RIFF" sozinho não é WebP — WAV e AVI começam igual', () => {
  const bytes = new Uint8Array(BYTES_PARA_RECONHECER);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], 0); // "WAVE"
  assert.equal(tipoDaImagem(bytes), null);
});

test('arquivo curto demais para ter assinatura não é imagem (e não estoura)', () => {
  assert.equal(tipoDaImagem(new Uint8Array([0xff, 0xd8])), null);
  assert.equal(tipoDaImagem(new Uint8Array(0)), null);
});

test('o accept do input lista exatamente os tipos que o servidor reconhece', () => {
  // Se os dois divergirem, o seletor do celular esconde uma foto que o
  // servidor aceitaria, ou oferece uma que ele vai recusar depois do upload.
  assert.equal(TIPOS_ACEITOS, 'image/jpeg,image/png,image/gif,image/webp');
});

// --- o caminho no bucket ---

test('NOME DE ARQUIVO NÃO ENTRA NO CAMINHO: nem "../", nem barra, nem o nome de quem aparece', () => {
  const caminho = caminhoNoBucket('Oficina de Percussão', 'jpg', 'abc-123');

  assert.equal(caminho, 'oficina-de-percussao/abc-123.jpg');
  assert.doesNotMatch(caminho, /\.\./);
});

test('álbum com travessia de diretório ou caractere estranho vira pasta inofensiva', () => {
  for (const perigoso of ['../../identidade', '/', '..', '   ', '???', 'a/b/c']) {
    const caminho = caminhoNoBucket(perigoso, 'png', 'id');
    assert.doesNotMatch(caminho, /\.\./, `"${perigoso}" deixou ".." no caminho`);
    assert.equal(caminho.split('/').length, 2, `"${perigoso}" produziu mais de uma pasta`);
    assert.match(caminho, /^[a-z0-9-]+\/id\.png$/, `"${perigoso}" produziu "${caminho}"`);
  }
});

test('a extensão do caminho vem do tipo reconhecido, nunca do nome recebido', () => {
  // Um .php, um .svg ou um .html com bytes de JPEG viraria um arquivo
  // executável servido do domínio do Storage se a extensão viesse do nome.
  assert.match(caminhoNoBucket('Álbum', 'jpg', 'id'), /\.jpg$/);
});

test('emMegabytes escreve como se lê em português', () => {
  assert.equal(emMegabytes(4 * 1024 * 1024), '4,0 MB');
  assert.equal(emMegabytes(3.7 * 1024 * 1024), '3,7 MB');
});

// --- os avisos da URL ---

test('o aviso da galeria vem de LISTA FECHADA — a URL escolhe uma frase nossa, nunca traz uma', () => {
  assert.equal(avisoDaGaleria('publicada').ok, true);
  assert.equal(avisoDaGaleria('sem-autorizacao').ok, false);
  assert.equal(avisoDaGaleria('Sua conta foi bloqueada, ligue para (11) 0000-0000'), null);
  assert.equal(avisoDaGaleria('toString'), null, 'herdado do protótipo de Object não é aviso');
  assert.equal(avisoDaGaleria(undefined), null);
});

test('o aviso de RN07 diz o que fazer, e não só que não deu', () => {
  const aviso = avisoDaGaleria('sem-autorizacao');
  assert.match(aviso.texto, /autorização de uso de imagem/);
  assert.match(aviso.texto, /Suba a foto de novo marcando a caixa|apague/);
});

test('as duas listas de aviso são separadas: uma chave de notícia não vale na galeria', () => {
  assert.equal(avisoDaGaleria('criada'), null);
  assert.equal(avisoDaLista('enviada'), null);
});

// =====================================================================
// 2. O LIMITE DE CORPO DA SERVER ACTION — o achado que decidiu o desenho
// =====================================================================
//
// MEDIDO em 01/09/2026, antes de escrever a tela (era instrução do brief, e
// foi a medição certa): sem `serverActions.bodySizeLimit`, um corpo de 1 MB
// já é recusado, e a resposta é **500 Internal Server Error em texto puro** —
// o `statusCode: 413` só aparece no log do servidor. Foto de celular tem 3 a
// 8 MB: a PRIMEIRA foto real da ONG bateria nisso.
//
// A configuração foi para 8 MB (next.config.ts, com a tabela da medição) e o
// limite da TELA ficou em 4 MB, para que arquivo grande demais receba a
// nossa frase em vez do 500.
//
// ESTES DOIS TESTES SÃO A TRAVA DISSO. Sem eles, apagar uma linha de
// next.config.ts não quebraria teste nenhum — e o defeito só apareceria no
// celular de alguém da ONG, no meio de um evento, como "Internal Server
// Error". Eles usam uma Action que existe e é alcançável sem sessão (a de
// /recuperar-acesso): o que se mede aqui é o CORPO, não a Action.

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

async function postarComRecheio(megabytes) {
  const ocultos = await camposDaAction('/recuperar-acesso', 'form-recuperar');

  const corpo = new FormData();
  for (const [nome, valor] of ocultos) corpo.set(nome, valor);
  corpo.set('email', 'ninguem@exemplo.com');
  corpo.set(
    'recheio',
    new File([new Uint8Array(Math.round(megabytes * 1024 * 1024))], 'foto.jpg', { type: 'image/jpeg' })
  );

  // `origin` igual ao host: as Server Actions do Next recusam requisição de
  // outra origem, e é o que um navegador manda ao enviar o form.
  return fetch(`${BASE}/recuperar-acesso`, {
    method: 'POST', redirect: 'manual', headers: { origin: BASE }, body: corpo
  });
}

test('um corpo de 3 MB CHEGA à Server Action — sem isto, nenhuma foto de celular sobe', async () => {
  const resposta = await postarComRecheio(3);

  assert.notEqual(
    resposta.status, 500,
    'um corpo de 3 MB voltou 500. É o limite padrão do Next (1 MB) de volta: alguém apagou\n'
    + '  `experimental.serverActions.bodySizeLimit` de next.config.ts. O efeito no celular da\n'
    + '  ONG é "Internal Server Error" em texto puro na primeira foto de verdade — MEDIDO em\n'
    + '  01/09/2026, com a tabela inteira no comentário daquele arquivo.'
  );
});

test('acima do limite configurado o Next responde 500 CRU — o teto existe e está documentado', async () => {
  // Este teste não defende um defeito: ele registra o TETO. Acima de 8 MB
  // não há mensagem nossa possível — o erro acontece antes de a Action
  // rodar, e é por isso que o limite da tela (4 MB) fica bem abaixo, e que o
  // formulário barra por script antes de enviar. Se um dia alguém subir o
  // `bodySizeLimit`, este teste falha e obriga a revisitar a decisão inteira.
  const resposta = await postarComRecheio(9);

  assert.equal(resposta.status, 500,
    `um corpo de 9 MB voltou ${resposta.status}. O limite de corpo mudou — reler o bloco `
    + 'MEDIDO de next.config.ts e refazer a conta com o limite da Netlify.');
});

// =====================================================================
// 3. O que as duas listas desenham
// =====================================================================

function renderizarPainel(midias, extras = {}) {
  return renderToStaticMarkup(createElement(ListaMidia, {
    midias, acaoPorNoAr: '/acao', caminhoApagar: '/admin/galeria/apagar', degradou: false, ...extras
  }));
}

function renderizarPublica(albuns) {
  return renderToStaticMarkup(createElement(ListaAlbuns, {
    albuns, mensagemVazio: 'Ainda não publicamos nenhum álbum por aqui.'
  }));
}

test('painel: foto SEM autorização não ganha botão de publicar — e a lista diz por quê', () => {
  const html = renderizarPainel([exemplo({ autorizacao_registrada: false })]);

  assert.match(html, /Sem autorização de imagem/, 'o estado não está escrito no cartão');
  assert.doesNotMatch(html, /Publicar/,
    'a lista ofereceu "Publicar" para uma foto sem autorização de uso de imagem (RN07)');
  assert.match(html, /não pode ir ao ar/,
    'o motivo precisa estar escrito no item, não codificado numa cor');
  // Apagar continua existindo: é o único caminho que resolve o caso.
  assert.match(html, /Apagar/);
});

test('painel: "No ar" depende das DUAS colunas — publicado sem autorização não é "No ar"', () => {
  // Estado que a Action recusa criar, mas que alguém pode produzir ligando a
  // coluna direto no painel do Supabase. Escrever "No ar" nele faria a
  // equipe acreditar que publicou algo que o público não vê — a política de
  // leitura do banco exige as duas colunas.
  const html = renderizarPainel([
    exemplo({ publicado: true, autorizacao_registrada: false })
  ]);

  assert.doesNotMatch(html, />No ar</, 'a tela mentiu: disse "No ar" sobre foto que ninguém vê');
  assert.match(html, /Sem autorização de imagem/);
});

test('painel: foto autorizada e fora do ar ganha "Publicar"; no ar, ganha "Tirar do ar"', () => {
  assert.match(renderizarPainel([exemplo({ publicado: false })]), /Publicar/);

  const noAr = renderizarPainel([exemplo({ publicado: true })]);
  assert.match(noAr, /Tirar do ar/);
  assert.doesNotMatch(noAr, />Publicar</);
});

test('painel: publicar/tirar do ar é um <form> com POST — é o que funciona sem JavaScript', () => {
  const html = renderizarPainel([exemplo()]);

  // Sem depender da ordem dos atributos, que é decisão do React e não nossa.
  const form = html.match(/<form[^>]*class="midia__form"[^>]*>/);
  assert.ok(form, 'o publicar/tirar do ar não é um <form>');
  assert.match(form[0], /action="\/acao"/);
  assert.match(html, /<input type="hidden" name="id" value="9c1d5b7e/);
  assert.match(html, /<input type="hidden" name="acao" value="publicar"/);
  assert.match(html, /<button type="submit"/);
  assert.doesNotMatch(html, /onclick/i, 'um handler de clique quebraria a tela para quem está sem script');
});

test('painel: "Apagar" é um LINK para a tela de confirmação, não um botão que apaga', () => {
  const html = renderizarPainel([exemplo()]);

  assert.match(html, /<a[^>]+href="\/admin\/galeria\/apagar\?id=9c1d5b7e[^"]*"/,
    'o gesto sem desfazer precisa passar por uma tela — `confirm()` não existe sem JavaScript');
});

test('painel: o botão diz de QUAL foto ele é, para quem navega por botões', () => {
  const html = renderizarPainel([exemplo()]);
  assert.match(html, /Publicar<span class="apenas-leitor-de-tela"> — Oficina de percussão<\/span>/);
});

test('painel: a descrição de acessibilidade aparece na tela para a equipe CONFERIR', () => {
  const html = renderizarPainel([exemplo()]);
  assert.match(html, /Crianças tocando tambor numa roda/);
  // A miniatura não repete a mesma frase no `alt`: seria lida duas vezes.
  assert.match(html, /<img class="midia__miniatura"[^>]*alt=""/);
});

test('painel: legenda nula não vira parágrafo vazio', () => {
  const html = renderizarPainel([exemplo({ legenda: null })]);
  assert.doesNotMatch(html, /midia__legenda/);
  assert.match(renderizarPainel([exemplo({ legenda: 'Roda de tambor' })]), /midia__legenda/);
});

test('painel: falha de consulta NÃO vira lista vazia — diria que o envio se perdeu', () => {
  const html = renderizarPainel([], { degradou: true });

  assert.match(html, /estado--erro/);
  assert.match(html, /Nada foi perdido/);
  assert.doesNotMatch(html, /Nenhuma foto subiu ainda/,
    'a mensagem de "não há nada" numa falha de banco faria a pessoa subir tudo de novo');
});

test('painel: lista vazia de verdade explica que subir não publica', () => {
  const html = renderizarPainel([]);
  assert.match(html, /Nenhuma foto subiu ainda/);
  assert.match(html, /só aparece no site quando você publicar/);
});

test('painel: a ausência de "editar" é explicada, não apenas ausente', () => {
  const html = renderizarPainel([exemplo()]);
  assert.match(html, /Não dá para trocar a foto nem o texto/,
    'botão que não existe e não é explicado vira busca frustrada');
});

test('galeria pública: sem álbum, mostra o estado vazio recebido da página', () => {
  const html = renderizarPublica([]);
  assert.match(html, /class="estado estado--vazio"/);
  assert.match(html, /Ainda não publicamos nenhum álbum por aqui\./);
});

test('galeria pública: cada álbum vira uma <section> com <h2> e a lista de fotos', () => {
  const html = renderizarPublica([
    { nome: 'Oficina de percussão', pecas: [exemplo(), exemplo({ id: 'outro', legenda: 'Roda' })] }
  ]);

  assert.match(html, /<h2 class="album__titulo">Oficina de percussão<\/h2>/);
  assert.equal((html.match(/<img/g) || []).length, 2);
  assert.match(html, /<figcaption class="album__legenda">Roda<\/figcaption>/);
});

test('galeria pública: o `alt` vem do banco, sempre — nunca vazio, nunca inventado', () => {
  const html = renderizarPublica([{ nome: 'Álbum', pecas: [exemplo()] }]);

  assert.match(html, /alt="Crianças tocando tambor numa roda"/);
  assert.doesNotMatch(html, /class="album__foto"[^>]*alt=""/,
    'um alt vazio "de reserva" é como a descrição some sem ninguém notar (regra 8)');
});

test('galeria pública: a foto carrega preguiçosa — a galeria não baixa tudo de uma vez', () => {
  const html = renderizarPublica([{ nome: 'Álbum', pecas: [exemplo()] }]);
  assert.match(html, /loading="lazy"/);
});

// =====================================================================
// 4. A trava das Server Actions: nenhuma esquece a guarda
// =====================================================================

const ARQUIVO_DAS_ACTIONS = fileURLToPath(new URL('../acoes/galeria.ts', import.meta.url));

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

test('toda Server Action da galeria chama ehEquipe() por conta própria', async () => {
  // A varredura de testes/painel-guarda.test.mjs exige `ehEquipe()` em toda
  // página sob `app/admin/`. Server Action NÃO é página: o Next a publica
  // numa URL própria (spec §4.5), e qualquer pessoa pode chamá-la com
  // qualquer corpo, sem passar pela tela e sem JavaScript. Uma Action nova
  // sem guarda não quebraria teste nenhum antes deste.
  const problemas = [];

  for (const { nome, corpo } of await corpoDasActions()) {
    if (!/ehEquipe\s*\(\s*\)/.test(corpo)) problemas.push(`${nome}: não chama ehEquipe()`);
  }

  assert.deepEqual(
    problemas, [],
    'Server Action da galeria sem guarda de permissão:\n  ' + problemas.join('\n  ')
    + '\n  A guarda das PÁGINAS (app/admin/**) não cobre isto. Ver o cabeçalho de acoes/galeria.ts.'
  );
});

test('a Action que sobe arquivo NUNCA escreve o campo `publicado` — publicar é outro botão', async () => {
  const enviar = (await corpoDasActions()).find(({ nome }) => nome === 'enviarMidia');
  assert.ok(enviar, 'enviarMidia sumiu — este teste precisa ser revisto');

  assert.doesNotMatch(enviar.corpo, /publicado/,
    'enviarMidia menciona `publicado`. A foto nasce fora do ar pela AUSÊNCIA da chave no '
    + 'insert — um `false` escrito à mão é o que alguém "parametriza" depois.');
});

test('a Action que publica LÊ a autorização antes — a RN07 não pode depender do botão', async () => {
  const publicar = (await corpoDasActions()).find(({ nome }) => nome === 'porNoAr');
  assert.ok(publicar, 'porNoAr sumiu — este teste precisa ser revisto');

  assert.match(publicar.corpo, /autorizacao_registrada/,
    'porNoAr não olha `autorizacao_registrada`. A lista não desenha o botão para foto sem '
    + 'autorização, mas a Action é endpoint HTTP: o `id` vem do corpo da requisição.');
  assert.match(publicar.corpo, /sem-autorizacao/,
    'a recusa da RN07 precisa ter um desfecho próprio, e não virar "erro" genérico');
});

test('nenhuma Action da galeria espalha o FormData num objeto', async () => {
  for (const { nome, corpo } of await corpoDasActions()) {
    assert.doesNotMatch(corpo, /\.\.\.\s*campos/,
      `${nome} espalha os campos recebidos — é assim que um campo inventado no corpo da `
      + 'requisição chega inteiro ao banco (regra 6 do CLAUDE.md)');
  }
});

test('o nome do arquivo recebido nunca vira caminho no bucket', async () => {
  const codigo = await readFile(ARQUIVO_DAS_ACTIONS, 'utf8');

  // `arquivo.name` é o nome escolhido por quem enviou. Ele carregaria "../",
  // barra, e o nome de quem aparece na foto — que num bucket de leitura
  // PÚBLICA vira dado pessoal na URL.
  assert.doesNotMatch(codigo.replace(/\/\*[\s\S]*?\*\//g, ''), /arquivo\.name/,
    'o nome do arquivo recebido está sendo usado. O caminho sai de `caminhoNoBucket`, com '
    + 'um uuid e a extensão vinda dos BYTES.');
});

// =====================================================================
// 5. A recusa, contra o servidor de verdade
// =====================================================================

const ROTAS_NOVAS = ['/admin/galeria', '/admin/galeria/apagar'];

test('as duas telas novas do painel respondem 404 para anônimo', async () => {
  for (const rota of ROTAS_NOVAS) {
    const resposta = await fetch(`${BASE}${rota}`, { redirect: 'manual' });
    assert.equal(resposta.status, 404,
      `${rota} respondeu ${resposta.status} — a guarda daquela página deixou de fechar`);
  }
});

test('nada das telas da galeria vaza no HTML de quem não é equipe', async () => {
  // O teste que pegou um defeito REAL na Tarefa P1: com a guarda só no
  // layout, `/admin` respondia 404 E mandava a página inteira do painel no
  // payload de hidratação. Aqui as marcas são as desta tarefa.
  for (const rota of ROTAS_NOVAS) {
    const html = await fetch(`${BASE}${rota}`).then((resposta) => resposta.text());

    for (const marca of [
      'Subir uma foto', 'Fotos já enviadas', 'midia__miniatura', 'midia__estado',
      'Subir foto', 'Apagar esta foto para sempre', 'Nenhuma foto subiu ainda',
      'Sem autorização de imagem'
    ]) {
      assert.ok(!html.includes(marca),
        `a resposta de ${rota} servida a quem não é equipe contém "${marca}"`);
    }

    assert.match(html, /<title>Página não encontrada/, `${rota} não devolveu o 404 do projeto`);
  }
});

test('a tela de apagar não conta nem se uma foto existe: id inventado também é 404', async () => {
  const resposta = await fetch(`${BASE}/admin/galeria/apagar?id=${UUID}`);
  assert.equal(resposta.status, 404);
});

test('/galeria continua respondendo 200 e servindo o estado vazio', async () => {
  // No modo offline da suíte não há Supabase configurado: a consulta não sai,
  // `listarAlbunsPublicados()` devolve lista vazia e a página mostra o mesmo
  // texto de antes desta tarefa. É o que prova que ligar a página ao banco
  // não quebrou a página pública — o texto exato das duas frases é medido em
  // testes/paginas-vazias-a4.test.mjs.
  const resposta = await fetch(`${BASE}/galeria`);
  assert.equal(resposta.status, 200);

  const html = await resposta.text();
  assert.match(html, /<div id="lista-albuns">/,
    'o <div id="lista-albuns"> sumiu — é o id que testes/paridade-texto.test.mjs exclui da '
    + 'comparação com o HTML original; sem ele, cada foto publicada quebraria aquele teste');
  assert.match(html, /class="estado estado--vazio"/);
});

// =====================================================================
// 6. A CSP deixando a foto carregar — e continuando a barrar o resto
// =====================================================================

/**
 * ESTE MEDE O SERVIDOR COMPARTILHADO DA SUÍTE, e por isso só vale no modo
 * offline — achado na Tarefa P4, rodando `npm run test:supabase`: com as
 * credenciais no ambiente o servidor da suíte tem SUPABASE_URL, o host entra
 * no img-src (que é o comportamento CERTO, provado pelo teste seguinte) e
 * este aqui ficava vermelho acusando um defeito que não existe.
 *
 * O irmão abaixo ("COM Supabase configurado") não tem esse problema porque
 * sobe um servidor próprio, com ambiente próprio.
 */
test('SEM Supabase configurado, o img-src não ganha host nenhum',
  { skip: process.env.COM_SUPABASE ? 'mede o modo offline; a suíte está com credenciais' : false },
  async () => {
  const politica = (await fetch(`${BASE}/galeria`)).headers.get('content-security-policy');

  assert.ok(politica, 'a página não veio com política de conteúdo');
  assert.match(politica, /img-src 'self' data: https:\/\/vlibras\.gov\.br https:\/\/cdn\.jsdelivr\.net;/,
    'o img-src ganhou host a mais no modo offline — a origem do Supabase só entra quando '
    + 'SUPABASE_URL existe');
});

test('COM Supabase configurado, o img-src ganha o host — e o connect-src NÃO', async () => {
  // A galeria carrega imagem do host do Storage. Sem o host no `img-src` o
  // <img> é BLOQUEADO EM SILÊNCIO: buraco branco na página, nada em teste
  // nenhum, só o console de quem abrir.
  //
  // E a outra metade, que é a que importa mais: o CLAUDE.md lista o
  // `connect-src` sem o Supabase como uma das TRÊS camadas que impedem o
  // navegador de falar com o banco. `img-src` permite BAIXAR IMAGEM daquele
  // host e nada mais — fetch, XHR e WebSocket são governados por
  // `connect-src`, e este teste é o que garante que a linha não escorregou
  // para lá.
  const { subirServidor } = await import('./apoio/servidor-de-teste.mjs');

  const servidor = await subirServidor({
    ambiente: {
      SUPABASE_URL: 'https://projeto-de-teste.supabase.co',
      SUPABASE_CHAVE_PUBLICAVEL: 'chave-que-nao-vai-a-lugar-nenhum'
    }
  });

  try {
    const politica = (await fetch(`${servidor.base}/galeria`))
      .headers.get('content-security-policy');

    const imgSrc = politica.split('; ').find((d) => d.startsWith('img-src'));
    const connectSrc = politica.split('; ').find((d) => d.startsWith('connect-src'));

    assert.match(imgSrc, /https:\/\/projeto-de-teste\.supabase\.co/,
      'o host do Supabase não entrou no img-src: as fotos da galeria seriam bloqueadas em silêncio');
    assert.doesNotMatch(connectSrc, /supabase/,
      'o host do Supabase entrou no connect-src. Isso é o navegador podendo FALAR com o banco '
      + '— uma das três camadas que o CLAUDE.md lista está caindo.');
  } finally {
    servidor.encerrar();
  }
});

test('SUPABASE_URL malformada não estraga a política inteira', async () => {
  // Origem inválida vira string vazia (ver hostDoSupabase, em middleware.ts):
  // a foto não carrega, o que é visível, em vez de a política ficar mal
  // formada, o que não é.
  const { subirServidor } = await import('./apoio/servidor-de-teste.mjs');

  const servidor = await subirServidor({
    ambiente: { SUPABASE_URL: 'isto nao e uma url', SUPABASE_CHAVE_PUBLICAVEL: 'x' }
  });

  try {
    const politica = (await fetch(`${servidor.base}/galeria`))
      .headers.get('content-security-policy');

    assert.match(politica, /img-src 'self' data: https:\/\/vlibras\.gov\.br https:\/\/cdn\.jsdelivr\.net;/);
    assert.match(politica, /script-src 'self' 'nonce-/, 'o resto da política precisa continuar de pé');
  } finally {
    servidor.encerrar();
  }
});

/*
 * O QUE FICOU SEM TESTE AQUI, e por que não se inventou um:
 *
 *  · TODO o caminho de sucesso: upload para o bucket, insert em
 *    `public.midia`, a remoção do arquivo órfão quando o insert falha,
 *    `revalidatePath('/galeria')`, e as três Actions completando. Todos
 *    exigem sessão de equipe, que não existe (CLAUDE.md, itens 1 e 2);
 *  · a galeria pública COM foto, servida de verdade. O componente é
 *    exercitado acima com dado de teste; a página com dado do banco exige
 *    uma linha publicada, que exige a sessão;
 *  · o limite de corpo de função da NETLIFY. Esta branch nunca foi
 *    publicada. A conta que escolheu 4 MB está escrita em
 *    compartilhado/validacao.ts e precisa ser conferida no primeiro deploy
 *    real, subindo uma foto de ~3,5 MB;
 *  · o comportamento de `<input type="file">` num navegador sem JavaScript
 *    está em testes/sem-javascript.test.mjs (a rota) e foi medido à mão nesta
 *    tarefa; o que não dá para medir sem sessão é o envio completando.
 */
