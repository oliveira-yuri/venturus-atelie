import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ehEquipe } from '@/servidor/permissao';
import FormularioRegistroDeDoacao from '@/componentes/FormularioRegistroDeDoacao';

/**
 * `/admin/doacoes/registrar` — a doação que chegou POR FORA do site (RF21).
 *
 * ===================================================================
 * ESTA TELA É A OUTRA PONTA DA DECISÃO "OFERTAR EXIGE CONTA"
 * ===================================================================
 *
 * O argumento inteiro está no cabeçalho de acoes/doacoes.ts. Em resumo:
 * `public.doacoes` não tem `grant` nenhum para `anon` (MEDIDO: uma
 * inserção anônima responde `42501 permission denied`) e a política de
 * insert exige `perfil_id = auth.uid()`, então ofertar sem conta não é uma
 * opção de desenho — é migration nova. Mas o esquema JÁ PREVIU quem não
 * tem conta, pelo outro lado do balcão: `perfil_id` aceita nulo, existem
 * `doador_nome` e `doador_email`, e o comentário da migration diz para que
 * servem, com todas as letras — "Doacao registrada pela equipe pode nao
 * ter perfil: veio de fora do site".
 *
 * É esta tela. Sem ela, aquelas duas colunas seriam letra morta e o RF21
 * valeria só para quem tem login.
 *
 * ===================================================================
 * ROTA PRÓPRIA, E NÃO UM FORMULÁRIO NO TOPO DA LISTA
 * ===================================================================
 *
 * /admin/galeria põe o formulário de subir foto na própria lista, e ali faz
 * sentido: são três campos e o gesto é o principal daquela tela. Aqui são
 * cinco campos, e o gesto é a EXCEÇÃO — a fila existe para responder o que
 * chegou pelo site. Um formulário de cinco campos no topo empurraria a fila
 * para a segunda tela de rolagem num celular (regra 4 do CLAUDE.md), toda
 * vez, para uma ação que acontece de vez em quando.
 *
 * A GUARDA É A MESMA DE TODA TELA DO PAINEL, nas duas funções, pelo motivo
 * medido na Tarefa P1 e escrito em app/admin/layout.tsx.
 * `testes/painel-guarda.test.mjs` varre `app/admin/**` e falha se uma delas
 * faltar.
 */
export async function generateMetadata() {
  if (!await ehEquipe()) notFound();

  return {
    title: 'Registrar doação recebida — painel da equipe',
    description: 'Registrar uma doação que chegou por fora do site, de quem não tem conta.'
  };
}

export default async function PaginaDeRegistro() {
  if (!await ehEquipe()) notFound();

  return (
    <main id="conteudo" className="conteudo painel__conteudo">
      <p className="painel__voltar"><Link href="/admin/doacoes">← Doações</Link></p>

      <h1>Registrar doação recebida</h1>

      <p className="destaque">
        Para o que chegou por fora do site: pelo WhatsApp, por e-mail, ou na porta da sede. O que
        você registrar aqui entra na lista já como <strong>recebida</strong>, com a data de hoje.
      </p>

      {/*
        AS DUAS COISAS QUE ESTA TELA NÃO FAZ, ditas antes de alguém procurar
        um campo que não existe.

        A primeira evita um registro errado: doação combinada e ainda não
        entregue não entra aqui, porque a linha nasce "recebida" e virar
        promessa em fato é o começo de uma prestação de contas que não
        fecha.

        A segunda evita um pior: pendurar a doação na conta de alguém.
        `perfil_id` fica nulo sempre, e nem há campo para isso (ver
        componentes/FormularioRegistroDeDoacao.tsx). Quando quem doou TEM
        conta, o caminho certo é ela mesma oferecer pelo site — aí a doação
        aparece na conta dela, com a resposta de vocês.
      */}
      <p className="painel__aviso">
        Se a doação foi combinada mas ainda não chegou, não registre aqui — espere chegar. E se
        quem doou tem conta no site, peça para essa pessoa oferecer por “Apoiar → Oferecer uma
        doação”: assim a doação aparece na conta dela, com a resposta de vocês. O que se registra
        por aqui não fica ligado a conta nenhuma.
      </p>

      <FormularioRegistroDeDoacao />
    </main>
  );
}
