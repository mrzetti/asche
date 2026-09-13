#!/usr/bin/env python3
"""Extract reference material from the original Asche zu Asche (1997) game.

Reads the preserved, unmodified original at `assets/original/RSTEIN.EXE` and
writes derived reference artefacts to `reference/extracted/`:

  * every 8-bit BMP embedded in the Win16 VB3 form resources, as PNG
    (the game's full-screen backdrops, sprite sheets and button art),
  * a JSON dump of the VB3 form/control names (the game's object model).

This script only READS the original assets and only WRITES under `reference/`.
It uses the Python standard library only (no Pillow/numpy), so it also serves
as documentation of how the embedded bitmaps were located.

Usage:
    python3 reference/extract_game_assets.py
"""

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXE_PATH = REPO_ROOT / "assets" / "original" / "RSTEIN.EXE"
OUT_DIR = Path(__file__).resolve().parent / "extracted"

# Descriptive names for the most useful embedded bitmaps, keyed by the file
# offset of the "BM" signature in RSTEIN.EXE. Everything else is written with a
# generic name. Offsets were found by scanning for BITMAPINFOHEADER records.
NAMED_BITMAPS = {
    0xF2A3: "level1-cavern",
    0x14D3C3: "level2-concert",
    0x24AAA5: "level3-beach",
    0x3ECD9B: "title-screen",
    0x438499: "game-over",
    0x483A95: "highscore-outro",
    0x5A798: "helicopter",
    0x9960F: "grave",
    0x9AB42: "player-spritesheet",
    0x110DC7: "band-face-a",
    0x11297A: "band-face-b",
    0x19D332: "flamethrower-fire-a",
    0x19DD5D: "flamethrower-fire-b",
    0x1A14A3: "woman-doll",
    0x1A4FCA: "sea-urchin",
    0x1B9BAB: "monster-a",
    0x1BBDae: "monster-b",
    0x4CEEF0: "button-knob",
}

# VB3 form records: file offset of the length-prefixed form name. Each control
# name that follows is a length-prefixed string as well.
FORM_OFFSETS = {
    "frmScreen1": 0x14CF01,
    "frmScreen2": 0x24A801,
    "frmScreen3": 0x3ECB01,
    "frmStart": 0x438301,
    "frmGameOver": 0x483901,
    "frmOutro": 0x4CFC01,
    "frmLoading": 0x14D201,
}


def find_bitmaps(data: bytes) -> list[tuple[int, int, int, int, int]]:
    """Return (offset, size, width, height, bpp) for embedded 8-bit BMPs."""
    found: list[tuple[int, int, int, int, int]] = []
    i = 0
    while True:
        i = data.find(b"BM", i)
        if i < 0:
            break
        if i + 54 <= len(data):
            size = struct.unpack_from("<I", data, i + 2)[0]
            off_bits = struct.unpack_from("<I", data, i + 10)[0]
            header_size = struct.unpack_from("<I", data, i + 14)[0]
            width = struct.unpack_from("<i", data, i + 18)[0]
            height = struct.unpack_from("<i", data, i + 22)[0]
            bpp = struct.unpack_from("<H", data, i + 28)[0]
            row = ((width * bpp + 31) // 32) * 4
            plausible = (
                header_size == 40
                and 1 <= width <= 2000
                and 1 <= abs(height) <= 2000
                and bpp == 8
                and off_bits == 1078
                and abs(size - (off_bits + row * abs(height))) <= 4
            )
            if plausible:
                found.append((i, size, width, height, bpp))
        i += 2
    return found


def bmp8_to_png(data: bytes, offset: int, size: int) -> bytes:
    """Convert an embedded 8-bit BMP to a paletted PNG (stdlib only)."""
    bmp = data[offset : offset + size]
    off_bits = struct.unpack_from("<I", bmp, 10)[0]
    width = struct.unpack_from("<i", bmp, 18)[0]
    height = struct.unpack_from("<i", bmp, 22)[0]
    top_down = height < 0
    abs_h = abs(height)
    stride = ((width * 8 + 31) // 32) * 4

    raw = bytearray()
    for y in range(abs_h):
        src_row = y if top_down else (abs_h - 1 - y)
        start = off_bits + src_row * stride
        raw.append(0)  # PNG filter type "None"
        raw += bmp[start : start + width]

    palette = bmp[54 : 54 + 1024]

    def chunk(tag: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)

    plte = bytearray()
    for i in range(256):
        b, g, r, _a = palette[i * 4 : i * 4 + 4]
        plte += bytes([r, g, b])

    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, abs_h, 8, 3, 0, 0, 0)),
            chunk(b"PLTE", bytes(plte)),
            chunk(b"IDAT", zlib.compress(bytes(raw), 6)),
            chunk(b"IEND", b""),
        ]
    )


def looks_like_name(data: bytes, i: int) -> bool:
    if i >= len(data):
        return False
    length = data[i]
    if not 1 <= length <= 60:
        return False
    name = data[i + 1 : i + 1 + length]
    return all(32 <= c < 127 for c in name)


def parse_form_names(data: bytes, offset: int, limit: int = 600) -> list[str]:
    """Parse a VB3 form record's length-prefixed name/control list."""
    names: list[str] = []
    i = offset - 1  # the form name itself is length-prefixed too
    zeros = 0
    while i < min(offset + limit, len(data)) and len(names) < 80:
        if looks_like_name(data, i):
            length = data[i]
            names.append(data[i + 1 : i + 1 + length].decode("latin1"))
            i += 1 + length
            zeros = 0
        elif data[i] == 0:
            i += 1
            zeros += 1
            if zeros > 3:
                break
        else:
            break
    return names


def main() -> None:
    data = EXE_PATH.read_bytes()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bitmaps = find_bitmaps(data)
    manifest = []
    for index, (offset, size, width, height, _bpp) in enumerate(bitmaps):
        stem = NAMED_BITMAPS.get(offset, f"bitmap_{index:02d}_{width}x{height}")
        out_path = OUT_DIR / f"{stem}.png"
        out_path.write_bytes(bmp8_to_png(data, offset, size))
        manifest.append(
            {
                "file": out_path.name,
                "exe_offset": f"0x{offset:x}",
                "width": width,
                "height": height,
                "bmp_size": size,
            }
        )

    forms = {name: parse_form_names(data, off) for name, off in FORM_OFFSETS.items()}

    (OUT_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "source": "assets/original/RSTEIN.EXE",
                "bitmap_count": len(manifest),
                "bitmaps": manifest,
                "forms": forms,
            },
            indent=2,
        )
        + "\n"
    )

    print(f"Wrote {len(manifest)} PNGs and manifest.json to {OUT_DIR}")


if __name__ == "__main__":
    main()
