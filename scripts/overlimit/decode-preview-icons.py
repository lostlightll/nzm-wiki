"""Decode only the selected card mip payloads produced by export-preview-icons.ps1."""
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else "MD/_local/overlimit/preview-icons")
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8-sig"))
for entry in manifest:
    if entry.get("missing"):
        continue
    source = root / (entry["path"] + ".bin")
    target = root / (entry["path"] + ".png")
    if target.exists():
        continue
    size = (entry["width"], entry["height"])
    pixel_format = entry["format"]
    payload = source.read_bytes()
    if pixel_format == "PF_BC7":
        image = Image.frombytes("RGBA", size, payload, "bcn", 7)
    elif pixel_format == "PF_DXT5":
        image = Image.frombytes("RGBA", size, payload, "bcn", 3)
    elif pixel_format == "PF_DXT1":
        image = Image.frombytes("RGBA", size, payload, "bcn", 1)
    elif pixel_format == "PF_B8G8R8A8":
        image = Image.frombytes("RGBA", size, payload, "raw", "BGRA")
    else:
        raise ValueError(f"Unsupported selected texture format: {pixel_format}: {source}")
    image.save(target)
print(f"Decoded {sum(not entry.get('missing', False) for entry in manifest)} selected card textures; {sum(bool(entry.get('missing')) for entry in manifest)} source gaps recorded")
