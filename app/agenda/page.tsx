// Conteúdo copiado literalmente do HTML original de agenda.html — hoje a
// cópia congelada em testes/apoio/html-original/agenda.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// A tabela `eventos` (RF13, migration 003_eventos.sql) está vazia hoje —
// ver o "O que trava hoje" do CLAUDE.md: nenhum evento foi cadastrado
// ainda (RF13, cadastro/edição de eventos pela equipe, também falta). As
// duas seções abaixo, "Em breve" e "Já aconteceu", mostram o estado vazio
// da Tarefa A4 em vez da lista — texto aprovado no relatório daquela
// tarefa (.superpowers/sdd/2026-08-29-fase-2-bloco-a/tarefa-A4-report.md),
// não um placeholder inventado às pressas. Ver o comentário de
// componentes/ListaEventos.ts para o porquê de a lista vazia ser desenhada
// (não omitida) aqui — decisão que diverge, de propósito, do padrão de
// componentes/SecaoNaMidia.ts e componentes/SecaoOndeEstivemos.ts.
//
// O parágrafo de destaque ainda fala em "não é preciso criar conta" para
// se inscrever (RF15) — texto literal do HTML original, mantido mesmo a
// inscrição sem conta ainda não existindo no app novo (Bloco B). Mesmo
// padrão de app/para-escolas/page.tsx linkando para /projetos antes de
// aquela página existir: conteúdo literal não espera a próxima tarefa.
import { listarProximos, listarPassados } from '@/servidor/dados/eventos';
import { ListaEventos } from '@/componentes/ListaEventos';

export const metadata = {
  title: 'Agenda — Ateliê Afro Cultural',
  description: 'Próximas oficinas, apresentações e vivências do Ateliê Afro Cultural. Inscrição sem precisar criar conta.'
};

export default async function Agenda() {
  const [proximos, passados] = await Promise.all([listarProximos(), listarPassados()]);

  return (
    <main id="conteudo" className="conteudo">
      <h1>Agenda</h1>
      <p className="destaque">
        Oficinas, apresentações e vivências abertas ao público. Para se inscrever não é preciso
        criar conta — basta preencher o formulário do evento.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <section aria-labelledby="titulo-proximos">
        <h2 id="titulo-proximos">Em breve</h2>
        <div id="lista-proximos">
          {/*
            `inscricoesAbertas` SÓ nesta lista, nunca na de baixo: o link
            de inscrição ao lado de um evento que já aconteceu seria um
            convite para uma porta fechada. Ver componentes/ListaEventos.ts.

            O parágrafo lá em cima ("basta preencher o formulário do
            evento") é texto ORIGINAL da ONG, travado por
            testes/paridade-texto.test.mjs. Ele esteve no ar prometendo uma
            coisa que o site não fazia; a partir da RF15, faz.
          */}
          <ListaEventos
            eventos={proximos}
            inscricoesAbertas
            mensagemVazio={
              'Nenhuma atividade marcada por enquanto. Acompanhe nosso Instagram ou fale com '
              + 'a gente para saber das próximas.'
            }
          />
        </div>
      </section>

      <section aria-labelledby="titulo-passados">
        <h2 id="titulo-passados">Já aconteceu</h2>
        <div id="lista-passados">
          <ListaEventos
            eventos={passados}
            mensagemVazio="Ainda não há registro de atividades passadas por aqui."
          />
        </div>
      </section>
    </main>
  );
}
