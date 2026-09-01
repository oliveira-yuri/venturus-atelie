/**
 * Validação dos formulários deste site — os de conta (RF08–RF12) e, desde a
 * Tarefa P2 do painel, o de notícia (RF04).
 *
 * TODOS NO MESMO ARQUIVO, e isso é decisão: o CLAUDE.md nomeia este módulo
 * como O lugar onde "o FormData é lido campo a campo por nome". Um segundo
 * arquivo de leitura de FormData seria uma segunda cópia das três precauções
 * do bloco "Leitura do FormData", lá embaixo — e a primeira que alguém
 * "simplificasse" para `String(dados.get(nome))` abriria de novo a porta que
 * a regra 6 fechou. Há também um motivo mecânico: este arquivo NÃO IMPORTA
 * NADA, o que é o que permite ao `node --test` importá-lo direto (o runtime
 * nativo do Node não resolve o alias `@/...` do tsconfig nem caminho
 * relativo sem extensão). Um módulo separado que importasse daqui deixaria
 * de ser testável sem subir o Next.
 *
 * Módulo puro, sem DOM: é o miolo testável dos formulários. As mensagens
 * seguem a seção 11 do escopo — dizem o que houve e o que fazer, sem
 * vaguidão e sem pedir desculpas.
 *
 * Toda validação devolve TODOS os erros de uma vez. Formulário que revela um
 * erro por vez faz a pessoa tentar várias vezes até acertar.
 *
 * VIVE EM compartilhado/, NÃO EM servidor/, e isso é decisão, não acaso:
 *
 *  - `acoes/autenticacao.ts` (Server Action) valida com estas funções. Spec
 *    §4.5: Server Action é endpoint HTTP público, qualquer pessoa manda
 *    qualquer corpo — a validação do servidor é a única que conta;
 *  - o formulário de /entrar é Client Component, e a Tarefa 3 vai querer as
 *    MESMAS regras no navegador para avisar antes de enviar. Um módulo em
 *    servidor/ começa com `import 'server-only'` e quebraria essa importação
 *    de propósito (é o que a linha existe para fazer);
 *  - `testes/validacao.test.mjs` importa este arquivo direto no `node --test`,
 *    o que também é impossível com a barreira de servidor/ no topo (ver
 *    testes/servidor-so-no-servidor.test.mjs, que documenta isso: "importar
 *    estes modulos aqui e impossivel por construcao").
 *
 * Duas regras, dois lugares seria a forma de as duas divergirem em silêncio.
 */

const SENHA_MINIMA = 8;

/** Papéis que alguém pode escolher para si. "equipe" nunca está aqui. */
const PAPEIS_PERMITIDOS = ['voluntario', 'doador'];

/**
 * Aceita o que é endereço de e-mail na prática: algo, arroba, domínio com
 * ponto e extensão de ao menos duas letras. Não tenta ser a RFC inteira —
 * validação rígida demais recusa endereço legítimo, o que custa mais caro.
 */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function apenasDigitos(texto: unknown): string {
  return String(texto || '').replace(/\D/g, '');
}

/**
 * Monta o telefone brasileiro conforme se digita: (11) 95396-8344 para
 * celular, (11) 3233-4455 para fixo.
 */
export function formatarTelefone(valor: unknown): string {
  const digitos = apenasDigitos(valor).slice(0, 11);

  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);

  // Celular brasileiro começa com 9 e tem 9 dígitos; fixo tem 8. Decidir pelo
  // primeiro dígito, e não pela quantidade, evita o hífen mudar de lugar no
  // meio da digitação — que faz o campo parecer quebrado.
  const corte = resto[0] === '9' ? 5 : 4;

  if (resto.length <= corte) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export type DadosCadastro = {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  maioridade?: boolean;
  consentimento?: boolean;
  papeis?: string[];
};

export type ResultadoValidacao = { valido: boolean; erros: Record<string, string> };

export type OpcoesCadastro = {
  /**
   * Exigir ao menos um papel (voluntário e/ou doador)?
   *
   * `true` é o padrão e é o comportamento do site antigo
   * (site/assets/js/paginas/entrar.js), preservado aqui para não mudar regra
   * por efeito colateral.
   *
   * `acoes/autenticacao.ts` passa `false`, de propósito: no formulário que
   * está no ar (componentes/AbasEntrar.tsx) as duas caixas do grupo "Como
   * você quer participar?" NÃO são marcadas como obrigatórias — não têm o
   * asterisco nem o `required` que os outros campos têm. Recusar o cadastro
   * por causa delas seria o servidor cobrar uma exigência que a tela nunca
   * anunciou. Se o grupo decidir que escolher um papel é obrigatório, o
   * conserto são duas linhas: marcar as caixas na tela e apagar este `false`.
   */
  exigirPapel?: boolean;
};

/**
 * A regra de força da senha, num lugar só.
 *
 * Extraída de validarCadastro() na Tarefa 2, quando `definirNovaSenha`
 * (acoes/autenticacao.ts) passou a precisar exatamente da mesma exigência.
 * Duas cópias da regra seria o cenário em que criar conta aceita uma senha
 * que trocar a senha recusa — a pessoa presa fora da própria conta por uma
 * divergência de uma linha. Devolve a mensagem, ou null quando está boa.
 *
 * O QUE ELA NÃO FAZ: força de verdade (dicionário, repetição, sequência)
 * quem mede é o Supabase, com a política do projeto — e o erro dele chega
 * traduzido por `weak_password` em compartilhado/erros.ts. Aqui é só o
 * mínimo que dá para checar sem rede, para a pessoa não descobrir depois
 * de uma ida ao servidor.
 */
