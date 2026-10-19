#!/usr/bin/env python3
"""Build the halftone grid used by the CV page's denoising-portrait animation.

Reads the profile photo, keeps a hand-drawn head-and-shoulders silhouette,
equalizes contrast inside it, and writes two hex strings to
_data/portrait_halftone.json: per-cell luminance and silhouette weight. The page
animates these cells from noise to the portrait, as a diffusion sampler would.
Light theme draws darkness as dots; dark theme draws brightness.

Usage: python3 bin/build-portrait-halftone.py   (requires Pillow)
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/img/personal/norway_photo.jpg"
TARGET = ROOT / "_data/portrait_halftone.json"

# Head-and-shoulders crop (left, top, right, bottom) in source pixels.
CROP = (150, 150, 520, 610)
COLS, ROWS = 34, 42


def silhouette(size):
    """Head ellipse plus shoulders, softened, in source pixel coordinates."""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([228, 168, 392, 372], fill=255)
    draw.polygon([(250, 330), (370, 330), (470, 400), (515, 470), (520, 640),
                  (160, 640), (170, 470), (200, 400)], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(6))


def main():
    photo = Image.open(SOURCE).convert("L")
    mask = silhouette(photo.size).crop(CROP)
    gray = photo.crop(CROP)

    # Histogram-equalize using only the person's pixels, so the lake does not set the range.
    inside = mask.point(lambda v: 255 if v > 128 else 0)
    histogram = gray.histogram(mask=inside)
    total, running, lookup = sum(histogram), 0, []
    for count in histogram:
        running += count
        lookup.append(round(255 * running / total))
    gray = gray.point(lookup)

    gray = gray.resize((COLS, ROWS), Image.LANCZOS)
    mask = mask.resize((COLS, ROWS), Image.LANCZOS)
    hexdigit = lambda value: format(round(value / 255 * 15), "x")
    luminance = "".join(hexdigit(gray.getpixel((x, y))) for y in range(ROWS) for x in range(COLS))
    weight = "".join(hexdigit(mask.getpixel((x, y))) for y in range(ROWS) for x in range(COLS))

    TARGET.write_text(json.dumps({
        "source": str(SOURCE.relative_to(ROOT)),
        "cols": COLS,
        "rows": ROWS,
        "luminance": luminance,
        "weight": weight,
    }, indent=2) + "\n")
    print(f"Wrote {TARGET.relative_to(ROOT)} ({COLS}x{ROWS})")


if __name__ == "__main__":
    main()
