/**
 * O `noindex` sai em TRÊS lugares, e este arquivo é o que obriga os três a
 * saírem JUNTOS.
 *
 * POR QUE ELE EXISTE. Dos riscos abertos do lançamento, este é o único que
 * **não produz sintoma nenhum** se der errado: o site sobe, as pessoas
 * navegam, todo o resto da suíte fica verde, e o Ateliê simplesmente não
 * aparece em busca nenhuma. Até aqui a única proteção eram três comentários
 * "PREVIA" — e a história do projeto já mostrou o que acontece com
 * instrução que só vive em comentário: a original vivia em
 * `site/robots.txt` e morreu junto com o diretório na Tarefa A8.
 *
 * OS TRÊS LUGARES, e por que cada um precisa do outro:
 *
 *   1. `middleware.ts` — põe `X-Robots-Tag` na resposta das PÁGINAS
 *      renderizadas. É o que este arquivo mede por fetch.
 *   2. `netlify.toml` — põe o mesmo cabeçalho no que a CDN serve DIRETO,
 *      inclusive os caminhos que o `matcher` do middleware exclui
 *      (`_next/static`, `favicon.ico`, `fontes/`). Não dá para medir contra
 *      `next start`, que não é a Netlify: aqui ele é lido como TEXTO, que é
 *      o melhor disponível sem um deploy real.
 *   3. `app/robots.ts` — o `/robots.txt`, que controla o RASTREIO (os dois
 *      cabeçalhos acima controlam a INDEXAÇÃO; são coisas diferentes, e a
 *      ONG precisa das duas abertas para ser encontrada).
 *
 * O QUE ESTE ARQUIVO GARANTE, e o que não garante. Ele garante COERÊNCIA:
 * os três estão bloqueando, ou os três estão liberando — nunca dois e um.
 * Ele NÃO decide quando lançar; isso é do usuário. Por isso são testes com
 * papéis diferentes:
 *
 *   · o de coerência quebra se alguém remover UM ou DOIS, que é exatamente
 *     o acidente temido;
 *   · o de "modo prévia" quebra quando os três saírem juntos, e aí o
 *     recado é: apagar aquele teste e o item 0c de "O que trava hoje"
 *     no CLAUDE.md, porque a prévia acabou;
 *   · o das rotas de sessão NÃO SAI NO LANÇAMENTO — é o oposto dos outros
 *     dois. Ver o comentário dele lá embaixo.
 *
 * Ou seja: não existe caminho em que o `noindex` mude e a suíte fique
 * quieta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BASE = process.env.URL_BASE || 'http://localhost:3123';

const RAIZ = new URL('../', import.meta.url);

/** Uma rota de página qualquer: o que interessa é o cabeçalho, não o corpo. */
const ROTA_DE_PAGINA = '/';

/**
 * O `X-Robots-Tag` do middleware bloqueia? Medido na resposta de verdade.
 *
 * `noindex` é o token que importa (`nofollow` acompanha, mas quem some do
 * buscador é o `noindex`).
 */
async function middlewareBloqueia() {
  const resposta = await fetch(`${BASE}${ROTA_DE_PAGINA}`);
  assert.equal(resposta.status, 200, `${ROTA_DE_PAGINA} não respondeu 200`);
  return /noindex/i.test(resposta.headers.get('x-robots-tag') ?? '');
}

/**
 * O `X-Robots-Tag` do netlify.toml bloqueia? Lido como texto.
 *
 * NÃO MEDIDO contra a Netlify — este arquivo de configuração só tem efeito
 * num deploy real, que nunca rodou nesta branch (ver "O que trava hoje" no
 * CLAUDE.md). Ler o texto é o que dá para fazer daqui, e já é o bastante
 * para o propósito deste teste, que é coerência entre os três, não a
 * eficácia de cada um.
 *
 * A leitura ignora linha de comentário de propósito: o bloco de advertência
 * que vive ali em cima MENCIONA `X-Robots-Tag` várias vezes, e sem isso
 * apagar a diretiva de verdade e deixar o comentário passaria batido.
 */
function netlifyBloqueia() {
  const texto = readFileSync(new URL('netlify.toml', RAIZ), 'utf8');
  const diretivas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => !linha.startsWith('#'))
    .filter((linha) => /^X-Robots-Tag\s*=/i.test(linha));

  return diretivas.some((linha) => /noindex/i.test(linha));
}

/** O /robots.txt bloqueia o rastreio? Medido na resposta de verdade. */
async function robotsBloqueia() {
  const resposta = await fetch(`${BASE}/robots.txt`);
  assert.equal(
    resposta.status, 200,
    `/robots.txt respondeu ${resposta.status} — app/robots.ts sumiu, e /robots.txt já foi 404 `
    + 'uma vez nesta branch (Tarefa A8)'
  );
  const corpo = await resposta.text();
  return /^\s*Disallow:\s*\/\s*$/im.test(corpo);
}

