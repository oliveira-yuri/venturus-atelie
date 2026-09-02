import { Builder, By } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { writeFileSync, mkdirSync } from 'node:fs';
const DIR='/tmp/claude-1000/-home-yuri-Documentos-projetos-Venturus-Atelie/d0d0140b-cf0a-4cf0-a4b4-f94e8968b338/scratchpad/tiros';
mkdirSync(DIR,{recursive:true});
const alvos=JSON.parse(process.argv[2]), L=+(process.argv[3]||390), A=+(process.argv[4]||900);
const escala=process.argv[5]?+process.argv[5]:null, semJs=process.argv[6]==='sem-js';
const o=new firefox.Options().addArguments('-headless');
if(semJs)o.setPreference('javascript.enabled',false);
const d=await new Builder().forBrowser('firefox').setFirefoxOptions(o).build();
try{ await d.manage().window().setRect({width:L,height:A});
 for(const a of alvos){
  await d.get('http://localhost:3456'+a.rota); await new Promise(r=>setTimeout(r,500));
  if(escala){ await d.executeScript("localStorage.setItem('aac-preferencias', JSON.stringify({escala:"+escala+",contraste:'normal'}));"); await d.navigate().refresh(); }
  await new Promise(r=>setTimeout(r,a.espera??1400));
  for(const c of (a.clicar?[].concat(a.clicar):[])){ try{ await d.findElement(By.css(c)).click(); await new Promise(r=>setTimeout(r,700)); }catch(e){ console.log('  (nao clicou '+c+')'); } }
  writeFileSync(`${DIR}/${a.nome}.png`, await d.takeScreenshot(),'base64'); console.log('  '+a.nome+'.png'); } }
finally{ await d.quit(); }