export function erroDeSenha(senha: string | undefined): string | null {
  if (!senha || senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return null;
}

export function validarCadastro(
  dados: DadosCadastro,
  { exigirPapel = true }: OpcoesCadastro = {}
): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!dados.nome || dados.nome.trim().length === 0) {
    erros.nome = 'Escreva seu nome.';
  }

  if (!dados.email || !FORMATO_EMAIL.test(dados.email.trim())) {
    erros.email = 'Confira o e-mail: ele precisa ter um endereço completo, como nome@exemplo.com.';
  }

  const erroSenha = erroDeSenha(dados.senha);
  if (erroSenha) erros.senha = erroSenha;

  // Telefone é opcional (coleta mínima), mas se vier, vem completo.
  if (dados.telefone && dados.telefone.trim().length > 0) {
    const digitos = apenasDigitos(dados.telefone);
    if (digitos.length < 10 || digitos.length > 11) {
      erros.telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344.';
    }
  }

  // RN01 e RF12: somente maiores de 18 anos criam conta.
  if (!dados.maioridade) {
    erros.maioridade = 'Só quem tem 18 anos ou mais pode criar uma conta. '
      + 'Crianças e adolescentes participam das atividades por inscrição feita por um responsável.';
  }

  if (!dados.consentimento) {
    erros.consentimento = 'Para criar a conta, precisamos que você concorde com o uso dos seus dados. '
      + 'Explicamos tudo na política de privacidade.';
  }

  const papeis = Array.isArray(dados.papeis) ? dados.papeis : [];
  const papeisValidos = papeis.filter((papel) => PAPEIS_PERMITIDOS.includes(papel));

  if (exigirPapel && papeisValidos.length === 0) {
    erros.papeis = 'Escolha ao menos uma forma de participar: voluntariado, doação, ou as duas.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

export type DadosEntrada = { email?: string; senha?: string };

export function validarEntrada(dados: DadosEntrada): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!dados.email || !FORMATO_EMAIL.test(dados.email.trim())) {
    erros.email = 'Confira o e-mail.';
  }

  if (!dados.senha || dados.senha.length === 0) {
    erros.senha = 'Escreva sua senha.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

export type DadosNovaSenha = { senha?: string; confirmacao?: string };

/**
 * A senha nova de /nova-senha, pedida DUAS VEZES.
 *
 * O site antigo pedia uma vez só. Numa tela sem "mostrar senha" — e esta
 * não tem, porque o celular da equipe muitas vezes está sendo usado de pé,
 * no meio de um evento, com gente ao lado (regra 4 do CLAUDE.md) — um erro
 * de digitação vira a pessoa trancada fora da conta, sem nada na tela que
 * indique o que houve. Pedir duas vezes é o que transforma isso num erro
 * de formulário em vez de uma senha desconhecida.
 *
 * A ORDEM DOS ERROS IMPORTA: se a senha em si já é curta demais, o erro de
 * "não são iguais" não aparece. Duas mensagens vermelhas ao mesmo tempo,
 * uma delas consequência da outra, é o tipo de tela que faz a pessoa achar
 * que errou duas coisas.
 */
export function validarNovaSenha(dados: DadosNovaSenha): ResultadoValidacao {
  const erros: Record<string, string> = {};

  const erroSenha = erroDeSenha(dados.senha);
  if (erroSenha) erros.senha = erroSenha;

  if (!dados.confirmacao) {
    erros.confirmacao = 'Escreva a senha nova de novo, para conferirmos.';
  } else if (!erroSenha && dados.confirmacao !== dados.senha) {
    erros.confirmacao = 'As duas senhas não são iguais. Confira e escreva as duas de novo.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/** Campos do formulário de /nova-senha (componentes/FormularioNovaSenha.tsx). */
export function lerNovaSenha(dados: FormData): DadosNovaSenha {
  // Os dois SEM trim, pelo mesmo motivo de sempre (ver senhaBruta acima):
  // aparar aqui e não aparar no cadastro é como se cria uma senha que a
  // pessoa consegue definir e nunca mais consegue digitar.
  return {
    senha: senhaBruta(dados, 'senha'),
    confirmacao: senhaBruta(dados, 'confirmacao')
  };
}

export function validarRecuperacao(dados: { email?: string }): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!dados.email || !FORMATO_EMAIL.test(dados.email.trim())) {
    erros.email = 'Confira o e-mail.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

// =====================================================================
// Leitura do FormData
//
// Server Action recebe FormData, e FormData é entrada hostil: spec §4.5 —
// a Action é um endpoint HTTP, qualquer pessoa manda qualquer corpo, com ou
// sem o formulário. Daí as três precauções abaixo, que parecem paranoia e
// não são:
//
//  1. `dados.get()` devolve `string | File | null`. Um File enviado no
//     campo "senha" viraria "[object File]" num `String(...)` distraído —
//     uma senha de 15 caracteres que ninguém digitou. Aqui, o que não é
//     string vira string vazia e é recusado pela validação.
//  2. Cada campo é lido POR NOME, um a um. Nada de espalhar objeto: é a
//     regra 6 do CLAUDE.md (`eh_equipe` nunca vem do cadastro), e ela só
//     vale se não houver caminho pelo qual um campo inventado no corpo da
//     requisição chegue inteiro ao banco. Campo que não está nesta lista
//     não existe para o resto do sistema.
//  3. Caixa de marcar não tem valor confiável: o navegador manda "on"
//     quando marcada e OMITE o campo quando não. Quem chama a Action à mão
//     pode mandar "false". Por isso marcado() olha o conteúdo, e não só a
//     presença.
// =====================================================================

/**
 * Texto de um campo, já sem espaço nas pontas. Nunca `undefined`.
 *
 * RENOMEADA NA TAREFA P2 DO PAINEL (era `texto`) e exportada, porque o
 * bloco "Publicações", no fim deste arquivo, também precisa dela — e porque
 * o nome antigo, dentro de uma função que trata de texto de notícia, dizia
 * muito pouco. Continua valendo a precaução 1 do bloco acima: `dados.get()`
 * devolve `string | File | null`, e um File no campo "corpo" viraria a
 * string "[object File]" gravada no banco.
 *
 * O `trim` NÃO estraga texto longo: ele apara só as pontas, e as quebras de
 * linha do meio (que é o que separa os parágrafos de uma notícia) ficam.
 */
export function textoDoCampo(dados: FormData, nome: string): string {
  const valor = dados.get(nome);
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Senha: o único campo lido SEM trim.
 *
 * Espaço no começo ou no fim é caractere de senha como qualquer outro, e
 * quem gerou a senha num gerenciador pode ter um. Aparar aqui produziria o
 * pior defeito possível de autenticação: cadastro e entrada aparando de
 * formas diferentes, e a pessoa trancada fora da própria conta sem
 * explicação.
 */
function senhaBruta(dados: FormData, nome: string): string {
  const valor = dados.get(nome);
  return typeof valor === 'string' ? valor : '';
}

/** Uma caixa de marcar está marcada? Ver a precaução 3 acima. */
function marcado(dados: FormData, nome: string): boolean {
  const valor = dados.get(nome);
  if (typeof valor !== 'string') return false;

  const normalizado = valor.trim().toLowerCase();
  return normalizado !== ''
    && normalizado !== 'false'
    && normalizado !== '0'
    && normalizado !== 'off'
    && normalizado !== 'nao'
    && normalizado !== 'não';
}

/**
 * Campos do formulário "Criar conta" (componentes/AbasEntrar.tsx).
 *
 * Os nomes são os atributos `name` daquele formulário — o `prefixo` de
 * CampoFormulario muda só o `id`, nunca o `name` (ver o componente).
 */
export function lerCadastro(dados: FormData): DadosCadastro {
  const papeis: string[] = [];
  if (marcado(dados, 'voluntario')) papeis.push('voluntario');
  if (marcado(dados, 'doador')) papeis.push('doador');

  return {
    nome: textoDoCampo(dados, 'nome'),
    email: textoDoCampo(dados, 'email'),
    telefone: textoDoCampo(dados, 'telefone'),
    senha: senhaBruta(dados, 'senha'),
    maioridade: marcado(dados, 'maioridade'),
    consentimento: marcado(dados, 'consentimento'),
    papeis
  };
}

/** Campos do formulário "Entrar". */
export function lerEntrada(dados: FormData): DadosEntrada {
  return {
    email: textoDoCampo(dados, 'email'),
    senha: senhaBruta(dados, 'senha')
  };
}

/** Campo do formulário de /recuperar-acesso. */
export function lerRecuperacao(dados: FormData): { email: string } {
  return { email: textoDoCampo(dados, 'email') };
}

// =====================================================================
// Publicações — o formulário de notícia do painel (RF04/RF33, Tarefa P2)
//
// Separado das funções de conta acima por assunto, não por natureza: as
// mesmas três precauções de leitura de FormData valem, e é por elas que
// estas funções moram aqui e não num arquivo próprio (ver o cabeçalho).
//
// O QUE ESTE BLOCO NÃO DECIDE: se a pessoa pode gravar. Isso é `ehEquipe()`
// dentro de cada Server Action (acoes/publicacoes.ts) e a RLS no banco
// (regras 5 e 6 do CLAUDE.md). E ele NÃO LÊ o campo `publicado` — publicar é
// um ato separado, com Action própria e botão próprio: um formulário de
// texto que também pudesse ligar o "no ar" faria uma correção de vírgula às
// 23h virar uma publicação acidental.
// =====================================================================

/**
 * O que o formulário de notícia manda — e é a lista COMPLETA do que a Action
 * aceita. Campo que não está aqui não existe para o resto do sistema.
 *
 * `imagem_caminho` e `imagem_alt` existem na tabela e NÃO estão aqui de
 * propósito: upload é a Tarefa P3, que faz o trabalho de Supabase Storage.
 * Um meio-caminho (um campo de texto pedindo o caminho do arquivo à mão)
 * seria pior que a ausência — a coluna tem `check` exigindo `imagem_alt`
 * junto, e quem preenchesse na mão levaria um erro de banco cru.
 */
export type CamposPublicacao = {
  /** Vazio quando é notícia nova; o uuid da linha quando é edição. */
  id: string;
  titulo: string;
  resumo: string;
  corpo: string;
};

/**
 * Limites de tamanho — e eles NÃO vêm do banco, vêm daqui.
 *
 * As colunas são `text` no Postgres, ou seja, sem limite nenhum. Como a
 * Action é endpoint HTTP público (spec §4.5), sem um teto qualquer pessoa
 * pode mandar megabytes num campo e a única defesa seria o limite de corpo
 * de requisição do runtime — que devolve um erro que ninguém entende.
 *
 * Os números são de uso, não de tecnologia: um título que não cabe em duas
 * linhas de celular já é grande demais; o resumo é a frase que aparece na
 * lista; e 20 mil caracteres são cerca de dez páginas, muito além de
 * qualquer notícia de ONG e ainda assim longe de ser um problema para o
 * banco.
 */
export const LIMITE_TITULO = 160;
export const LIMITE_RESUMO = 400;
export const LIMITE_CORPO = 20_000;

/**
 * O formato de um `uuid` do Postgres (`gen_random_uuid()`).
 *
 * Serve para separar "criar" de "editar" ANTES de falar com o banco: sem
 * isto, um `id` com lixo dentro iria para o `.eq('id', ...)` e voltaria como
 * erro de sintaxe do Postgres (22P02), que a tela mostraria como falha
 * genérica. Com isto, a Action sabe que aquilo nunca foi um identificador e
 * responde o que de fato aconteceu.
 *
 * NÃO É AUTORIZAÇÃO E NÃO PROVA QUE A LINHA EXISTE: um uuid bem formado de
 * outra publicação passa por aqui igual. Quem decide o que pode ser lido e
 * escrito é a RLS.
 */
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdentificador(valor: unknown): boolean {
  return typeof valor === 'string' && FORMATO_UUID.test(valor);
}

/**
 * Campos do formulário de notícia (componentes/FormularioPublicacao.tsx).
 *
 * Um a um, por nome, pelo motivo do bloco "Leitura do FormData": espalhar o
 * FormData num objeto seria abrir de novo a porta por onde `publicado` (ou
 * `eh_equipe`, no cadastro) entraria pela frente.
 */
export function lerPublicacao(dados: FormData): CamposPublicacao {
  return {
    id: textoDoCampo(dados, 'id'),
    titulo: textoDoCampo(dados, 'titulo'),
    resumo: textoDoCampo(dados, 'resumo'),
    corpo: textoDoCampo(dados, 'corpo')
  };
}

/** TODOS os erros de uma vez — a regra do topo deste arquivo. */
export function validarPublicacao(campos: CamposPublicacao): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.titulo) {
    erros.titulo = 'Escreva um título para a notícia.';
  } else if (campos.titulo.length > LIMITE_TITULO) {
    erros.titulo = `O título passou de ${LIMITE_TITULO} caracteres. Encurte um pouco.`;
  }

  // `resumo` é opcional: a coluna aceita null, e nem toda notícia precisa de
  // uma chamada separada do texto. O que não pode é passar do tamanho.
  if (campos.resumo.length > LIMITE_RESUMO) {
    erros.resumo = `O resumo passou de ${LIMITE_RESUMO} caracteres. Ele é a chamada curta, `
      + 'não o texto inteiro.';
  }

  if (!campos.corpo) {
    erros.corpo = 'Escreva o texto da notícia.';
  } else if (campos.corpo.length > LIMITE_CORPO) {
    erros.corpo = `O texto passou de ${LIMITE_CORPO} caracteres.`;
  }

  // Edição: o id vem do link que a própria lista do painel montou. Se chegou
  // preenchido e não é um uuid, alguém montou a requisição à mão — a Action
  // recusa em vez de perguntar ao Postgres.
  if (campos.id && !ehIdentificador(campos.id)) {
    erros.id = 'Não foi possível identificar qual notícia é esta. Volte à lista e abra de novo.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/** O que o botão de publicar/tirar do ar manda. */
export type AcaoDePublicacao = 'publicar' | 'despublicar';

/**
 * Lê o botão de publicar/tirar do ar — LISTA FECHADA, como o `type` do link
 * de e-mail em compartilhado/links-de-email.ts.
 *
 * O valor vem de um `<input type="hidden">`, ou seja, é entrada de usuário
 * como qualquer outra. Sem a lista fechada, um valor inesperado cairia num
 * `else` e viraria "despublicar" (ou "publicar") em silêncio.
 */
export function lerAlternancia(dados: FormData): { id: string; acao: AcaoDePublicacao | null } {
  const pedida = textoDoCampo(dados, 'acao');
  const acao = pedida === 'publicar' || pedida === 'despublicar' ? pedida : null;

  return { id: textoDoCampo(dados, 'id'), acao };
}

// =====================================================================
// Galeria — o formulário de subir foto (RF05/RF33/RN07, Tarefa P3)
//
// Mesmo lugar das publicações, pelo mesmo motivo escrito no cabeçalho
// deste arquivo: as três precauções de leitura de FormData valem igual, e
// este módulo não importa nada, o que é o que permite ao `node --test`
// exercitá-lo sem subir o Next.
//
// O QUE ESTE BLOCO NÃO DECIDE: se a pessoa pode gravar (isso é `ehEquipe()`
// na Action e a RLS no banco) e se o arquivo é MESMO uma imagem — a
// resposta a essa depende de LER OS BYTES, e quem lê é a Action; o que mora
// aqui é a decisão pura sobre os bytes já lidos (`tipoDaImagem`).
//
// E ele NÃO LÊ o campo `publicado`, pela mesma razão de `lerPublicacao`:
// subir não é publicar. A foto entra como rascunho e sai do rascunho por um
// botão separado — que, na galeria, ainda depende da autorização de uso de
// imagem (RN07).
// =====================================================================

/**
 * O TETO DE TAMANHO DE ARQUIVO, e ele é a metade de uma decisão que tem
 * outra metade em `next.config.ts`. Ler as duas juntas.
 *
 * MEDIDO (o bloco inteiro está em next.config.ts): sem configuração, uma
 * Server Action recusa corpo acima de 1 MB devolvendo **500 em texto puro**,
 * antes de qualquer código nosso rodar. Foto de celular tem 3 a 8 MB. Então
 * o limite de corpo do Next foi para 8 MB e ESTE número, que é o que a tela
 * de fato aceita, ficou em 4 MB. A folga entre os dois existe para que um
 * arquivo grande demais receba a frase de `validarMidia` em vez do 500.
 *
 * POR QUE 4 MB e não 8: a Netlify tem limite próprio de corpo de função e
 * esta branch nunca foi publicada (CLAUDE.md, item 0). 4 MB binários viram
 * ~5,3 MB depois da codificação que a plataforma usa para entregar o corpo
 * à função, o que deixa margem sob o limite documentado de 6 MB. NÃO
 * MEDIDO na Netlify — declarado no relatório da Tarefa P3.
 *
 * O QUE ISSO CUSTA, dito em voz alta: uma parte das fotos de celular passa
 * de 4 MB e vai ser RECUSADA. A recusa é uma frase que diz o tamanho, o
 * limite e o que fazer (ver `validarMidia`) — não um erro. Reduzir a imagem
 * antes de enviar exigiria `canvas` no navegador, o que quebra sem
 * JavaScript, ou uma biblioteca no servidor, proibida pela regra 7 do
 * CLAUDE.md. As duas saídas foram consideradas e recusadas; a terceira —
 * recusar com mensagem clara — é esta.
 */
export const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;

/** Nome do álbum e descrição: limites de uso, como os de publicação. */
export const LIMITE_ALBUM = 80;
export const LIMITE_ALT = 300;
export const LIMITE_LEGENDA = 400;

/**
 * As imagens que o site aceita, POR ASSINATURA DE BYTES — não por extensão
 * e não pelo `Content-Type` que o navegador declarou.
 *
 * O `accept` do `<input type="file">` é sugestão para o seletor de arquivos
 * do sistema, e o `type` do File vem do CLIENTE: os dois são entrada de
 * usuário. Server Action é endpoint HTTP público (spec §4.5) — quem monta a
 * requisição à mão escolhe o nome do arquivo, a extensão e o Content-Type,
 * todos os três. O que não dá para forjar sem de fato ser aquilo são os
 * primeiros bytes do arquivo.
 *
 * A extensão que vai para o bucket sai DAQUI, do tipo reconhecido, e nunca
 * do nome que chegou.
 */
type AssinaturaDeImagem = {
  tipo: string;
  extensao: string;
  /** Bytes que precisam bater, a partir de `deslocamento`. */
  bytes: number[];
  deslocamento?: number;
};

const ASSINATURAS: AssinaturaDeImagem[] = [
  // JPEG: FF D8 FF. Cobre JFIF e Exif, que é o que sai de câmera de celular.
  { tipo: 'image/jpeg', extensao: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  // PNG: os 8 bytes canônicos, inclusive o CRLF que existe justamente para
  // detectar transferência corrompida.
  { tipo: 'image/png', extensao: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // GIF87a / GIF89a.
  { tipo: 'image/gif', extensao: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: "WEBP" no deslocamento 8, dentro de um contêiner RIFF. O "RIFF"
  // do começo sozinho não basta — ele também é de WAV e de AVI.
  { tipo: 'image/webp', extensao: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], deslocamento: 8 }
];

/**
 * Quantos bytes do começo do arquivo bastam para decidir. Nenhuma assinatura
 * acima passa do byte 12.
 */
export const BYTES_PARA_RECONHECER = 12;

export type ImagemReconhecida = { tipo: string; extensao: string };

/**
 * O arquivo é uma imagem que aceitamos? Devolve o tipo e a extensão, ou
 * `null` — e `null` é a resposta para PDF, .exe, .zip, vídeo, e para um
 * .txt renomeado para .jpg.
 *
 * Recebe os bytes já lidos (um `Uint8Array`), e não o File, de propósito:
 * assim a decisão é pura e cabe num teste do Node, sem arquivo em disco e
 * sem servidor.
 *
 * NÃO É ANTIVÍRUS e não afirma que o arquivo é seguro: afirma que ele
 * COMEÇA como um JPEG/PNG/GIF/WebP. É o que impede o caso comum (arquivo
 * trocado, extensão mentindo) e é o que dá para fazer sem biblioteca nova
 * (regra 7 do CLAUDE.md).
 */
export function tipoDaImagem(bytes: Uint8Array): ImagemReconhecida | null {
  for (const assinatura of ASSINATURAS) {
    const inicio = assinatura.deslocamento ?? 0;
    if (bytes.length < inicio + assinatura.bytes.length) continue;

    const bate = assinatura.bytes.every((byte, i) => bytes[inicio + i] === byte);
    if (bate) return { tipo: assinatura.tipo, extensao: assinatura.extensao };
  }

  return null;
}

/** Os tipos que o `accept` do input sugere — a MESMA lista das assinaturas. */
export const TIPOS_ACEITOS = ASSINATURAS.map((a) => a.tipo).join(',');

/** "3,7 MB" — para a mensagem dizer o tamanho, não só que passou. */
export function emMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * O caminho do arquivo DENTRO do bucket.
 *
 * NOME DE ARQUIVO É ENTRADA DE USUÁRIO e não entra aqui de jeito nenhum —
 * nem "limpo". Ele carregaria `../`, barra, caractere de controle, unicode
 * que parece ASCII, e ainda o nome de quem tirou a foto ("IMG_Ana_e_o_filho
 * .jpg"), que num bucket de leitura PÚBLICA vira dado pessoal exposto na
 * URL. O caminho é `<álbum reduzido>/<uuid>.<extensão reconhecida>`:
 *
 *   · o álbum reduzido só para a equipe se achar no painel do Supabase, e
 *     passa por uma lista branca de caracteres — o que não for `a-z0-9-`
 *     some;
 *   · o uuid vem de `crypto.randomUUID()`, ou seja, não colide e não é
 *     adivinhável;
 *   · a extensão vem de `tipoDaImagem`, dos BYTES, nunca do nome recebido.
 *
 * O uuid NÃO É PROTEÇÃO, e isso precisa ficar escrito: o bucket `galeria` é
 * público (supabase/migrations/006_storage.sql), então qualquer arquivo lá
 * é legível por quem tiver a URL, publicado ou não. O que o uuid dá é que a
 * URL não é adivinhável e só existe em dois lugares — no banco e no HTML de
 * uma foto que a equipe publicou. Quem precisa de mais que isso precisa de
 * bucket privado com URL assinada, que é migration nova (fora desta tarefa).
 * Ver o cabeçalho de acoes/galeria.ts.
 */
export function caminhoNoBucket(album: string, extensao: string, identificador: string): string {
  const pasta = album
    .toLowerCase()
    .normalize('NFD')
    // Tira acento sem tirar a letra: "ação" -> "acao".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `${pasta || 'album'}/${identificador}.${extensao}`;
}

export type CamposMidia = {
  /** Vazio quando é envio novo; o uuid da linha quando é um gesto sobre uma existente. */
  id: string;
  album: string;
  alt: string;
  legenda: string;
  /** RN07: a declaração de que existe autorização de uso de imagem registrada. */
  autorizacao: boolean;
  /** O arquivo, ou null quando não veio nada (ou veio texto no lugar). */
  arquivo: File | null;
};

/**
 * Campos do formulário de subir foto (componentes/FormularioMidia.tsx).
 *
 * Um a um, por nome — a regra 6 do CLAUDE.md aplicada aqui: `publicado` e
 * `autorizacao_registrada` são colunas que decidem se a foto de uma criança
 * aparece na internet. Espalhar o FormData num objeto seria deixar as duas
 * entrarem pelo corpo da requisição.
 *
 * O ARQUIVO É LIDO COM A VERIFICAÇÃO INVERSA das outras: aqui o que NÃO for
 * `File` vira null. É a mesma precaução 1 do bloco lá em cima, do outro
 * lado — lá um File no campo de senha viraria "[object File]"; aqui uma
 * string no campo de arquivo não pode virar um arquivo.
 */
export function lerMidia(dados: FormData): CamposMidia {
  const enviado = dados.get('arquivo');

  return {
    id: textoDoCampo(dados, 'id'),
    album: textoDoCampo(dados, 'album'),
    alt: textoDoCampo(dados, 'alt'),
    legenda: textoDoCampo(dados, 'legenda'),
    autorizacao: marcado(dados, 'autorizacao'),
    // `instanceof File` e não "tem .arrayBuffer": um objeto qualquer com
    // esse método passaria adiante e só falharia lá na frente, no upload.
    // Arquivo de tamanho zero é tratado como ausência — é o que o navegador
    // manda quando o campo fica vazio num envio multipart.
    arquivo: enviado instanceof File && enviado.size > 0 ? enviado : null
  };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * O que NÃO é verificado aqui: se os bytes do arquivo são mesmo de uma
 * imagem. Isso exige lê-los (`tipoDaImagem`) e quem lê é a Action; separar
 * mantém esta função pura e síncrona, do jeito que o teste do Node
 * consegue exercitar.
 */
export function validarMidia(campos: CamposMidia): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.album) {
    erros.album = 'Escreva em qual álbum esta foto entra — por exemplo, o nome da oficina ou do '
      + 'evento. Fotos com o mesmo nome de álbum aparecem juntas na galeria.';
  } else if (campos.album.length > LIMITE_ALBUM) {
    erros.album = `O nome do álbum passou de ${LIMITE_ALBUM} caracteres. Encurte um pouco.`;
  }

  // `alt` é `not null` no banco (com `check (length(trim(alt)) > 0)`) E é
  // acessibilidade (regra 8 do CLAUDE.md). Não existe texto automático
  // aqui de propósito: descrever a imagem é trabalho de quem a viu.
  if (!campos.alt) {
    erros.alt = 'Descreva a foto em uma frase, para quem não pode vê-la. Diga o que aparece: '
      + '"crianças tocando tambor numa roda", por exemplo.';
  } else if (campos.alt.length > LIMITE_ALT) {
    erros.alt = `A descrição passou de ${LIMITE_ALT} caracteres. Uma ou duas frases bastam.`;
  }

  if (campos.legenda.length > LIMITE_LEGENDA) {
    erros.legenda = `A legenda passou de ${LIMITE_LEGENDA} caracteres.`;
  }

  if (!campos.arquivo) {
    erros.arquivo = 'Escolha a foto que você quer subir.';
  } else if (campos.arquivo.size > LIMITE_ARQUIVO_BYTES) {
    erros.arquivo = `Esta foto tem ${emMegabytes(campos.arquivo.size)} e o limite é `
      + `${emMegabytes(LIMITE_ARQUIVO_BYTES)}. No celular, ao escolher a foto, procure a opção `
      + 'de enviar em tamanho médio (ou "otimizado") em vez do tamanho real — a foto continua '
      + 'boa para o site e cabe no limite.';
  }

  if (campos.id && !ehIdentificador(campos.id)) {
    erros.id = 'Não foi possível identificar qual foto é esta. Volte à galeria e abra de novo.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

// =====================================================================
// Atividades — o formulário de EDITAR as 11 reais (RF03/RF33, Tarefa P4)
//
// Mesmo lugar dos dois blocos acima, pelo mesmo motivo escrito no cabeçalho
// deste arquivo: as três precauções de leitura de FormData valem igual, e
// este módulo não importa nada, o que é o que permite ao `node --test`
// exercitá-lo sem subir o Next.
//
// A DIFERENÇA QUE ESTE BLOCO TEM PARA O DAS PUBLICAÇÕES, e ela decide o
// desenho inteiro da tela: aqui NÃO SE CRIA E NÃO SE APAGA. As 11
// atividades são conteúdo da ONG, vieram no seed versionado
// (dados-iniciais/atividades.json) e a tela existe para CORRIGIR o texto
// delas. Por isso `id` é OBRIGATÓRIO aqui — em `lerPublicacao` o id vazio
// significa "notícia nova"; aqui significa "requisição malformada".
//
// E o `id` NÃO É UUID: `public.atividades.id` é `text`
// (supabase/migrations/002_conteudo.sql), e os valores reais são apelidos
// legíveis — "banzo", "catirina-e-nego-dito", "brasil-negreiro". Usar
// `ehIdentificador` (que é o uuid das publicações e da mídia) aqui
// recusaria todas as 11.
// =====================================================================

/**
 * O que o formulário de atividade manda — e é a lista COMPLETA do que a
 * Action aceita. Campo que não está aqui não existe para o resto do
 * sistema.
 *
 * `publicado` NÃO ESTÁ AQUI, pela mesma razão de `lerPublicacao`: corrigir
 * um texto não é tirar do ar nem pôr no ar. São botões separados, com Action
 * separada. E `criado_em` também não: é do banco, não de quem escreve.
 */
export type CamposAtividade = {
  /** Qual das 11 está sendo corrigida. NUNCA vazio: esta tela não cria. */
  id: string;
  titulo: string;
  resumo: string;
  descricao: string;
  genero: string;
  duracao: string;
  elenco: string;
  classificacao: string;
  local: string;
  rider: string;
};

/**
 * O teto da sinopse e o dos seis campos da ficha técnica.
 *
 * Mesma razão dos limites das publicações: as colunas são `text` no
 * Postgres (sem limite nenhum) e a Action é endpoint HTTP público (spec
 * §4.5). Os números vêm do uso, medidos contra o conteúdo real de
 * dados-iniciais/atividades.json — a maior sinopse tem 1.485 caracteres e
 * o maior campo de ficha ("elenco") tem 67. A folga é grande de propósito:
 * o limite existe para barrar megabytes, não para brigar com a ONG por uma
 * frase a mais.
 *
 * `titulo` e `resumo` reaproveitam LIMITE_TITULO/LIMITE_RESUMO lá de cima:
 * é a mesma decisão de uso ("cabe em duas linhas de celular", "é a chamada
 * curta"), e dois números diferentes para a mesma ideia divergiriam.
 */
export const LIMITE_DESCRICAO = 20_000;
export const LIMITE_FICHA = 200;

/**
 * O formato de um id de atividade: apelido em letras minúsculas, números e
 * hífen — "banzo", "a-cabaca-e-o-canto-ancestral".
 *
 * Serve para o mesmo que `ehIdentificador` faz com o uuid das publicações:
 * recusar, ANTES de falar com o banco, o que nunca foi um identificador. A
 * diferença é que a coluna aqui é `text`, então um id com lixo dentro não
 * levanta erro de sintaxe no Postgres — ele simplesmente não casa com linha
 * nenhuma, e o `update` "bem-sucedido com zero linhas" viraria "salvo!" sem
 * nada salvo. É por isso que a recusa é escrita, e não confiada ao banco.
 *
 * NÃO É AUTORIZAÇÃO E NÃO PROVA QUE A LINHA EXISTE: um apelido bem formado
 * de outra atividade passa por aqui igual. Quem decide o que pode ser lido
 * e escrito é a RLS.
 */
const FORMATO_ID_ATIVIDADE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITE_ID_ATIVIDADE = 80;

export function ehIdentificadorDeAtividade(valor: unknown): boolean {
  return typeof valor === 'string'
    && valor.length <= LIMITE_ID_ATIVIDADE
    && FORMATO_ID_ATIVIDADE.test(valor);
}

/**
 * Campos do formulário de atividade (componentes/FormularioAtividade.tsx).
 *
 * Um a um, por nome, pelo motivo do bloco "Leitura do FormData". Aqui isso
 * tem uma consequência extra: `publicado` é coluna desta tabela e chega
 * `true` por padrão (`not null default true`, ao contrário de
 * `publicacoes`). Espalhar o FormData faria um `publicado=false` mandado no
 * corpo tirar uma atividade do ar por dentro do formulário de texto.
 */
export function lerAtividade(dados: FormData): CamposAtividade {
  return {
    id: textoDoCampo(dados, 'id'),
    titulo: textoDoCampo(dados, 'titulo'),
    resumo: textoDoCampo(dados, 'resumo'),
    descricao: textoDoCampo(dados, 'descricao'),
    genero: textoDoCampo(dados, 'genero'),
    duracao: textoDoCampo(dados, 'duracao'),
    elenco: textoDoCampo(dados, 'elenco'),
    classificacao: textoDoCampo(dados, 'classificacao'),
    local: textoDoCampo(dados, 'local'),
    rider: textoDoCampo(dados, 'rider')
  };
}

/** Os seis campos da ficha técnica, com o rótulo que a tela usa. */
const FICHA_DA_ATIVIDADE: Array<[keyof CamposAtividade, string]> = [
  ['genero', 'gênero'],
  ['duracao', 'duração'],
  ['elenco', 'elenco'],
  ['classificacao', 'classificação'],
  ['local', 'local'],
  ['rider', 'o que precisa']
];

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * SÓ `titulo` É OBRIGATÓRIO, e isso espelha a tabela: `titulo text not
 * null`, todo o resto aceita nulo (002_conteudo.sql). E espelha o conteúdo
 * real: cinco das 11 atividades não têm resumo, seis não têm sinopse, nove
 * não têm rider. Exigir campo que a ONG não escreveu obrigaria a inventar
 * texto, que é a regra 2 do CLAUDE.md ao contrário.
 */
export function validarAtividade(campos: CamposAtividade): ResultadoValidacao {
  const erros: Record<string, string> = {};

  // O id vem do link que a própria lista do painel montou. Esta tela não
  // cria atividade: sem id, ou com id que nunca foi um apelido, alguém
  // montou a requisição à mão.
  if (!campos.id) {
    erros.id = 'Não foi possível saber qual atividade é esta. Volte à lista e abra pelo botão '
      + '"Editar".';
  } else if (!ehIdentificadorDeAtividade(campos.id)) {
    erros.id = 'Não foi possível identificar qual atividade é esta. Volte à lista e abra de novo.';
  }

  if (!campos.titulo) {
    erros.titulo = 'Escreva o nome da atividade.';
  } else if (campos.titulo.length > LIMITE_TITULO) {
    erros.titulo = `O nome passou de ${LIMITE_TITULO} caracteres. Encurte um pouco.`;
  }

  if (campos.resumo.length > LIMITE_RESUMO) {
    erros.resumo = `O resumo passou de ${LIMITE_RESUMO} caracteres. Ele é a frase curta que `
      + 'aparece antes da sinopse.';
  }

  if (campos.descricao.length > LIMITE_DESCRICAO) {
    erros.descricao = `A sinopse passou de ${LIMITE_DESCRICAO} caracteres.`;
  }

  for (const [campo, rotulo] of FICHA_DA_ATIVIDADE) {
    if (campos[campo].length > LIMITE_FICHA) {
      erros[campo] = `O campo "${rotulo}" passou de ${LIMITE_FICHA} caracteres. Ele é uma linha `
        + 'da ficha técnica, não um parágrafo.';
    }
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

// =====================================================================
// Contato — o formulário público de /contato (RF07)
//
// Mesmo lugar dos três blocos acima, pelo mesmo motivo escrito no cabeçalho
// deste arquivo: as três precauções de leitura de FormData valem igual, e
// este módulo não importa nada, o que é o que permite ao `node --test`
// exercitá-lo sem subir o Next.
//
// A DIFERENÇA QUE ESTE BLOCO TEM PARA OS OUTROS TRÊS, e ela muda o risco:
// os três anteriores são do PAINEL, atrás de `ehEquipe()`. Este é público —
// quem envia não tem conta, e a Server Action correspondente
// (acoes/contato.ts) NÃO chama `ehEquipe()`, de propósito. Então esta é a
// única barreira que existe antes do banco, e o que ela deixa passar chega
// a uma tabela com dado pessoal (RF29).
//
// OS CAMPOS SAEM DO ESQUEMA, não de gosto: `public.contatos` em
// supabase/migrations/004_pessoas.sql. `situacao` e `criado_em` são do
// banco; `origem` é escrita pelo servidor com o literal 'contato' (ver
// acoes/contato.ts e a função `registrar_contato` de
// 007_limite_por_visitante.sql), nunca pelo formulário — ela tem
// `check (origem in ('contato','escola','doacao','voluntariado'))` e deixar
// o corpo da requisição escolher sujaria o registro central de graça.
// =====================================================================

/**
 * O que o formulário de contato manda — e é a lista COMPLETA do que a
 * Action aceita. Campo que não está aqui não existe para o resto do
 * sistema.
 */
export type CamposContato = {
  nome: string;
  email: string;
  telefone: string;
  instituicao: string;
  mensagem: string;
  /** LGPD: o banco tem `check (consentimento_dados)` e recusa a linha sem. */
  consentimento: boolean;
};

/**
 * Tetos de tamanho — pelo mesmo motivo dos das publicações: as colunas são
 * `text` no Postgres (sem limite nenhum) e a Action é endpoint HTTP público
 * (spec §4.5), então sem um teto qualquer pessoa manda megabytes num campo.
 *
 * Os números são de uso:
 *  · 120 para o nome — o maior nome real de dados-iniciais/ tem 34;
 *  · 254 para o e-mail é o máximo que um endereço pode ter (RFC 5321), ou
 *    seja, recusar acima disso não recusa endereço legítimo nenhum;
 *  · 160 para a instituição cabe "EMEF" + nome de escola com folga;
 *  · 5.000 para a mensagem são cerca de duas páginas e meia. Quem precisa
 *    de mais que isso está mandando um anexo em texto, e o caminho para
 *    isso é o e-mail da ONG, que está na mesma página.
 */
export const LIMITE_NOME = 120;
export const LIMITE_EMAIL = 254;
export const LIMITE_INSTITUICAO = 160;
export const LIMITE_MENSAGEM = 5_000;

/**
 * Campos do formulário de contato (componentes/FormularioContato.tsx).
 *
 * Um a um, por nome, pelo motivo do bloco "Leitura do FormData". Aqui isso
 * tem uma consequência específica: `consentimento_dados` é a coluna que a
 * LGPD apoia e que o banco exige (`check (consentimento_dados)`). Espalhar
 * o FormData faria um `consentimento_dados=true` mandado no corpo valer
 * tanto quanto a caixa marcada por uma pessoa — que é exatamente a coisa
 * que um consentimento não pode ser.
 */
export function lerContato(dados: FormData): CamposContato {
  return {
    nome: textoDoCampo(dados, 'nome'),
    email: textoDoCampo(dados, 'email'),
    telefone: textoDoCampo(dados, 'telefone'),
    instituicao: textoDoCampo(dados, 'instituicao'),
    mensagem: textoDoCampo(dados, 'mensagem'),
    consentimento: marcado(dados, 'consentimento')
  };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * O QUE É OBRIGATÓRIO ESPELHA A TABELA, e nada além: `nome`, `email` e
 * `mensagem` são `not null` em `public.contatos`; `telefone` e
 * `instituicao` aceitam nulo. Pedir mais do que a ONG precisa para
 * responder seria coleta acima do mínimo (RNF09) numa tela que qualquer
 * pessoa abre.
 */
export function validarContato(campos: CamposContato): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.nome) {
    erros.nome = 'Escreva seu nome, para sabermos com quem estamos falando.';
  } else if (campos.nome.length > LIMITE_NOME) {
    erros.nome = `O nome passou de ${LIMITE_NOME} caracteres.`;
  }

  if (!campos.email || !FORMATO_EMAIL.test(campos.email)) {
    erros.email = 'Confira o e-mail: ele precisa ter um endereço completo, como nome@exemplo.com. '
      + 'É por ele que respondemos.';
  } else if (campos.email.length > LIMITE_EMAIL) {
    erros.email = `O e-mail passou de ${LIMITE_EMAIL} caracteres.`;
  }

  // Telefone é opcional (coleta mínima), mas se vier, vem completo — mesma
  // regra de validarCadastro(), e de propósito: duas regras de telefone no
  // mesmo site divergiriam.
  if (campos.telefone) {
    const digitos = apenasDigitos(campos.telefone);
    if (digitos.length < 10 || digitos.length > 11) {
      erros.telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344. '
        + 'Se preferir não deixar telefone, apague o campo — ele é opcional.';
    }
  }

  if (campos.instituicao.length > LIMITE_INSTITUICAO) {
    erros.instituicao = `O nome da instituição passou de ${LIMITE_INSTITUICAO} caracteres.`;
  }

  if (!campos.mensagem) {
    erros.mensagem = 'Escreva sua mensagem.';
  } else if (campos.mensagem.length > LIMITE_MENSAGEM) {
    erros.mensagem = `A mensagem passou de ${LIMITE_MENSAGEM} caracteres. Conte o essencial por `
      + 'aqui — a gente responde e continua a conversa por e-mail.';
  }

  // A caixa é obrigatória na tela E o banco recusa a linha sem ela
  // (`constraint consentimento_obrigatorio check (consentimento_dados)`,
  // 004_pessoas.sql). A recusa daqui existe para a pessoa ler uma frase em
  // vez de um erro de banco.
  if (!campos.consentimento) {
    erros.consentimento = 'Para enviar, precisamos que você concorde com o uso dos seus dados '
      + 'para responder esta mensagem. O que fazemos com eles está na política de privacidade.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

// =====================================================================
// Triagem das mensagens recebidas (RF29) — a OUTRA metade do formulário
// acima
//
// O bloco de cima é o que a pessoa de fora escreve; este é o que a equipe
// faz com o que chegou. As duas metades ficam no mesmo arquivo pelo motivo
// escrito no cabeçalho: leitura de FormData num lugar só, com as três
// precauções do bloco "Leitura do FormData" valendo igual.
//
// O QUE ESTE BLOCO NÃO DECIDE, e é a diferença para `lerAlternancia`:
// quais situações existem. Essa lista fechada mora em
// compartilhado/triagem-de-contatos.ts porque ela decide TRÊS coisas — os
// botões que a tela desenha, o que a Action aceita, e a ordem da lista —,
// e duas cópias divergiriam num botão que a Action recusa. Aqui só se LÊ.
// =====================================================================

/**
 * O que o botão de triagem manda: qual mensagem e para qual situação.
 *
 * Dois campos e mais nada. Nome, e-mail, telefone e o texto da mensagem
 * NÃO passam por aqui em caminho nenhum — o que a pessoa escreveu é
 * registro, e esta tela não edita registro (ver o cabeçalho de
 * acoes/contatos.ts). Um campo `mensagem` no corpo da requisição não tem
 * como chegar ao banco porque nada o lê.
 *
 * `situacao` volta como texto CRU, sem lista fechada: quem aplica a lista é
 * `ehSituacaoDeContato`, em compartilhado/triagem-de-contatos.ts. Ver o
 * bloco acima.
 */
export function lerMudancaDeSituacao(dados: FormData): { id: string; situacao: string } {
  return {
    id: textoDoCampo(dados, 'id'),
    situacao: textoDoCampo(dados, 'situacao')
  };
}

// =====================================================================
// Meus dados — o formulário da ÁREA DO USUÁRIO (RF11)
//
// A pessoa edita o PRÓPRIO registro de `public.perfis`. É a tela por onde
// uma escalada de privilégio entraria, porque `eh_equipe` mora na mesma
// linha da mesma tabela — e a regra 6 do CLAUDE.md existe porque essa
// escalada já aconteceu neste projeto uma vez.
//
// TRÊS CAMPOS, E O QUE FICA DE FORA É A PARTE IMPORTANTE. `lerMeusDados`
// conhece `nome`, `telefone` e `tipo_pessoa`, e mais nada. Um
// `eh_equipe=true` no corpo da requisição não tem caminho: ninguém o lê,
// então ele não existe para o resto do sistema (é a precaução 2 do bloco
// "Leitura do FormData"). O mesmo vale para `id` — QUAL linha é atualizada
// não vem do formulário em caminho nenhum, vem da sessão verificada
// (`usuarioAtual()`), em acoes/conta.ts.
//
// E `eh_voluntario`/`eh_doador` também ficam de fora, por outro motivo: a
// tela não os edita (a tarefa é nome, telefone e tipo de pessoa), então
// lê-los aqui criaria um caminho para o corpo da requisição mexer em coluna
// que a tela nem desenha.
// =====================================================================

/**
 * O que o formulário de "Meus dados" manda — e é a lista COMPLETA do que a
 * Action aceita.
 */
export type CamposMeusDados = {
  nome: string;
  telefone: string;
  /** '' significa "não quis dizer", e vira NULL na coluna. */
  tipo_pessoa: string;
};

/**
 * A LISTA FECHADA de `tipo_pessoa`, e ela decide DUAS coisas: as opções que
 * o `<select>` desenha e o que a Action aceita.
 *
 * Uma cópia só, porque duas divergiriam numa opção que a tela oferece e o
 * servidor recusa — ou pior, no contrário. Os valores são exatamente os do
 * `check (tipo_pessoa in ('fisica', 'juridica'))` de
 * supabase/migrations/001_base.sql; a coluna aceita nulo, e é daí que vem a
 * terceira opção.
 *
 * O texto de cada uma é do controle, não conteúdo institucional (regra 2 do
 * CLAUDE.md): um `<select>` sem rótulo em cada opção não é preenchível.
 */
export const TIPOS_DE_PESSOA: Array<{ valor: string; texto: string }> = [
  { valor: '', texto: 'Prefiro não dizer' },
  { valor: 'fisica', texto: 'Pessoa física' },
  { valor: 'juridica', texto: 'Organização (pessoa jurídica)' }
];

export function ehTipoDePessoa(valor: unknown): boolean {
  return TIPOS_DE_PESSOA.some((opcao) => opcao.valor === valor);
}

/**
 * Campos do formulário de "Meus dados" (componentes/FormularioMeusDados.tsx).
 *
 * Um a um, por nome. Ver o cabeçalho deste bloco para o que isso impede.
 */
export function lerMeusDados(dados: FormData): CamposMeusDados {
  return {
    nome: textoDoCampo(dados, 'nome'),
    telefone: textoDoCampo(dados, 'telefone'),
    tipo_pessoa: textoDoCampo(dados, 'tipo_pessoa')
  };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * O QUE É OBRIGATÓRIO ESPELHA A TABELA: `nome` é `not null` em
 * `public.perfis`; `telefone` e `tipo_pessoa` aceitam nulo. A regra do
 * telefone é a MESMA de `validarCadastro` e `validarContato`, de propósito
 * — três regras de telefone no mesmo site divergiriam, e a pessoa
 * descobriria isso ao ter um número aceito no cadastro e recusado aqui.
 */
export function validarMeusDados(campos: CamposMeusDados): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.nome) {
    erros.nome = 'Escreva seu nome. Ele é o que aparece no topo da tela quando você entra.';
  } else if (campos.nome.length > LIMITE_NOME) {
    erros.nome = `O nome passou de ${LIMITE_NOME} caracteres.`;
  }

  if (campos.telefone) {
    const digitos = apenasDigitos(campos.telefone);
    if (digitos.length < 10 || digitos.length > 11) {
      erros.telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344. '
        + 'Se preferir não deixar telefone, apague o campo — ele é opcional.';
    }
  }

  // Só acontece com quem monta a requisição à mão (a tela é um `<select>`
  // com estas três opções). A recusa existe para o valor não chegar ao
  // `check` do Postgres e voltar como erro de banco.
  if (!ehTipoDePessoa(campos.tipo_pessoa)) {
    erros.tipo_pessoa = 'Escolha uma das opções da lista.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS QUE VÃO PARA O `update`, montadas chave por chave.
 *
 * ESTA FUNÇÃO EXISTE PARA PODER SER MEDIDA. O objeto do `update` podia ser
 * escrito dentro de `acoes/conta.ts` como nas outras Actions do projeto —
 * mas aquele arquivo importa `server-only` e o Supabase, ou seja, não entra
 * num `node --test`. Aqui ele é uma função pura, e
 * `testes/minha-conta.test.mjs` a alimenta com um FormData hostil
 * (`eh_equipe=true`, `id=<outra pessoa>`, `eh_voluntario=true`) e prova que
 * NADA disso aparece no objeto que vai ao banco. Sem isto, a garantia da
 * regra 6 dependeria de alguém ler o código.
 *
 * Campo vazio vira NULL, e não string vazia: as duas colunas aceitam nulo, e
 * a tela OMITE o que é nulo (regra 2 do CLAUDE.md no nível do campo).
 * Guardar '' faria a ficha desenhar um rótulo sem valor — e, em
 * `tipo_pessoa`, '' nem passaria pelo `check` do Postgres.
 *
 * `telefone` guarda SÓ OS DÍGITOS, como `criarConta` já faz
 * (acoes/autenticacao.ts): a máscara é da tela, e gravar "(11) 95396-8344"
 * numa linha e "11953968344" na outra deixaria a mesma coluna com dois
 * formatos.
 */
export function colunasDoPerfil(campos: CamposMeusDados): {
  nome: string;
  telefone: string | null;
  tipo_pessoa: string | null;
} {
  return {
    nome: campos.nome,
    telefone: apenasDigitos(campos.telefone) || null,
    tipo_pessoa: campos.tipo_pessoa || null
  };
}

// =====================================================================
// Candidatura ao voluntariado (RF25)
//
// A pessoa escolhe uma ou mais das CINCO ÁREAS REAIS da ONG (RF24,
// `public.areas_voluntariado`) e, se quiser, escreve por quê. Grava em
// `public.voluntarios` + `public.voluntario_areas` (004_pessoas.sql).
//
// DOIS CAMPOS, E O QUE FICA DE FORA É A PARTE IMPORTANTE. `lerCandidatura`
// conhece `areas` e `mensagem`, e mais nada. Em particular:
//
//  · `perfil_id` — DE QUEM é a candidatura NÃO vem do formulário em
//    caminho nenhum. Vem da sessão verificada (`usuarioAtual()`), dentro
//    da Action. É a mesma disciplina de acoes/conta.ts, e aqui ela tem
//    prova: MEDIDO em 01/09/2026 contra o Supabase real, com sessão de
//    verdade, um insert com `perfil_id` de outra pessoa respondeu
//    `42501 new row violates row-level security policy for table
//    "voluntarios"` — a política `voluntarios: a pessoa se candidata`
//    (`with check (perfil_id = auth.uid())`) recusa. A leitura campo a
//    campo é a primeira trava; a RLS é a última;
//  · `situacao` — é o fluxo de atendimento da ONG ('novo' -> 'em_contato'
//    -> 'ativo'/'inativo'), não campo de quem se candidata. A política de
//    insert do banco NÃO diz nada sobre ela: quem monta a requisição à mão
//    poderia mandar `situacao=ativo` e nascer voluntário ativo sem
//    ninguém da ONG ter falado com a pessoa. Quem impede é esta leitura, e
//    `colunasDaCandidatura()` abaixo, que não conhece a coluna — nem para
//    escrever 'novo', que é o `default` dela. Mesma decisão de
//    acoes/contato.ts com `origem` e `situacao`.
//
// NÃO HÁ CAIXA DE CONSENTIMENTO AQUI, ao contrário de /contato, e a
// ausência é decisão: quem se candidata JÁ TEM CONTA, e o consentimento de
// uso de dados foi dado no cadastro (`validarCadastro`, RN01/LGPD). Uma
// segunda caixa sem coluna onde gravar — `public.voluntarios` não tem
// `consentimento_dados` — seria teatro: a tela pediria uma afirmação que
// nada registra.
// =====================================================================

/**
 * O que o formulário de candidatura manda — e é a lista COMPLETA do que a
 * Action aceita.
 */
export type CamposCandidatura = {
  /** Os `id` das áreas escolhidas, sem repetição. */
  areas: string[];
  /** Texto livre, opcional. '' significa "não quis escrever" e vira NULL. */
  mensagem: string;
};

/**
 * Teto da mensagem, pelo mesmo motivo dos outros: a coluna é `text` no
 * Postgres (sem limite nenhum) e a Action é endpoint HTTP público (spec
 * §4.5), então sem teto qualquer pessoa manda megabytes num campo.
 *
 * 2.000 é menor que os 5.000 de /contato de propósito. Lá a mensagem é a
 * coisa toda — pode ser um pedido de escola inteiro. Aqui ela é uma
 * apresentação: o que a ONG precisa para começar a conversa é a área e um
 * parágrafo. O resto acontece na conversa, que é o que a própria página
 * promete ("A gente lê sua candidatura e entra em contato").
 */
export const LIMITE_MOTIVO = 2_000;

/**
 * Campos do formulário de candidatura
 * (componentes/FormularioCandidatura.tsx).
 *
 * `areas` é o ÚNICO campo do site lido com `getAll()`, porque é o único
 * grupo de caixas de marcar que compartilham o mesmo `name` — é assim que
 * um formulário HTML manda "escolhi três das cinco". As três precauções do
 * bloco "Leitura do FormData" continuam valendo uma a uma:
 *
 *  1. `getAll()` devolve `(string | File)[]`: um File no meio viraria
 *     "[object File]" e iria ao banco como `area_id`. Por isso o
 *     `typeof === 'string'`;
 *  2. campo fora desta lista não existe para o resto do sistema;
 *  3. aqui não há caixa "ligada/desligada" para interpretar — o valor de
 *     cada caixa é o `id` da área, e o navegador só manda as marcadas.
 *     Por isso `marcado()` não serve, e não é usado.
 *
 * SEM REPETIÇÃO, e não é cosmético: `voluntario_areas` tem
 * `primary key (voluntario_id, area_id)`, então mandar a mesma área duas
 * vezes — trivial numa requisição montada à mão — faria o insert das áreas
 * falhar com violação de chave primária DEPOIS de a candidatura já estar
 * gravada. O `Set` resolve antes de sair daqui.
 *
 * O que NÃO é resolvido aqui é se cada id EXISTE: isso é
 * `validarCandidatura`, que precisa da lista real de áreas — ela vem do
 * banco, não de uma cópia versionada.
 */
export function lerCandidatura(dados: FormData): CamposCandidatura {
  const escolhidas = new Set<string>();

  for (const valor of dados.getAll('areas')) {
    if (typeof valor !== 'string') continue;
    const limpo = valor.trim();
    if (limpo) escolhidas.add(limpo);
  }

  return { areas: [...escolhidas], mensagem: textoDoCampo(dados, 'mensagem') };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * `idsDasAreas` são os `id` que EXISTEM em `public.areas_voluntariado`,
 * lidos do banco por quem chama. Não há cópia versionada deles neste
 * repositório de propósito: as cinco áreas são conteúdo da ONG (regra 2 do
 * CLAUDE.md) e podem mudar sem que ninguém toque no código.
 *
 * QUEM CHAMA NÃO PODE PASSAR LISTA VAZIA. Com `[]`, toda escolha vira
 * "essa área não está mais na lista" — uma frase que acusa a pessoa de um
 * defeito do servidor. É por isso que `acoes/voluntariado.ts` verifica se
 * a consulta das áreas DEGRADOU antes de chegar aqui, e responde outra
 * coisa nesse caso.
 *
 * Quem de fato impede um id inventado é a chave estrangeira
 * `area_id references public.areas_voluntariado(id)`, que responderia
 * `23503`. A validação daqui existe para a pessoa ler uma frase em vez de
 * um erro de banco — e para o erro não chegar DEPOIS de a candidatura já
 * estar gravada, que é a ordem em que as duas tabelas são escritas.
 */
export function validarCandidatura(
  campos: CamposCandidatura,
  idsDasAreas: string[]
): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (campos.areas.length === 0) {
    erros.areas = 'Escolha pelo menos uma área. É por ela que a gente sabe com quem falar '
      + 'primeiro — e dá para marcar mais de uma.';
  } else {
    const desconhecidas = campos.areas.filter((id) => !idsDasAreas.includes(id));
    if (desconhecidas.length > 0) {
      // Só acontece com quem monta a requisição à mão, ou com quem deixou
      // a página aberta enquanto a ONG mexia nas áreas. A frase serve aos
      // dois casos sem acusar ninguém.
      erros.areas = 'Uma das áreas escolhidas não está mais na lista. Atualize a página e '
        + 'escolha de novo.';
    }
  }

  if (campos.mensagem.length > LIMITE_MOTIVO) {
    erros.mensagem = `O texto passou de ${LIMITE_MOTIVO} caracteres. Conte o essencial por `
      + 'aqui — o resto a gente conversa quando entrar em contato.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS QUE VÃO PARA O `insert` de `public.voluntarios`, montadas
 * chave por chave.
 *
 * ESTA FUNÇÃO EXISTE PARA PODER SER MEDIDA, mesmo motivo de
 * `colunasDoPerfil()`: o objeto podia ser escrito dentro de
 * acoes/voluntariado.ts, mas aquele arquivo importa `server-only` e o
 * Supabase, ou seja, não entra num `node --test`. Aqui ele é uma função
 * pura, e testes/voluntariado.test.mjs a alimenta com um FormData hostil
 * (`situacao=ativo`, `perfil_id=<outra pessoa>`, `eh_equipe=true`) e prova
 * que nada disso aparece no objeto que vai ao banco.
 *
 * `perfil_id` é ARGUMENTO, e não campo: ele vem da sessão verificada. E
 * `situacao` não aparece nem como chave — nem para escrever 'novo', que é
 * o `default` da coluna. Escrever o default à mão seria abrir, no código,
 * o único lugar por onde essa coluna poderia passar a vir de fora.
 */
export function colunasDaCandidatura(
  campos: CamposCandidatura,
  perfilId: string
): { perfil_id: string; mensagem: string | null } {
  return { perfil_id: perfilId, mensagem: campos.mensagem || null };
}

/**
 * As linhas de `public.voluntario_areas` — a segunda tabela, escrita
 * depois de a candidatura existir e ter id.
 */
export function linhasDasAreas(
  voluntarioId: string,
  areas: string[]
): Array<{ voluntario_id: string; area_id: string }> {
  return areas.map((area) => ({ voluntario_id: voluntarioId, area_id: area }));
}

// =====================================================================
// Eventos — o formulário da agenda no painel (RF13/RF14)
//
// Mesmo arquivo das publicações, da galeria e da candidatura, pelo mesmo
// motivo escrito no cabeçalho: as três precauções de leitura de FormData
// valem igual, e este módulo NÃO IMPORTA NADA, o que é o que permite ao
// `node --test` exercitá-lo sem subir o Next. Um `compartilhado/fuso.ts`
// separado seria mais bonito e não funcionaria: o runtime nativo do Node não
// resolve o alias `@/...` do tsconfig, e um caminho relativo COM extensão
// (`./fuso.ts`) derruba o `tsc` do build, que não liga
// `allowImportingTsExtensions`.
//
// O QUE ESTE BLOCO NÃO DECIDE: se a pessoa pode gravar (isso é `ehEquipe()`
// na Action e a RLS no banco). E ele NÃO LÊ o campo `publicado`, pela mesma
// razão de `lerPublicacao`: publicar é ato separado, com Action e botão
// próprios.
//
// E ELE NÃO LÊ `vagas` NEM `exige_cpf`, que existem em `public.eventos`
// (003_eventos.sql) e ficam de fora DE PROPÓSITO: as duas só fazem sentido
// com inscrição, que é RF15/RF16 e não existe. Um campo "vagas" na tela da
// equipe prometeria à ONG um controle de vagas que o site não tem, e um
// número de vagas na agenda faria o público procurar um botão de se
// inscrever que não está lá.
// =====================================================================

/**
 * O FUSO DA ONG, PELA QUARTA VEZ NO PROJETO — e a repetição é consciente.
 *
 * `FUSO_DA_ONG` já existe em componentes/ListaEventos.ts,
 * componentes/ListaNoticias.ts e componentes/MinhaConta.ts, sempre com o
 * mesmo valor e sempre repetido, porque esses arquivos são importados pelo
 * runtime nativo do Node (ver o bloco acima). O que impede as cópias de
 * divergirem em silêncio é um teste que lê os arquivos como TEXTO e exige
 * que todos declarem o mesmo fuso: `testes/publicacoes.test.mjs` faz isso
 * com três deles, e `testes/eventos.test.mjs` faz com estes mais este
 * arquivo e o componente novo do painel.
 *
 * POR QUE ELE PRECISA ESTAR AQUI, e não só nos componentes que imprimem
 * data: o formulário de evento manda hora de PAREDE ("2026-11-05T19:00",
 * sem fuso nenhum), e é este arquivo que a transforma no instante que vai
 * para uma coluna `timestamptz`. Sem o fuso explícito,
 * `new Date('2026-11-05T19:00')` interpreta a string no fuso do PROCESSO —
 * que na Netlify é UTC. O evento das 19h seria gravado como 19:00Z, e a
 * agenda (que imprime em São Paulo, corretamente) o mostraria às 16:00.
 *
 * É o MESMO defeito medido no Bloco A, pelo outro lado: lá a LEITURA saía
 * três horas errada; aqui seria a ESCRITA. E este lado é pior, porque o
 * dado gravado fica errado para sempre — consertar a exibição depois não
 * conserta a linha.
 */
export const FUSO_DA_ONG = 'America/Sao_Paulo';

/**
 * O formato que um `<input type="datetime-local">` manda: hora de parede,
 * sem fuso.
 *
 * Os segundos são aceitos e ignorados: alguns navegadores os acrescentam
 * quando o `step` permite (o nosso não permite), e a Action é endpoint HTTP
 * público (spec §4.5) — o corpo pode vir de qualquer lugar.
 */
const FORMATO_MOMENTO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function ehMomentoLocal(valor: unknown): boolean {
  return typeof valor === 'string' && FORMATO_MOMENTO_LOCAL.test(valor);
}

/**
 * As partes de um instante, lidas NO FUSO DA ONG.
 *
 * `Intl.DateTimeFormat` com `timeZone` é a única forma, sem biblioteca
 * (regra 7 do CLAUDE.md), de perguntar "que horas eram em São Paulo neste
 * instante?" — `getHours()` responderia no fuso do processo, que é o defeito
 * que este bloco inteiro existe para não repetir.
 */
function partesEmSaoPaulo(instante: number): Record<string, number> {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DA_ONG,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  const partes: Record<string, number> = {};
  for (const parte of formatador.formatToParts(new Date(instante))) {
    if (parte.type !== 'literal') partes[parte.type] = Number(parte.value);
  }

  // `hour12: false` produz hora 24 em vez de 0 para a meia-noite em alguns
  // runtimes. Normalizar aqui é mais barato que descobrir isso em produção,
  // num evento marcado para 00:00.
  if (partes.hour === 24) partes.hour = 0;

  return partes;
}

/**
 * Quantos milissegundos o fuso da ONG está À FRENTE de UTC neste instante.
 * Negativo para São Paulo (-3 h).
 *
 * Depende do instante DE PROPÓSITO: o Brasil não tem horário de verão desde
 * 2019, mas ele já existiu e pode voltar por decreto. Uma constante `-3h`
 * escrita à mão acertaria hoje e envelheceria em silêncio — que é
 * exatamente a forma deste defeito.
 */
function deslocamentoDoFuso(instante: number): number {
  const p = partesEmSaoPaulo(instante);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instante;
}

/**
 * Hora de parede de São Paulo -> o instante ISO que vai para a coluna
 * `timestamptz`. `null` quando a string não é um momento válido.
 *
 * O ALGORITMO, porque ele parece complicado e o simples está errado:
 *
 *   1. `Date.UTC(...)` trata a hora escrita como se fosse UTC — uma primeira
 *      aproximação, errada por exatamente o deslocamento do fuso;
 *   2. mede-se o deslocamento NAQUELE instante e subtrai-se;
 *   3. repete-se uma vez. A segunda passada só muda alguma coisa perto de
 *      uma virada de horário de verão, onde o deslocamento do palpite e o do
 *      resultado são diferentes. Hoje, no Brasil, ela nunca muda nada — e é
 *      barata o bastante para ficar de pé no dia em que o decreto voltar.
 */
export function instanteDeSaoPaulo(local: string): string | null {
  const casou = FORMATO_MOMENTO_LOCAL.exec(local);
  if (!casou) return null;

  const [, ano, mes, dia, hora, minuto, segundo] = casou;

  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31
    || Number(hora) > 23 || Number(minuto) > 59) return null;

  const comoSeFosseUtc = Date.UTC(
    Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo ?? 0)
  );

  // `Date.UTC` aceita 31 de fevereiro e devolve 3 de março, calado. Uma data
  // assim chega de um corpo montado à mão (o seletor do navegador não a
  // produz), e gravá-la como OUTRO dia seria pior que recusar.
  if (new Date(comoSeFosseUtc).getUTCDate() !== Number(dia)) return null;

  let instante = comoSeFosseUtc;
  for (let passada = 0; passada < 2; passada += 1) {
    instante = comoSeFosseUtc - deslocamentoDoFuso(instante);
  }

  return new Date(instante).toISOString();
}

/**
 * O caminho de volta: o instante gravado -> a hora de parede que o
 * `<input type="datetime-local">` mostra ao reabrir o formulário.
 *
 * Sem isto, editar um evento das 19h num servidor em UTC devolveria "22:00"
 * no campo, e quem apertasse "Guardar alterações" sem mexer em nada
 * empurraria o evento três horas para a frente — a cada edição.
 */
export function momentoLocalDe(iso: string): string {
  const instante = new Date(iso).getTime();
  if (Number.isNaN(instante)) return '';

  const p = partesEmSaoPaulo(instante);
  const doisDigitos = (n: number) => String(n).padStart(2, '0');

  return `${p.year}-${doisDigitos(p.month)}-${doisDigitos(p.day)}`
    + `T${doisDigitos(p.hour)}:${doisDigitos(p.minute)}`;
}

/**
 * O que o formulário de evento manda — a lista COMPLETA do que a Action
 * aceita. Campo que não está aqui não existe para o resto do sistema.
 *
 * Os campos espelham exatamente o tipo `Evento` de servidor/dados/eventos.ts:
 * tudo o que a equipe escreve aqui a agenda mostra, e nada do que ela
 * escreve fica invisível. `imagem_caminho`/`imagem_alt` ficam de fora como
 * em `lerPublicacao` (upload é assunto da galeria); `vagas` e `exige_cpf`,
 * pelo motivo do bloco acima.
 */
export type CamposEvento = {
  /** Vazio quando é evento novo; o uuid da linha quando é edição. */
  id: string;
  titulo: string;
  descricao: string;
  /** Hora de parede de São Paulo, como o `<input datetime-local>` manda. */
  comeca_em: string;
  termina_em: string;
  local: string;
  faixa_etaria: string;
};

/**
 * Limites de tamanho. Como em `lerPublicacao`, eles NÃO vêm do banco (as
 * colunas são `text`, sem limite nenhum): vêm do uso, e existem porque a
 * Action é endpoint HTTP público — sem teto, qualquer pessoa manda megabytes
 * num campo.
 */
export const LIMITE_LOCAL = 200;
export const LIMITE_FAIXA_ETARIA = 80;

/** Campos do formulário de evento (componentes/FormularioEvento.tsx). */
export function lerEvento(dados: FormData): CamposEvento {
  return {
    id: textoDoCampo(dados, 'id'),
    titulo: textoDoCampo(dados, 'titulo'),
    descricao: textoDoCampo(dados, 'descricao'),
    comeca_em: textoDoCampo(dados, 'comeca_em'),
    termina_em: textoDoCampo(dados, 'termina_em'),
    local: textoDoCampo(dados, 'local'),
    faixa_etaria: textoDoCampo(dados, 'faixa_etaria')
  };
}

/** TODOS os erros de uma vez — a regra do topo deste arquivo. */
export function validarEvento(campos: CamposEvento): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.titulo) {
    erros.titulo = 'Escreva o nome do evento.';
  } else if (campos.titulo.length > LIMITE_TITULO) {
    erros.titulo = `O nome passou de ${LIMITE_TITULO} caracteres. Encurte um pouco.`;
  }

  const comeco = campos.comeca_em ? instanteDeSaoPaulo(campos.comeca_em) : null;

  if (!campos.comeca_em) {
    erros.comeca_em = 'Diga o dia e a hora em que o evento começa.';
  } else if (comeco === null) {
    erros.comeca_em = 'Não entendi o dia e a hora. Use o seletor do celular, ou escreva no '
      + 'formato 05/11/2026 19:00.';
  }

  // `termina_em` é opcional: a coluna aceita nulo, e a maior parte do que a
  // ONG marca não tem hora de terminar combinada.
  if (campos.termina_em) {
    const fim = instanteDeSaoPaulo(campos.termina_em);

    if (fim === null) {
      erros.termina_em = 'Não entendi o dia e a hora de terminar. Use o seletor do celular, '
        + 'ou deixe em branco.';
    } else if (comeco !== null && fim <= comeco) {
      // A MESMA REGRA DO BANCO (`termino_depois_do_inicio`, em
      // 003_eventos.sql), conferida aqui para virar uma frase. Sem isto o
      // Postgres recusaria com violação de `check` (código 23514), que a
      // tela mostraria como falha genérica — e a pessoa não teria como saber
      // qual dos dois campos consertar.
      erros.termina_em = 'O evento não pode terminar antes de começar (nem no mesmo minuto). '
        + 'Confira a hora de terminar, ou deixe em branco.';
    }
  }

  if (campos.descricao.length > LIMITE_DESCRICAO) {
    erros.descricao = `A descrição passou de ${LIMITE_DESCRICAO} caracteres.`;
  }

  if (campos.local.length > LIMITE_LOCAL) {
    erros.local = `O local passou de ${LIMITE_LOCAL} caracteres. Escreva só o endereço ou o `
      + 'nome do lugar.';
  }

  if (campos.faixa_etaria.length > LIMITE_FAIXA_ETARIA) {
    erros.faixa_etaria = `Passou de ${LIMITE_FAIXA_ETARIA} caracteres. É uma frase curta, como `
      + '"Livre" ou "A partir de 10 anos".';
  }

  // Edição: o id vem do link que a própria lista do painel montou. Se chegou
  // preenchido e não é um uuid, alguém montou a requisição à mão — a Action
  // recusa em vez de perguntar ao Postgres.
  if (campos.id && !ehIdentificador(campos.id)) {
    erros.id = 'Não foi possível identificar qual evento é este. Volte à lista e abra de novo.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS QUE VÃO PARA `public.eventos`, montadas chave por chave.
 *
 * ESTA FUNÇÃO EXISTE PARA PODER SER MEDIDA, mesmo motivo de
 * `colunasDaCandidatura()` e `colunasDoPerfil()`: o objeto podia ser escrito
 * dentro de acoes/eventos.ts, mas aquele arquivo importa `server-only` e o
 * Supabase, ou seja, não entra num `node --test`. Aqui ele é função pura, e
 * testes/eventos.test.mjs a alimenta com um FormData HOSTIL
 * (`publicado=true`, `vagas=999`, `exige_cpf=true`, `id` de outro evento) e
 * prova que nada disso aparece no objeto que vai ao banco.
 *
 * `publicado` NÃO É CHAVE DAQUI — nem para escrever `false`, que é o default
 * da coluna. Escrever o default à mão abriria, no código, o único lugar por
 * onde essa coluna poderia passar a vir de fora. É a disciplina da regra 6
 * do CLAUDE.md aplicada a outro campo.
 *
 * Texto vazio vira NULL, e não string vazia: as colunas aceitam nulo e a
 * agenda OMITE o que é nulo (componentes/ListaEventos.ts — regra 2 do
 * CLAUDE.md no nível do campo). Guardar '' faria a página desenhar um
 * parágrafo vazio e deixar um " · " solto no horário.
 *
 * Devolve `null` se a data de começo não converter. Não lança: esta função é
 * chamada depois de `validarEvento`, e duplicar a recusa como exceção só
 * criaria um segundo caminho de erro para manter.
 */
export function colunasDoEvento(campos: CamposEvento): {
  titulo: string;
  descricao: string | null;
  comeca_em: string;
  termina_em: string | null;
  local: string | null;
  faixa_etaria: string | null;
} | null {
  const comeca = instanteDeSaoPaulo(campos.comeca_em);
  if (comeca === null) return null;

  return {
    titulo: campos.titulo,
    descricao: campos.descricao || null,
    comeca_em: comeca,
    termina_em: campos.termina_em ? instanteDeSaoPaulo(campos.termina_em) : null,
    local: campos.local || null,
    faixa_etaria: campos.faixa_etaria || null
  };
}

// O botão de publicar/tirar do ar de EVENTO reaproveita `lerAlternancia`
// (lista fechada 'publicar' | 'despublicar'), que já lê o mesmo par de
// campos escondidos em notícias, galeria e atividades. Não há leitura nova
// aqui de propósito: uma segunda cópia da mesma lista fechada seria uma
// segunda chance de alguém trocá-la por um `else`.

// =====================================================================
// Acervo — o formulário de publicar material (RF36/RF37)
//
// Mesmo lugar dos blocos acima, pelo mesmo motivo escrito no cabeçalho
// deste arquivo: as três precauções de leitura de FormData valem igual, e
// este módulo não importa nada, o que é o que permite ao `node --test`
// exercitá-lo sem subir o Next.
//
// O QUE ESTE BLOCO NÃO DECIDE: se a pessoa pode gravar (isso é `ehEquipe()`
// na Action e a RLS no banco) e se o arquivo é MESMO um PDF — a resposta a
// essa depende de LER OS BYTES, e quem lê é a Action; o que mora aqui é a
// decisão pura sobre os bytes já lidos (`tipoDoDocumento`).
//
// E ele NÃO LÊ o campo `publicado`, pela mesma razão de `lerPublicacao` e
// `lerMidia`: subir não é publicar. O material entra guardado e sai disso
// por um botão separado.
//
// A DIFERENÇA PARA A GALERIA, que decide duas coisas do desenho:
//
//   1. NÃO HÁ RN07 AQUI. Material de acervo é documento feito para
//      circular — cartilha, ficha técnica, portfólio —, não foto de
//      pessoa. Não existe caixa de autorização de uso de imagem nesta
//      tela, e inventar uma seria pedir uma declaração que não se aplica.
//   2. O BUCKET `acervo` É PÚBLICO E CONTINUA ASSIM (006_storage.sql), ao
//      contrário do `galeria`, que virou privado em 008. É de propósito:
//      o arquivo daqui é feito para ser baixado por qualquer pessoa, sem
//      cadastro — é o que /acervo promete, em texto, desde o site antigo.
//      A consequência que precisa estar escrita: material GUARDADO ou
//      TIRADO DO AR continua baixável por quem tiver o endereço. Quem
//      subiu o arquivo errado precisa APAGAR, não tirar do ar — e é por
//      isso que esta tela tem apagar, como a da galeria e ao contrário da
//      de notícias.
// =====================================================================

/**
 * O TETO DE TAMANHO DE UM MATERIAL, e ele é DERIVADO do teto da galeria de
 * propósito: a causa dos dois é a mesma, e ela não é nossa.
 *
 * MEDIDO em 01/09/2026, com PDF de verdade (os do acervo tratado da ONG,
 * repetidos até o tamanho alvo), `next build` + `next start`, POST
 * multipart cru para uma Server Action:
 *
 *   3 MB -> 200   4 MB -> 200   5 MB -> 200   5,5 MB -> 200
 *   6 MB -> 200   7 MB -> 200   7,5 MB -> 200
 *   8 MB -> 500 (Internal Server Error, texto puro)   9 MB -> 500
 *
 * Ou seja: com `serverActions.bodySizeLimit: '8mb'` (next.config.ts, com a
 * tabela da medição da Tarefa P3) o Next local aceitaria material de até
 * ~7,5 MB. **O LIMITE NÃO É O NEXT — É A PLATAFORMA**: a Netlify tem limite
 * próprio de corpo de função (6 MB documentados, já contando a codificação
 * que ela usa para entregar o corpo), e esta branch NUNCA foi publicada
 * (CLAUDE.md, "O que trava hoje", item 0). 4 MB binários viram ~5,3 MB
 * codificados, o que cabe; 6 MB binários viram ~8 MB, o que não cabe.
 *
 * Por isso o número é o MESMO da galeria e sai do MESMO lugar: no dia em
 * que alguém medir o limite real da Netlify (subindo um arquivo de ~3,5 MB
 * pelo painel, no primeiro deploy), UMA edição corrige as duas telas. Se as
 * duas divergirem um dia, será por medição, não por descuido.
 *
 * O QUE ISSO CUSTA, dito em voz alta e com nome próprio: dos materiais que
 * a ONG já tem tratados (233 MB reduzidos a 27 MB, fora deste repositório),
 * **"Eu Griot .pdf" (5,3 MiB) não passa por esta tela**. Os outros passam.
 * A recusa é uma frase que diz o tamanho, o limite e o que fazer — não um
 * erro. As saídas para esse caso estão no relatório da tarefa: reduzir o
 * PDF, ou subir pelo painel do Supabase e cadastrar a linha por lá.
 */
export const LIMITE_MATERIAL_BYTES = LIMITE_ARQUIVO_BYTES;

/** Tema: rótulo curto, como o nome do álbum da galeria. */
export const LIMITE_TEMA = 80;

// LIMITE_FAIXA_ETARIA NÃO é declarado de novo aqui, e a colisão foi real:
// eventos (RF13) e acervo (RF37) foram construídos em paralelo, em worktrees
// separados, e os dois criaram a mesma constante com o mesmo valor (80). O
// build acusou "defined multiple times" no merge. Unificado na declaração
// que já existe lá em cima, junto de LIMITE_LOCAL — o valor é o mesmo e o
// motivo também: é um rótulo curto que a pessoa digita, e a Action é
// endpoint público, então precisa de teto.  A faixa etária de um evento e a
// de um material de acervo podem divergir um dia; no dia em que divergirem,
// o conserto é dar nomes diferentes, não duplicar este.

/**
 * O que o acervo aceita, POR ASSINATURA DE BYTES — mesma disciplina de
 * `ASSINATURAS` (imagens) e pelo mesmo motivo, que está escrito lá em cima:
 * `accept` é sugestão para o seletor de arquivos e `File.type` vem do
 * cliente; os dois são entrada de usuário.
 *
 * SÓ PDF, e é decisão com prazo de validade: os materiais que a ONG
 * entregou são todos PDF. Acrescentar um tipo aqui é uma linha — e é o
 * único lugar que precisa mudar, porque o `accept` do input e a mensagem de
 * recusa saem daqui.
 *
 * A ASSINATURA É EXIGIDA NO COMEÇO DO ARQUIVO, sem tolerância a lixo antes
 * dela. A especificação do PDF permite bytes antes do `%PDF-` e muitos
 * leitores toleram; aqui a exigência é estrita de propósito — um arquivo
 * assim não sai de nenhum editor que a ONG use, e afrouxar significaria
 * aceitar qualquer arquivo que ESCONDA um PDF dentro.
 */
type AssinaturaDeDocumento = { tipo: string; extensao: string; bytes: number[] };

const ASSINATURAS_DE_DOCUMENTO: AssinaturaDeDocumento[] = [
  // "%PDF-" — os cinco bytes com que todo PDF começa.
  { tipo: 'application/pdf', extensao: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }
];

export type DocumentoReconhecido = { tipo: string; extensao: string };

/**
 * O arquivo é um material que aceitamos? Devolve o tipo e a extensão, ou
 * `null` — e `null` é a resposta para .doc, .zip, .exe, imagem, vídeo e
 * para um .txt renomeado para .pdf.
 *
 * Recebe os bytes já lidos, e não o File, pelo mesmo motivo de
 * `tipoDaImagem`: assim a decisão é pura e cabe num teste do Node.
 *
 * NÃO É ANTIVÍRUS e não afirma que o arquivo é seguro: afirma que ele
 * COMEÇA como um PDF.
 */
export function tipoDoDocumento(bytes: Uint8Array): DocumentoReconhecido | null {
  for (const assinatura of ASSINATURAS_DE_DOCUMENTO) {
    if (bytes.length < assinatura.bytes.length) continue;
    if (assinatura.bytes.every((byte, i) => bytes[i] === byte)) {
      return { tipo: assinatura.tipo, extensao: assinatura.extensao };
    }
  }

  return null;
}

/** O `accept` do input — a MESMA lista das assinaturas. */
export const TIPOS_DE_MATERIAL_ACEITOS = ASSINATURAS_DE_DOCUMENTO.map((a) => a.tipo).join(',');

/**
 * O caminho do material DENTRO do bucket `acervo`.
 *
 * Reaproveita `caminhoNoBucket` inteiro — a mesma lista branca de
 * caracteres, o mesmo uuid, a mesma extensão vinda dos BYTES. O que muda é
 * só a pasta padrão quando não há tema: "material" em vez de "album".
 *
 * E AQUI O UUID IMPORTA MAIS QUE NA GALERIA, não menos: o bucket `acervo` é
 * PÚBLICO de propósito, então o caminho é a única coisa entre um arquivo
 * guardado e quem quiser baixá-lo. Nome de arquivo NÃO entra — o nome que
 * vem do computador de quem envia carregaria, por exemplo, o nome de uma
 * pessoa para dentro de uma URL pública.
 */
export function caminhoDoMaterial(
  tema: string,
  extensao: string,
  identificador: string
): string {
  return caminhoNoBucket(tema || 'material', extensao, identificador);
}

export type CamposMaterial = {
  /** Vazio quando é envio novo; o uuid da linha quando é gesto sobre uma existente. */
  id: string;
  titulo: string;
  descricao: string;
  tema: string;
  faixaEtaria: string;
  /** O arquivo, ou null quando não veio nada (ou veio texto no lugar). */
  arquivo: File | null;
};

/**
 * Campos do formulário de subir material (componentes/FormularioMaterial.tsx).
 *
 * Um a um, por nome. `publicado` e `downloads` são colunas da tabela e NÃO
 * estão aqui: a primeira decide o que o público vê, a segunda é contagem —
 * nenhuma das duas pode entrar pelo corpo da requisição (regra 6 do
 * CLAUDE.md).
 *
 * `tamanho_bytes` também não é campo: ele é medido do arquivo recebido, na
 * Action. Aceitá-lo do formulário deixaria a ficha do material mentir sobre
 * o tamanho do download — que é justamente o número que alguém em rede de
 * celular usa para decidir se baixa agora.
 */
export function lerMaterial(dados: FormData): CamposMaterial {
  const enviado = dados.get('arquivo');

  return {
    id: textoDoCampo(dados, 'id'),
    titulo: textoDoCampo(dados, 'titulo'),
    descricao: textoDoCampo(dados, 'descricao'),
    tema: textoDoCampo(dados, 'tema'),
    faixaEtaria: textoDoCampo(dados, 'faixa_etaria'),
    // `instanceof File` e tamanho zero tratado como ausência — mesma
    // precaução de `lerMidia`, e pelo mesmo motivo.
    arquivo: enviado instanceof File && enviado.size > 0 ? enviado : null
  };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * O QUE É OBRIGATÓRIO, E POR QUÊ: título e arquivo, só. Tema e faixa etária
 * são os dois campos de FILTRO da página pública (`FiltrosAcervo`, em
 * servidor/dados/acervo.ts) e o cartão omite o que for nulo — exigi-los
 * faria a equipe inventar um tema para conseguir publicar, que é a regra 2
 * do CLAUDE.md pelo avesso. A descrição é opcional pelo mesmo motivo.
 */
export function validarMaterial(campos: CamposMaterial): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.titulo) {
    erros.titulo = 'Escreva o nome do material — é o que aparece na lista do acervo, e é por '
      + 'ele que as pessoas procuram.';
  } else if (campos.titulo.length > LIMITE_TITULO) {
    erros.titulo = `O nome passou de ${LIMITE_TITULO} caracteres. Encurte um pouco.`;
  }

  if (campos.descricao.length > LIMITE_RESUMO) {
    erros.descricao = `A descrição passou de ${LIMITE_RESUMO} caracteres. Ela é a explicação `
      + 'curta que aparece embaixo do nome — o conteúdo inteiro está no próprio arquivo.';
  }

  if (campos.tema.length > LIMITE_TEMA) {
    erros.tema = `O tema passou de ${LIMITE_TEMA} caracteres. Ele é um rótulo curto.`;
  }

  if (campos.faixaEtaria.length > LIMITE_FAIXA_ETARIA) {
    erros.faixa_etaria = `A faixa etária passou de ${LIMITE_FAIXA_ETARIA} caracteres.`;
  }

  if (!campos.arquivo) {
    erros.arquivo = 'Escolha o arquivo do material.';
  } else if (campos.arquivo.size > LIMITE_MATERIAL_BYTES) {
    erros.arquivo = `Este arquivo tem ${emMegabytes(campos.arquivo.size)} e o limite é `
      + `${emMegabytes(LIMITE_MATERIAL_BYTES)}. Um PDF costuma caber depois de reduzido — no `
      + 'celular, procure "comprimir PDF"; no computador, "salvar como PDF reduzido". Se ele '
      + 'não couber de jeito nenhum, fale com quem cuida do site: dá para subir por outro '
      + 'caminho.';
  }

  if (campos.id && !ehIdentificador(campos.id)) {
    erros.id = 'Não foi possível identificar qual material é este. Volte ao acervo e abra de novo.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS QUE VÃO PARA O `insert` de `public.acervo`, montadas chave por
 * chave.
 *
 * Existe como função pura pelo mesmo motivo de `colunasDaCandidatura()`:
 * escrita dentro de acoes/acervo.ts ela não entraria num `node --test`, e é
 * justamente aqui que se prova que `publicado`, `downloads` e um
 * `arquivo_caminho` vindo do corpo da requisição NÃO chegam ao banco.
 *
 * `publicado` não aparece nem como chave — a coluna é `not null default
 * false` (002_conteudo.sql), e é a AUSÊNCIA dela que faz o material nascer
 * guardado. Escrever `false` à mão abriria, no código, o único lugar por
 * onde essa coluna poderia passar a vir de fora.
 *
 * `arquivo_caminho` e `tamanho_bytes` são ARGUMENTOS, não campos: o
 * primeiro é construído por `caminhoDoMaterial` (uuid nosso, extensão vinda
 * dos bytes) e o segundo é medido do arquivo recebido.
 *
 * Texto vazio vira NULL, não string vazia: a coluna aceita nulo e o cartão
 * do acervo OMITE o que é nulo (componentes/ListaMateriais.ts). Guardar ''
 * faria a ficha desenhar um "Tema" em branco.
 */
export function colunasDoMaterial(
  campos: CamposMaterial,
  arquivoCaminho: string,
  tamanhoBytes: number
): {
  titulo: string;
  descricao: string | null;
  tema: string | null;
  faixa_etaria: string | null;
  arquivo_caminho: string;
  tamanho_bytes: number;
} {
  return {
    titulo: campos.titulo,
    descricao: campos.descricao || null,
    tema: campos.tema || null,
    faixa_etaria: campos.faixaEtaria || null,
    arquivo_caminho: arquivoCaminho,
    tamanho_bytes: tamanhoBytes
  };
}

/**
 * O NOME COM QUE O ARQUIVO CHEGA NA PASTA DE DOWNLOADS de quem baixa.
 *
 * Nasceu com o RF36 e existe por um defeito concreto: o caminho no bucket é
 * `<tema>/<uuid>.pdf` (`caminhoDoMaterial`, logo acima), então sem isto o
 * material da ONG chegaria ao computador de uma professora como
 * "b3f1c2d4-....pdf" — impossível de reconhecer no meio de dez downloads.
 * O nome sai do TÍTULO, que é o que a pessoa acabou de ler na tela.
 *
 * Passa pela mesma lista branca de `caminhoNoBucket`, e não por gosto: este
 * texto vai para dentro de um `Content-Disposition` (o parâmetro
 * `?download=` do Storage) e para o nome de um arquivo no disco de outra
 * pessoa — dois lugares onde barra, aspas, quebra de linha e caractere de
 * controle são problema de segurança, não de estética.
 *
 * A extensão vem do CAMINHO GUARDADO, que por sua vez veio dos bytes no
 * momento do envio (`tipoDoDocumento`): assim ela continua descrevendo o
 * arquivo de verdade, mesmo que o título mude depois.
 */
export function nomeParaBaixar(titulo: string, caminho: string): string {
  const extensao = caminho.includes('.') ? caminho.split('.').pop()! : '';
  const limpo = extensao.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);

  const base = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${base || 'material'}${limpo ? `.${limpo}` : ''}`;
}
