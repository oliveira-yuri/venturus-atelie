import { Builder } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { entrar, espera } from './apoio.mjs';
const B = process.env.BASE || 'http://localhost:3214';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1000 });
  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');

  const medir = async (query) => {
    await d.get(B + '/admin/voluntarios' + query);
    await espera(800);
    return d.executeScript(`
      var cards = document.querySelectorAll('.voluntario');
      var c = document.querySelector('.painel__contagem');
      return {
        cartoes: cards.length,
        contagem: c ? c.textContent.trim() : null,
        quem: [].map.call(cards, function (x) {
          var e = x.querySelector('a[href^="mailto:"]');
          return e ? e.textContent.trim() : '(sem e-mail visível)';
        })
      };
    `);
  };

  for (const [rotulo, q] of [
    ['sem filtro', ''],
    ['busca=pedro', '?busca=pedro'],
    ['busca=entrega', '?busca=entrega'],
    ['busca=exemplo', '?busca=exemplo'],
    ['situacao=ativo', '?situacao=ativo'],
    ['area=Apoio pedagógico', '?area=' + encodeURIComponent('Apoio pedagógico e oficinas')],
    ['tipo_pessoa=fisica', '?tipo_pessoa=fisica']
  ]) {
    const r = await medir(q);
    console.log(`  ${rotulo.padEnd(24)} ${String(r.cartoes).padStart(2)} cartão(ões)  ${JSON.stringify(r.quem)}`);
  }
} finally {
  await d.quit();
}
