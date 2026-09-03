import { Builder, By } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/firefox.js';
import { entrar, espera } from './apoio.mjs';
import { writeFileSync } from 'node:fs';

const B = process.env.BASE || 'http://localhost:3217';
const S = process.env.SAIDA || '/tmp';
const EV = process.env.EVENTO || 'b161303a-bc7f-4916-b2fa-5fab27cfcaa7';

const d = await new Builder().forBrowser('firefox')
  .setFirefoxOptions(new Options().addArguments('-headless')).build();
try {
  await d.manage().window().setRect({ width: 450, height: 1400 });
  await entrar(d, B, 'entrega@exemplo.test', 'entrega123');

  // 1. a lista de eventos: o botao "Inscritos" existe?
  await d.get(B + '/admin/eventos');
  await espera(900);
  const links = await d.executeScript(
    'return [...document.querySelectorAll("main a")].map(a => a.textContent.trim() + " → " + a.getAttribute("href")).filter(t => /nscrit|resen/.test(t))');
  console.log('LINKS na lista de eventos:');
  for (const l of links) console.log('  ' + l);

  // 2. a tela de inscritos
  await d.get(`${B}/admin/eventos/inscritos?id=${EV}`);
  await espera(1000);
  console.log('\nTITULO: ' + await d.getTitle());
  const h1 = await d.executeScript('var h=document.querySelector("main h1"); return h?h.textContent.trim():"(sem h1)"');
  console.log('H1: ' + h1);
  const texto = await d.executeScript('var m=document.querySelector("main"); return m?m.innerText.trim().slice(0,900):"(sem main)"');
  console.log('\n--- MAIN ---\n' + texto);
  writeFileSync(S + '/inscritos.png', await d.takeScreenshot(), 'base64');
  console.log('\ncaptura: ' + S + '/inscritos.png');
} finally { await d.quit(); }
