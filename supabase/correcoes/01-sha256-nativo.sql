-- =====================================================================
-- CORREÇÃO 01 — contenção de envios usava digest() do pgcrypto
--
-- No Supabase as extensões ficam no schema "extensions", e esta função
-- roda com search_path = public — então digest() não existia aqui e
-- QUALQUER inscrição ou mensagem de contato falhava com erro 42883.
--
-- sha256() é nativo do Postgres e não depende de extensão nenhuma.
--
-- Cole no SQL Editor e execute. Pode rodar mais de uma vez sem risco.
-- =====================================================================

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
  --
  -- sha256() e nativo do Postgres desde a versao 11. Usar digest() do
  -- pgcrypto exigiria qualificar o schema: no Supabase as extensoes ficam em
  -- "extensions", e esta funcao roda com search_path = public, entao digest()
  -- simplesmente nao existiria aqui.
  v_origem := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');

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
