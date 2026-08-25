#!/usr/bin/env bash
# Junta migrations e seed num arquivo unico, para colar no SQL Editor do
# Supabase. Rodar sempre que uma migration mudar.
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- ====================================================================="
  echo "-- Ateliê Afro Cultural — aplicação completa do banco"
  echo "--"
  echo "-- GERADO por ferramentas/gerar-sql-completo.sh. Não editar à mão."
  echo "-- Cole este arquivo inteiro no SQL Editor do Supabase e execute."
  echo "-- É seguro rodar uma vez; rodar duas vezes acusa objeto já existente."
  echo "-- ====================================================================="
  echo
  for f in supabase/migrations/*.sql; do
    echo "-- ############ $(basename "$f") ############"
    cat "$f"; echo
  done
  echo "-- ############ seed.sql ############"
  cat supabase/seed.sql
} > supabase/aplicar-tudo.sql
echo "supabase/aplicar-tudo.sql gerado ($(wc -l < supabase/aplicar-tudo.sql) linhas)"
