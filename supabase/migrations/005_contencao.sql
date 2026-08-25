-- =====================================================================
-- 005 — Contencao de envio automatizado
--
-- Efeito colateral de permitir insercao sem conta em inscricoes e contatos
-- (secao 12 do escopo): abre porta para envio em massa.
--
-- Contencao suficiente pedida pelo escopo: limite por origem e revisao
-- humana. Sem captcha — custo zero e nenhum atrito para quem se inscreve.
--
-- O que NAO pode acontecer, e nao acontece aqui: afrouxar a leitura junto
-- com a escrita.
-- =====================================================================

create table public.envios_recentes (
  id        bigserial primary key,
  origem    text not null,
  tabela    text not null,
  criado_em timestamptz not null default now()
);

create index envios_recentes_busca_idx
  on public.envios_recentes (origem, tabela, criado_em desc);

comment on column public.envios_recentes.origem is
  'Hash SHA-256 do IP. O endereco em si nunca e gravado: coleta minima (RNF09).';

alter table public.envios_recentes enable row level security;

-- Ninguem le nem escreve direto: so o trigger, que roda como definer.
create policy "envios_recentes: so a equipe consulta"
  on public.envios_recentes for select
  using (public.eh_equipe());

-- ---------------------------------------------------------------------
-- limitar_envios()
--
-- O Postgres enxerga os cabecalhos da requisicao via request.headers,
-- populado pelo PostgREST. Fora de uma requisicao HTTP a configuracao nao
-- existe — por isso o coalesce.
-- ---------------------------------------------------------------------
create or replace function public.limitar_envios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cabecalhos json;
  v_ip         text;
  v_origem     text;
  v_recentes   integer;
  v_limite     constant integer := 10;
  v_janela     constant interval := interval '1 hour';
begin
  begin
    v_cabecalhos := current_setting('request.headers', true)::json;
  exception when others then
    v_cabecalhos := null;
  end;

  v_ip := coalesce(
    split_part(v_cabecalhos ->> 'x-forwarded-for', ',', 1),
    v_cabecalhos ->> 'x-real-ip',
    'desconhecida'
  );

  -- Guardamos o hash, nunca o IP: coleta minima (RNF09).
  v_origem := encode(digest(v_ip, 'sha256'), 'hex');

  select count(*) into v_recentes
  from public.envios_recentes e
  where e.origem = v_origem
    and e.tabela = tg_table_name
    and e.criado_em > now() - v_janela;

  if v_recentes >= v_limite then
    raise exception 'muitos envios em pouco tempo, tente novamente mais tarde'
      using errcode = 'P0001';
  end if;

  insert into public.envios_recentes (origem, tabela)
  values (v_origem, tg_table_name);

  return new;
end;
$$;

create trigger limitar_inscricoes
  before insert on public.inscricoes
  for each row execute function public.limitar_envios();

create trigger limitar_contatos
  before insert on public.contatos
  for each row execute function public.limitar_envios();

-- ---------------------------------------------------------------------
-- Limpeza: registros de contencao nao precisam durar mais que a janela.
-- ---------------------------------------------------------------------
create or replace function public.limpar_envios_antigos()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.envios_recentes where criado_em < now() - interval '1 day';
$$;
