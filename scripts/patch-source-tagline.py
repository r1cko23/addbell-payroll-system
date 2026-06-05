#!/usr/bin/env python3
"""Add comma between SERVICES and INC in the master logo PNG."""

from __future__ import annotations

from PIL import Image, ImageDraw, ImageFont

SRC = "public/add-bell-logo-new.png"
GAP_X0 = 1491
GAP_X1 = 1506
GAP_Y0 = 410
GAP_Y1 = 445
COMMA_ANCHOR = (1491, 382)
COMMA_FONT_SIZE = 54
TAGLINE_FILL = (0, 0, 0, 255)

FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
)


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
            r, g, b, a = dp[x, y]
            if a > 160 and r + g + b < 120:
                dp[x, y] = (0, 0, 0, 0)


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    dp = img.load()
    clear_gap(dp)
    font = load_comma_font()
    ImageDraw.Draw(img).text(COMMA_ANCHOR, ",", fill=TAGLINE_FILL, font=font)
    img.save(SRC, optimize=True)
    print(f"Patched comma in {SRC}")


if __name__ == "__main__":
    main()
