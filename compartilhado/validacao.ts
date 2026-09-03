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
  /**
   * Pessoa fisica ou juridica (pedido V1). A coluna `tipo_pessoa` de
   * `public.perfis` sempre aceitou os dois valores e /minha-conta ja
   * deixava trocar — mas o CADASTRO nao perguntava, e `acoes/autenticacao
   * .ts` gravava 'fisica' fixo. Uma escola ou empresa que se cadastrasse
   * entrava como pessoa fisica e so' descobria depois, na area da conta.
   *
   * A lista fechada e' a MESMA de `TIPOS_DE_PESSOA`, la' embaixo, que ja'
   * servia /minha-conta: duas listas para a mesma coluna divergiriam, e
   * uma delas desenharia opcao que o `check` do Postgres recusa.
   */
  tipo_pessoa?: string;
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

  // Tipo de pessoa (pedido V1). LISTA FECHADA, e a MESMA que
  // /minha-conta usa: `ehTipoDePessoa` confere contra `TIPOS_DE_PESSOA`,
  // que por sua vez e' reconciliada com o `check` de 001_base.sql por
  // testes/minha-conta.test.mjs. Sem esta trava, um corpo hostil mandaria
  // `tipo_pessoa=equipe` e o insert quebraria no banco em vez de na tela.
  //
  // OBRIGATORIO, e nao opcional com padrao 'fisica': o padrao silencioso
  // era exatamente o defeito relatado — uma escola se cadastrava e virava
  // pessoa fisica sem nunca ver a pergunta.
  if (!ehTipoDePessoaDeclarado(dados.tipo_pessoa)) {
    erros.tipo_pessoa = 'Escolha se a conta é de uma pessoa ou de uma instituição.';
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
    tipo_pessoa: textoDoCampo(dados, 'tipo_pessoa'),
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
  /** O arquivo enviado, quando houver. `FormDataEntryValue` porque é o que o FormData devolve. */
  arquivo?: FormDataEntryValue | null;
  imagem_alt?: string;
  /** O caminho já gravado, para não se perder ao editar só o texto. */
  imagem_atual?: string;
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
    corpo: textoDoCampo(dados, 'corpo'),
    // A IMAGEM (pedido V1). `arquivo` é o File; `imagem_alt` é a descrição
    // que a coluna exige quando há imagem (`check` de 002_conteudo.sql).
    // `imagem_atual` é o caminho que já está gravado, e vem num campo
    // escondido: sem ele, editar o texto de uma notícia com imagem
    // apagaria a imagem.
    arquivo: dados.get('arquivo'),
    imagem_alt: textoDoCampo(dados, 'imagem_alt'),
    imagem_atual: textoDoCampo(dados, 'imagem_atual')
  };
}

/** TODOS os erros de uma vez — a regra do topo deste arquivo. */
export function validarPublicacao(campos: CamposPublicacao): ResultadoValidacao {
  const erros: Record<string, string> = {};

  // A DESCRIÇÃO DA IMAGEM É OBRIGATÓRIA QUANDO HÁ IMAGEM (pedido V1).
  //
  // O `check` de 002_conteudo.sql já recusa a linha sem alt — mas recusar
  // no banco significa a equipe perder o texto que acabou de escrever e
  // ler um erro de Postgres. A validação aqui devolve o formulário
  // preenchido, com a mensagem no campo certo.
  //
  // Acessibilidade é requisito (regra 8): imagem sem alt é imagem que não
  // existe para quem usa leitor de tela.
  const temArquivoNovo = campos.arquivo instanceof File && campos.arquivo.size > 0;
  const temImagem = temArquivoNovo || Boolean(campos.imagem_atual);

  if (temImagem && !campos.imagem_alt?.trim()) {
    erros.imagem_alt = 'Descreva a imagem em uma frase, para quem não pode vê-la. '
      + 'Exemplo: "crianças sentadas em roda ouvindo uma história".';
  }

  if (temArquivoNovo && (campos.arquivo as File).size > LIMITE_ARQUIVO_BYTES) {
    erros.arquivo = mensagemDeArquivoGrande((campos.arquivo as File).size);
  }

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

/**
 * A frase de "esta foto é grande demais", num lugar só.
 *
 * Ela nasceu em `validarMidia` e passou a ser usada também pela imagem da
 * notícia e pela capa do projeto (pedido V1). Três cópias divergiriam — e
 * a instrução do meio ("procure a opção de enviar em tamanho médio") é o
 * que de fato desatasca a pessoa, então perder essa parte numa das cópias
 * seria perder a única frase útil.
 */
export function mensagemDeArquivoGrande(tamanho: number): string {
  return `Esta foto tem ${emMegabytes(tamanho)} e o limite é `
    + `${emMegabytes(LIMITE_ARQUIVO_BYTES)}. No celular, ao escolher a foto, procure a opção `
    + 'de enviar em tamanho médio (ou "otimizado") em vez do tamanho real — a foto continua '
    + 'boa para o site e cabe no limite.';
}

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
    erros.arquivo = mensagemDeArquivoGrande(campos.arquivo.size);
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
  /**
   * Qual atividade. VAZIO quando é uma atividade NOVA (pedido V1: "criar
   * na página do admin um botão para Adicionar projeto").
   *
   * Era "NUNCA vazio: esta tela não cria", e a mudança tem preço — está
   * escrita no cabeçalho de `acoes/atividades.ts` e no item 0k do
   * CLAUDE.md: uma atividade criada pelo painel existe SÓ no banco, e o
   * JSON versionado não a conhece.
   */
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
  /** O arquivo enviado, quando houver. Ver `CamposPublicacao`. */
  arquivo?: FormDataEntryValue | null;
  imagem_alt?: string;
  imagem_atual?: string;
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

/**
 * O apelido (`id`) de uma atividade NOVA, derivado do título.
 *
 * =====================================================================
 * POR QUE DERIVAR, E NÃO GERAR UM UUID
 * =====================================================================
 *
 * `atividades.id` é `text`, e as onze do seed têm apelidos escritos à mão
 * pela ONG: "banzo", "cafu-e-o-cafe", "brasil-negreiro". Desde o pedido V1
 * esse id é também o ENDEREÇO da página — `/projetos/banzo`.
 *
 * Um uuid daria `/projetos/8f14e45f-...`, que não se lê, não se dita por
 * telefone e não diz nada a quem recebe o link. Derivar do título mantém a
 * forma que a ONG já usa, e o endereço continua sendo uma frase.
 *
 * =====================================================================
 * COLISÃO É RECUSADA, NÃO CONTORNADA
 * =====================================================================
 *
 * Duas atividades com o mesmo nome dariam o mesmo apelido. Esta função NÃO
 * acrescenta sufixo nem número: quem grava é `acoes/atividades.ts`, com um
 * `insert` simples, e o Postgres recusa pela chave primária. A equipe lê
 * "já existe uma atividade com um nome parecido" e decide — que é melhor
 * que ganhar um `/projetos/banzo-2` sem entender de onde ele veio.
 *
 * O resultado passa por `ehIdentificadorDeAtividade` antes de ir ao banco:
 * um título só de emoji, ou só de pontuação, produz string vazia — e a
 * Action recusa em vez de gravar uma linha com id vazio.
 */
export function apelidoDeAtividade(titulo: string): string {
  return String(titulo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITE_ID_ATIVIDADE);
}

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
    rider: textoDoCampo(dados, 'rider'),
    // A CAPA (pedido V1, migration 009). Mesma trinca da notícia — ver
    // `lerPublicacao` para o porquê de `imagem_atual` existir.
    arquivo: dados.get('arquivo'),
    imagem_alt: textoDoCampo(dados, 'imagem_alt'),
    imagem_atual: textoDoCampo(dados, 'imagem_atual')
  };
}

