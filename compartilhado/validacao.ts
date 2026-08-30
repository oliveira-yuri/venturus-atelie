/**
 * Validação de formulários de conta.
 *
 * Módulo puro, sem DOM: é o miolo testável dos formulários de cadastro e
 * entrada. As mensagens seguem a seção 11 do escopo — dizem o que houve e o
 * que fazer, sem vaguidão e sem pedir desculpas.
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

/** Texto de um campo, já sem espaço nas pontas. Nunca `undefined`. */
function texto(dados: FormData, nome: string): string {
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
    nome: texto(dados, 'nome'),
    email: texto(dados, 'email'),
    telefone: texto(dados, 'telefone'),
    senha: senhaBruta(dados, 'senha'),
    maioridade: marcado(dados, 'maioridade'),
    consentimento: marcado(dados, 'consentimento'),
    papeis
  };
}

/** Campos do formulário "Entrar". */
export function lerEntrada(dados: FormData): DadosEntrada {
  return {
    email: texto(dados, 'email'),
    senha: senhaBruta(dados, 'senha')
  };
}

/** Campo do formulário de /recuperar-acesso. */
export function lerRecuperacao(dados: FormData): { email: string } {
  return { email: texto(dados, 'email') };
}
