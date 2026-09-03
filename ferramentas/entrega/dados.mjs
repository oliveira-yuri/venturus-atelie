/**
 * ferramentas/entrega/dados.mjs — os 39 RF, 12 RNF e 8 RN, com o status
 * VERIFICADO de cada um.
 *
 * =====================================================================
 * A COLUNA QUE FAZ ESTE DOCUMENTO VALER: `evidencia`
 * =====================================================================
 *
 * "Pronto" sem dizer COMO se sabe é promessa. Cada linha aqui diz o que
 * foi feito para saber — teste automatizado, medição contra o Supabase de
 * produção, ou navegador. Onde ninguém percorreu o caminho, está escrito.
 *
 * A fonte do REQUISITO é PLANO-PROJETO-ATELIE-AFRO-CULTURAL.md (§5, §6,
 * §7). A fonte do STATUS é CLAUDE.md, que a disciplina do projeto obriga a
 * atualizar no mesmo commit da funcionalidade.
 */

export const PROJETO = {
  nome: 'Ateliê Afro Cultural',
  subtitulo: 'Site institucional e sistema de gestão',
  contexto: 'Fatec Innovation Challenge · Venturus',
  entrega: '4 de setembro de 2026',
  endereco: 'https://www.atelieafrocultural.site',
  repositorio: 'github.com/oliveira-yuri/venturus-atelie',
  branch: 'migracao-nextjs'
};

/** `pronto` | `parcial` | `falta`. Nada mais — a lista é fechada. */
export const MODULOS = [
  { id: 'M1', nome: 'Site institucional e divulgação' },
  { id: 'M2', nome: 'Cadastro de usuários e acesso' },
  { id: 'M3', nome: 'Gerenciamento de eventos' },
  { id: 'M4', nome: 'Gestão de doações' },
  { id: 'M5', nome: 'Área de voluntariado' },
  { id: 'M9', nome: 'Acervo aberto' },
  { id: 'M6', nome: 'Comunicação interna' },
  { id: 'M7', nome: 'Relatórios' },
  { id: 'M8', nome: 'Administração' }
];

