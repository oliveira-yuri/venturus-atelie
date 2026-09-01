/**
 * O `noindex` sai em QUATRO lugares, e este arquivo é o que obriga os
 * quatro a saírem JUNTOS.
 *
 * POR QUE ELE EXISTE. Dos riscos abertos do lançamento, este é o único que
 * **não produz sintoma nenhum** se der errado: o site sobe, as pessoas
 * navegam, todo o resto da suíte fica verde, e o Ateliê simplesmente não
 * aparece em busca nenhuma. Até aqui a única proteção eram comentários
 * "PREVIA" — e a história do projeto já mostrou o que acontece com
 * instrução que só vive em comentário: a original vivia em
 * `site/robots.txt` e morreu junto com o diretório na Tarefa A8.
 *
 * OS QUATRO LUGARES, e por que cada um precisa do outro:
 *
 *   1. `middleware.ts` — põe `X-Robots-Tag` na resposta das PÁGINAS
 *      renderizadas, nas duas plataformas. É o que este arquivo mede por
 *      fetch.
 *   2. `netlify.toml` — põe o mesmo cabeçalho no que a CDN serve DIRETO,
 *      inclusive os caminhos que o `matcher` do middleware exclui
 *      (`_next/static`, `favicon.ico`, `fontes/`). Não dá para medir contra
 *      `next start`, que não é a Netlify: aqui ele é lido como TEXTO, que é
 *      o melhor disponível sem um deploy real.
 *   3. `vercel.json` — o mesmo papel do 2 na outra plataforma, desde que o
 *      projeto passou a poder rodar nas duas. Mesma limitação, e uma a
 *      mais: a Vercel NUNCA recebeu este projeto, então nem sequer há um
 *      deploy antigo de onde tirar evidência.
 *   4. `app/robots.ts` — o `/robots.txt`, que controla o RASTREIO (os três
 *      cabeçalhos acima controlam a INDEXAÇÃO; são coisas diferentes, e a
 *      ONG precisa das duas abertas para ser encontrada). Vale nas duas
 *      plataformas: é rota do Next, não configuração de hospedagem.
 *
 * O PAR 2/3 TEM UM MODO DE FALHA PRÓPRIO, que os outros não têm: só uma
 * plataforma serve o site por vez, então o arquivo da outra não faz nada
 * hoje e esquecê-lo não muda nada hoje. A conta chega no dia da troca de
 * plataforma. É por isso que a coerência é exigida entre os quatro, e não
 * só entre os que estão em uso.
 *
 * O QUE ESTE ARQUIVO GARANTE, e o que não garante. Ele garante COERÊNCIA:
 * os quatro estão bloqueando, ou os quatro estão liberando — nunca três e
 * um. Ele NÃO decide quando lançar; isso é do usuário. Por isso são testes
 * com papéis diferentes:
 *
 *   · o de coerência quebra se alguém remover parte deles, que é exatamente
 *     o acidente temido;
 *   · o de "modo prévia" quebra quando os quatro saírem juntos, e aí o
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
 * para o propósito deste teste, que é coerência entre os quatro, não a
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

/**
 * O `X-Robots-Tag` do vercel.json bloqueia? Lido como ESTRUTURA.
 *
 * O QUARTO LUGAR, desde que o projeto passou a poder rodar nas duas
 * plataformas. Mesma limitação do netlify.toml e pelo mesmo motivo: este
 * arquivo só tem efeito num deploy real, e não há nenhum — a Vercel nunca
 * recebeu este projeto. Ler o arquivo é o que dá para fazer daqui.
 *
 * A DIFERENÇA em relação ao irmão de cima é que aqui NÃO se filtra
 * comentário: `vercel.json` é JSON estrito, a Vercel recusa o deploy
 * inteiro se houver `//` dentro (é por isso que a advertência de prévia
 * mora em `vercel.json.LEIA-ME.txt`, e não no arquivo). Então dá para fazer
 * melhor que grep de linha: `JSON.parse` e procurar a diretiva no lugar
 * onde ela realmente vale, o que também protege contra alguém deixar o
 * cabeçalho num bloco `source` que não casa com nada.
 *
 * Um JSON quebrado aqui NÃO vira "não bloqueia" — vira exceção, e o teste
 * fica vermelho dizendo o que houve. Silêncio sobre arquivo ilegível é a
 * falha que este projeto já corrigiu duas vezes noutros lugares.
 */