async function medirOsTres() {
  return {
    'middleware.ts (X-Robots-Tag na resposta)': await middlewareBloqueia(),
    'netlify.toml (X-Robots-Tag na CDN)': netlifyBloqueia(),
    'app/robots.ts (/robots.txt Disallow)': await robotsBloqueia()
  };
}

test('os três lugares do noindex concordam entre si — nunca dois bloqueando e um liberando', async () => {
  const medidas = await medirOsTres();
  const valores = Object.values(medidas);
  const todosIguais = valores.every((v) => v === valores[0]);

  const detalhe = Object.entries(medidas)
    .map(([onde, bloqueia]) => `    ${bloqueia ? 'BLOQUEIA' : 'libera  '}  ${onde}`)
    .join('\n');

  assert.ok(
    todosIguais,
    'os três lugares do noindex discordam:\n' + detalhe + '\n\n'
    + '  Este é o defeito que NÃO dá sintoma: o site sobe, as pessoas navegam, e só o\n'
    + '  buscador some. Um X-Robots-Tag "noindex" que sobreviva vence o robots.txt\n'
    + '  (robots.txt controla o rastreio, o cabeçalho controla a indexação), então\n'
    + '  liberar só um ou dois não libera nada de verdade.\n'
    + '  Para LANÇAR, os três saem juntos; para voltar à prévia, os três voltam juntos.\n'
    + '  Ver "O que trava hoje", item 0c, no CLAUDE.md.'
  );
});

test('os três continuam em modo PRÉVIA — quando o site lançar, este teste sai junto com eles', async () => {
  // Este teste existe para quebrar UMA vez: no lançamento. Quando quebrar,
  // não "consertar" — apagar este teste, e apagar o item 0c de "O que trava
  // hoje" no CLAUDE.md, que descreve a prévia. O teste de coerência acima
  // continua valendo depois, e passa a garantir que ninguém devolva o
  // noindex por acidente em um só lugar.
  const medidas = await medirOsTres();

  for (const [onde, bloqueia] of Object.entries(medidas)) {
    assert.ok(
      bloqueia,
      `${onde} deixou de bloquear.\n`
      + '  Se isto foi o LANÇAMENTO: confira que os outros dois saíram também (o teste de\n'
      + '  coerência acima cuida disso), apague ESTE teste e o item 0c de "O que trava\n'
      + '  hoje" no CLAUDE.md.\n'
      + '  Se não foi: alguém removeu uma das três marcas sozinho, e o site iria ao ar\n'
      + '  meio-invisível sem nenhum erro visível.'
    );
  }
});

test('as rotas que ficam fora do buscador para sempre (fluxo de e-mail e painel) continuam fora — ESTE teste NÃO sai no lançamento', async () => {
  // ATENÇÃO A QUEM VIER NO DIA DO LANÇAMENTO: o teste acima existe para
  // quebrar uma vez e ser APAGADO; este aqui existe para FICAR. São coisas
  // diferentes no mesmo arquivo, e confundir as duas apaga a única trava que
  // sobra depois que a prévia acabar.
  //
  // Hoje o `Disallow: /` da prévia já cobre tudo e estas linhas são
  // redundantes. No dia em que ele virar `allow: '/'`, elas passam a ser a
  // única coisa mantendo `/auth/confirm`, `/nova-senha` e `/admin` fora do
  // rastreio — e o motivo está escrito em app/robots.ts: rastreador que abre
  // um link de confirmação GASTA o token, que é de uso único, e quem recebeu
  // o e-mail descobre depois que o link "já não vale", sem entender por quê.
  // Para `/admin` o motivo é outro, e está no mesmo arquivo: o painel não é
  // conteúdo público.
  const corpo = await fetch(`${BASE}/robots.txt`).then((resposta) => resposta.text());

  // `/admin` entra na Tarefa P1 do painel (RF33), pelo terceiro motivo
  // escrito em app/robots.ts: painel não é conteúdo público, e a regra por
  // prefixo cobre também as telas de P2/P3/P4. Ele também NÃO sai no
  // lançamento.
  for (const rota of ['/auth/confirm', '/nova-senha', '/admin']) {
    assert.match(
      corpo,
      new RegExp(`^\\s*Disallow:\\s*${rota}\\s*$`, 'im'),
      `${rota} saiu do /robots.txt.\n`
      + '  Se isto aconteceu junto com o lançamento: NÃO era para sair. O `disallow: \'/\'`\n'
      + '  da prévia sai; a lista FORA_DO_BUSCADOR de app/robots.ts fica, como segundo\n'
      + '  campo ao lado do `allow`.'
    );
  }
});