export const REQUISITOS = [
  // ---- M1 ----
  { id: 'RF01', m: 'M1', nome: 'Página inicial institucional',
    o: '§3', s: 'pronto', onde: '/',
    e: 'Herói com foto, os quatro caminhos numerados, os três setores e "Na mídia". Conferido no navegador a 390px e 1280px.' },
  { id: 'RF02', m: 'M1', nome: 'Página "Quem somos"',
    o: '§1, §3', s: 'pronto', onde: '/quem-somos',
    e: 'História, idealizadores e os três setores. Mapa do Google abaixo da localização (pedido V1).' },
  { id: 'RF03', m: 'M1', nome: 'Projetos e atividades',
    o: '§3', s: 'pronto', onde: '/projetos · /admin/atividades',
    e: 'As 11 atividades reais da ONG, do banco. Lista em blocos com página própria por projeto; a equipe cria, edita e sobe capa. Apagar fica de fora, com argumento escrito.' },
  { id: 'RF04', m: 'M1', nome: 'Notícias e campanhas',
    o: '§6', s: 'pronto', onde: '/noticias · /admin/publicacoes',
    e: 'Lista em blocos + página própria + imagem na notícia. Escrever, publicar e tirar do ar são gestos separados. Tabela ainda vazia: a ONG não publicou nada.' },
  { id: 'RF05', m: 'M1', nome: 'Galeria de fotos',
    o: '§2, §3', s: 'parcial', onde: '/galeria · /admin/galeria',
    e: 'Tela cheia com setas, álbum linkando o projeto. RN07 em quatro camadas. VÍDEO ficou de fora: não cabe no limite de corpo de uma Server Action. A migration 008 (bucket privado) está escrita e NÃO aplicada.' },
  { id: 'RF06', m: 'M1', nome: 'Contato institucional',
    o: '§8', s: 'pronto', onde: '/contato',
    e: 'Os cinco canais nomeados pela ONG, com ícones, mais o mapa.' },
  { id: 'RF07', m: 'M1', nome: 'Formulário de contato geral',
    o: '§3', s: 'pronto', onde: '/contato',
    e: 'MEDIDO ponta a ponta contra o Supabase de produção, sem JavaScript: preencher, enviar, redirect e a linha gravada. Foi o primeiro caminho de sucesso do projeto.' },
  { id: 'RF38', m: 'M1', nome: 'Área "Para Escolas"',
    o: '§3', s: 'pronto', onde: '/para-escolas',
    e: 'Atividades, faixas etárias, formatos, duração e o que a escola providencia.' },
  { id: 'RF39', m: 'M1', nome: 'Prova social',
    o: '§3, §4', s: 'pronto', onde: '/ · /para-escolas',
    e: 'Os 14 registros reais de clipping, do banco.' },

  // ---- M2 ----
  { id: 'RF08', m: 'M2', nome: 'Cadastro de voluntário',
    o: '§6', s: 'pronto', onde: '/entrar',
    e: 'MEDIDO contra o Auth de produção: criar conta devolve sessão na hora (autoconfirm ligado).' },
  { id: 'RF09', m: 'M2', nome: 'Cadastro de doador',
    o: '§6', s: 'pronto', onde: '/entrar',
    e: 'Mesmo formulário, com tipo de pessoa (PF/PJ) e a caixa "quero doar ou apoiar".' },
  { id: 'RF10', m: 'M2', nome: 'Autenticação e papéis acumuláveis',
    o: '§6', s: 'pronto', onde: '/entrar · /recuperar-acesso · /nova-senha',
    e: 'As quatro telas enviam COM e SEM JavaScript, medido no Firefox. Sessão lida com getUser(), nunca getSession().' },
  { id: 'RF11', m: 'M2', nome: 'Área do usuário',
    o: '§6', s: 'pronto', onde: '/minha-conta',
    e: 'MEDIDO ponta a ponta contra produção, com e sem JavaScript. Primeiro caminho AUTENTICADO do projeto. Trava de escalada provada pelos dois caminhos (PATCH direto e formulário hostil).' },
  { id: 'RF12', m: 'M2', nome: 'Confirmação de maioridade',
    o: '§5', s: 'pronto', onde: '/entrar',
    e: 'RN01 recusada no servidor, e a recusa medida sem JavaScript. A caixa é lida pelo conteúdo, não pela presença do campo.' },

  // ---- M3 ----
  { id: 'RF13', m: 'M3', nome: 'Cadastro e edição de eventos',
    o: '§6', s: 'pronto', onde: '/admin/eventos',
    e: 'Publicar é gesto separado. A tela não apaga: apagar um evento levaria a lista de inscritos junto (cascade).' },
  { id: 'RF14', m: 'M3', nome: 'Agenda pública',
    o: '§6', s: 'pronto', onde: '/agenda',
    e: 'Duas seções, com os passados acessíveis. Data no fuso da ONG, conferido com evento real.' },
  { id: 'RF15', m: 'M3', nome: 'Inscrição em evento sem conta',
    o: '§6', s: 'pronto', onde: '/agenda/<id>/inscricao',
    e: 'Migration 010 APLICADA e medida em produção. Vaga conferida no banco com a linha do evento travada. 40 testes + 14 contra Postgres real. O formulário foi conferido no navegador; o insert pelo formulário não foi disparado em produção de propósito.' },
  { id: 'RF16', m: 'M3', nome: 'Consulta e exportação de inscritos',
    o: '§6', s: 'pronto', onde: '/admin/eventos/inscritos',
    e: 'Contato, CPF quando há, responsável (RN02) e a marca de autorização de imagem em toda linha. Exportação em CSV. Só lê.' },
  { id: 'RF17', m: 'M3', nome: 'Lista de presença pelo celular',
    o: '§6', s: 'pronto', onde: '/admin/eventos/presenca',
    e: 'Três estados (veio / não veio / ninguém conferiu). Sem paginação, sem e-mail e sem CPF na tela. Cada botão é um <form> com Server Action — funciona sem JavaScript.' },
  { id: 'RF18', m: 'M3', nome: 'E-mail de confirmação',
    o: '§6', s: 'parcial', onde: 'Edge Function enviar-email',
    e: 'Função PUBLICADA e medida em produção (responde 401 sem a chave, o que prova que os quatro secrets estão lá). O envio real ainda não foi disparado.' },

  // ---- M4 ----
  { id: 'RF19', m: 'M4', nome: 'Oferta de doação',
    o: '§6', s: 'pronto', onde: '/doar/ofertar',
    e: 'Descrição livre + tipo, como o plano pede. Sem campo de valor no formulário público: valor é escrito pela equipe, depois do fato (RN08).' },
  { id: 'RF20', m: 'M4', nome: 'Análise e resposta ao doador',
    o: '§6', s: 'pronto', onde: '/admin/doacoes/responder',
    e: 'Aceite ou recusa com mensagem editável, e agora também POR E-MAIL. A equipe pode responder sem mudar a situação.' },
  { id: 'RF21', m: 'M4', nome: 'Registro de doação recebida',
    o: '§6', s: 'pronto', onde: '/admin/doacoes/registrar',
    e: 'Inclui doação vinda de fora do site (nome e e-mail sem conta ligada).' },
  { id: 'RF22', m: 'M4', nome: 'Histórico por doador',
    o: '§6', s: 'pronto', onde: '/minha-conta · /admin/doacoes',
    e: 'MEDIDO contra Postgres real: quem doou lê a resposta e NÃO consegue mudar a própria situação.' },
  { id: 'RF23', m: 'M4', nome: 'Meios de doação',
    o: '§3, §4', s: 'parcial', onde: '/doar',
    e: 'Página pronta. A chave Pix é de TESTE (chaveteste-123) com três marcas dizendo isso — a chave real da ONG é a decisão D7, ainda pendente.' },

  // ---- M5 ----
  { id: 'RF24', m: 'M5', nome: 'Página de voluntariado',
    o: '§6', s: 'pronto', onde: '/voluntariado',
    e: 'As cinco áreas reais, do banco.' },
  { id: 'RF25', m: 'M5', nome: 'Candidatura',
    o: '§6', s: 'pronto', onde: '/voluntariado/candidatura',
    e: 'MEDIDO contra produção, sem JavaScript: entrar, marcar duas áreas, enviar, e a candidatura desenhada. Exige conta, e o porquê é do esquema.' },
  { id: 'RF26', m: 'M5', nome: 'Gestão de voluntários',
    o: '§6', s: 'parcial', onde: '/admin/voluntarios',
    e: 'Lê as candidaturas com as áreas e move a situação entre as quatro. FILTRO: só por situação — o pedido V1 pediu também nome, e-mail, CPF/PJ e área.' },

  // ---- M9 ----
  { id: 'RF35', m: 'M9', nome: 'Catálogo do acervo com busca',
    o: '§6, §3', s: 'pronto', onde: '/acervo',
    e: 'Busca por texto. Tabela ainda vazia: a ONG não publicou material.' },
  { id: 'RF36', m: 'M9', nome: 'Visualização e download',
    o: '§6', s: 'parcial', onde: '/acervo',
    e: 'Abrir e baixar, sem cadastro. ACHADO: o atributo download é ignorado entre origens — corrigido com ?download=. O CONTADOR de downloads não existe: exigiria função security definer.' },
  { id: 'RF37', m: 'M9', nome: 'Publicação de material',
    o: '§6, §7', s: 'pronto', onde: '/admin/acervo',
    e: 'Só PDF, reconhecido por assinatura de bytes (%PDF-), até 4 MB.' },

  // ---- M6 ----
  { id: 'RF27', m: 'M6', nome: 'Mural de avisos',
    o: '§6', s: 'parcial', onde: '/avisos · /admin/avisos',
    e: 'Tabela NOVA, não uma coluna em publicacoes — reaproveitar aquela política publicaria comunicação interna na internet aberta. "Voluntário" = situação ATIVA. 9 testes contra Postgres real. A migration 012 está escrita e NÃO aplicada.' },
  { id: 'RF28', m: 'M6', nome: 'Mensagem para grupo',
    o: '§6', s: 'parcial', onde: '/admin/avisos',
    e: 'Grupo por lista fechada; nenhum alcança "todo mundo". Um e-mail por pessoa (/emails/batch), nunca uma lista no mesmo campo. Depende da migration 012.' },
  { id: 'RF29', m: 'M6', nome: 'Registro central de contatos',
    o: '§4, §6', s: 'pronto', onde: '/admin/contatos',
    e: 'Fila de atendimento com novo / em contato / concluída. Lê e tria: não apaga e não edita a mensagem — o texto recebido é registro.' },

  // ---- M7 ----
  { id: 'RF30', m: 'M7', nome: 'Painel de indicadores',
    o: '§6, §9', s: 'pronto', onde: '/admin',
    e: 'Seis números com count + head, sem trazer linha nenhuma pela rede. Zero é número; contagem que falhou é traço, nunca um zero inventado.' },
  { id: 'RF31', m: 'M7', nome: 'Exportação em CSV',
    o: '§6', s: 'pronto', onde: '/admin/exportar/<conjunto>',
    e: 'Contatos, voluntários e inscritos. Neutraliza injeção de fórmula (= + - @) — as aspas NÃO protegem disso. Separador ; e BOM, para o Excel em português.' },
  { id: 'RF32', m: 'M7', nome: 'Relatório em PDF',
    o: '§6', s: 'pronto', onde: '/admin/relatorio',
    e: 'window.print() com impressao.css, sem biblioteca de PDF (decisão da spec §9). Sem JavaScript o menu do navegador produz o MESMO documento — quem o gera é o CSS.' },

  // ---- M8 ----
  { id: 'RF33', m: 'M8', nome: 'Painel administrativo mobile-first',
    o: '§7', s: 'pronto', onde: '/admin',
    e: '21 telas. Guarda na PÁGINA e no generateMetadata — MEDIDO: só no layout, o Next respondia 404 E mandava a página inteira no payload de hidratação.' },
  { id: 'RF34', m: 'M8', nome: 'Perfis e permissões',
    o: '§5', s: 'pronto', onde: 'banco',
    e: '118 testes contra um Postgres real com as migrations reais. Trigger contra escalada de privilégio, provado.' }
];

