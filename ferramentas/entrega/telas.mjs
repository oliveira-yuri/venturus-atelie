/**
 * ferramentas/entrega/telas.mjs — as telas a capturar, agrupadas por
 * FLUXO e não por diretório.
 *
 * A ordem é a de quem chega ao site pela primeira vez, e depois a de quem
 * trabalha nele. Um protótipo ordenado por caminho de arquivo obriga quem
 * avalia a reconstruir a navegação de cabeça.
 */

/** Substituído pelo id de um evento real na hora de capturar. */
export const EVENTO = '{{EVENTO}}';

export const FLUXOS = [
  {
    id: 'institucional',
    nome: 'Site institucional',
    resumo: 'O que qualquer pessoa vê ao chegar. Tudo renderizado no servidor.',
    telas: [
      { rota: '/', nome: 'Página inicial', rf: 'RF01' },
      { rota: '/quem-somos', nome: 'Quem somos', rf: 'RF02' },
      { rota: '/projetos', nome: 'Projetos e atividades', rf: 'RF03' },
      { rota: '/projetos/banzo', nome: 'Um projeto', rf: 'RF03' },
      { rota: '/noticias', nome: 'Notícias', rf: 'RF04' },
      { rota: '/galeria', nome: 'Galeria', rf: 'RF05' },
      { rota: '/acervo', nome: 'Acervo aberto', rf: 'RF35' },
      { rota: '/para-escolas', nome: 'Para escolas', rf: 'RF38' },
      { rota: '/contato', nome: 'Contato', rf: 'RF06 · RF07' },
      { rota: '/privacidade', nome: 'Política de privacidade', rf: 'RNF09' }
    ]
  },
  {
    id: 'participar',
    nome: 'Participar',
    resumo: 'Agenda, inscrição sem conta, voluntariado e doação.',
    telas: [
      { rota: '/agenda', nome: 'Agenda', rf: 'RF14' },
      { rota: `/agenda/${EVENTO}/inscricao`, nome: 'Inscrição sem conta', rf: 'RF15' },
      { rota: '/voluntariado', nome: 'Voluntariado', rf: 'RF24' },
      { rota: '/voluntariado/candidatura', nome: 'Candidatura', rf: 'RF25' },
      { rota: '/doar', nome: 'Como apoiar', rf: 'RF23' },
      { rota: '/doar/ofertar', nome: 'Oferecer doação', rf: 'RF19' }
    ]
  },
  {
    id: 'conta',
    nome: 'Conta',
    resumo: 'Entrar, recuperar acesso e a área do usuário.',
    telas: [
      { rota: '/entrar', nome: 'Entrar e criar conta', rf: 'RF08 · RF09 · RF10 · RF12' },
      { rota: '/recuperar-acesso', nome: 'Recuperar acesso', rf: 'RF10' },
      { rota: '/nova-senha', nome: 'Definir nova senha', rf: 'RF10' },
      { rota: '/minha-conta', nome: 'Minha conta', rf: 'RF11', sessao: true },
      { rota: '/avisos', nome: 'Mural de avisos', rf: 'RF27', sessao: true }
    ]
  },
  {
    id: 'painel',
    nome: 'Painel da equipe',
    resumo: 'Mobile-first: a ONG não possui computador. Responde 404 para quem não é equipe.',
    equipe: true,
    telas: [
      { rota: '/admin', nome: 'Início do painel', rf: 'RF33 · RF30' },
      { rota: '/admin/atividades', nome: 'Projetos', rf: 'RF03' },
      { rota: '/admin/atividades/editar', nome: 'Adicionar projeto', rf: 'RF03' },
      { rota: '/admin/publicacoes', nome: 'Notícias', rf: 'RF04' },
      { rota: '/admin/publicacoes/editar', nome: 'Escrever notícia', rf: 'RF04' },
      { rota: '/admin/galeria', nome: 'Galeria', rf: 'RF05' },
      { rota: '/admin/acervo', nome: 'Acervo', rf: 'RF37' },
      { rota: '/admin/eventos', nome: 'Agenda', rf: 'RF13' },
      { rota: '/admin/eventos/editar', nome: 'Cadastrar evento', rf: 'RF13' },
      { rota: `/admin/eventos/inscritos?id=${EVENTO}`, nome: 'Inscritos', rf: 'RF16' },
      { rota: `/admin/eventos/presenca?id=${EVENTO}`, nome: 'Lista de presença', rf: 'RF17' },
      { rota: '/admin/contatos', nome: 'Mensagens recebidas', rf: 'RF29' },
      { rota: '/admin/voluntarios', nome: 'Voluntários', rf: 'RF26' },
      { rota: '/admin/doacoes', nome: 'Doações', rf: 'RF20 · RF21' },
      { rota: '/admin/doacoes/registrar', nome: 'Registrar doação', rf: 'RF21' },
      { rota: '/admin/avisos', nome: 'Avisos', rf: 'RF27 · RF28' },
      { rota: '/admin/avisos/editar', nome: 'Escrever aviso', rf: 'RF27' },
      { rota: '/admin/relatorio', nome: 'Relatório em PDF', rf: 'RF32' }
    ]
  }
];

/**
 * As duas larguras.
 *
 * 450 E NAO 390, e a razao e' da ferramenta, nao do site: o Firefox
 * headless tem largura MINIMA de janela e ignora qualquer valor menor —
 * MEDIDO, pedindo 320, 375, 390 e 414, e recebendo 450 nos quatro.
 *
 * CONFERIDO que isso nao muda o que se ve: entre 390px e 450px existe UMA
 * unica regra de CSS no projeto (`max-width: 26rem`, 416px), e ela apenas
 * esconde o ROTULO escrito do botao de WhatsApp, deixando o icone. Nenhuma
 * quebra de layout mora nessa faixa — a primeira e' 30rem (480px).
 *
 * Ou seja: o que aparece nas capturas e' o layout que um celular recebe,
 * com o botao de WhatsApp um pouco mais largo do que ele ficaria num
 * aparelho de 390px.
 */
export const LARGURAS = [
  { chave: 'celular', px: 450, altura: 900, rotulo: 'Celular (450px)' },
  { chave: 'desktop', px: 1280, altura: 900, rotulo: 'Desktop (1280px)' }
];
