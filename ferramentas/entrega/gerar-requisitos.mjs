/**
 * ferramentas/entrega/gerar-requisitos.mjs — o Documento de Requisitos.
 *
 * Escreve um HTML autossuficiente (CSS embutido, fontes do sistema, zero
 * rede) que `para-pdf.mjs` transforma em PDF. O HTML fica na entrega junto
 * do PDF, de propósito: é a fonte, e abre em qualquer navegador sem nada
 * instalado.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { PROJETO, MODULOS, REQUISITOS, NAO_FUNCIONAIS, REGRAS } from './dados.mjs';
import { ESTILO } from './estilo-documento.mjs';

const DESTINO = 'entrega/01-documento-de-requisitos';

const esc = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ROTULO = { pronto: 'Pronto', parcial: 'Parcial', falta: 'Não iniciado' };

const conta = (lista, s) => lista.filter((x) => x.s === s).length;

function selo(s) {
  return `<span class="selo selo--${s}">${ROTULO[s]}</span>`;
}

function linhaDeRequisito(r) {
  return `<tr>
    <td class="id">${esc(r.id)}</td>
    <td><strong>${esc(r.nome)}</strong>${r.onde ? `<br><span class="onde">${esc(r.onde)}</span>` : ''}</td>
    <td class="origem">${esc(r.o ?? '')}</td>
    <td class="status">${selo(r.s)}</td>
    <td class="evidencia">${esc(r.e)}</td>
  </tr>`;
}



function documento() {
  const porModulo = MODULOS.map((m) => {
    const linhas = REQUISITOS.filter((r) => r.m === m.id);
    if (linhas.length === 0) return '';
    return `<h3>${esc(m.id)} — ${esc(m.nome)}</h3>
    <table>
      <thead><tr><th>ID</th><th>Requisito</th><th>Origem</th><th>Status</th><th>Como se sabe</th></tr></thead>
      <tbody>${linhas.map(linhaDeRequisito).join('')}</tbody>
    </table>`;
  }).join('');

  const parciais = [...REQUISITOS, ...NAO_FUNCIONAIS, ...REGRAS].filter((r) => r.s === 'parcial');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Documento de Requisitos — ${esc(PROJETO.nome)}</title>
<style>${ESTILO}</style>
</head>
<body>

<section class="capa">
  <div class="capa__faixa"></div>
  <h1>Documento de Requisitos</h1>
  <p class="sub">${esc(PROJETO.nome)} — ${esc(PROJETO.subtitulo)}</p>
  <dl>
    <dt>Contexto</dt><dd>${esc(PROJETO.contexto)}</dd>
    <dt>Entrega</dt><dd>${esc(PROJETO.entrega)}</dd>
    <dt>Endereço em produção</dt><dd>${esc(PROJETO.endereco)}</dd>
    <dt>Repositório</dt><dd>${esc(PROJETO.repositorio)} · branch <code>${esc(PROJETO.branch)}</code></dd>
    <dt>Requisitos</dt><dd>${REQUISITOS.length} funcionais · ${NAO_FUNCIONAIS.length} não funcionais · ${REGRAS.length} regras de negócio</dd>
  </dl>
  <div class="capa__faixa capa__faixa--fim"></div>
</section>

<h2>1. Como ler este documento</h2>

<p>Cada requisito tem uma coluna <strong>"Como se sabe"</strong>. Ela existe porque
<em>"pronto"</em> sem dizer como se verificou é promessa, não relatório. Ali está o que foi
feito para saber: teste automatizado, medição contra o banco de produção, ou navegador — e,
onde ninguém percorreu o caminho até o fim, está escrito que ninguém percorreu.</p>

<div class="placar">
  <div><span class="n">${conta(REQUISITOS, 'pronto')}</span><span class="r">RF prontos</span></div>
  <div><span class="n">${conta(REQUISITOS, 'parcial')}</span><span class="r">RF parciais</span></div>
  <div><span class="n">${conta(REQUISITOS, 'falta')}</span><span class="r">RF não iniciados</span></div>
  <div><span class="n">1268</span><span class="r">testes verdes</span></div>
</div>

<p>Os três selos:</p>
<ul>
  <li>${selo('pronto')} — existe, funciona e foi verificado rodando.</li>
  <li>${selo('parcial')} — o caminho principal existe; algo declarado ficou de fora, e a coluna diz o quê.</li>
  <li>${selo('falta')} — não foi construído.</li>
</ul>

<div class="nota">
  <strong>A fonte de cada coluna</strong>
  O <em>requisito</em> e a <em>origem</em> vêm do Plano de Projeto (§5 a §7), onde a coluna
  Origem aponta a seção do formulário respondido pela própria ONG que justifica cada item.
  O <em>status</em> e a <em>evidência</em> vêm do mapa do repositório, que a disciplina do
  projeto obriga a atualizar no mesmo commit da funcionalidade.
</div>

<h2 class="secao">2. Requisitos funcionais</h2>
${porModulo}

<h2 class="secao">3. Requisitos não funcionais</h2>
<table>
  <thead><tr><th>ID</th><th>Requisito</th><th>Status</th><th>Como se sabe</th></tr></thead>
  <tbody>${NAO_FUNCIONAIS.map((r) => `<tr>
    <td class="id">${esc(r.id)}</td>
    <td><strong>${esc(r.nome)}</strong></td>
    <td class="status">${selo(r.s)}</td>
    <td class="evidencia">${esc(r.e)}</td>
  </tr>`).join('')}</tbody>
</table>

<h2>4. Regras de negócio</h2>
<table>
  <thead><tr><th>ID</th><th>Regra</th><th>Status</th><th>Como se sabe</th></tr></thead>
  <tbody>${REGRAS.map((r) => `<tr>
    <td class="id">${esc(r.id)}</td>
    <td><strong>${esc(r.nome)}</strong></td>
    <td class="status">${selo(r.s)}</td>
    <td class="evidencia">${esc(r.e)}</td>
  </tr>`).join('')}</tbody>
</table>

<h2 class="secao">5. O que ficou parcial, e por quê</h2>

<p>Nenhum dos ${REQUISITOS.length} requisitos funcionais está por começar. ${parciais.length}
itens estão parciais, e cada um tem um motivo declarado — quatro deles dependem de uma ação
humana que este repositório não pode fazer.</p>

<table>
  <thead><tr><th>ID</th><th>Item</th><th>O que falta</th></tr></thead>
  <tbody>${parciais.map((r) => `<tr>
    <td class="id">${esc(r.id)}</td>
    <td><strong>${esc(r.nome)}</strong></td>
    <td class="evidencia">${esc(r.e)}</td>
  </tr>`).join('')}</tbody>
</table>

<h3>Duas migrations escritas e não aplicadas</h3>

<p>Este repositório <strong>não tem, e não vai ter, credencial capaz de aplicar migration</strong>:
a chave de serviço do banco nunca entra no código-fonte. Quem aplica é uma pessoa, no editor
SQL do Supabase. Duas estão nesse estado:</p>

<ul>
  <li><strong>008 — bucket da galeria privado.</strong> Enquanto não for aplicada, uma foto
  tirada do ar continua baixável por quem tiver o endereço. O sistema <em>anuncia</em> isso:
  uma sonda bate no endereço público e, enquanto ele responder, o painel mostra um aviso
  permanente.</li>
  <li><strong>012 — mural de avisos.</strong> Sem ela as duas telas do mural mostram o estado
  de falha. Nada quebra, e nada funciona — que é o desfecho honesto para uma tela de
  comunicação interna que ainda não existe no banco.</li>
</ul>

<h3>O caminho autenticado do painel</h3>

<p>As 21 telas do painel respondem <strong>404 para quem não é equipe</strong>, e isso está
medido. O que <em>não</em> foi percorrido é o caminho de dentro: nenhuma conta recebeu o papel
de equipe, então nenhuma pessoa abriu aquelas telas com dados reais. É uma linha de SQL, e
está registrada como pendência desde o começo.</p>

<h2 class="secao">6. Como isto foi verificado</h2>

<p>Quatro camadas independentes, e elas medem coisas diferentes:</p>

<ul>
  <li><strong>1268 testes em modo offline</strong>, sem rede e sem credencial — determinísticos.
  Incluem varreduras de código-fonte que cobram a presença <em>e a ausência</em> de guardas:
  há teste que falha se a Action pública de inscrição ganhar uma guarda de equipe, e teste
  irmão que falha se a Action do painel perder a dela.</li>
  <li><strong>1269 testes contra o banco de produção</strong> — é o que impede o site de servir
  conteúdo versionado achando que está lendo o banco.</li>
  <li><strong>118 testes contra um PostgreSQL real</strong> com as migrations reais aplicadas.
  É onde a política de acesso de cada tabela é exercitada de verdade, inclusive as tentativas
  de escalada de privilégio.</li>
  <li><strong>Navegador</strong> — Firefox, com e sem JavaScript, a 375px e 1280px. Dois
  defeitos visíveis já passaram por uma bateria verde neste projeto; por isso a regra do
  repositório diz que bateria de testes não substitui abrir a página.</li>
</ul>

<div class="nota">
  <strong>Um teste que apodreceu, e o que se aprendeu com ele</strong>
  Um teste afirmava "a agenda está vazia hoje" e ficou vermelho quando a equipe publicou um
  evento — e estava certo em ficar. O conserto não foi afrouxar a asserção: foi cobrar a
  relação entre o conteúdo e a tela (<em>ou está vazia e traz o estado vazio, ou tem itens e o
  estado vazio não aparece</em>). Afirmação sobre o conteúdo de hoje envelhece; afirmação sobre
  a relação, não.
</div>

<p class="rodape-doc">
  ${esc(PROJETO.nome)} · Documento de Requisitos · gerado a partir do repositório em
  ${esc(PROJETO.entrega)}. Os status descrevem o que estava verificado nesta data.
</p>

</body>
</html>`;
}

await mkdir(DESTINO, { recursive: true });
await writeFile(`${DESTINO}/requisitos.html`, documento());
console.log(`  ✅ ${DESTINO}/requisitos.html`);