/**
 * Os seis campos da ficha técnica, com o rótulo que a tela usa.
 *
 * O tipo é a UNIÃO EXPLÍCITA dos seis, e não `keyof CamposAtividade`: desde
 * que o tipo ganhou os campos da capa (que são opcionais e um deles é um
 * File), `keyof` passou a incluir chaves cujo valor não tem `.length` — e o
 * laço abaixo, que mede tamanho de texto, deixou de compilar. Listar os
 * seis é mais verboso e diz a verdade: a ficha técnica é ESTES seis.
 */
type CampoDaFicha = 'genero' | 'duracao' | 'elenco' | 'classificacao' | 'local' | 'rider';

const FICHA_DA_ATIVIDADE: Array<[CampoDaFicha, string]> = [
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

  // ID VAZIO É ATIVIDADE NOVA (pedido V1), e não mais um erro. Quando ele
  // vem, ainda precisa ser um apelido válido: `id` é `text` no Postgres,
  // então nem o banco reclamaria do formato, e um id com barra ou espaço
  // viraria uma URL que não resolve.
  if (campos.id && !ehIdentificadorDeAtividade(campos.id)) {
    erros.id = 'Não foi possível identificar qual atividade é esta. Volte à lista e abra de novo.';
  }

  // A DESCRIÇÃO DA CAPA É OBRIGATÓRIA QUANDO HÁ CAPA — mesma regra da
  // notícia, e o `check` da migration 009 recusa a linha sem ela. Validar
  // aqui devolve o formulário preenchido em vez de um erro de Postgres.
  const temArquivoNovo = campos.arquivo instanceof File && campos.arquivo.size > 0;
  const temImagem = temArquivoNovo || Boolean(campos.imagem_atual);

  if (temImagem && !campos.imagem_alt?.trim()) {
    erros.imagem_alt = 'Descreva a imagem em uma frase, para quem não pode vê-la. '
      + 'Exemplo: "cena do espetáculo, com o ator tocando um berimbau".';
  }

  if (temArquivoNovo && (campos.arquivo as File).size > LIMITE_ARQUIVO_BYTES) {
    erros.arquivo = mensagemDeArquivoGrande((campos.arquivo as File).size);
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
 * As mesmas opções, MENOS "Prefiro não dizer" — as duas que a coluna
 * `tipo_pessoa` de fato guarda.
 *
 * ===================================================================
 * POR QUE DUAS LISTAS, SE O ARQUIVO INTEIRO PREGA QUE UMA SÓ
 * ===================================================================
 *
 * Porque são duas REGRAS diferentes sobre a mesma coluna, e não duas
 * cópias da mesma:
 *
 *   · /minha-conta é EDIÇÃO de um dado que já existe, e a coluna aceita
 *     nulo. Tirar "Prefiro não dizer" de lá tiraria de quem já recusou o
 *     direito de continuar recusando — mudança de comportamento que
 *     ninguém pediu;
 *   · o CADASTRO é onde o dado nasce, e o pedido V1 é explícito: "na hora
 *     do usuário criar conta ele deve inserir o tipo de pessoa: física ou
 *     jurídica". Aceitar vazio ali seria o padrão silencioso de novo, só
 *     que com outra cara.
 *
 * A derivação é o que impede a divergência: esta lista é FILTRADA da
 * outra, então acrescentar um terceiro tipo no banco alcança as duas.
 */
export const TIPOS_DE_PESSOA_DECLARADOS = TIPOS_DE_PESSOA.filter((opcao) => opcao.valor !== '');

export function ehTipoDePessoaDeclarado(valor: unknown): boolean {
  return TIPOS_DE_PESSOA_DECLARADOS.some((opcao) => opcao.valor === valor);
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

// =====================================================================
// Doações (RF19–RF22) — as TRÊS metades de um ciclo só
//
// Sim, três. Um formulário público (a oferta, RF19), um da equipe que
// responde e registra o recebido (RF20/RF21) e um da equipe que registra
// uma doação que chegou POR FORA do site (também RF21). Os três leem
// FormData, então os três moram aqui, com as três precauções do bloco
// "Leitura do FormData" valendo uma a uma.
//
// O QUE ESTE BLOCO NÃO DECIDE, e é a diferença para `lerAlternancia`:
// quais tipos e quais situações existem. Essas listas fechadas moram em
// compartilhado/doacoes.ts porque decidem TRÊS coisas — as opções que a
// tela desenha, o que a Action aceita e a ordem da fila —, e duas cópias
// divergiriam numa opção que a Action recusa. Aqui só se LÊ.
//
// ===================================================================
// A COLUNA `situacao` NÃO É LIDA DE FORMULÁRIO PÚBLICO EM CAMINHO NENHUM
// ===================================================================
//
// `lerOferta` conhece DOIS campos, `tipo` e `descricao`, e mais nada.
// `situacao` nasce do `default 'ofertada'` da coluna; `perfil_id` vem da
// sessão verificada, como argumento; `valor`, `resposta`, `respondida_em`
// e `recebida_em` são da equipe. É a regra 6 do CLAUDE.md aplicada a outro
// campo: um `situacao=recebida` no corpo da requisição faria a própria
// pessoa declarar entregue uma doação que ninguém recebeu — e isso
// apareceria na fila da ONG como trabalho já feito.
// =====================================================================

/**
 * O que o formulário público de oferta manda — e é a lista COMPLETA do que
 * a Action `ofertar` aceita.
 */
export type CamposOferta = {
  /**
   * 'item' ou 'recurso_financeiro'. Texto CRU: quem aplica a lista fechada
   * é compartilhado/doacoes.ts.
   */
  tipo: string;
  /** Texto livre: o que a pessoa quer doar (RF19). */
  descricao: string;
};

/**
 * Teto da descrição, pelo mesmo motivo dos outros: a coluna é `text` no
 * Postgres (sem limite nenhum) e a Action é endpoint HTTP público (spec
 * §4.5), então sem teto qualquer pessoa manda megabytes num campo.
 *
 * 2.000 é o mesmo de `LIMITE_MOTIVO` e pelo mesmo raciocínio: isto começa
 * uma conversa, não a substitui. O que a ONG precisa para responder "dá
 * para receber?" cabe num parágrafo — e a própria /doar promete que o
 * resto se combina junto.
 */
export const LIMITE_OFERTA = 2_000;

/** Teto da resposta que a equipe escreve (RF20). Mesma conta da oferta. */
export const LIMITE_RESPOSTA = 2_000;

/**
 * Campos do formulário de oferta (componentes/FormularioOferta.tsx).
 *
 * Um a um, por nome. Aqui isso tem uma consequência específica, escrita no
 * bloco acima: `situacao` e `valor` não são lidos em caminho nenhum, então
 * um corpo com `situacao=recebida&valor=5000` não tem como chegar ao banco
 * — não porque alguém os filtre, mas porque nada os lê.
 */
export function lerOferta(dados: FormData): CamposOferta {
  return {
    tipo: textoDoCampo(dados, 'tipo'),
    descricao: textoDoCampo(dados, 'descricao')
  };
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * `tiposValidos` é a lista de compartilhado/doacoes.ts, passada por quem
 * chama. Não é importada aqui porque ESTE ARQUIVO NÃO IMPORTA NADA (ver o
 * cabeçalho) — e a inversão tem o mesmo efeito de `validarCandidatura`
 * com as áreas: a lista fechada continua sendo uma só.
 */
export function validarOferta(campos: CamposOferta, tiposValidos: string[]): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.tipo) {
    erros.tipo = 'Escolha se você quer doar um item ou dinheiro. É por aí que a gente sabe '
      + 'como responder.';
  } else if (!tiposValidos.includes(campos.tipo)) {
    // Só acontece com quem monta a requisição à mão. A frase não acusa
    // ninguém e diz o que fazer.
    erros.tipo = 'Essa opção não existe. Atualize a página e escolha de novo.';
  }

  if (!campos.descricao) {
    erros.descricao = 'Conte o que você quer doar. Pode ser em poucas palavras — é isso que a '
      + 'gente lê para responder se conseguimos receber.';
  } else if (campos.descricao.length > LIMITE_OFERTA) {
    erros.descricao = `O texto passou de ${LIMITE_OFERTA} caracteres. Conte o essencial por `
      + 'aqui — o resto a gente combina quando responder.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS QUE VÃO PARA O `insert` de `public.doacoes`, montadas chave
 * por chave.
 *
 * ESTA FUNÇÃO EXISTE PARA PODER SER MEDIDA, mesmo motivo de
 * `colunasDaCandidatura()`: o objeto podia ser escrito dentro de
 * acoes/doacoes.ts, mas aquele arquivo importa `server-only` e o Supabase,
 * ou seja, não entra num `node --test`. Aqui ele é função pura, e
 * testes/doacoes.test.mjs a alimenta com um FormData hostil
 * (`situacao=recebida`, `valor=99999`, `perfil_id=<outra pessoa>`,
 * `doador_nome=...`) e prova que nada disso aparece no objeto.
 *
 * `perfil_id` é ARGUMENTO, e vem da sessão verificada. `situacao` não
 * aparece nem como chave — nem para escrever 'ofertada', que é o `default`
 * da coluna: escrever o default à mão seria abrir, no código, o único
 * lugar por onde essa coluna poderia passar a vir de fora. Mesma regra que
 * `salvarPublicacao` aplica a `publicado` e `salvarAtividade` também.
 *
 * `doador_nome`/`doador_email` TAMBÉM ficam de fora, e por outro motivo:
 * quem oferta pelo site tem conta, e o nome dela está em `public.perfis`.
 * Gravar uma segunda cópia aqui criaria duas respostas para "quem é esta
 * pessoa" — e a que veio do formulário seria a editável por quem manda a
 * requisição. Aquelas duas colunas existem para a doação que a EQUIPE
 * registra de alguém sem conta (`colunasDoRegistro`, abaixo).
 */
export function colunasDaOferta(
  campos: CamposOferta,
  perfilId: string
): { perfil_id: string; tipo: string; descricao: string } {
  return { perfil_id: perfilId, tipo: campos.tipo, descricao: campos.descricao };
}

// ---------------------------------------------------------------------
// Dinheiro: uma função de leitura, e o que ela recusa de propósito
// ---------------------------------------------------------------------

/**
 * O maior valor que `numeric(12, 2)` guarda: 10 dígitos antes da vírgula.
 *
 * O TETO É O DA COLUNA, e não um número "razoável" escolhido por quem
 * escreve o código. A tentação era limitar a, digamos, um milhão — nenhuma
 * doação ao Ateliê passaria disso, e um teto baixo pegaria erro de
 * digitação. Recusado: um teto inventado recusa dado legítimo no dia em
 * que a ONG receber um patrocínio grande, e o erro de digitação tem
 * conserto (a mesma tela grava de novo). Recusar o que o banco aceitaria
 * seria a tela mentindo sobre o sistema.
 */
export const LIMITE_VALOR = 9_999_999_999.99;

/**
 * Só a forma BRASILEIRA de escrever dinheiro, e a recusa do resto é
 * deliberada.
 *
 * Aceita: `1234`, `1234,56`, `1.234`, `1.234,56`, `12.345.678,90`.
 * Recusa: `1234.56`, `1.2345`, `1,234.56`, `12.34.56`.
 *
 * POR QUE NÃO ACEITAR TAMBÉM O PONTO COMO DECIMAL: `1.500` é ambíguo — mil
 * e quinhentos para quem digitou em português, um e meio para quem digitou
 * em inglês. Um palpite errado aqui grava R$ 1,50 onde a ONG recebeu
 * R$ 1.500,00, e NADA na tela acusaria: o número aparece bonitinho,
 * formatado, errado por mil vezes. Entre adivinhar e pedir para escrever de
 * novo, pedir é a única opção honesta — e a mensagem de erro mostra o
 * formato.
 */
const FORMATO_VALOR = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/;

/**
 * O valor em reais que a equipe digitou, como número — ou `null` se o
 * campo estiver vazio, e `NaN` se não for um valor escrito na forma acima.
 *
 * TRÊS DESFECHOS, e o do meio é o que costuma faltar: vazio é legítimo (o
 * campo é opcional, e doação de item não tem valor), texto inválido é erro
 * da pessoa, e número é número. Uma função que devolvesse `0` para os dois
 * primeiros gravaria "R$ 0,00" onde a resposta certa era "não sei" — e a
 * tela de quem doou desenharia isso como se a doação não valesse nada.
 */
export function numeroDoValor(texto: string): number | null {
  const limpo = texto.replace(/^R\$\s*/i, '').trim();
  if (!limpo) return null;
  if (!FORMATO_VALOR.test(limpo)) return Number.NaN;

  return Number(limpo.replace(/\./g, '').replace(',', '.'));
}

// ---------------------------------------------------------------------
// A análise da equipe (RF20) e o registro do recebido (RF21)
// ---------------------------------------------------------------------

/**
 * A lista fechada de situações que a análise aceita.
 *
 * DUPLICATA APARENTE de compartilhado/doacoes.ts, e não é: este arquivo
 * NÃO IMPORTA NADA, por construção (ver o cabeçalho), então a lista tem de
 * ser escrita aqui ou passada como argumento. `validarOferta` recebe os
 * tipos como argumento; aqui isso encheria a assinatura de listas, e a
 * função é chamada de dois lugares.
 *
 * O QUE IMPEDE AS DUAS DE DIVERGIREM: `testes/doacoes.test.mjs` reconcilia
 * esta constante com `SITUACOES_DA_DOACAO` E com o `check` da coluna, lido
 * de supabase/migrations/004_pessoas.sql. Três fontes, uma verdade, e a
 * suíte fica vermelha se qualquer uma andar sozinha.
 */
export const SITUACOES_ACEITAS_NA_ANALISE = ['ofertada', 'aceita', 'recusada', 'recebida'];

/**
 * "Não mudar por enquanto" — o valor que RESPONDE SEM MEXER NA SITUAÇÃO.
 *
 * ===================================================================
 * ISTO CONSERTA UM DEFEITO, NÃO ACRESCENTA UM ENFEITE
 * ===================================================================
 *
 * Até aqui, responder e mudar a situação eram o MESMO gesto: o `<select>`
 * era obrigatório, então a equipe não conseguia mandar um recado ("dá para
 * trazer na terça?") sem também declarar a doação aceita, recusada ou
 * recebida. O pedido V1 relatou exatamente isso: "GAP na resposta do admin
 * para o user sem mudança de status da solicitação".
 *
 * ===================================================================
 * O VALOR NÃO EXISTE NO BANCO, E NÃO PODE EXISTIR
 * ===================================================================
 *
 * `doacoes.situacao` tem `check (situacao in ('ofertada', 'aceita',
 * 'recusada', 'recebida'))` em 004_pessoas.sql. 'manter' não é uma quinta
 * situação: é a AUSÊNCIA de mudança, e por isso `colunasDaAnalise` deixa a
 * coluna FORA do objeto do update quando ele chega — o Postgres nunca o vê.
 *
 * Um valor que a tela oferece e o banco não conhece só é seguro assim: se
 * ele escapasse para o `update`, o insert falharia no `check` e a equipe
 * leria um erro de banco no lugar de uma resposta enviada. Há teste que
 * falha se `colunasDaAnalise` voltar a incluir a coluna nesse caso.
 */
export const MANTER_SITUACAO = 'manter';

/**
 * O que a tela de resposta manda — e é a lista COMPLETA do que a Action
 * `responderDoacao` aceita.
 *
 * `descricao` NÃO ESTÁ AQUI, e a ausência é a decisão mais importante deste
 * bloco: o que a pessoa escreveu é REGISTRO. Editá-lo seria falsificar o
 * que alguém ofereceu à ONG — a mesma regra de acoes/contatos.ts, e a mesma
 * tentação (a tela de atendimento é justamente onde dá vontade de "arrumar
 * o texto"). Um campo `descricao` no corpo da requisição não tem caminho
 * porque nada o lê.
 *
 * `respondida_em` e `recebida_em` também não: são carimbos, e quem os
 * decide é `colunasDaAnalise` a partir da linha que já está no banco.
 */
export type CamposAnalise = {
  id: string;
  /** Texto CRU: a lista fechada é aplicada por `validarAnalise`. */
  situacao: string;
  /** A resposta da ONG, que quem doou lê em /minha-conta. */
  resposta: string;
  /** O que de fato entrou, em reais. Texto CRU — `numeroDoValor` converte. */
  valor: string;
};

export function lerAnalise(dados: FormData): CamposAnalise {
  return {
    id: textoDoCampo(dados, 'id'),
    situacao: textoDoCampo(dados, 'situacao'),
    resposta: textoDoCampo(dados, 'resposta'),
    valor: textoDoCampo(dados, 'valor')
  };
}

/**
 * TODOS os erros de uma vez.
 *
 * `tipoDaLinha` é o `tipo` da doação COMO ESTÁ NO BANCO, não como veio no
 * formulário: quem oferece escolhe o tipo uma vez, e a tela da equipe não
 * o edita. É ele que decide se o campo de valor faz sentido.
 *
 * ===================================================================
 * DUAS REGRAS QUE PARECEM CHATICE E NÃO SÃO
 * ===================================================================
 *
 *  1. RECUSAR EXIGE ESCREVER O MOTIVO. "A ONG não conseguiu receber", sem
 *     mais nada, é o que a pessoa vê em /minha-conta — e ela ficaria sem
 *     saber se o problema foi o item, o momento ou o espaço. A /doar
 *     promete o contrário ("Respondemos dizendo se conseguimos receber e
 *     combinamos juntos a entrega"), e uma recusa muda é essa promessa
 *     quebrada. Nas outras três situações a resposta é opcional: aceitar e
 *     receber já dizem o essencial sozinhas;
 *  2. VALOR SÓ EM DOAÇÃO DE DINHEIRO. Um valor pendurado numa doação de
 *     item apareceria na tela de quem doou como "Item · R$ 300,00", o que
 *     ninguém prometeu e ninguém avaliou — a ONG não é avaliadora de bens.
 *     A recusa é do CAMPO, com a frase dizendo por quê, e não um
 *     apagamento silencioso.
 */
export function validarAnalise(campos: CamposAnalise, tipoDaLinha: string): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.situacao) {
    erros.situacao = 'Escolha em que pé está esta doação.';
  } else if (campos.situacao !== MANTER_SITUACAO
    && !SITUACOES_ACEITAS_NA_ANALISE.includes(campos.situacao)) {
    erros.situacao = 'Essa situação não existe. Atualize a página e escolha de novo.';
  }

  if (campos.resposta.length > LIMITE_RESPOSTA) {
    erros.resposta = `A resposta passou de ${LIMITE_RESPOSTA} caracteres. O resto se conversa `
      + 'por WhatsApp ou e-mail, que é onde a pessoa deixou o contato.';
  } else if (campos.situacao === MANTER_SITUACAO && !campos.resposta) {
    // Manter a situação E não escrever nada é um envio que não faz coisa
    // nenhuma. Dizer isso é melhor que gravar um update vazio e responder
    // "guardado".
    erros.resposta = 'Para responder sem mudar a situação, escreva a resposta. '
      + 'Sem texto e sem mudança, este envio não faria nada.';
  } else if (campos.situacao === 'recusada' && !campos.resposta) {
    erros.resposta = 'Escreva por que não dá para receber desta vez. Quem ofereceu lê esta '
      + 'resposta em "Sua conta", e uma recusa sem motivo é a pior notícia possível.';
  }

  const valor = numeroDoValor(campos.valor);

  if (Number.isNaN(valor)) {
    erros.valor = 'Escreva o valor com vírgula, como 1.234,56 — ou deixe em branco se não '
      + 'houver valor em dinheiro.';
  } else if (valor !== null && valor > LIMITE_VALOR) {
    erros.valor = 'Esse valor é maior do que o sistema guarda. Confira se não sobrou um zero.';
  } else if (valor !== null && tipoDaLinha !== 'recurso_financeiro') {
    erros.valor = 'Esta doação foi ofertada como item, não como dinheiro — não há valor a '
      + 'registrar. Deixe o campo em branco.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS DO `update` de `public.doacoes`, montadas chave por chave.
 *
 * ===================================================================
 * OS DOIS CARIMBOS, E POR QUE ELES DEPENDEM DA LINHA ATUAL
 * ===================================================================
 *
 * Mesma disciplina de `publicado_em` em acoes/publicacoes.ts, e pelo mesmo
 * motivo — só que aqui são dois:
 *
 *  · `respondida_em` é carimbado SÓ SE ainda for nulo, na primeira vez que
 *    a doação sai de "ofertada". Corrigir a resposta depois não é responder
 *    de novo, e recarimbar apagaria quando a ONG de fato respondeu;
 *  · `recebida_em` é carimbado SÓ SE ainda for nulo, quando a situação vira
 *    "recebida". E ele NUNCA é apagado: se a equipe voltar a situação para
 *    "aceita" por engano, a data fica, porque ela é um fato — aquela doação
 *    chegou naquele dia. Apagá-la seria destruir informação num gesto sem
 *    desfazer, num celular, de pé (regra 4 do CLAUDE.md).
 *
 * `agora` é ARGUMENTO, e não `new Date()` aqui dentro: é o que torna esta
 * função pura e mensurável sem relógio de mentira.
 *
 * `valor` VIRA null QUANDO O CAMPO ESTÁ VAZIO, e isso é apagamento
 * deliberado: a equipe que digitou um valor errado precisa poder tirá-lo.
 * `validarAnalise` já garantiu que ele só existe em doação de dinheiro.
 */
export function colunasDaAnalise(
  campos: CamposAnalise,
  atual: { respondida_em: string | null; recebida_em: string | null },
  agora: string
): {
  situacao?: string;
  resposta: string | null;
  valor: number | null;
  respondida_em: string | null;
  recebida_em: string | null;
} {
  const manter = campos.situacao === MANTER_SITUACAO;
  const jaRespondeu = manter || campos.situacao !== 'ofertada';
  const valor = numeroDoValor(campos.valor);

  return {
    // A COLUNA SAI DO OBJETO quando a equipe escolheu não mudar. Não é
    // `situacao: null` nem `situacao: 'manter'`: os dois quebrariam o
    // `check` de 004_pessoas.sql, e a equipe leria um erro de banco no
    // lugar de uma resposta enviada. Ver MANTER_SITUACAO.
    ...(manter ? {} : { situacao: campos.situacao }),
    resposta: campos.resposta || null,
    valor: valor !== null && !Number.isNaN(valor) ? valor : null,
    // Responder JÁ É responder, mesmo sem mudar a situação — por isso
    // `manter` carimba a data como qualquer outra resposta.
    respondida_em: atual.respondida_em ?? (jaRespondeu ? agora : null),
    recebida_em: atual.recebida_em ?? (campos.situacao === 'recebida' ? agora : null)
  };
}

// ---------------------------------------------------------------------
// A doação que chegou POR FORA do site (RF21)
// ---------------------------------------------------------------------

/**
 * O que a tela de registro manda — e é a lista COMPLETA do que a Action
 * `registrarDoacao` aceita.
 *
 * ESTA É A OUTRA PONTA DA DECISÃO "OFERTAR EXIGE CONTA". Quem não tem
 * conta fala com a ONG pelo WhatsApp, pelo e-mail ou na porta da sede, e é
 * a equipe que registra — usando `doador_nome`/`doador_email`, as duas
 * colunas que a migration criou exatamente para isso ("Doacao registrada
 * pela equipe pode nao ter perfil: veio de fora do site", 004_pessoas.sql).
 * Sem esta tela, aquelas colunas seriam letra morta e o RF21 valeria só
 * para quem tem login.
 *
 * `perfil_id` NÃO É CAMPO, em caminho nenhum: ele fica nulo aqui. Lê-lo do
 * formulário deixaria a equipe (ou quem montasse a requisição) pendurar uma
 * doação na conta de qualquer pessoa — e essa doação apareceria em
 * /minha-conta dela, como se ela tivesse doado.
 */
export type CamposRegistro = {
  doador_nome: string;
  doador_email: string;
  /** Texto CRU: quem aplica a lista fechada é quem chama `validarRegistro`. */
  tipo: string;
  descricao: string;
  /** Texto CRU — `numeroDoValor` converte. */
  valor: string;
};

export function lerRegistro(dados: FormData): CamposRegistro {
  return {
    doador_nome: textoDoCampo(dados, 'doador_nome'),
    doador_email: textoDoCampo(dados, 'doador_email'),
    tipo: textoDoCampo(dados, 'tipo'),
    descricao: textoDoCampo(dados, 'descricao'),
    valor: textoDoCampo(dados, 'valor')
  };
}

/**
 * TODOS os erros de uma vez.
 *
 * O QUE É OBRIGATÓRIO ESPELHA A TABELA, e nada além. `doador_nome` é
 * obrigatório porque a linha não entra sem ele: `constraint
 * identificacao_obrigatoria check (perfil_id is not null or (doador_nome is
 * not null and length(trim(doador_nome)) > 0))`, e aqui `perfil_id` é nulo
 * por construção. `doador_email` é opcional — muita doação chega de gente
 * que só deixou um WhatsApp, e exigir e-mail faria a equipe inventar um.
 */
export function validarRegistro(
  campos: CamposRegistro,
  tiposValidos: string[]
): ResultadoValidacao {
  const erros: Record<string, string> = {};

  if (!campos.doador_nome) {
    erros.doador_nome = 'Escreva quem doou. Sem isso a doação não pode ser guardada — é o '
      + 'único jeito de saber de quem ela é, já que essa pessoa não tem conta no site.';
  } else if (campos.doador_nome.length > LIMITE_NOME) {
    erros.doador_nome = `O nome passou de ${LIMITE_NOME} caracteres.`;
  }

  if (campos.doador_email) {
    if (!FORMATO_EMAIL.test(campos.doador_email)) {
      erros.doador_email = 'Confira o e-mail, ou apague o campo — ele é opcional.';
    } else if (campos.doador_email.length > LIMITE_EMAIL) {
      erros.doador_email = `O e-mail passou de ${LIMITE_EMAIL} caracteres.`;
    }
  }

  if (!campos.tipo) {
    erros.tipo = 'Escolha se foi um item ou dinheiro.';
  } else if (!tiposValidos.includes(campos.tipo)) {
    erros.tipo = 'Essa opção não existe. Atualize a página e escolha de novo.';
  }

  if (!campos.descricao) {
    erros.descricao = 'Escreva o que foi doado.';
  } else if (campos.descricao.length > LIMITE_OFERTA) {
    erros.descricao = `O texto passou de ${LIMITE_OFERTA} caracteres.`;
  }

  const valor = numeroDoValor(campos.valor);

  if (Number.isNaN(valor)) {
    erros.valor = 'Escreva o valor com vírgula, como 1.234,56 — ou deixe em branco se não '
      + 'houver valor em dinheiro.';
  } else if (valor !== null && valor > LIMITE_VALOR) {
    erros.valor = 'Esse valor é maior do que o sistema guarda. Confira se não sobrou um zero.';
  } else if (valor !== null && campos.tipo !== 'recurso_financeiro') {
    erros.valor = 'Isto foi registrado como item, não como dinheiro — não há valor a guardar. '
      + 'Deixe o campo em branco, ou troque o tipo para dinheiro.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * AS COLUNAS DO `insert` da doação registrada pela equipe.
 *
 * `situacao: 'recebida'` e `recebida_em` são ESCRITOS À MÃO aqui, e isso é
 * o contrário do que `colunasDaOferta` faz de propósito. A diferença não é
 * de gosto: lá o valor viria de um formulário PÚBLICO, e escrever a coluna
 * abriria o caminho para o corpo da requisição decidir a situação. Aqui o
 * literal é da TELA — ela se chama "registrar doação recebida" e existe
 * para o que já chegou. Nada no FormData influencia estas duas chaves:
 * `lerRegistro` não lê `situacao` nem `recebida_em` em caminho nenhum.
 *
 * `perfil_id` fica FORA (nulo por omissão): ver o comentário de
 * `CamposRegistro`.
 *
 * `respondida_em` também é carimbado: do ponto de vista de quem doou, a
 * conversa aconteceu — só aconteceu fora do site.
 */
export function colunasDoRegistro(
  campos: CamposRegistro,
  agora: string
): {
  doador_nome: string;
  doador_email: string | null;
  tipo: string;
  descricao: string;
  valor: number | null;
  situacao: string;
  respondida_em: string;
  recebida_em: string;
} {
  const valor = numeroDoValor(campos.valor);

  return {
    doador_nome: campos.doador_nome,
    doador_email: campos.doador_email || null,
    tipo: campos.tipo,
    descricao: campos.descricao,
    valor: valor !== null && !Number.isNaN(valor) ? valor : null,
    situacao: 'recebida',
    respondida_em: agora,
    recebida_em: agora
  };
}

// =====================================================================
// Inscrição em evento SEM CONTA (RF15)
//
// A DIFERENÇA PARA TODO O RESTO DESTE ARQUIVO: esta é a segunda tela do
// projeto que qualquer pessoa do mundo alcança sem sessão (a outra é
// /contato), e é a ÚNICA que grava dado de CRIANÇA. `public.inscricoes`
// guarda nome, e-mail, telefone, CPF e — quando a pessoa inscrita é menor
// de idade — nome e telefone de quem responde por ela.
//
// Três consequências que valem estar escritas aqui e não só no cabeçalho
// da tabela:
//
//  · a validação abaixo é a ÚNICA barreira antes da gravação, porque não
//    há guarda de sessão para segurar nada (Server Action é endpoint HTTP
//    público — spec §4.5);
//  · `eh_menor` NÃO é um campo de conveniência da tela: ele decide se o
//    banco vai exigir responsável (`responsavel_obrigatorio_para_menor`,
//    RN02). Marcar a caixa aumenta o que é pedido, nunca diminui — por
//    isso não há caminho em que ela seja ignorada;
//  · `autoriza_imagem` é a RN07 registrada no momento da inscrição, e ela
//    é OPCIONAL de propósito: exigir autorização de imagem para participar
//    de uma oficina condicionaria o acesso à arte à cessão da própria
//    imagem, o que esta ONG não faz. Não marcada significa "não autorizou",
//    e é assim que a equipe vê na lista.
// =====================================================================

export type CamposInscricao = {
  /** De qual evento. Vem de campo escondido, e é conferido como uuid. */
  eventoId: string;
  nome: string;
  email: string;
  telefone: string;
  /** RN06: só é pedido quando o evento declara `exige_cpf`. */
  cpf: string;
  /** RN02: quando verdadeiro, o responsável passa a ser obrigatório. */
  ehMenor: boolean;
  responsavelNome: string;
  responsavelTelefone: string;
  /** RN07, registrada na inscrição. Opcional — ver o cabeçalho do bloco. */
  autorizaImagem: boolean;
  /** LGPD: o banco tem `check (consentimento_dados)` e recusa a linha sem. */
  consentimento: boolean;
};

/**
 * Os tetos. `LIMITE_NOME` e `LIMITE_EMAIL` são reaproveitados do bloco de
 * contato de propósito — duas regras de tamanho de nome no mesmo site
 * divergiriam, e o campo é o mesmo campo.
 *
 * O do responsável é o mesmo do nome pela mesma razão: é um nome.
 */
export const LIMITE_RESPONSAVEL = LIMITE_NOME;

/**
 * Campos do formulário de inscrição (componentes/FormularioInscricao.tsx).
 *
 * Um a um, por nome. Aqui isso tem uma consequência que não existe nas
 * outras telas: `public.inscricoes` NÃO tem coluna que um corpo hostil
 * queira forjar (não há `eh_equipe`, não há `situacao`) — o que ele
 * ganharia espalhando o FormData seria escrever `criado_em` e `id`. Por
 * isso a leitura campo a campo aqui protege menos, e mesmo assim é feita
 * igual: a regra vale para o arquivo inteiro, e uma exceção seria o começo
 * do fim dela.
 */
export function lerInscricao(dados: FormData): CamposInscricao {
  return {
    eventoId: textoDoCampo(dados, 'evento_id'),
    nome: textoDoCampo(dados, 'nome'),
    email: textoDoCampo(dados, 'email'),
    telefone: textoDoCampo(dados, 'telefone'),
    cpf: textoDoCampo(dados, 'cpf'),
    ehMenor: marcado(dados, 'eh_menor'),
    responsavelNome: textoDoCampo(dados, 'responsavel_nome'),
    responsavelTelefone: textoDoCampo(dados, 'responsavel_telefone'),
    autorizaImagem: marcado(dados, 'autoriza_imagem'),
    consentimento: marcado(dados, 'consentimento')
  };
}

/**
 * Um CPF é válido? Onze dígitos, com os dois verificadores conferindo.
 *
 * POR QUE CONFERIR O DÍGITO, e não só contar onze: o CPF só é pedido
 * quando a instituição parceira exige (RN06), e ela exige para EMITIR
 * DOCUMENTO — lista de presença de projeto público, prestação de contas de
 * edital. Um campo que aceita "111.111.111-11" entrega à ONG uma planilha
 * que a instituição vai devolver, e a pessoa que digitou já foi embora.
 *
 * OS ONZE DÍGITOS IGUAIS SÃO RECUSADOS À PARTE, e não é preciosismo: eles
 * PASSAM na conta dos verificadores (`111.111.111-11` fecha certinho). É o
 * furo clássico de quem implementa a regra sem saber disso.
 *
 * O QUE ISTO NÃO FAZ: dizer se o CPF existe. Isso só a Receita responde, e
 * consultar a Receita é integração que este projeto não tem e não vai ter.
 * O que a conta pega é o erro de digitação, que é o caso comum.
 */
export function ehCpf(valor: unknown): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11) return false;

  // "00000000000", "11111111111"... — todos passam nos verificadores.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  // Os dois dígitos verificadores, pela regra do módulo 11.
  for (const quantos of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < quantos; i += 1) {
      soma += Number(digitos[i]) * (quantos + 1 - i);
    }
    const resto = (soma * 10) % 11;
    // Resto 10 vale como 0 — é a regra, não um arredondamento nosso.
    const esperado = resto === 10 ? 0 : resto;
    if (esperado !== Number(digitos[quantos])) return false;
  }

  return true;
}

/**
 * Formata um CPF como a pessoa está acostumada a lê-lo. Texto que não tem
 * onze dígitos volta COMO VEIO — a mesma regra de `formatarTelefone`:
 * mascarar o que não entendemos esconderia o erro de quem digitou.
 */
export function formatarCpf(valor: unknown): string {
  const digitos = apenasDigitos(valor);
  if (digitos.length !== 11) return typeof valor === 'string' ? valor : '';

  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/**
 * TODOS os erros de uma vez — a regra do topo deste arquivo.
 *
 * `exigeCpf` VEM DO EVENTO LIDO NO BANCO, nunca do formulário, e esta é a
 * decisão mais importante deste bloco. A coluna `eventos.exige_cpf` é da
 * ONG (RN06); se o valor viesse do corpo da requisição, quem quisesse pular
 * o campo mandaria `exige_cpf=false` e pularia. A tela DESENHA o campo a
 * partir do evento, e a Action VALIDA a partir do evento — a mesma fonte,
 * duas vezes, porque uma delas é alcançável sem passar pela outra.
 */
export function validarInscricao(
  campos: CamposInscricao,
  opcoes: { exigeCpf: boolean }
): ResultadoValidacao {
  const erros: Record<string, string> = {};

  // O evento não é campo que a pessoa preenche — quando ele está errado, o
  // problema não é dela. A mensagem diz o que fazer, não o que ela errou.
  if (!ehIdentificador(campos.eventoId)) {
    erros.evento_id = 'Não deu para identificar o evento desta inscrição. '
      + 'Volte para a agenda e abra o evento de novo.';
  }

  if (!campos.nome) {
    erros.nome = 'Escreva o nome de quem vai participar.';
  } else if (campos.nome.length > LIMITE_NOME) {
    erros.nome = `O nome passou de ${LIMITE_NOME} caracteres.`;
  }

  if (!campos.email || !FORMATO_EMAIL.test(campos.email)) {
    erros.email = 'Confira o e-mail: ele precisa ter um endereço completo, como nome@exemplo.com. '
      + 'É por ele que confirmamos a inscrição.';
  } else if (campos.email.length > LIMITE_EMAIL) {
    erros.email = `O e-mail passou de ${LIMITE_EMAIL} caracteres.`;
  }

  // Telefone é opcional (coleta mínima, RNF09), mas se vier, vem completo —
  // a mesma regra de validarContato e de validarCadastro.
  if (campos.telefone) {
    const digitos = apenasDigitos(campos.telefone);
    if (digitos.length < 10 || digitos.length > 11) {
      erros.telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344. '
        + 'Se preferir não deixar telefone, apague o campo — ele é opcional.';
    }
  }

  // RN06 — ver o cabeçalho desta função sobre de onde `exigeCpf` vem.
  if (opcoes.exigeCpf) {
    if (!campos.cpf) {
      erros.cpf = 'Este evento acontece em parceria com uma instituição que pede o CPF de quem '
        + 'participa. Sem ele não conseguimos incluir você na lista.';
    } else if (!ehCpf(campos.cpf)) {
      erros.cpf = 'Confira o CPF: algum número não bate. Ele tem 11 dígitos, '
        + 'como 123.456.789-09.';
    }
  } else if (campos.cpf && !ehCpf(campos.cpf)) {
    // Fora da exigência o campo nem aparece na tela. Chegando preenchido e
    // errado, recusar é melhor que gravar um número quebrado que ninguém
    // pediu.
    erros.cpf = 'Confira o CPF: algum número não bate.';
  }

  // RN02 — o banco também recusa (`responsavel_obrigatorio_para_menor`).
  // A recusa daqui existe para a pessoa ler uma frase em vez de um erro de
  // banco, e para o formulário voltar preenchido.
  if (campos.ehMenor) {
    if (!campos.responsavelNome) {
      erros.responsavel_nome = 'Para inscrever alguém com menos de 18 anos, precisamos do nome '
        + 'de quem é responsável.';
    } else if (campos.responsavelNome.length > LIMITE_RESPONSAVEL) {
      erros.responsavel_nome = `O nome passou de ${LIMITE_RESPONSAVEL} caracteres.`;
    }

    const digitos = apenasDigitos(campos.responsavelTelefone);
    if (!campos.responsavelTelefone) {
      erros.responsavel_telefone = 'Precisamos de um telefone de contato de quem é responsável — '
        + 'é por ele que falamos com a família no dia da atividade.';
    } else if (digitos.length < 10 || digitos.length > 11) {
      erros.responsavel_telefone = 'O telefone precisa incluir o DDD, como (11) 95396-8344.';
    }
  }

  // A caixa é obrigatória na tela E o banco recusa a linha sem ela
  // (`consentimento_obrigatorio`, 003_eventos.sql).
  if (!campos.consentimento) {
    erros.consentimento = 'Para concluir a inscrição, precisamos que você concorde com o uso '
      + 'dos dados para organizar a atividade. O que fazemos com eles está na política de '
      + 'privacidade.';
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

// =====================================================================
// Mural de avisos (RF27) e mensagem para grupo (RF28)
//
// O MESMO TEXTO SERVE AS DUAS COISAS, e é isso que faz o RF28 caber na
// regra da Edge Function (spec §9): ela não aceita texto no payload, só um
// identificador. Com o aviso já gravado, o que viaja até ela é o `id` — e
// ela busca o corpo no banco.
//
// Sem isso, "mandar mensagem para um grupo" seria um endpoint que recebe
// texto e uma lista de destinatários, ou seja, um formulário aberto para
// enviar e-mail em nome da ONG.
// =====================================================================

export type CamposAviso = {
  /** Vazio quando é um aviso NOVO. Preenchido quando é correção. */
  id: string;
  titulo: string;
  corpo: string;
};

/**
 * Os tetos. Os mesmos de `publicacoes`, de propósito: é o mesmo gesto
 * (escrever um texto no painel, do celular) e duas regras de tamanho para
 * a mesma coisa divergiriam.
 */
export function lerAviso(dados: FormData): CamposAviso {
  return {
    id: textoDoCampo(dados, 'id'),
    titulo: textoDoCampo(dados, 'titulo'),
    corpo: textoDoCampo(dados, 'corpo')
  };
}

export function validarAviso(campos: CamposAviso): ResultadoValidacao {
  const erros: Record<string, string> = {};

  // `id` vazio é um aviso NOVO — não é erro. O que é erro é um id que
  // existe e não é um identificador.
  if (campos.id && !ehIdentificador(campos.id)) {
    erros.id = 'Não deu para identificar qual aviso é este. Volte para a lista e abra de novo.';
  }

  if (!campos.titulo) {
    erros.titulo = 'Escreva um título — é o que aparece primeiro no mural.';
  } else if (campos.titulo.length > LIMITE_TITULO) {
    erros.titulo = `O título passou de ${LIMITE_TITULO} caracteres.`;
  }

  if (!campos.corpo) {
    erros.corpo = 'Escreva o aviso.';
  } else if (campos.corpo.length > LIMITE_CORPO) {
    erros.corpo = `O aviso passou de ${LIMITE_CORPO} caracteres.`;
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * O objeto que vai ao `.insert()`/`.update()`, montado chave por chave.
 *
 * `publicado` E `publicado_em` NÃO ESTÃO AQUI, e a ausência é a regra:
 * quem publica é `alternarAviso`, num botão separado. Escrever não é
 * publicar — e num mural INTERNO o descuido põe algo na frente de gente
 * que ainda não devia ver. Mesma decisão de `salvarPublicacao`.
 *
 * `id` também não: numa correção ele vai no `.eq()`, e numa criação ele
 * nasce do `default` da coluna. Deixá-lo aqui permitiria escolher o id de
 * uma linha nova pelo corpo da requisição.
 */
export function colunasDoAviso(campos: CamposAviso): { titulo: string; corpo: string } {
  return { titulo: campos.titulo, corpo: campos.corpo };
}
