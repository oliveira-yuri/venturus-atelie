/**
 * Para onde a pessoa vai DEPOIS de entrar ou criar conta.
 *
 * Até 06/10/2026 toda ação de conta terminava em `redirect('/')`. Quem
 * clicou em "Quero me candidatar" ou "Oferecer uma doação", criou a conta e
 * caiu na home tinha de reencontrar o caminho sozinha — e a equipe, depois
 * de entrar, caía na página pública e precisava abrir a gaveta para achar o
 * painel.
 *
 * O destino viaja num campo escondido (`voltar`) do formulário. Isso é
 * ENTRADA DE USUÁRIO — qualquer pessoa monta `/entrar?voltar=...` e manda o
 * link —, então o valor passa por uma lista de caracteres, não por uma
 * tentativa de reconhecer o que é perigoso. Um redirect aberto
 * (`?voltar=https://site-falso.example`) transformaria a tela de entrar da ONG
 * em isca de phishing com o endereço dela.
 *
 * REGRA: só se aceita um CAMINHO DO PRÓPRIO SITE, escrito com letras
 * minúsculas, dígitos, hífen e barra. Nada de `//` (protocolo relativo),
 * barra invertida, `:`, `?`, `#`, `%` ou espaço — nenhum dos destinos legítimos
 * precisa deles, e cada um é um jeito conhecido de escapar do domínio.
 *
 * As rotas de conta ficam de fora: voltar para `/entrar` depois de entrar
 * seria um laço, e `/auth/confirm` gasta um token de uso único.
 */

const CAMINHO_PERMITIDO = /^\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/;

const TAMANHO_MAXIMO = 120;

const FORA_DA_LISTA = ['/entrar', '/recuperar-acesso', '/nova-senha', '/auth'];

/** O caminho, se for do próprio site e seguro; `null` em qualquer outro caso. */
export function caminhoInternoSeguro(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (valor.length === 0 || valor.length > TAMANHO_MAXIMO) return null;
  if (!CAMINHO_PERMITIDO.test(valor)) return null;

  const naLista = FORA_DA_LISTA.some((rota) => valor === rota || valor.startsWith(`${rota}/`));
  return naLista ? null : valor;
}

/**
 * Para onde ir depois de entrar, na ordem: o que a pessoa estava fazendo, o
 * painel (se for equipe) e, por fim, a home.
 *
 * A equipe vai ao painel só quando NÃO veio de outro lugar: quem clicou em
 * "Oferecer uma doação" e por acaso é da equipe quer a doação, não o painel.
 */
export function destinoDepoisDeEntrar(voltar: unknown, ehEquipe: boolean): string {
  return caminhoInternoSeguro(voltar) ?? (ehEquipe ? '/admin' : '/');
}

/** O mesmo, depois de CRIAR a conta: sem o `/admin`, porque conta nova nunca é da equipe. */
export function destinoDepoisDeCriarConta(voltar: unknown): string {
  return caminhoInternoSeguro(voltar) ?? '/?aviso=conta-criada';
}

/** `/entrar` com o destino, para os links das telas que pedem conta. */
export function enderecoDeEntrar(voltar: string): string {
  const seguro = caminhoInternoSeguro(voltar);
  return seguro ? `/entrar?voltar=${seguro}` : '/entrar';
}
