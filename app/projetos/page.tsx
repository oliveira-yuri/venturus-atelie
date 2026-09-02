// Conteúdo copiado literalmente do HTML original de projetos.html — hoje a
// cópia congelada em testes/apoio/html-original/projetos.html, já que a
// Tarefa A8 apagou site/ desta branch (regra 2 do CLAUDE.md: conteúdo
// real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, e o bloco
// <noscript> saiu — a navegação agora chega pronta no HTML do servidor
// (Cabecalho e Rodape em app/layout.tsx). Os links perderam o ".html"
// (/para-escolas.html -> /para-escolas, /contato.html -> /contato) para
// casar com o esquema de rotas do Next; usam next/link mesmo com /contato
// ainda pendente (fase 2), mesmo padrão de app/quem-somos/page.tsx e
// app/page.tsx para links a rotas que ainda não existem.
//
// A ARMADILHA DO JSX COME ESPAÇOS (restrições globais #3): no HTML original
// há uma quebra de linha entre "instituição?" e o primeiro <a>, e outra
// entre "ou" e o segundo <a> — as duas viram espaço na tela (regra do HTML)
// e precisam de {' '} explícito aqui, porque o JSX as removeria. Já entre o
// segundo </a> e o "." não há espaço nenhum no original (colados na mesma
// linha) — nenhum {' '} ali, de propósito.
//
// A lista de atividades era preenchida no CLIENTE por
// assets/js/paginas/projetos.js, lendo listarAtividades() (o
// <div id="lista-atividades"> chegava vazio no HTML estático). Agora a
// camada de dados existe no servidor (servidor/dados/conteudo.ts) e a
// página busca direto — sem round-trip no navegador, mesmo padrão que
// app/para-escolas/page.tsx e app/page.tsx já usam para o clipping. Usa
// listarAtividadesComOrigem() (não listarAtividades()) para expor a
// procedência em data-origem-atividades, mesmo motivo do data-origem-
// clipping daquelas duas páginas: sem isso, uma consulta que falhasse e
// caísse para o JSON versionado produziria uma página idêntica à página
// certa, e ninguém saberia (CRÍTICO 1 da revisão final da fase 1).
//
// CADA <CardAtividade> PRECISA CONTINUAR FILHO DIRETO DE #lista-atividades,
// SEM NENHUM WRAPPER NO MEIO: estilos/componentes.css alterna a cor do
// "aplique" com `.card-atividade:nth-child(3n+2)`/`(3n+3)` (amarelo, azul,
// marrom — a paleta da ONG, com significado declarado por eles). Um <div>
// a mais entre a lista e o cartão muda a contagem do nth-child e tira a
// paleta da ordem. Ver o comentário de componentes/CardAtividade.tsx para
// o porquê de a classe `card-atividade` morar no elemento raiz daquele
// componente.
import Link from 'next/link';
import { listarAtividadesComOrigem } from '@/servidor/dados/conteudo';
import { CardAtividade } from '@/componentes/CardAtividade';

export const metadata = {
  title: 'Projetos e atividades — Ateliê Afro Cultural',
  description: 'Contações de história, espetáculos e vivências brincantes do Ateliê Afro Cultural, com ficha técnica de cada atividade.'
};

export default async function Projetos() {
  const { registros: atividades, origem } = await listarAtividadesComOrigem();

  return (
    <main id="conteudo" className="conteudo" data-origem-atividades={origem}>
      <h1>Projetos e atividades</h1>
      <p className="destaque">
        Contações de história performáticas e vivências brincantes. Todas se adaptam a qualquer
        espaço e têm classificação livre.
      </p>

      <div className="af-stripe" aria-hidden="true" />

      <p>
        Quer levar uma destas atividades para a sua escola ou instituição?{' '}
        <Link href="/para-escolas">Veja como funciona</Link> ou{' '}
        <Link href="/contato">fale com a gente</Link>.
      </p>

      <div id="lista-atividades" className="lista-atividades">
        {atividades.length === 0
          ? <p className="estado estado--vazio">Nenhuma atividade publicada ainda.</p>
          : atividades.map((atividade) => (
              <CardAtividade key={atividade.id} atividade={atividade} />
            ))}
      </div>
    </main>
  );
}
