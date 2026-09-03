#!/usr/bin/env python3
"""
ferramentas/entrega/empacotar.py — fecha o pacote e CONFERE que ele abre.

Escrito em Python porque a maquina nao tem o `zip` da linha de comando —
e `zipfile` faz parte da biblioteca padrao, entao nao entra dependencia
nova (a mesma disciplina do resto do projeto).

A CONFERENCIA NAO E' ZELO. Um zip que descompacta com caminho errado, ou
um indice cujas imagens so' existem na maquina de quem gerou, e'
descoberto pela banca e nao por nos. Entao o script descompacta o proprio
resultado num diretorio limpo e segue cada link relativo.
"""
import os
import re
import shutil
import sys
import tempfile
import zipfile
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
os.chdir(RAIZ)

nome = sys.argv[1] if len(sys.argv) > 1 else f"atelie-afro-cultural-entrega-{date.today()}"
destino = RAIZ / f"{nome}.zip"

# Metadado de geracao, nao conteudo de entrega.
FORA = {"entrega/03-prototipos/capturas.json"}

EXIGIDOS = [
    "entrega/LEIA-ME.md",
    "entrega/00-proposta-de-impacto/proposta-de-impacto.pdf",
    "entrega/00-proposta-de-impacto/proposta-de-impacto.html",
    "entrega/01-documento-de-requisitos/requisitos.pdf",
    "entrega/01-documento-de-requisitos/requisitos.html",
    "entrega/02-arquitetura/arquitetura.md",
    "entrega/03-prototipos/index.html",
]

# ---------------------------------------------------------------- criar
destino.unlink(missing_ok=True)
with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for caminho in sorted(Path("entrega").rglob("*")):
        if caminho.is_dir():
            continue
        arq = caminho.as_posix()
        if arq in FORA:
            continue
        z.write(caminho, arq)

tamanho = destino.stat().st_size
print(f"  ✅ {destino.name}  —  {tamanho / 1024 / 1024:.1f} MB")

# ------------------------------------------------------------- conferir
temp = Path(tempfile.mkdtemp())
problemas = []
try:
    with zipfile.ZipFile(destino) as z:
        z.extractall(temp)

    for exigido in EXIGIDOS:
        alvo = temp / exigido
        if alvo.is_file() and alvo.stat().st_size > 0:
            print(f"     ✅ {exigido}")
        else:
            problemas.append(f"falta ou está vazio: {exigido}")

    def conferir_links(arquivo, base, padrao):
        """Todo caminho RELATIVO precisa existir dentro do zip."""
        texto = (temp / arquivo).read_text(encoding="utf8")
        for alvo in sorted(set(re.findall(padrao, texto))):
            if alvo.startswith(("http", "#", "mailto:", "data:")):
                continue
            if not (temp / base / alvo).exists():
                problemas.append(f"link quebrado em {arquivo}: {alvo}")

    conferir_links("entrega/03-prototipos/index.html",
                   "entrega/03-prototipos", r'(?:src|href)="([^"]+)"')
    conferir_links("entrega/02-arquitetura/arquitetura.md",
                   "entrega/02-arquitetura", r'\]\(([^)]+)\)')

    if not problemas:
        capturas = len(list((temp / "entrega/03-prototipos/telas").glob("*.png")))
        diagramas = len(list((temp / "entrega/02-arquitetura/renderizado").glob("*.svg")))
        print(f"     ✅ nenhum link quebrado — {capturas} capturas, {diagramas} diagramas")
finally:
    shutil.rmtree(temp, ignore_errors=True)

if problemas:
    print("\n  ❌ o pacote tem problema — NÃO enviar:")
    for p in problemas:
        print(f"     · {p}")
    sys.exit(1)

print("  ✅ o pacote abre, e está completo.")
