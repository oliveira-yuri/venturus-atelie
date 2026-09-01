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
