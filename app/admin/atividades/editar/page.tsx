import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import { buscarAtividadeDoPainel } from '@/servidor/dados/conteudo';
import { ehIdentificadorDeAtividade } from '@/compartilhado/validacao';
import FormularioAtividade from '@/componentes/FormularioAtividade';

/**
 * `/admin/atividades/editar?id=<apelido>` — corrigir o texto de UMA das 11
 * atividades reais (RF03/RF33).
 *
 * COM `?id=` É CORREÇÃO; SEM ele, é ATIVIDADE NOVA — igual a
 * /admin/publicacoes/editar. Até o pedido V1 (02/09/2026) criar não
 * existia, e esta tela respondia 404 sem `id`: as 11 vieram do seed, e
 * apagar por engano no celular não tem desfazer.
 *
 * O QUE MUDOU foi só a criação. APAGAR CONTINUA DE FORA, e o argumento
 * segue o mesmo: o banco permite (`for all`), a tela não oferece, e
 * `testes/atividades.test.mjs` falha se um `delete` aparecer na Action.
 *
 * O PREÇO DE CRIAR está no item 0k do CLAUDE.md: uma atividade criada aqui
 * existe só no banco, e o JSON versionado não a conhece.
 *
 * A GUARDA É A MESMA DE TODA TELA DO PAINEL, nas duas funções (componente e
 * `generateMetadata`), pelo motivo medido na Tarefa P1 e escrito em
 * app/admin/layout.tsx. `testes/painel-guarda.test.mjs` varre `app/admin/**`
 * e falha se uma delas faltar.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Corrigir atividade — painel da equipe',
    description: 'Corrigir o texto de uma atividade do Ateliê.'
  };
}

export default async function PaginaDeEdicaoDeAtividade(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  if (!await ehEquipe()) notFound();

  const pedido = (await searchParams).id;
  const id = typeof pedido === 'string' ? pedido : '';

  /*
   * SEM `?id=` A TELA É "ATIVIDADE NOVA" (pedido V1: "criar na página do
   * admin um botão para Adicionar projeto").
   *
   * Era 404 — e o comentário no topo deste arquivo explicava por quê:
   * criar não existia. Agora existe, e a tela ficou igual à de
   * /admin/publicacoes/editar, que sempre funcionou assim.
   *
   * O QUE ISSO CUSTA está escrito no item 0k do CLAUDE.md e no cabeçalho
   * de acoes/atividades.ts: uma atividade criada aqui existe SÓ no banco.
   * O JSON versionado de `dados-iniciais/` não a conhece, então um deploy
   * sem as variáveis do Supabase (item 0e) a faria sumir da página de
   * projetos sem erro nenhum.
   */
  if (!id) {
    return (
      <Tela titulo="Nova atividade">
        <p className="destaque">
          O nome vira o endereço da página desta atividade no site — "Banzo" vira
          <code> /projetos/banzo</code>. Escolha com calma: mudar o nome depois muda o endereço,
          e links antigos param de funcionar.
        </p>
        <FormularioAtividade />
      </Tela>
    );
  }

  // `?id=` com lixo dentro nunca foi um apelido de atividade. Aqui a coluna
  // é `text` (não uuid), então o Postgres NÃO reclamaria — devolveria zero
  // linhas em silêncio. Recusar antes é o que separa "não existe" de "a
  // consulta falhou" mais adiante. Ver `ehIdentificadorDeAtividade` em
  // compartilhado/validacao.ts.
  if (!ehIdentificadorDeAtividade(id)) notFound();

  const { valor: atividade, degradou } = await buscarAtividadeDoPainel(id);

  // A DISTINÇÃO QUE ESTA TELA PRECISA FAZER, e por isso a camada de dados
  // devolve `Degradavel` aqui em vez do valor puro: "esta atividade não
  // existe" e "o banco não respondeu" chegariam as duas como `null`. Tratar
  // a segunda como 404 mostraria à equipe, no meio de uma queda do Supabase,
  // uma tela dizendo que uma das atividades da ONG sumiu.
  if (degradou) {
    return (
      <Tela titulo="Corrigir atividade">
        <p className="estado estado--erro">
          Não deu para abrir esta atividade agora — o banco de dados não respondeu. Nada foi
          perdido: volte à lista e tente de novo em alguns instantes.
        </p>
      </Tela>
    );
  }

  if (!atividade) notFound();

  return (
    <Tela titulo={atividade.titulo}>
      {/* A regra desta tela, dita antes do formulário: guardar corrige o
          texto e não mexe no que está no ar. Tirar do ar é o outro botão, na
          lista — a mesma separação de acoes/atividades.ts, onde o formulário
          de texto não conhece a coluna `publicado`. */}
      <p className="destaque">
        Guardar corrige o texto na página de projetos. Para tirar esta atividade do site (ou
        colocá-la de volta), use o botão na lista de atividades.
      </p>

      <FormularioAtividade atividade={atividade} />
    </Tela>
  );
}

/**
 * O invólucro comum às duas saídas acima — título, caminho de volta e
 * conteúdo. Escrito uma vez para que o `<main id="conteudo">` e o link de
 * volta não dependam de alguém lembrar de repeti-los em cada ramo.
 *
 * O `<h1>` é o NOME DA ATIVIDADE, e não "Editar atividade": num celular, o
 * título da tela é a única confirmação de que a pessoa abriu a certa antes
 * de começar a mexer no texto.
 */
function Tela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/atividades">← Atividades</Link></p>

      <h1>{titulo}</h1>

      {children}
    </main>
  );
}