export const NAO_FUNCIONAIS = [
  { id: 'RNF01', nome: 'Responsividade', s: 'pronto',
    e: 'Medido a 375px, 390px e 1280px, sem rolagem horizontal em nenhuma das 16 rotas conferidas.' },
  { id: 'RNF02', nome: 'Acessibilidade', s: 'pronto',
    e: 'A-/A/A+ e alto contraste com preferência persistida; foco visível em todo elemento alcançado por Tab; alvos de 44px; VLibras sob a política de conteúdo. Auditado com axe-core.' },
  { id: 'RNF03', nome: 'Facilidade de uso', s: 'pronto',
    e: 'Instruções em bullets no topo de cada tela do painel, com destaque no que não pode ser pulado.' },
  { id: 'RNF04', nome: 'Idioma português', s: 'pronto',
    e: 'Interface, código, tabelas e colunas em português — é o que sustenta a RNF07.' },
  { id: 'RNF05', nome: 'Tom de comunicação', s: 'pronto',
    e: 'Há teste que recusa estética de pena e linguagem de caridade. Toda mensagem de erro diz o que houve e o que fazer.' },
  { id: 'RNF06', nome: 'Identidade visual', s: 'parcial',
    e: 'Design system "Ateliê Afro" v1, com a paleta e os significados declarados pela ONG. LOGOTIPO: só existe em baixa qualidade, bordado em camiseta — a marca está tipográfica.' },
  { id: 'RNF07', nome: 'Autonomia de manutenção', s: 'parcial',
    e: 'Manual escrito (docs/manual-da-equipe.md) e guia de uma página para imprimir. O TREINAMENTO presencial que o requisito também pede não aconteceu.' },
  { id: 'RNF08', nome: 'Operação sem equipamento próprio', s: 'pronto',
    e: 'Todo o painel é mobile-first. A lista de presença é a tela mais extrema: sem paginação, alvos grandes, e cada botão funciona sem JavaScript.' },
  { id: 'RNF09', nome: 'Proteção de dados pessoais', s: 'pronto',
    e: 'RLS em todas as 17 tabelas, provada contra Postgres real. IP nunca gravado — só o hash. Política de privacidade publicada.' },
  { id: 'RNF10', nome: 'Custo de operação', s: 'pronto',
    e: 'Camada gratuita de Vercel + Supabase + Resend. Domínio ~R$ 40/ano. Nenhuma dependência paga.' },
  { id: 'RNF11', nome: 'Desempenho em rede móvel', s: 'pronto',
    e: 'Acervo tratado de 233 MB para 27 MB. Fontes servidas localmente. Nenhuma biblioteca de UI, nenhum framework de CSS.' },
  { id: 'RNF12', nome: 'Execução em navegador', s: 'pronto',
    e: 'Web, sem aplicativo. E funciona SEM JavaScript nas rotas medidas — o servidor entrega o HTML pronto.' }
];