function vercelBloqueia() {
  const bruto = readFileSync(new URL('vercel.json', RAIZ), 'utf8');

  let config;
  try {
    config = JSON.parse(bruto);
  } catch (erro) {
    throw new Error(
      `vercel.json não é JSON válido (${erro.message}).\n`
      + '  A Vercel recusa o deploy inteiro nesse caso — inclusive por causa de comentário,\n'
      + '  que ela não aceita. Ver vercel.json.LEIA-ME.txt.'
    );
  }

  const regras = Array.isArray(config.headers) ? config.headers : [];

  return regras.some((regra) => {
    // Só a regra que vale para o site inteiro conta: um noindex escondido
    // num `source` específico não é a camada de prévia.
    if (regra?.source !== '/(.*)') return false;
    const cabecalhos = Array.isArray(regra.headers) ? regra.headers : [];
    return cabecalhos.some(
      (cabecalho) => /^X-Robots-Tag$/i.test(cabecalho?.key ?? '')
        && /noindex/i.test(cabecalho?.value ?? '')
    );
  });
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

async function medirOsQuatro() {
  return {
    'middleware.ts (X-Robots-Tag na resposta)': await middlewareBloqueia(),
    'netlify.toml (X-Robots-Tag na CDN da Netlify)': netlifyBloqueia(),
    'vercel.json (X-Robots-Tag na Vercel)': vercelBloqueia(),
    'app/robots.ts (/robots.txt Disallow)': await robotsBloqueia()
  };
}

test('os quatro lugares do noindex concordam entre si — nunca três bloqueando e um liberando', async () => {
  const medidas = await medirOsQuatro();
  const valores = Object.values(medidas);
  const todosIguais = valores.every((v) => v === valores[0]);

  const detalhe = Object.entries(medidas)
    .map(([onde, bloqueia]) => `    ${bloqueia ? 'BLOQUEIA' : 'libera  '}  ${onde}`)
    .join('\n');

  assert.ok(
    todosIguais,
    'os quatro lugares do noindex discordam:\n' + detalhe + '\n\n'
    + '  Este é o defeito que NÃO dá sintoma: o site sobe, as pessoas navegam, e só o\n'
    + '  buscador some. Um X-Robots-Tag "noindex" que sobreviva vence o robots.txt\n'
    + '  (robots.txt controla o rastreio, o cabeçalho controla a indexação), então\n'
    + '  liberar só um, dois ou três não libera nada de verdade.\n'
    + '  Para LANÇAR, os quatro saem juntos; para voltar à prévia, os quatro voltam juntos.\n\n'
    + '  ATENÇÃO ao par netlify.toml / vercel.json: com o site em UMA plataforma só, o\n'
    + '  arquivo da OUTRA não tem efeito nenhum hoje — e é por isso que ele é fácil de\n'
    + '  esquecer. Quem esquecer publica um site invisível no dia em que trocar de\n'
    + '  plataforma, que é justamente o dia em que ninguém vai procurar aqui.\n'
    + '  Ver "O que trava hoje", item 0c, no CLAUDE.md, e vercel.json.LEIA-ME.txt.'
  );
});

test('os quatro continuam em modo PRÉVIA — quando o site lançar, este teste sai junto com eles', async () => {
  // Este teste existe para quebrar UMA vez: no lançamento. Quando quebrar,
  // não "consertar" — apagar este teste, e apagar o item 0c de "O que trava
  // hoje" no CLAUDE.md, que descreve a prévia. O teste de coerência acima
  // continua valendo depois, e passa a garantir que ninguém devolva o
  // noindex por acidente em um só lugar.
  const medidas = await medirOsQuatro();

  for (const [onde, bloqueia] of Object.entries(medidas)) {
    assert.ok(
      bloqueia,
      `${onde} deixou de bloquear.\n`
      + '  Se isto foi o LANÇAMENTO: confira que os outros dois saíram também (o teste de\n'
      + '  coerência acima cuida disso), apague ESTE teste e o item 0c de "O que trava\n'
      + '  hoje" no CLAUDE.md.\n'
      + '  Se não foi: alguém removeu uma das quatro marcas sozinho, e o site iria ao ar\n'
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
  // prefixo cobre também as telas de P2/P3/P4. `/minha-conta` entra na RF11
  // (área do usuário) pelo mesmo motivo: a tela mostra nome, e-mail,
  // telefone e histórico de doação de uma pessoa. Nenhum dos dois sai no
  // lançamento.
  for (const rota of ['/auth/confirm', '/nova-senha', '/admin', '/minha-conta']) {
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
