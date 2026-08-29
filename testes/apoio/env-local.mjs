import { readFileSync } from 'node:fs';

/**
 * Lê .env.local (raiz do projeto) e devolve as variáveis nele como objeto,
 * SEM tocar em process.env — cada chamador decide se aplica ao próprio
 * processo. Devolve {} se o arquivo não existir.
 *
 * Compartilhado entre testes/seguranca.test.mjs e testes/vazamento.test.mjs:
 * os dois precisam da URL/chave REAIS do Supabase para verificar alguma
 * coisa de verdade — a partir da Rodada de correção 1 da Tarefa 10,
 * ferramentas/rodar-testes.mjs roda a build/servidor principal da suíte
 * com NODE_ENV=test, que faz o Next IGNORAR .env.local de propósito (para
 * a renderização ficar determinística e offline, servida pelo JSON
 * versionado). Isso significa que process.env sozinho não é mais
 * suficiente para estes dois testes: eles precisam ler o arquivo direto.
 *
 * SÍNCRONO de propósito: o `skip` de um describe() e a montagem de
 * constantes no topo de um módulo de teste rodam antes de qualquer
 * before()/hook assíncrono — foi assim que testes/seguranca.test.mjs já
 * ficou pulando o aceite bloqueante em silêncio uma vez.
 */
export function lerEnvLocal() {
  let bruto;
  try {
    bruto = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
  } catch {
    return {};
  }

  const variaveis = {};
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const posicaoIgual = limpa.indexOf('=');
    if (posicaoIgual === -1) continue;
    const chave = limpa.slice(0, posicaoIgual).trim();
    const valor = limpa.slice(posicaoIgual + 1).trim();
    variaveis[chave] = valor;
  }
  return variaveis;
}
