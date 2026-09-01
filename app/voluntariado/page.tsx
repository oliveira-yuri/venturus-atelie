// Conteúdo copiado literalmente do HTML original de voluntariado.html — hoje a
// cópia congelada em testes/apoio/html-original/voluntariado.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica:
// class -> className, <main id="conteudo" class="conteudo"> preservado,
// <noscript> saiu (a navegação chega pronta no HTML do servidor, via
// app/layout.tsx). Os links perderam o ".html" (/entrar.html -> /entrar,
// /contato.html -> /contato) para casar com o esquema de rotas do Next;
// usam next/link mesmo as duas rotas ainda estando pendentes (fase 2),
// mesmo padrão de app/projetos/page.tsx e app/quem-somos/page.tsx para
// links a rotas que ainda não existem.
//
// A ARMADILHA DO JSX COME ESPAÇOS (restrições globais #3): no HTML original
// há uma quebra de linha entre os dois <a class="botao"...> de
// "abertura__acoes" — vira espaço na tela (regra do HTML) e precisaria de
// {' '} explícito para não desaparecer em JSX. Escrito aqui com {' '}
// explícito entre os dois links, mesmo padrão de app/para-escolas/page.tsx.
//
// AS CINCO ÁREAS DE VOLUNTARIADO (RF24) VÊM DO BANCO — diferente das
// quatro páginas da Tarefa A4 (agenda/notícias/galeria/acervo), a tabela
// `areas_voluntariado` TEM dado real hoje (supabase/seed.sql). A busca
// mora em servidor/dados/voluntariado.ts. A CANDIDATURA (RF25) existe
// desde 01/09/2026, mas não aqui: ela é rota própria
// (`/voluntariado/candidatura`) e a escrita é Server Action
// (`acoes/voluntariado.ts`) — o porquê de ser outra página está no
// cabeçalho daquele page.tsx. A apresentação (os cartões, ou o estado vazio) mora em
// componentes/ListaAreas.ts — ver o comentário lá para o motivo de o caso
// vazio, mesmo sendo excepcional aqui (só acontece em modo offline, sem
// JSON de fallback para esta tabela), ainda assim desenhar um estado
// honesto em vez de omitir a seção inteira.
import Link from 'next/link';
import { listarAreas } from '@/servidor/dados/voluntariado';
import { ListaAreas } from '@/componentes/ListaAreas';

export const metadata = {
  title: 'Voluntariado — Ateliê Afro Cultural',
  description: 'Seja voluntário no Ateliê Afro Cultural: cinco áreas de atuação, do apoio pedagógico à organização do acervo.'
};

export default async function Voluntariado() {
  const areas = await listarAreas();

  return (
    <main id="conteudo" className="conteudo">
      <h1>Ser voluntário no Ateliê</h1>

      <p className="destaque">
        Voluntariar aqui é somar com a gente na criação, na reflexão e na valorização da cultura
        e memória afro brasileira. Não é preciso experiência prévia — é preciso vontade de
        participar e compromisso com o que combinamos.
      </p>

      <section aria-labelledby="titulo-areas">
        <h2 id="titulo-areas">Onde você pode ajudar</h2>
        <p>Escolha uma ou mais áreas. Muita gente atua em duas.</p>
        <div id="lista-areas">
          <ListaAreas
            areas={areas}
            mensagemVazio={
              'As áreas de atuação ainda estão sendo organizadas. '
              + 'Fale com a gente que explicamos pessoalmente.'
            }
          />
        </div>
      </section>

      <section aria-labelledby="titulo-como">
        <h2 id="titulo-como">Como funciona</h2>
        <ol className="lista-simples">
          <li>Você cria uma conta e escolhe suas áreas de interesse</li>
          <li>A gente lê sua candidatura e entra em contato para conversar</li>
          <li>Combinamos juntos o que faz sentido para você e para o ateliê</li>
        </ol>
        <p>
          Para criar conta é preciso ter 18 anos ou mais. Crianças e adolescentes participam das
          atividades por inscrição feita por um responsável.
        </p>
        {/*
          O DESTINO DE "Quero me candidatar" MUDOU NA RF25: era /entrar,
          agora é /voluntariado/candidatura. O TEXTO não mudou, e isso não é
          acaso — testes/paridade-texto.test.mjs compara o texto do <main>
          desta página com o do HTML original congelado, palavra por
          palavra, e uma frase nova aqui exigiria excluir esta seção
          daquela comparação.

          Por que o destino novo é melhor para os dois públicos: /entrar era
          honesto (candidatar-se exige conta) mas seco — quem já tinha conta
          era mandado para uma tela de login sem saber por quê, e quem não
          tinha via um formulário de cadastro sem entender o que aquilo
          tinha a ver com voluntariado. A rota nova explica a exigência para
          quem não entrou e mostra o formulário para quem entrou.
        */}
        <p className="abertura__acoes">
          <Link className="botao" href="/voluntariado/candidatura">Quero me candidatar</Link>{' '}
          <Link className="botao botao--secundario" href="/contato">Tenho uma dúvida</Link>
        </p>
      </section>
    </main>
  );
}
