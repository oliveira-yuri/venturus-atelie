-- =====================================================================
-- 012 — Mural de avisos (RF27) e mensagem para grupo (RF28)
--
-- ---------------------------------------------------------------------
-- POR QUE UMA TABELA NOVA, E NAO UMA COLUNA EM `publicacoes`
-- ---------------------------------------------------------------------
--
-- O caminho barato seria acrescentar `interno boolean` a `public.
-- publicacoes` e filtrar. Foi recusado, e o motivo esta MEDIDO: a politica
-- daquela tabela e' `using (publicado or public.eh_equipe())`, e um
-- anonimo com a chave publicavel LE tudo que tem `publicado = true`
-- (HTTP 200, conferido em 01/09/2026).
--
-- Ou seja: reaproveitar `publicacoes` faria a seguranca da comunicacao
-- INTERNA depender de um `and not interno` escrito certo em toda consulta
-- e em toda politica, para sempre. Um esquecimento publicaria na internet
-- aberta um aviso escrito para dentro da equipe — e ninguem veria, porque
-- nada quebra.
--
-- Tabela separada, politica separada: o pior caso de um erro aqui e' um
-- aviso que ninguem le, nao um aviso que todo mundo le.
--
-- ---------------------------------------------------------------------
-- UMA TABELA SERVE OS DOIS REQUISITOS, E ISSO E' DESENHO
-- ---------------------------------------------------------------------
--
-- RF27 quer um MURAL que voluntario le no site. RF28 quer MANDAR uma
-- mensagem para um grupo. E' o mesmo texto: a ONG escreve o aviso uma vez,
-- ele fica no mural, e um botao separado o manda por e-mail.
--
-- Isso tambem e' o que faz o RF28 caber na regra da Edge Function (spec
-- §9): ela nao aceita texto no payload, so' um identificador. Com o aviso
-- ja' gravado, o que viaja e' o `id` — e a funcao busca o corpo aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- eh_voluntario_ativo() — quem enxerga o mural
--
-- ESPELHA `public.eh_equipe()` (001_base.sql) linha por linha: `stable`,
-- `security definer`, `search_path = public`. O definer e' o que evita a
-- recursao — sem ele, uma politica em `voluntarios` que consultasse
-- `voluntarios` estouraria com "stack depth limit exceeded", que e' o
-- defeito que `eh_equipe` ja' teve de resolver.
--
-- 'ativo' E NAO 'novo', E ESTA E' A DECISAO DESTA MIGRATION.
--
-- `public.voluntarios.situacao` tem quatro valores ('novo', 'em_contato',
-- 'ativo', 'inativo'). O escopo pede o mural "visivel para voluntarios
-- autenticados", e a leitura honesta disso e' quem JA' E' voluntario — nao
-- quem acabou de mandar o formulario.
--
-- A diferenca importa: `/voluntariado/candidatura` e' publica e qualquer
-- pessoa com conta se candidata. Se 'novo' contasse, bastaria preencher um
-- formulario para passar a ler a comunicacao interna da ONG.
--
-- O PRECO, dito em voz alta: um aviso novo NAO alcanca ninguem ate a
-- equipe promover alguem a 'ativo' em /admin/voluntarios — o que ja' e' um
-- toque naquela tela, e ja' e' o gesto que significa "esta pessoa entrou".
-- ---------------------------------------------------------------------
create or replace function public.eh_voluntario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.voluntarios v
    where v.perfil_id = auth.uid() and v.situacao = 'ativo'
  );
$$;

revoke all on function public.eh_voluntario_ativo() from public;
-- `anon` NAO recebe: sem sessao, `auth.uid()` e' nulo e a resposta seria
-- sempre falsa — mas conceder execucao a quem nao tem conta convidaria a
-- usar esta funcao como se ela fosse publica em alguma politica futura.
grant execute on function public.eh_voluntario_ativo() to authenticated;

-- ---------------------------------------------------------------------
-- avisos (RF27, RF28)
-- ---------------------------------------------------------------------
create table public.avisos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  corpo        text not null,

  -- COMO EM `publicacoes` E AO CONTRARIO DE `atividades`: nasce FALSE.
  -- Escrever nao e' publicar, e num mural interno o descuido poe algo na
  -- frente de gente que ainda nao devia ver.
  publicado    boolean not null default false,

  -- Carimbada ao publicar, e SO' se ainda for nula (corrigir e republicar
  -- nao e' republicar). Ao tirar do ar ela FICA — e' um fato, e apaga-la
  -- seria destruir informacao num gesto sem desfazer. Mesma regra de
  -- `publicacoes`.
  publicado_em timestamptz,

  criado_em    timestamptz not null default now()
);

create index avisos_publicado_em_idx on public.avisos (publicado_em desc nulls last);

alter table public.avisos enable row level security;

-- A POLITICA DE LEITURA, e ela e' a razao desta migration existir.
--
-- Repare no que NAO esta aqui: nenhuma forma de `publicado` sozinho. Um
-- aviso publicado continua invisivel para quem nao e' voluntario ativo nem
-- equipe. E' o oposto de `publicacoes`, onde `publicado` significa "o
-- mundo ve".
create policy "avisos: voluntario ativo e equipe leem"
  on public.avisos for select
  using ((publicado and public.eh_voluntario_ativo()) or public.eh_equipe());

create policy "avisos: equipe gerencia"
  on public.avisos for all
  using (public.eh_equipe()) with check (public.eh_equipe());

-- ---------------------------------------------------------------------
-- Permissoes
--
-- `anon` NAO RECEBE NADA, nem select. E' a primeira trava, antes da RLS:
-- mesmo que a politica acima fosse reescrita errada um dia, o papel
-- anonimo nao teria o privilegio de tentar. E' a mesma disciplina de
-- `inscricoes` (003) e `doacoes`.
-- ---------------------------------------------------------------------
grant select on public.avisos to authenticated;
grant insert, update, delete on public.avisos to authenticated;
