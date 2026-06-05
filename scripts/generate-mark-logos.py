#!/usr/bin/env python3
"""Build sidebar/header logo variants with solid black tagline on white."""

from __future__ import annotations

from PIL import Image, ImageFilter

SRC = "public/add-bell-logo-new.png"
OUT_LIGHT = "public/add-bell-logo-mark-light.png"
OUT_DARK = "public/add-bell-logo-mark-dark.png"
WHITE = (255, 255, 255, 255)
TAGLINE = (24, 32, 44, 255)
TAGLINE_Y_START = 378
TAGLINE_Y_END = 468
PADDING = 10


def is_tagline_pixel(r: int, g: int, b: int, a: int) -> bool:
    return a > 160 and r + g + b < 120


def is_brand_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 80:
        return False
    return (r > 150 and g > 100 and b < 100) or (b > 100 and r < 100 and g < 150)


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


def header_bounds(src: Image.Image) -> tuple[int, int, int, int]:
    w, h = src.size
    min_x, min_y, max_x, max_y = w, h, 0, 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = src.getpixel((x, y))
            if is_brand_pixel(r, g, b, a):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
            elif (
                TAGLINE_Y_START <= y <= TAGLINE_Y_END
                and x >= 600
                and is_tagline_pixel(r, g, b, a)
            ):
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    return (
        max(0, min_x - PADDING),
        max(0, min_y - PADDING),
        min(w, max_x + PADDING),
        min(h, max_y + PADDING),
    )


def build_mark(matte_to: tuple[int, int, int, int] | None) -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    mask = tagline_mask(src)
    left, top, right, bottom = header_bounds(src)
    mark = src.crop((left, top, right, bottom))
    mp = mask.crop((left, top, right, bottom))
    dp = mark.load()
    mpp = mp.load()

    for y in range(mark.height):
        for x in range(mark.width):
            r, g, b, a = dp[x, y]
            if mpp[x, y] > 0:
                dp[x, y] = TAGLINE
                continue
            if matte_to is not None and a >= 200 and r + g + b < 30:
                dp[x, y] = (*matte_to, 255)

    return mark


def build_mark_light() -> None:
    mark = build_mark(matte_to=(255, 255, 255))
    mark.save(OUT_LIGHT, optimize=True)
    print(f"Wrote {OUT_LIGHT} ({mark.width}x{mark.height})")


def build_mark_dark() -> None:
    mark = build_mark(matte_to=None)
    mark.save(OUT_DARK, optimize=True)
    print(f"Wrote {OUT_DARK} ({mark.width}x{mark.height})")


def main() -> None:
    build_mark_light()
    build_mark_dark()


if __name__ == "__main__":
    main()
