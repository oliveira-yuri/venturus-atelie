#!/usr/bin/env python3
"""Gera as imagens da home a partir de docs/info-venturus/ (não versionado).

Recorta cada original para o aspect-ratio de destino, em torno de um ponto
de foco, reduz a largura e salva JPEG progressivo em public/imagens/.
Fecha em ~55–140 KB por arquivo (RNF11 — banda móvel).

Só imagens do cofundador Wil Oliveira, adulto e figura pública (RN07,
regra 9 do CLAUDE.md — nenhuma criança identificável vai ao ar). A foto
que mostra o rosto de uma criança fica de fora, de propósito.

Uso:  python3 ferramentas/gerar-imagens-home.py
Requer: Pillow (`pip install Pillow`).
"""
import os
import unicodedata
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RAIZ, "docs", "info-venturus")
DEST = os.path.join(RAIZ, "public", "imagens")


def _fold(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def _acha(arquivos, *pistas):
    for nome in arquivos:
        alvo = _fold(nome)
        if all(p in alvo for p in pistas):
            return os.path.join(ORIG, nome)
    raise SystemExit(f"não encontrei a origem para {pistas!r} em {ORIG}")


# (pistas p/ casar o original, destino, (aspecto_w, aspecto_h), largura, foco_y)
# foco_y: 0.0 = topo … 1.0 = base — mantém o rosto no quadro ao cortar.
JOBS = [
    (("- atelie afro cultural -", ".jpeg"), "heroi.jpg",           (16, 9), 1200, 0.45),
    (("brasil negreiro  3", ".png"),        "heroi-retrato.jpg",   (4, 5),  1000, 0.30),
    (("cafu e o cafe .jpg.jpeg",),          "setor-literario.jpg", (2, 1),  1000, 0.12),
    (("brasil negreiro .png",),             "setor-musical.jpg",   (2, 1),  1000, 0.35),
    (("(cafu e o cafe).jpg.jpeg",),         "setor-artistico.jpg", (2, 1),  1000, 0.28),
]


def _recorta(im, aw, ah, foco_y):
    w, h = im.size
    alvo = aw / ah
    if w / h > alvo:                       # largo demais: corta os lados
        nova = int(round(h * alvo))
        x = (w - nova) // 2
        return im.crop((x, 0, x + nova, h))
    nova = int(round(w / alvo))            # alto demais: corta em torno do foco
    y = max(0, min(h - nova, int(round((h - nova) * foco_y))))
    return im.crop((0, y, w, y + nova))


def main():
    os.makedirs(DEST, exist_ok=True)
    arquivos = os.listdir(ORIG)
    for pistas, destino, (aw, ah), largura, foco_y in JOBS:
        im = Image.open(_acha(arquivos, *pistas)).convert("RGB")
        im = _recorta(im, aw, ah, foco_y)
        if im.width > largura:
            im = im.resize(
                (largura, int(round(im.height * largura / im.width))), Image.LANCZOS
            )
        saida = os.path.join(DEST, destino)
        im.save(saida, "JPEG", quality=80, optimize=True, progressive=True)
        print(f"{destino:22s} {im.width}x{im.height}  {os.path.getsize(saida)/1024:6.1f} KB")


if __name__ == "__main__":
    main()
