import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarEventoDoPainel } from '@/servidor/dados/eventos';
import { listarInscritos } from '@/servidor/dados/inscricoes';
import { marcarPresenca } from '@/acoes/presencas';
import { ehIdentificador } from '@/compartilhado/validacao';
import { avisoDePresenca } from '@/compartilhado/avisos-do-painel';
import { ListaPresenca } from '@/componentes/ListaPresenca';
import { Instrucoes } from '@/componentes/Instrucoes';

/**
 * `/admin/eventos/presenca?id=<evento>` — a lista de presença (RF17).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas. Ver o cabeçalho de
 * `app/admin/eventos/page.tsx`.
 *
 * ===================================================================
 * A TELA DE UM CELULAR SEGURADO DE PÉ, NUM GALPÃO
 * ===================================================================
 *
 * É a regra 4 do CLAUDE.md no caso mais extremo do projeto: a ONG não tem
 * computador, e esta tela é usada na PORTA de um evento, com fila
 * esperando. Três coisas saem disso, e todas estão no desenho:
 *
 *  · SEM PAGINAÇÃO, ao contrário da tela de inscritos. Numa lista de
 *    presença, "página 2" é onde as pessoas somem — quem está conferindo
 *    corre o dedo pela lista inteira e não vai reparar que ela acabou cedo.
 *    Se um dia houver evento grande o bastante para isso pesar, o caminho é
 *    busca por nome, nunca um corte;
 *  · SEM E-MAIL E SEM CPF na tela. Um telefone virado para uma fila não
 *    deve mostrar a lista de e-mails e CPFs de trinta pessoas. O que fica é
 *    o nome — e o telefone de quem responde por uma criança, que é
 *    exatamente o que se precisa quando alguém não foi buscado;
 *  · SEM JAVASCRIPT. Cada botão é um `<form>` com Server Action, o que
 *    funciona com internet ruim de galpão: o POST ou vai, ou a página não
 *    muda. Um `fetch` que falha em silêncio deixaria a equipe achando que
 *    marcou.
 *
 * O TÍTULO DA PÁGINA NÃO CARREGA O NOME DO EVENTO, pelo mesmo motivo da
 * tela de inscritos: o `generateMetadata` do painel é o caminho por onde o
 * título vazou uma vez (Tarefa P1).
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Lista de presença — painel da equipe',
    description: 'Marcar quem veio, no dia do evento.'
  };
}

export default async function PaginaDePresenca(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const busca = await searchParams;
  const eventoId = typeof busca.id === 'string' ? busca.id : '';

  if (!ehIdentificador(eventoId)) notFound();

  const { valor: evento, degradou: eventoFalhou } = await buscarEventoDoPainel(eventoId);

  if (eventoFalhou) {
    return (
      <main id="conteudo" className="conteudo painel__conteudo">
        <p className="painel__voltar"><Link href="/admin/eventos">← Agenda</Link></p>
        <h1>Lista de presença</h1>
        <p className="estado estado--erro">
          Não deu para carregar este evento agora — o banco de dados não respondeu. Se você está
          na porta do evento, confira no papel e marque depois: ninguém perde a inscrição
          por isso.
        </p>
      </main>
    );
  }

  if (!evento) notFound();

  const { valor: inscritos, degradou } = await listarInscritos(eventoId);
  const aviso = avisoDePresenca(busca.aviso);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar">
        <Link href={`/admin/eventos/inscritos?id=${evento.id}`}>← Inscritos</Link>
      </p>

      <h1>Lista de presença</h1>
      <p className="destaque">{evento.titulo}</p>

      <Instrucoes
        resumo="Marque quem veio, tocando no nome da pessoa na lista abaixo."
        itens={[
          <><strong>Dá para corrigir depois</strong> — inclusive dias depois do evento. Nada
            aqui é definitivo.</>,
          <><strong>"Sem conferir" não é "faltou".</strong> Quem você não marcou fica separado
            de quem você marcou como ausente.</>,
          <>O botão <strong>Limpar</strong> desfaz uma marcação feita por engano.</>
        ]}
      />

      {aviso ? (
        <div className={aviso.ok ? 'aviso aviso--sucesso' : 'aviso aviso--erro'} role="status">
          <p>{aviso.texto}</p>
        </div>
      ) : null}

      <ListaPresenca
        inscritos={inscritos}
        eventoId={evento.id}
        degradou={degradou}
        acaoMarcar={marcarPresenca}
        mensagemVazio="Ninguém se inscreveu neste evento pelo site. Se alguém chegou na hora,
                       anote no papel — esta tela só lista quem se inscreveu."
      />
    </main>
  );
}
