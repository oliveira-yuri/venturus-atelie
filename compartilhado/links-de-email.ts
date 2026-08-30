/**
 * compartilhado/links-de-email.ts — o que a rota /auth/confirm aceita, e
 * para onde ela manda quem chega por ali.
 *
 * POR QUE ESTA ROTA EXISTE (spec §9). No fluxo implícito, o Supabase devolve
 * o token no FRAGMENTO da URL (`#access_token=...`), e o navegador NUNCA
 * envia fragmento ao servidor. Num site inteiro renderizado no servidor,
 * como este, isso significa que recuperação de senha simplesmente não
 * funciona: o servidor não vê o token, e não há JavaScript de página lendo
 * `location.hash` para resgatá-lo. O fluxo PKCE resolve porque manda
 * `?token_hash=...&type=...` na QUERY, que chega ao servidor como qualquer
 * outro parâmetro.
 *
 * POR QUE ESTE MÓDULO É SEPARADO DA ROTA, e mora em compartilhado/:
 * `app/auth/confirm/route.ts` não pode ser importado por `node --test` —
 * resolve `@/...` pelo tsconfig, importa `servidor/supabase.ts` (que começa
 * com `import 'server-only'`) e acaba em `cookies()`, que exige contexto de
 * requisição. Mesmo raciocínio já registrado em compartilhado/validacao.ts.
 * Deixando aqui a decisão de "que tipo de link é aceito", ela ganha teste de
 * unidade de verdade (testes/links-de-email.test.mjs), e a rota fica sendo
 * só a parte que precisa de rede.
 *
 * `type` É ENTRADA DE USUÁRIO NUMA URL PÚBLICA. Qualquer pessoa monta
 * `/auth/confirm?type=<o que quiser>`. O SDK do Supabase aceita vários
 * outros tipos (`magiclink`, `invite`, `email_change`, `sms`, `phone_change`)
 * e cada um tem consequência própria — repassar a string crua seria deixar
 * quem chama escolher qual fluxo do Auth acionar. Por isso a lista abaixo é
 * fechada, e a checagem é por igualdade em array, não por `chave in objeto`:
 * `'__proto__' in {}` é `true`, e essa é a forma clássica de furar uma
 * lista escrita como objeto.
 */

/**
 * Os dois tipos de link que este projeto manda por e-mail hoje:
 *
 *  - `recovery`: `solicitarRecuperacao` em acoes/autenticacao.ts
 *    (`resetPasswordForEmail`);
 *  - `signup`: `criarConta` na mesma. Existe porque o projeto Supabase está
 *    com `mailer_autoconfirm: false` (medido em 28/08/2026), ou seja, TODO
 *    cadastro dispara e-mail de confirmação.
 *
 * Link de outro tipo não é gerado por nenhum código deste site. Se um dia
 * for (convite de equipe, troca de e-mail), a entrada nova vem junto com o
 * destino dela — e com o teste que prova que a lista mudou de propósito.
 */
export const TIPOS_DE_LINK_ACEITOS = ['recovery', 'signup'] as const;

export type TipoDeLink = (typeof TIPOS_DE_LINK_ACEITOS)[number];

export function ehTipoDeLinkAceito(valor: unknown): valor is TipoDeLink {
  return typeof valor === 'string'
    && (TIPOS_DE_LINK_ACEITOS as readonly string[]).includes(valor);
}

/**
 * Para onde a pessoa segue depois de o link ser verificado com sucesso.
 *
 * `recovery` → `/nova-senha`: ela acabou de ganhar sessão e o único motivo
 * de ter clicado no link era trocar a senha.
 *
 * `signup` → `/`: a conta está confirmada e ela já entrou. Não há área do
 * usuário para onde mandá-la (RF11 é Bloco B), e cair na home logada é o
 * desfecho honesto — nada mais é exigido dela.
 */
export function destinoDepoisDeConfirmar(tipo: TipoDeLink): string {
  return tipo === 'recovery' ? '/nova-senha' : '/';
}

/**
 * Os motivos pelos quais alguém chega a /nova-senha SEM sessão.
 *
 * Ficam aqui, e não soltos em cada arquivo, porque são escritos pela rota
 * (`app/auth/confirm/route.ts`, no `?erro=`) e lidos pela página
 * (`app/nova-senha/page.tsx`, que escolhe o texto). Dois lugares digitando
 * a mesma string à mão é a forma de um deles envelhecer sozinho e a pessoa
 * receber a explicação genérica sem ninguém perceber.
 */
export const MOTIVOS_DE_FALHA = {
  /** Faltou `token_hash`, ou o `type` não está na lista acima. */
  invalido: 'invalido',
  /** Link de `recovery` recusado pelo Supabase: vencido ou já usado. */
  expirado: 'expirado',
  /** Link de `signup` recusado pelo Supabase: vencido ou já usado. */
  confirmacao: 'confirmacao',
  /** O ambiente não tem Supabase configurado — nada pode ser verificado. */
  indisponivel: 'indisponivel'
} as const;

export type MotivoDeFalha = (typeof MOTIVOS_DE_FALHA)[keyof typeof MOTIVOS_DE_FALHA];

export function ehMotivoDeFalha(valor: unknown): valor is MotivoDeFalha {
  return typeof valor === 'string'
    && Object.values(MOTIVOS_DE_FALHA).includes(valor as MotivoDeFalha);
}

/**
 * O caminho para onde a rota manda quem chegou com link que não vale.
 *
 * TUDO CAI EM /nova-senha, com o motivo na query — decisão desta tarefa,
 * ver o cabeçalho de app/nova-senha/page.tsx. O resumo: /nova-senha JÁ
 * PRECISA ter uma tela para quem chega sem sessão (link velho, acesso
 * direto), então essa tela é o lugar natural da explicação; uma terceira
 * página só para "link inválido" repetiria o mesmo texto num segundo
 * arquivo. E /recuperar-acesso, a outra opção, é da Tarefa 3.
 */
export function caminhoDeFalha(motivo: MotivoDeFalha): string {
  return `/nova-senha?erro=${motivo}`;
}