export const REGRAS = [
  { id: 'RN01', nome: 'Só maiores de 18 criam conta', s: 'pronto',
    e: 'Caixa obrigatória na tela, recusa no servidor, e a recusa medida sem JavaScript.' },
  { id: 'RN02', nome: 'Menor participa por responsável identificado', s: 'pronto',
    e: 'Constraint no banco (responsavel_obrigatorio_para_menor) + validação na Action. Provado contra Postgres real, nos dois sentidos.' },
  { id: 'RN03', nome: 'Ofertas compatíveis com a natureza da ONG', s: 'pronto',
    e: 'O formulário nomeia livros, instrumentos, materiais artísticos e acervo — e o texto deixa claro que não é assistência social.' },
  { id: 'RN04', nome: 'Toda oferta recebe resposta registrada', s: 'pronto',
    e: 'A resposta é gravada e lida em /minha-conta, e desde 02/09 vai também por e-mail.' },
  { id: 'RN05', nome: 'Dado pessoal só para a equipe', s: 'pronto',
    e: 'MEDIDO contra produção: select anônimo em contatos, inscricoes, voluntarios, doacoes e avisos responde 42501 permission denied — antes mesmo da RLS.' },
  { id: 'RN06', nome: 'CPF condicional por evento', s: 'pronto',
    e: 'O campo só aparece quando o evento declara exige_cpf, e a Action valida a partir do BANCO, nunca do formulário. Os onze dígitos iguais são recusados à parte — eles passam na conta do módulo 11.' },
  { id: 'RN07', nome: 'Foto só com autorização registrada', s: 'pronto',
    e: 'Quatro camadas independentes: RLS da tabela, guarda dentro da Action, tela, e o ARQUIVO. MEDIDO contra produção sem mandar chave: `galeria` responde NoSuchBucket (privado) enquanto `acervo` e `identidade` respondem NoSuchKey (públicos, e é o certo — download livre é o RF36).' },
  { id: 'RN08', nome: 'Registra doações, não processa pagamento', s: 'pronto',
    e: 'lerOferta não lê campo de valor; valor só é escrito pela equipe, depois do fato.' }
];
