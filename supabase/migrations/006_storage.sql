-- =====================================================================
-- 006 — Buckets de arquivos
--
-- Politicas de Storage tambem sao RLS: valem as mesmas regras.
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('galeria',   'galeria',   true),
  ('acervo',    'acervo',    true),
  ('identidade','identidade', true)
on conflict (id) do nothing;

-- Leitura publica nos tres: sao arquivos destinados ao publico.
create policy "arquivos publicos: leitura"
  on storage.objects for select
  using (bucket_id in ('galeria', 'acervo', 'identidade'));

-- Escrita apenas da equipe, nos tres.
create policy "arquivos publicos: equipe envia"
  on storage.objects for insert
  with check (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());

create policy "arquivos publicos: equipe atualiza"
  on storage.objects for update
  using (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());

create policy "arquivos publicos: equipe remove"
  on storage.objects for delete
  using (bucket_id in ('galeria', 'acervo', 'identidade') and public.eh_equipe());
