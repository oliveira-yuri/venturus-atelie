/**
 * Mede a aba do mural no menu (RF27, pedido de 03/09/2026).
 *
 * A conta `entrega@exemplo.test` e' voluntaria ATIVA e equipe, entao ela
 * exercita a linha mais cheia da tabela: os tres itens, na ordem.
 */
import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { entrar, espera } from './apoio.mjs';

const B = process.env.BASE || 'http://localhost:3214';
const S = process.env.SAIDA || '/tmp';

const itens = (d) => d.executeScript(
  'return [...document.querySelectorAll("header .af-navlink")].map(a => a.textContent.trim() + " → " + a.getAttribute("href"))');

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1000 });

  await d.get(B + '/');
  await espera(500);
  const anonimo = await itens(d);
  console.log('ANONIMO: ' + anonimo.length + ' itens');
  console.log('  mural no menu? ' + anonimo.some((t) => t.includes('/avisos')));

  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');

  // A conta esta 'inativo'. Promove PELA TELA (que e' o gesto da RF26) e
  // devolve ao fim, para o banco ficar como estava.
  const { clicarEConfirmar } = await import('./apoio.mjs');
  await d.get(B + '/admin/voluntarios?busca=entrega');
  await espera(900);
  console.log('promover: ' + JSON.stringify(await clicarEConfirmar(d, 'Marcar como voluntariando')));

  await d.get(B + '/');
  await espera(700);
  const dentro = await itens(d);
  console.log('\nCOM SESSAO (voluntaria ativa + equipe): ' + dentro.length + ' itens');
  for (const t of dentro.slice(11)) console.log('  ' + t);

  // a gaveta aberta, no celular, que e' onde a equipe usa (regra 4)
  await d.findElement(By.css('.af-burger, [aria-controls="menu-principal"], header button')).click();
  await espera(600);
  await d.executeScript('window.scrollTo(0, document.body.scrollHeight)');
  await espera(300);
  await d.executeScript('window.scrollTo(0, 0)');
  const png = await d.takeScreenshot();
  const { writeFileSync } = await import('node:fs');
  writeFileSync(S + '/menu-mural.png', png, 'base64');
  console.log('\ncaptura: ' + S + '/menu-mural.png');

  // Devolve o banco ao estado em que estava.
  await d.get(B + '/admin/voluntarios?busca=entrega');
  await espera(900);
  console.log('\ndesfazer: ' + JSON.stringify(await clicarEConfirmar(d, 'Encerrar')));
  await d.get(B + '/');
  await espera(700);
  const depois = await itens(d);
  console.log('depois de encerrar: ' + depois.length + ' itens, mural? '
    + depois.some((t) => t.includes('/avisos')));
} finally { await d.quit(); }
