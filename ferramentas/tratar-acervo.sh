#!/usr/bin/env bash
# Tratamento do acervo original da ONG (risco R3 do plano de projeto).
# Reduz PDFs a resolucao web e converte .pptx em PDF.
# Origem em material-origem/ (nao versionada), saida em acervo-web/.
set -uo pipefail

ORIGEM="material-origem"
DESTINO="acervo-web"
mkdir -p "$DESTINO"

comprimir_pdf() {
  gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/ebook \
     -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages=true \
     -dDownsampleColorImages=true -dColorImageResolution=150 \
     -dDownsampleGrayImages=true -dGrayImageResolution=150 \
     -sOutputFile="$2" "$1"
}

echo "== Convertendo .pptx para PDF =="
for arquivo in "$ORIGEM"/*.pptx; do
  [ -e "$arquivo" ] || continue
  echo "-- $(basename "$arquivo")"
  soffice --headless --convert-to pdf --outdir "$DESTINO/_bruto" "$arquivo" >/dev/null 2>&1
done

echo "== Comprimindo PDFs =="
mkdir -p "$DESTINO/_bruto"
for arquivo in "$ORIGEM"/*.pdf "$DESTINO"/_bruto/*.pdf; do
  [ -e "$arquivo" ] || continue
  base=$(basename "$arquivo")
  saida="$DESTINO/$base"
  comprimir_pdf "$arquivo" "$saida" || { echo "!! falhou: $base"; continue; }
  antes=$(stat -c%s "$arquivo")
  depois=$(stat -c%s "$saida")
  printf '%-55s %7s KB -> %7s KB\n' "$base" "$((antes/1024))" "$((depois/1024))"
done

echo "== Concluido =="
