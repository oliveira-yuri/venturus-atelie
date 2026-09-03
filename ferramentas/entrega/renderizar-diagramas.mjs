/**
 * ferramentas/entrega/renderizar-diagramas.mjs — os `.mmd` viram `.svg` e
 * `.png`.
 *
 * =====================================================================
 * UMA FONTE SO': O ARQUIVO `.mmd`
 * =====================================================================
 *
 * A alternativa era desenhar o SVG a mao. Foi recusada por um motivo que
 * so' aparece depois: seriam DUAS fontes de verdade, e elas divergem no
 * primeiro ajuste — alguem corrige o `.mmd` e a imagem da entrega
 * continua dizendo o que era antes, sem nada acusar.
 *
 * Aqui o `.mmd` gera os dois. Mudou o diagrama, roda de novo.
 *
 * =====================================================================
 * O MERMAID FICA VERSIONADO, NAO VEM DE CDN
 * =====================================================================
 *
 * `vendor/mermaid.min.js` foi baixado uma vez e vive no repositorio. O
 * pacote da entrega precisa ser reproduzivel sem internet — e um render
 * que dependa de CDN quebra no dia em que a versao sair do ar, meses
 * depois, quando ninguem lembra por que.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';

const DIAGRAMAS = 'entrega/02-arquitetura/diagramas';
const SAIDA = 'entrega/02-arquitetura/renderizado';

/** A paleta da ONG, aplicada ao tema do Mermaid. */
const TEMA = {
  primaryColor: '#F4EFE6',
  primaryTextColor: '#2B2019',
  primaryBorderColor: '#2B2019',
  lineColor: '#2B2019',
  secondaryColor: '#FBF6ED',
  tertiaryColor: '#fff',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '15px',
  clusterBkg: '#FBF6ED',
  clusterBorder: '#D69A10',
  actorBkg: '#F4EFE6',
  actorBorder: '#2B2019',
  noteBkgColor: '#FBEFD0',
  noteBorderColor: '#D69A10'
};

async function main() {
  const mermaid = await readFile('ferramentas/entrega/vendor/mermaid.min.js', 'utf8');
  const arquivos = (await readdir(DIAGRAMAS)).filter((n) => n.endsWith('.mmd')).sort();

  const navegador = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new Options().addArguments('-headless'))
    .build();

  try {
    for (const arquivo of arquivos) {
      const nome = basename(arquivo, '.mmd');
      const fonte = await readFile(`${DIAGRAMAS}/${arquivo}`, 'utf8');

      // A pagina de render: fundo branco, o diagrama e nada mais. Ela e'
      // temporaria e nao vai para a entrega.
      const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; padding: 28px; background: #fff;
         font-family: Georgia, 'Times New Roman', serif; }
  #alvo { display: inline-block; }
  #alvo svg { display: block; max-width: none !important; height: auto !important; }
</style></head>
<body><div id="alvo"></div>
<script>${mermaid}</script>
<script>
  window.__pronto = false;
  window.__erro = null;
  mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: ${JSON.stringify(TEMA)},
                       er: { useMaxWidth: false }, flowchart: { useMaxWidth: false, htmlLabels: true },
                       sequence: { useMaxWidth: false } });
  mermaid.render('d', ${JSON.stringify(fonte)})
    .then(function (r) { document.getElementById('alvo').innerHTML = r.svg; window.__pronto = true; })
    .catch(function (e) { window.__erro = String(e && e.message || e); window.__pronto = true; });
</script></body></html>`;

      const temporario = `/tmp/render-${nome}.html`;
      await writeFile(temporario, html);
      await navegador.get(`file://${temporario}`);

      await navegador.wait(async () =>
        await navegador.executeScript('return window.__pronto === true'), 30000,
      `o Mermaid não terminou de renderizar ${arquivo}`);

      const erro = await navegador.executeScript('return window.__erro');
      if (erro) {
        console.error(`  ❌ ${arquivo}: ${erro}`);
        continue;
      }

      // O SVG sai do DOM — é a mesma árvore que o PNG vai capturar, então
      // os dois nunca discordam.
      const svg = await navegador.executeScript(
        'return document.getElementById("alvo").innerHTML');
      await writeFile(`${SAIDA}/${nome}.svg`,
        `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`);

      // O PNG é a captura do elemento, então ele sai no tamanho do
      // diagrama — sem moldura de página em volta.
      const alvo = await navegador.findElement({ css: '#alvo' });
      const caixa = await alvo.getRect();
      await navegador.manage().window().setRect({
        width: Math.min(Math.ceil(caixa.width) + 120, 3000),
        height: Math.min(Math.ceil(caixa.height) + 120, 3000)
      });
      const png = await alvo.takeScreenshot();
      await writeFile(`${SAIDA}/${nome}.png`, Buffer.from(png, 'base64'));

      console.log(`  ✅ ${nome}  —  ${Math.round(caixa.width)}×${Math.round(caixa.height)}px`);
    }
  } finally {
    await navegador.quit();
  }
}

await main();
