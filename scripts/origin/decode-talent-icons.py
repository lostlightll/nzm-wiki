"""Decode selected CUE4Parse mip payloads with Pillow; never infer binary offsets."""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image


def decode(entry):
    width, height = entry['width'], entry['height']
    payload = Path(entry['payload']).read_bytes()
    if entry['format'] != 'PF_BC7':
        raise ValueError(f"Unsupported texture format: {entry['format']}")
    expected = ((width + 3) // 4) * ((height + 3) // 4) * 16
    if len(payload) != expected:
        raise ValueError(f"Invalid BC7 payload size: {entry['name']}")
    # DDS_HEADER + DX10 extension: BC7_UNORM, 2D, one array element.
    header = struct.pack('<7I', 124, 0x81007, height, width, expected, 0, 1)
    header += bytes(44)
    header += struct.pack('<II4s5I', 32, 4, b'DX10', 0, 0, 0, 0, 0)
    header += struct.pack('<5I', 0x1000, 0, 0, 0, 0)
    extension = struct.pack('<5I', 98, 3, 0, 1, 0)
    image = Image.open(io.BytesIO(b'DDS ' + header + extension + payload)).convert('RGBA')
    if image.size != (width, height) or image.getbbox() is None:
        raise ValueError(f"Empty or invalid decoded image: {entry['name']}")
    if entry.get('crop'):
        x, y, w, h = entry['crop']
        if x < 0 or y < 0 or x + w > width or y + h > height:
            raise ValueError('Sprite crop outside atlas')
        image = image.crop((x, y, x + w, y + h))
    return image


if __name__ == '__main__':
    entries = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    destination = Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        target = destination / f"{entry['name']}.webp"
        decoded = decode(entry)
        if target.exists():
            with Image.open(target) as existing:
                # Fully transparent RGB may be normalized by an older WebP encoder.
                same = existing.size == decoded.size and all(
                    Image.alpha_composite(Image.new('RGBA', decoded.size, color), existing.convert('RGBA')).tobytes()
                    == Image.alpha_composite(Image.new('RGBA', decoded.size, color), decoded).tobytes()
                    for color in ('black', 'white'))
                if not same:
                    raise FileExistsError(f'Existing image differs; preserve it before replacing: {target}')
        else:
            decoded.save(target, format='WEBP', lossless=True, exact=True)
    print(f'Decoded {len(entries)} game textures.')
