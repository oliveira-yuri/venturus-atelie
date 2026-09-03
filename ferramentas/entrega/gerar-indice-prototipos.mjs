/**
 * ferramentas/entrega/gerar-indice-prototipos.mjs — o índice dos
 * protótipos, que abre SEM INTERNET.
 *
 * Requisito do pacote: "formato estático/offline". Então nada de CDN,
 * nada de fonte baixada, nada de JavaScript necessário para ver. As
 * imagens são arquivos ao lado; o CSS é embutido; e clicar numa captura
 * abre o PNG no tamanho real, que é um <a href> comum.
 *
 * O QUE FALTOU APARECE, e isso é decisão: um protótipo que esconde as
 * telas que não conseguiu capturar é pior que um incompleto — quem avalia
 * conclui que elas não existem.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { FLUXOS, LARGURAS, EVENTO } from './telas.mjs';

const SAIDA = 'entrega/03-prototipos';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const { feitas, puladas, evento } = JSON.parse(await readFile(`${SAIDA}/capturas.json`, 'utf8'));
const porRota = new Map(feitas.map((t) => [t.fluxo + t.rota, t]));

function tela(t, fluxo) {
  const feita = porRota.get(fluxo.id + t.rota);
  const rota = t.rota.replace(EVENTO, evento ?? '<id>');

  if (!feita) {
    return `<article class="tela tela--faltando">
      <h3>${esc(t.nome)} <span class="rf">${esc(t.rf)}</span></h3>
      <p class="rota">${esc(rota)}</p>
      <p class="ausente"><strong>Não capturada.</strong> Esta tela exige sessão
      ${fluxo.equipe ? 'de equipe' : 'de usuário'}, e a captura rodou sem ela.
      A tela existe e responde 404 para quem não tem permissão — o que está medido nos testes.</p>
    </article>`;
  }

  const imagens = LARGURAS.map((l) => `
    <figure>
      <a href="telas/${feita.base}-${l.chave}.png">
        <img src="telas/${feita.base}-${l.chave}.png" alt="${esc(t.nome)} — ${esc(l.rotulo)}" loading="lazy">
      </a>
      <figcaption>${esc(l.rotulo)}</figcaption>
    </figure>`).join('');

  return `<article class="tela">
    <h3>${esc(t.nome)} <span class="rf">${esc(t.rf)}</span></h3>
    <p class="rota">${esc(rota)}</p>
    <div class="capturas">${imagens}</div>
  </article>`;
}

const corpo = FLUXOS.map((f) => `
<section id="${f.id}">
  <h2>${esc(f.nome)}</h2>
  <p class="resumo">${esc(f.resumo)}</p>
  ${f.telas.map((t) => tela(t, f)).join('')}
</section>`).join('');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Protótipos — Ateliê Afro Cultural</title>
<style>
  :root { --ocre:#D69A10; --tinta:#2B2019; --creme:#F4EFE6; --linha:#C9BFB2; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--creme); color: var(--tinta);
    font-family: Georgia, 'Times New Roman', serif; line-height: 1.55;
  }
  header { background: var(--tinta); color: var(--creme); padding: 2rem 1.5rem; }
  header h1 { margin: 0 0 .3rem; font-size: 1.7rem; }
  header p { margin: 0; opacity: .85; }
  header .faixa { height: 8px; background: var(--ocre); margin: 1.2rem -1.5rem -2rem; }
  nav { position: sticky; top: 0; background: #fff; border-bottom: 2px solid var(--tinta);
        padding: .7rem 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; z-index: 2; }
  nav a { color: var(--tinta); font-weight: bold; text-decoration: none; border-bottom: 2px solid transparent; }
  nav a:hover, nav a:focus { border-bottom-color: var(--ocre); }
  main { max-width: 68rem; margin: 0 auto; padding: 1.5rem; }
  section { margin-bottom: 3rem; }
  h2 { font-size: 1.4rem; border-bottom: 2px solid var(--tinta); padding-bottom: .3rem; }
  .resumo { margin-top: .3rem; }
  .tela { background: #fff; border: 1.5px solid var(--tinta); padding: 1rem 1.2rem; margin: 1.2rem 0; }
  .tela h3 { margin: 0 0 .2rem; font-size: 1.1rem; }
  .rf { font-size: .78rem; font-weight: normal; background: var(--creme);
        border: 1px solid var(--linha); padding: .1em .45em; margin-left: .4em; white-space: nowrap; }
  .rota { margin: 0 0 .9rem; font-family: ui-monospace,'Courier New',monospace;
          font-size: .82rem; opacity: .75; word-break: break-all; }
  .capturas { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
  figure { margin: 0; }
  figure img { display: block; border: 1px solid var(--linha); background: #fff; }
  /* O celular sai em tamanho quase real; o desktop reduzido para caber ao lado. */
  figure:first-child img { width: 300px; }
  figure:last-child img { width: 560px; }
  figcaption { font-size: .8rem; margin-top: .3rem; opacity: .75; }
  .tela--faltando { border-style: dashed; }
  .ausente { background: #FBEFD0; border-left: 5px solid var(--ocre); padding: .6rem .8rem; margin: 0; }
  .ressalva { background: #fff; border-left: 5px solid var(--ocre); padding: .7rem .9rem; }
  footer { border-top: 2px solid var(--tinta); margin-top: 2rem; padding: 1.2rem 0; font-size: .85rem; }
  @media (max-width: 46rem) {
    figure:first-child img, figure:last-child img { width: 100%; max-width: 340px; }
  }
</style>
</head>
<body>

<header>
  <h1>Protótipos de interface</h1>
  <p>Ateliê Afro Cultural — ${feitas.length} de ${feitas.length + puladas.length} telas,
     em duas larguras</p>
  <div class="faixa"></div>
</header>

<nav>${FLUXOS.map((f) => `<a href="#${f.id}">${esc(f.nome)}</a>`).join('')}</nav>

<main>
  <p><strong>Estas não são maquetes.</strong> São capturas do sistema rodando, com o banco de
  dados real da ONG — o que significa que o protótipo não pode mostrar uma tela que não
  funcione. Cada uma aparece a <strong>390px</strong> (celular) e <strong>1280px</strong>
  (notebook), porque a ONG não possui computador e opera tudo do celular.</p>

  <p>Clique numa captura para abri-la no tamanho original. Tudo aqui funciona
  <strong>sem internet</strong>.</p>

  <p class="ressalva"><strong>Uma ressalva sobre a largura.</strong> As capturas de celular
  saem a <strong>450px</strong>, e não a 390px, porque o navegador usado para fotografar tem
  largura mínima de janela — medido, e é limite da ferramenta, não do site. Entre 390px e
  450px existe uma única regra de estilo no projeto inteiro, e ela apenas mostra o rótulo
  escrito do botão de WhatsApp em vez de só o ícone. <strong>Nenhuma quebra de layout mora
  nessa faixa</strong>, então o que se vê aqui é o que um celular recebe.</p>

  ${corpo}

  <footer>
    Ateliê Afro Cultural · protótipos gerados a partir do sistema em
    ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
    O sistema está no ar em <strong>www.atelieafrocultural.site</strong>.
  </footer>
</main>

</body>
</html>`;

await writeFile(`${SAIDA}/index.html`, html);
console.log(`  ✅ ${SAIDA}/index.html — ${feitas.length} capturadas, ${puladas.length} anotadas como ausentes`);
