#!/usr/bin/env python3
"""Build add-bell-logo-light.png — white matte + black tagline for light chrome (sidebar/header)."""

from PIL import Image, ImageFilter

SRC = "public/add-bell-logo-new.png"
OUT = "public/add-bell-logo-light.png"
TAGLINE_Y_START = 378
TAGLINE_Y_END = 468
TAGLINE = (24, 32, 44, 255)
WHITE = (255, 255, 255, 255)


def is_tagline_pixel(r: int, g: int, b: int, a: int) -> bool:
    return a > 160 and r + g + b < 120


def tagline_mask(src: Image.Image) -> Image.Image:
    w, h = src.size
    sp = src.load()
    letter = Image.new("L", (w, h), 0)
    lp = letter.load()
    for y in range(TAGLINE_Y_START, TAGLINE_Y_END):
        for x in range(600, w - 20):
            r, g, b, a = sp[x, y]
            if is_tagline_pixel(r, g, b, a):
                lp[x, y] = 255
    return letter.filter(ImageFilter.MaxFilter(3))


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    out = src.copy()
    w, h = out.size
    dp = out.load()
    filled = tagline_mask(src)
    fp = filled.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = dp[x, y]
            if a < 200:
                continue
            if fp[x, y] > 0:
                dp[x, y] = TAGLINE
            elif r + g + b < 30:
                dp[x, y] = WHITE

    out.save(OUT, optimize=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
