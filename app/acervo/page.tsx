// Conteúdo copiado literalmente de site/acervo.html (regra 2 do CLAUDE.md:
// conteúdo real da ONG, nunca inventado). Conversão mecânica: class ->
// className, <main id="conteudo" class="conteudo"> preservado, <noscript>
// saiu (a navegação chega pronta no HTML do servidor, via app/layout.tsx).
//
// A tabela `acervo` (RF35, migration 002_conteudo.sql) está vazia hoje —
// nenhum material foi publicado ainda (RF37, publicação de material pela
// equipe, também falta, ver CLAUDE.md). ListaMateriais mostra o estado
// vazio da Tarefa A4 (texto aprovado no relatório daquela tarefa) em vez de
// omitir a seção — ver o comentário de componentes/ListaMateriais.ts.
//
// BUSCA (RF35) PORTADA COMO FORMULÁRIO GET NATIVO, SEM JAVASCRIPT NENHUM —
// decisão desta tarefa, diferente do site antigo: lá, site/assets/js/
// paginas/acervo.js escutava o submit no cliente e chamava listarMateriais
// de novo. Aqui a página já É um Server Component que busca o dado a cada
// requisição; um <form method="get" action="/acervo"> devolve exatamente
// isso de graça — o navegador recarrega /acervo?busca=X, o Next reexecuta
// este componente com `searchParams.busca` preenchido, sem Client
// Component, sem Server Action e sem quebrar a navegação sem JavaScript
// (regra "navegação sem JavaScript" do CLAUDE.md: aqui o próprio FORMULÁRIO
// funciona sem script, não só o menu).
//
// O campo de busca era um custom element (<aac-form-campo>) no site antigo
// — só existe depois que o script dele roda, e por isso não tinha como
// entrar na comparação de texto de testes/paridade-texto.test.mjs mesmo lá
// (rotulo/ajuda eram ATRIBUTOS do elemento, não texto — só apareciam depois
// da hidratação). Aqui viram <label>/<input> de verdade, expandindo o que
// aquele componente renderizava (site/assets/js/componentes/
// aac-form-campo.js, ramo não-checkbox: label, depois a ajuda, depois o
// controle) — mesma mecânica de app/*/page.tsx expandirem aac-header e
// aac-rodape em componentes/Cabecalho.tsx e componentes/Rodape.tsx. Por
// introduzir texto (rótulo e ajuda) que não existia como texto no HTML
// estático original, todo o <form id="filtros-acervo"> sai da comparação
// de testes/paridade-texto.test.mjs (idsExcluidos) — mesma situação de
// "lista-atividades" em /projetos.
//
// Sem o <p class="campo__erro" role="alert"> do componente original: ali
// ele existia para validação de CLIENTE, que este formulário GET não tem
// (não há campo obrigatório, não há como "errar" uma busca) — incluir um
// elemento de erro que nunca preenche nada seria HTML morto.
import { listarMateriais, enderecoDoArquivo } from '@/servidor/dados/acervo';
import { ListaMateriais, type MaterialComUrl } from '@/componentes/ListaMateriais';

export const metadata = {
  title: 'Acervo aberto — Ateliê Afro Cultural',
  description: 'Materiais educativos produzidos pelo Ateliê Afro Cultural sobre cultura e memória afro-brasileira. Download livre, sem cadastro.'
};

export default async function Acervo({
  searchParams
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const buscaLimpa = busca?.trim() || undefined;

  const materiaisBrutos = await listarMateriais({ busca: buscaLimpa });
  // enderecoDoArquivo() é assíncrona só por causa de obterCliente() (que lê
  // cookies()) — getPublicUrl em si é síncrono e não faz requisição
  // nenhuma (ver o comentário de servidor/dados/acervo.ts). Resolvida aqui,
  // no servidor, para ListaMateriais continuar um componente puro e
  // síncrono, testável sem o Next (testes/lista-materiais.test.mjs).
  const materiais: MaterialComUrl[] = await Promise.all(
    materiaisBrutos.map(async (material) => ({
      ...material,
      url: await enderecoDoArquivo(material.arquivo_caminho)
    }))
  );

  const mensagemVazio = buscaLimpa
    ? `Nada encontrado para "${buscaLimpa}". Tente outra palavra.`
    : 'Ainda não há material publicado no acervo. Estamos preparando os primeiros.';

  return (
    <main id="conteudo" className="conteudo">
      <h1>Acervo aberto</h1>
      <p className="destaque">
        Materiais educativos que produzimos sobre cultura e memória afro-brasileira. Leia na
        própria página ou baixe — é livre, e não pedimos cadastro para nada disso.
      </p>

      <form id="filtros-acervo" className="formulario" role="search" aria-label="Buscar no acervo"
            action="/acervo" method="get">
        <div className="campo">
          <label htmlFor="campo-busca">Buscar por palavra</label>
          <p className="campo__ajuda" id="campo-busca-ajuda">Procura no título, na descrição e no tema.</p>
          <input type="search" id="campo-busca" name="busca" aria-describedby="campo-busca-ajuda"
                 defaultValue={busca ?? ''} />
        </div>
        <button type="submit">Buscar</button>
      </form>

      <div id="lista-acervo">
        <ListaMateriais materiais={materiais} mensagemVazio={mensagemVazio} />
      </div>
    </main>
  );
}
