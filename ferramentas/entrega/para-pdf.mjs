/**
 * ferramentas/entrega/para-pdf.mjs — HTML local vira PDF, offline.
 *
 * =====================================================================
 * POR QUE FIREFOX, E NÃO UMA BIBLIOTECA DE PDF
 * =====================================================================
 *
 * É a mesma decisão do RF32 (spec §9), pelos mesmos motivos e com uma
 * vantagem a mais aqui: o Firefox headless já está na máquina porque a
 * suíte de testes o usa. Zero dependência nova, e a tipografia é a do
 * navegador — melhor que a de qualquer gerador em JavaScript.
 *
 * `printPage` é o comando "Print" do WebDriver: ele aplica o CSS de
 * `@media print` do documento, exatamente como o menu Imprimir faria.
 *
 * =====================================================================
 * `file://`, E NADA DE REDE
 * =====================================================================
 *
 * Os documentos da entrega precisam abrir sem internet — é requisito do
 * pacote. Então tudo vai embutido: CSS inline, fontes do sistema, e
 * nenhuma requisição externa. Se um documento precisar de rede para
 * renderizar, ele está errado antes de virar PDF.
 */
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Converte uma lista de `{ html, pdf }` (caminhos) numa sessão só do
 * navegador — subir o Firefox custa segundos, e fazer isso por documento
 * seria pagar o custo N vezes.
 */
export async function gerarPdfs(trabalhos, opcoes = {}) {
  const navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();

  const feitos = [];

  try {
    for (const { html, pdf } of trabalhos) {
      await navegador.get(`file://${resolve(html)}`);

      // Espera a fonte assentar antes de imprimir: sem isto, um documento
      // longo pode ser impresso no meio do layout e sair com a paginação
      // errada — e o defeito só aparece na página 7.
      await navegador.executeScript('return document.fonts ? document.fonts.ready : true');

      /*
       * OS NOMES DOS PARÂMETROS SÃO CHATOS, e a primeira versão disto
       * errou: o `selenium-webdriver` valida a lista e recusa qualquer
       * chave fora dela (`InvalidArgumentError: Invalid Argument
       * 'pageWidth'`). Os aceitos são planos — `width`, `height`, `top`,
       * `bottom`, `left`, `right` —, e NÃO um objeto `margin` aninhado.
       *
       * A UNIDADE É CENTÍMETRO, que é o que a especificação do WebDriver
       * usa. O padrão dela é Carta (21,59 × 27,94); A4 é 21 × 29,7.
       *
       * As margens vão a ZERO de propósito: quem manda nelas é o `@page`
       * do documento. Somar as duas daria uma margem dupla, e o sintoma
       * seria um texto estranhamente apertado no meio da folha.
       */
      const base64 = await navegador.printPage({
        width: 21.0,
        height: 29.7,
        top: 0, bottom: 0, left: 0, right: 0,
        // Sem isto o PDF sai só com o texto: as tarjas, o fundo do
        // cabeçalho de tabela e os selos de status somem.
        background: true,
        shrinkToFit: false,
        ...opcoes
      });

      await writeFile(pdf, Buffer.from(base64, 'base64'));
      feitos.push(pdf);
    }
  } finally {
    await navegador.quit();
  }

  return feitos;
}

/** Uma captura PNG de um HTML local, na largura pedida. */
export async function capturar(trabalhos) {
  const navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();

  const feitos = [];

  try {
    for (const { url, png, largura = 1280, altura = 900, seletor } of trabalhos) {
      await navegador.manage().window().setRect({ width: largura, height: altura });
      // `file://` só é acrescentado a caminho RELATIVO. Quem já manda um
      // endereço completo (inclusive com `#page=3`, que é como se navega
      // dentro de um PDF no visualizador do Firefox) passa direto — a
      // primeira versão disto prefixava duas vezes e o Firefox abria a
      // página de "arquivo não encontrado".
      const endereco = /^[a-z]+:\/\//i.test(url) ? url : `file://${resolve(url)}`;
      await navegador.get(endereco);
      await navegador.executeScript('return document.fonts ? document.fonts.ready : true');

      // Um seletor captura SÓ aquele elemento — é o que dá um SVG de
      // diagrama recortado no tamanho dele, sem a moldura da página.
      const alvo = seletor
        ? await navegador.findElement({ css: seletor })
        : null;

      const base64 = alvo
        ? await alvo.takeScreenshot()
        : await navegador.takeScreenshot();

      await writeFile(png, Buffer.from(base64, 'base64'));
      feitos.push(png);
    }
  } finally {
    await navegador.quit();
  }

  return feitos;
}
