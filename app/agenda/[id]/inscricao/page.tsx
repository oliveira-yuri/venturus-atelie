import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarEventoParaInscricao } from '@/servidor/dados/eventos';
import { vagasRestantes } from '@/servidor/dados/inscricoes';
import { avisoDeInscricao } from '@/compartilhado/avisos-de-inscricao';
import { FUSO_DA_ONG } from '@/compartilhado/validacao';
import FormularioInscricao from '@/componentes/FormularioInscricao';

/**
 * `/agenda/<id>/inscricao` — inscrição em evento SEM CONTA (RF15).
 *
 * ===================================================================
 * UMA ROTA QUE NUNCA EXISTIU NO SITE ANTIGO
 * ===================================================================
 *
 * Como `/voluntariado/candidatura` (RF25), ela entra em
 * `PAGINAS_SEM_URL_ANTIGA` de testes/redirects.test.mjs. O parágrafo de
 * /agenda que promete inscrição é texto ORIGINAL da ONG, travado por
 * `testes/paridade-texto.test.mjs` — ele estava no ar prometendo uma coisa
 * que o site não fazia. A partir desta tela, faz.
 *
 * ===================================================================
 * PÚBLICA, E SEM REDIRECIONAR NINGUÉM
 * ===================================================================
 *
 * Não há guarda de sessão, e a ausência é a decisão D4 do escopo: reduzir
 * atrito importa mais que histórico individual. Quem quer levar o filho a
 * uma oficina de sábado não vai criar conta para isso.
 *
 * É o oposto de `/voluntariado/candidatura`, que EXIGE conta — e a
 * diferença não é de gosto, é do esquema: `voluntarios.perfil_id` é
 * `not null references public.perfis(id)`, então sem sessão não existe
 * linha possível. `inscricoes` não tem coluna de perfil nenhuma, de
 * propósito (a decisão D4 está escrita na própria migration 003).
 *
 * ===================================================================
 * QUATRO ESTADOS, E TRÊS DELES NÃO DESENHAM O FORMULÁRIO
 * ===================================================================
 *
 *  · o banco não respondeu — a página DIZ isso, com o caminho de volta.
 *    Desenhar o formulário aqui faria alguém preencher nove campos para
 *    ser recusado no fim;
 *  · o evento não existe, ou está em rascunho — 404. Quem tem o id de um
 *    rascunho não deve descobrir que ele existe;
 *  · o evento já aconteceu, ou as vagas acabaram — a página explica e
 *    manda para a agenda;
 *  · o resto — o formulário.
 *
 * A CONTAGEM DE VAGAS É INFORMATIVA, NÃO É A TRANCA. Entre desenhar esta
 * página e a pessoa enviar podem passar minutos, e a última vaga pode ir
 * embora nesse intervalo. Quem decide de verdade é `reservar_vaga()` no
 * banco, com a linha do evento travada (migration 010) — e a Action tem
 * uma frase própria para "acabou enquanto você preenchia".
 */

/** Data e hora por extenso, no fuso da ONG — a mesma de ListaEventos.ts. */
function quando(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: FUSO_DA_ONG
  });
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: FUSO_DA_ONG
  });
  return `${dia}, às ${hora}`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
) {
  const { valor: evento } = await buscarEventoParaInscricao((await params).id);
  if (!evento) return { title: 'Inscrição — Ateliê Afro Cultural' };

  return {
    title: `Inscrição: ${evento.titulo} — Ateliê Afro Cultural`,
    description: `Inscreva-se em ${evento.titulo}, do Ateliê Afro Cultural.`
  };
}

export default async function PaginaDeInscricao({
  params, searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { valor: evento, degradou } = await buscarEventoParaInscricao(id);

  if (degradou) {
    return (
      <main id="conteudo" className="conteudo">
        <h1>Inscrição</h1>
        <p className="estado estado--erro">
          Não deu para carregar este evento agora — o banco de dados não respondeu. Nada foi
          perdido, e ninguém foi inscrito. Tente de novo em alguns instantes, ou{' '}
          <Link href="/agenda">volte para a agenda</Link>. Se preferir, chame no WhatsApp
          (11) 95396-8344 — a gente inscreve você por lá.
        </p>
      </main>
    );
  }

  if (!evento) notFound();

  const aviso = avisoDeInscricao((await searchParams).aviso);
  const { valor: restantes, degradou: vagasIndisponiveis } = await vagasRestantes(id);

  const fim = new Date(evento.termina_em ?? evento.comeca_em);
  const jaAconteceu = fim.getTime() < Date.now();
  // `restantes` é `null` para evento sem limite E quando não deu para
  // contar — `vagasIndisponiveis` é o que separa os dois casos.
  const esgotado = !vagasIndisponiveis && restantes !== null && restantes <= 0;

  return (
    <main id="conteudo" className="conteudo">
      <p className="painel__voltar"><Link href="/agenda">← Agenda</Link></p>

      <h1>Inscrição</h1>

      <section className="cartao-evento" aria-labelledby="titulo-evento">
        <h2 id="titulo-evento">{evento.titulo}</h2>
        <p className="destaque">
          <time dateTime={evento.comeca_em}>{quando(evento.comeca_em)}</time>
        </p>
        {evento.local ? <p>{evento.local}</p> : null}
        {evento.faixa_etaria ? <p>Para {evento.faixa_etaria}.</p> : null}
        {evento.descricao ? <p>{evento.descricao}</p> : null}
      </section>

      {aviso ? (
        <div id="aviso" className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'}
             role="status">
          <p>{aviso.texto}</p>
        </div>
      ) : null}

      {jaAconteceu ? (
        <p className="estado estado--vazio">
          Este evento já aconteceu, então as inscrições estão encerradas.{' '}
          <Link href="/agenda">Veja o que vem por aí</Link>.
        </p>
      ) : esgotado ? (
        <p className="estado estado--vazio">
          As vagas deste evento acabaram. Dá para entrar na lista de espera falando com a gente
          pelo WhatsApp (11) 95396-8344 — e{' '}
          <Link href="/agenda">a agenda</Link> tem as próximas datas.
        </p>
      ) : (
        <>
          {/*
            O número só aparece quando existe E quando deu para contar.
            Escrever "vagas abertas" numa falha de consulta seria prometer
            algo que ninguém verificou — e a pessoa preencheria o formulário
            inteiro para ser recusada no fim.
          */}
          {restantes !== null && !vagasIndisponiveis ? (
            <p className="destaque">
              {restantes === 1 ? 'Resta 1 vaga.' : `Restam ${restantes} vagas.`}
            </p>
          ) : null}

          <FormularioInscricao eventoId={evento.id} exigeCpf={evento.exige_cpf} />
        </>
      )}
    </main>
  );
}
