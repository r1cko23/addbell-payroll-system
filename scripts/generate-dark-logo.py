#!/usr/bin/env python3
"""Build add-bell-logo-on-dark.png — tagline white on black matte; no outline halos."""

from __future__ import annotations

from PIL import Image, ImageDraw, ImageFont

SRC = "public/add-bell-logo-new.png"
OUT = "public/add-bell-logo-on-dark.png"
TAGLINE_Y_START = 378
TAGLINE_Y_END = 468
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)

# Gap between SERVICES (~x1490) and INC (~x1507).
GAP_X0 = 1491
GAP_X1 = 1506
GAP_Y0 = 410
GAP_Y1 = 445
COMMA_ANCHOR = (1491, 382)
COMMA_FONT_SIZE = 54

FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
)


def is_tagline_pixel(r: int, g: int, b: int, a: int) -> bool:
    return a > 160 and r + g + b < 120


def load_comma_font(size: int = COMMA_FONT_SIZE):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def clear_gap(dp) -> None:
    for y in range(GAP_Y0, GAP_Y1):
        for x in range(GAP_X0, GAP_X1):
            dp[x, y] = BLACK


def paint_comma(img: Image.Image) -> None:
    clear_gap(img.load())
    font = load_comma_font()
    ImageDraw.Draw(img).text(COMMA_ANCHOR, ",", fill=WHITE, font=font)


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    out = src.copy()
    w, h = out.size
    dp = out.load()
    sp = src.load()

    for y in range(TAGLINE_Y_START - 5, TAGLINE_Y_END + 5):
        for x in range(600, w - 20):
            r, g, b, a = sp[x, y]
            if is_tagline_pixel(r, g, b, a):
                dp[x, y] = WHITE

    paint_comma(out)

    out.save(OUT, optimize=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
