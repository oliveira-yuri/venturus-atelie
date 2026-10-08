import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { CabecalhoDaPagina } from '@/componentes/CabecalhoDaPagina';
import { ItemDeLista } from '@/componentes/ItemDeLista';
import { FiltroEmChips } from '@/componentes/FiltroEmChips';
import { Abas } from '@/componentes/Abas';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Aplique } from '@/componentes/Aplique';
import { SeloDeData } from '@/componentes/SeloDeData';
import BarraDeAcao, { LinkDeVoltar } from '@/componentes/BarraDeAcao';

/**
 * /admin/ajuda/componentes — o catálogo dos componentes do novo layout
 * (Plano de migração, tarefa 1.5).
 *
 * É a referência que as fases 4 a 7 usam: cada componente base desenhado
 * aqui, com o nome do arquivo, para que a página nova seja montada com as
 * peças que já existem em vez de reinventar uma.
 *
 * OS EXEMPLOS USAM TEXTO REAL DO SITE (regra 2): o lead da Agenda, os quatro
 * caminhos da home, os gêneros das atividades do seed, os canais da ONG. A
 * data do selo é a de HOJE — não um evento inventado.
 *
 * Só equipe, com a guarda na página e no `generateMetadata`, como toda tela
 * de `app/admin/`. É de SEGUNDO nível (alcançada por /admin/ajuda), por isso
 * não entra em `TELAS_DO_PAINEL`.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Componentes do novo layout — painel da equipe',
    description: 'Catálogo das peças do novo layout do site.'
  };
}

function Bloco({ nome, arquivo, children }: { nome: string; arquivo: string; children: React.ReactNode }) {
  return (
    <section className="catalogo__bloco" aria-labelledby={`catalogo-${arquivo}`}>
      <h2 id={`catalogo-${arquivo}`}>{nome}</h2>
      <p className="catalogo__arquivo"><code>componentes/{arquivo}</code></p>
      <div className="catalogo__amostra">{children}</div>
    </section>
  );
}

export default async function CatalogoDeComponentes() {
  if (!await ehEquipe()) notFound();

  const hoje = new Date().toISOString();

  return (
    <main id="conteudo" className="conteudo painel__conteudo catalogo">
      <p className="painel__voltar"><Link href="/admin/ajuda">← Ajuda</Link></p>

      <CabecalhoDaPagina
        sobretitulo="Ajuda"
        titulo="Componentes do novo layout"
        lead="As peças com que as páginas do site são montadas. Use estas antes de criar uma nova."
      />

      <Bloco nome="Cabeçalho da página" arquivo="CabecalhoDaPagina.ts">
        <CabecalhoDaPagina
          sobretitulo="Participar"
          titulo="Agenda"
          lead="Oficinas, apresentações e vivências abertas ao público. Para se inscrever não é preciso criar conta — basta preencher o formulário do evento."
        />
      </Bloco>

      <Bloco nome="Item de lista" arquivo="ItemDeLista.ts">
        <ItemDeLista numero="01" href="/quem-somos" titulo="Conhecer"
          descricao="Nossa história, quem idealizou o ateliê e os três setores de atuação." />
        <ItemDeLista numero="02" href="/agenda" titulo="Participar"
          descricao="Oficinas, apresentações e vivências abertas ao público. A inscrição não exige cadastro." />
        <ItemDeLista rotulo="Contação de história" href="/projetos" titulo="Projetos e atividades" />
        <ItemDeLista titulo="Linha sem link" descricao="Sem endereço, a linha não ganha seta." />
      </Bloco>

      <Bloco nome="Chips de filtro" arquivo="FiltroEmChips.ts">
        <FiltroEmChips rotulo="Exemplo de filtro por gênero" opcoes={[
          { texto: 'Todas', href: '/admin/ajuda/componentes', ativo: true, contagem: 11 },
          { texto: 'Contação de história', href: '/admin/ajuda/componentes?genero=contacao' },
          { texto: 'História-brincante interativa', href: '/admin/ajuda/componentes?genero=brincante' },
          { texto: 'Peça / contação', href: '/admin/ajuda/componentes?genero=peca' }
        ]} />
      </Bloco>

      <Bloco nome="Abas" arquivo="Abas.ts">
        <Abas rotulo="Exemplo de abas" abas={[
          { texto: 'Em breve', href: '/admin/ajuda/componentes', ativa: true },
          { texto: 'Já aconteceu', href: '/admin/ajuda/componentes?quando=antes' }
        ]} />
      </Bloco>

      <Bloco nome="Estado vazio" arquivo="EstadoVazio.ts">
        <EstadoVazio
          titulo="Nenhuma atividade marcada por enquanto"
          texto="Acompanhe as novidades por onde preferir."
          acoes={[
            { texto: 'Instagram', href: 'https://instagram.com/atelie_afrocultural', externo: true },
            { texto: 'WhatsApp', href: 'https://wa.me/5511953968344', externo: true }
          ]}
        />
      </Bloco>

      <Bloco nome="Aplique (no máximo um por tela)" arquivo="Aplique.ts">
        <Aplique className="catalogo__aplique">
          <p><strong>O destaque da tela.</strong> Borda marrom e sombra dura. Se dois elementos
            disputam o aplique, nenhum dos dois é o destaque.</p>
        </Aplique>
      </Bloco>

      <Bloco nome="Selo de data" arquivo="SeloDeData.ts">
        <div className="catalogo__linha">
          <SeloDeData iso={hoje} destaque />
          <SeloDeData iso={hoje} />
          <SeloDeData iso={hoje} destaque grande />
        </div>
        <p className="catalogo__nota">Ocre só no destaque (o próximo evento); os demais em creme.</p>
      </Bloco>

      <Bloco nome="Barra de ação e Voltar" arquivo="BarraDeAcao.ts">
        <p className="catalogo__nota">
          Em telas de detalhe e de formulário, a barra de ação substitui a barra inferior no
          celular, com a ação principal fixa; o "Voltar", com o nome do destino, fica no topo da
          página. Esta amostra fica no fluxo; numa página de verdade a barra gruda no pé da tela.
        </p>
        <LinkDeVoltar texto="Ajuda" href="/admin/ajuda" />
        <BarraDeAcao amostra
          principal={{ texto: 'Ação principal', href: '/admin/ajuda/componentes' }}
          secundaria={{ texto: 'WhatsApp', href: 'https://wa.me/5511953968344', externo: true }} />
      </Bloco>
    </main>
  );
}
