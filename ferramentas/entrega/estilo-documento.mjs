/**
 * ferramentas/entrega/estilo-documento.mjs — a folha de estilo dos PDFs da
 * entrega.
 *
 * MORA NUM MODULO SO' porque os documentos precisam sair como UM CONJUNTO:
 * mesma capa, mesma tarja ocre, mesma tipografia, mesmos selos. Duplicar o
 * CSS entre eles faria os dois divergirem no primeiro ajuste, e quem
 * recebe o pacote veria dois documentos de projetos diferentes.
 *
 * A paleta e' a da ONG, com o significado que ela declarou: o ocre e' luz e
 * ancestralidade, o marrom e' terra e raizes. No papel a TINTA e' preta e o
 * fundo e' branco — o marrom chapado sai cinza numa impressora laser velha,
 * e um documento de entrega precisa ser legivel antes de ser bonito.
 */

export const ESTILO = `
:root {
  --ocre: #D69A10;
  --azul: #6FA6C8;
  --tinta: #2B2019;
  --creme: #F4EFE6;
  --linha: #C9BFB2;
}

@page { size: A4; margin: 2cm 1.8cm; }

/*
 * O HTML VAI NA ENTREGA JUNTO DO PDF, e aberto no navegador ele nao tem
 * regra de pagina nenhuma — o texto encostava na borda da janela. Estas
 * regras valem so na TELA; no papel quem manda e a regra de pagina acima.
 *
 * SEM CRASE NESTE COMENTARIO, de proposito: todo este CSS mora dentro de
 * um template literal do JavaScript, e uma crase aqui FECHA a string. Foi
 * exatamente o que quebrou a primeira versao deste bloco.
 */
@media screen {
  body { max-width: 21cm; margin: 0 auto; padding: 2cm 1.8cm; }
  .capa { height: auto; padding: 3cm 0; }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.5;
  color: var(--tinta);
  background: #fff;
}

h1, h2, h3 { line-height: 1.2; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 20pt; margin: 0 0 .3em; }
h2 {
  font-size: 14pt;
  margin: 2em 0 .6em;
  padding-bottom: .25em;
  border-bottom: 2px solid var(--tinta);
}
h3 { font-size: 11.5pt; margin: 1.4em 0 .4em; }

p { margin: 0 0 .8em; }
ul { margin: 0 0 .8em; padding-left: 1.2em; }
li { margin-bottom: .35em; }

/* ---- capa ---- */
.capa {
  height: 24.5cm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  break-after: page;
  page-break-after: always;
}
.capa__faixa { height: 10px; background: var(--ocre); margin-bottom: 1.4cm; }
.capa__faixa--fim { margin: 1.4cm 0 0; background: var(--tinta); }
.capa h1 { font-size: 30pt; margin-bottom: .15em; }
.capa .sub { font-size: 14pt; margin-bottom: 1.6cm; }
.capa dl { display: grid; grid-template-columns: 5.2cm 1fr; gap: .45em 0; margin: 0; font-size: 10.5pt; }
.capa dt { font-weight: bold; }
.capa dd { margin: 0; }

/* ---- números ---- */
.placar { display: flex; gap: .5cm; margin: 1.2em 0 1.6em; }
.placar div {
  flex: 1;
  border: 1.5px solid var(--tinta);
  padding: .55em .7em;
  text-align: center;
}
.placar .n { display: block; font-size: 22pt; font-weight: bold; line-height: 1.1; }
.placar .r { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; }

/* ---- tabelas ---- */
table { width: 100%; border-collapse: collapse; margin: .6em 0 1.4em; font-size: 9pt; }
thead { display: table-header-group; }
th, td {
  border: 1px solid var(--linha);
  padding: .4em .5em;
  text-align: left;
  vertical-align: top;
}
th { background: var(--creme); font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
tr { break-inside: avoid; page-break-inside: avoid; }
td.id { font-weight: bold; white-space: nowrap; width: 1.5cm; }
td.origem { white-space: nowrap; width: 1.5cm; font-size: 8.5pt; }
td.status { white-space: nowrap; width: 2.1cm; }
td.evidencia { font-size: 8.5pt; }
.onde { font-size: 8pt; font-family: ui-monospace, 'Courier New', monospace; opacity: .75; }

.selo {
  display: inline-block;
  padding: .1em .45em;
  font-size: 8pt;
  font-weight: bold;
  border: 1px solid var(--tinta);
  white-space: nowrap;
}
.selo--pronto  { background: #DCEBD8; }
.selo--parcial { background: #F6E4B8; }
.selo--falta   { background: #F1D9D9; }

/* ---- blocos ---- */
.nota {
  border-left: 5px solid var(--ocre);
  background: var(--creme);
  padding: .7em .9em;
  margin: 1em 0;
  break-inside: avoid;
}
.nota strong { display: block; margin-bottom: .25em; }

.secao { break-before: page; page-break-before: always; }

.rodape-doc {
  margin-top: 2em;
  padding-top: .6em;
  border-top: 1px solid var(--tinta);
  font-size: 8.5pt;
}`;
