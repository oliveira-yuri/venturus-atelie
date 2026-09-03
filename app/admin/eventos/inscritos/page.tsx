import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarEventoDoPainel } from '@/servidor/dados/eventos';
import { listarInscritos } from '@/servidor/dados/inscricoes';
import { ehIdentificador } from '@/compartilhado/validacao';
import { paginar, frasePaginacao, INSCRITOS } from '@/compartilhado/paginacao';
import { ListaInscritos } from '@/componentes/ListaInscritos';
import { Paginacao } from '@/componentes/Paginacao';
import { Instrucoes } from '@/componentes/Instrucoes';

/**
 * `/admin/eventos/inscritos?id=<evento>` — quem se inscreveu (RF16).
 *
 * A PRIMEIRA LINHA DE CADA FUNÇÃO É A GUARDA, nas duas — corpo e
 * `generateMetadata`. Ver o cabeçalho de `app/admin/eventos/page.tsx` para
 * a medição que obriga as duas.
 *
 * O TÍTULO DA PÁGINA NÃO CARREGA O NOME DO EVENTO, e isso é deliberado: o
 * `generateMetadata` do painel é o caminho por onde o título vazou uma vez
 * (Tarefa P1), e um título como "Inscritos: Oficina de Percussão" contaria
 * a quem não é equipe que aquele evento existe e tem lista. A tela mostra o
 * nome; a aba do navegador, não.
 *
 * ===================================================================
 * A PAGINAÇÃO É EM MEMÓRIA, E ISSO É DECISÃO
 * ===================================================================
 *
 * `listarInscritos()` traz a lista inteira e o recorte acontece aqui. Um
 * `.range()` no PostgREST economizaria rede, e num evento de trinta pessoas
 * essa economia é zero — enquanto a lista inteira em memória é o que
 * permite o PLACAR ser verdadeiro (quantos vieram, de quantos) sem uma
 * segunda consulta que poderia discordar da primeira.
 *
 * No dia em que houver um evento de mil inscritos, isto muda — e o sinal
 * será o tempo de carregamento, não um defeito silencioso.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Inscritos — painel da equipe',
    description: 'Quem se inscreveu num evento da agenda.'
  };
}

export default async function PaginaDeInscritos(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const busca = await searchParams;
  const eventoId = typeof busca.id === 'string' ? busca.id : '';

  // Endereço sem evento, ou com um id que não é uuid, é um endereço que não
  // existe — e não um erro a explicar. Mesma decisão de /projetos/[id].
  if (!ehIdentificador(eventoId)) notFound();

  const { valor: evento, degradou: eventoFalhou } = await buscarEventoDoPainel(eventoId);

  if (eventoFalhou) {
    return (
      <main id="conteudo" className="conteudo painel__conteudo">
        <p className="painel__voltar"><Link href="/admin/eventos">← Agenda</Link></p>
        <h1>Inscritos</h1>
        <p className="estado estado--erro">
          Não deu para carregar este evento agora — o banco de dados não respondeu. Nada foi
          perdido. Tente de novo em alguns instantes.
        </p>
      </main>
    );
  }

  if (!evento) notFound();

  const { valor: todos, degradou } = await listarInscritos(eventoId);
  const paginacao = paginar(todos.length, busca.pagina);
  const pagina = todos.slice(paginacao.de, paginacao.ate + 1);

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/eventos">← Agenda</Link></p>

      <h1>Inscritos</h1>
      <p className="destaque">{evento.titulo}</p>

      <Instrucoes
        resumo="Quem se inscreveu neste evento pelo site."
        itens={[
          <><strong>Esta tela só lê.</strong> Ela não corrige e não apaga inscrição — o que a
            pessoa preencheu é registro, e é o que a ONG usa para prestar contas.</>,
          <><strong>"NÃO autoriza imagem" é para respeitar</strong> (RN07): essa pessoa não pode
            aparecer em foto publicada.</>,
          <>Para marcar quem veio no dia, use <strong>Lista de presença</strong>.</>,
          <><strong>Não reencaminhe esta lista.</strong> São dados pessoais de terceiros,
            inclusive de crianças.</>
        ]}
      />

      <p className="painel__acoes">
        <Link className="painel__acao-principal"
              href={`/admin/eventos/presenca?id=${evento.id}`}>
          Lista de presença
        </Link>
        {/*
          Um `<a>` comum para o Route Handler que gera o CSV: funciona sem
          JavaScript por construção, sem fetch e sem Blob. Ver
          app/admin/exportar/[conjunto]/route.ts.
        */}
        {' '}
        <a className="painel__acao-secundaria"
           href={`/admin/exportar/inscritos?evento=${evento.id}`}>
          Baixar em planilha
        </a>
      </p>

      {/* O TOTAL ESCRITO NA TELA, sempre — nunca um corte silencioso.
          Mesma regra da fila de contatos. */}
      <p className="painel__contagem">{frasePaginacao(paginacao, INSCRITOS)}</p>

      <ListaInscritos
        inscritos={pagina}
        degradou={degradou}
        mensagemVazio="Ninguém se inscreveu neste evento ainda."
      />

      <Paginacao paginacao={paginacao} nome={INSCRITOS} parametros={{ id: evento.id }} />
    </main>
  );
}
