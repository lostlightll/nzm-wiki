"""Decode selected FModel mip payloads, verify PNGs and add missing reference images."""
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image

root = Path(sys.argv[1]).resolve()
destination_root = Path(sys.argv[2]).resolve()
manifest_path = root / "images.jsonl"
if manifest_path.exists():
    raise FileExistsError("Image manifest already exists; use a fresh export.")

with manifest_path.open("x", encoding="utf-8") as manifest:
    for line in (root / "manifest.jsonl").read_text(encoding="utf-8-sig").splitlines():
        entry = json.loads(line)
        if entry["status"] != "exported":
            continue
        try:
            relative = Path(entry["path"])
            if relative.is_absolute() or ".." in relative.parts or relative.parts[0] != "UI":
                raise ValueError("Invalid UI image path")
            source = root / relative.with_suffix(".bin")
            target = root / relative.with_suffix(".png")
            destination = destination_root / relative.with_suffix(".png")
            if target.exists():
                raise FileExistsError("PNG already exists")
            payload = source.read_bytes()
            if hashlib.sha256(payload).hexdigest().upper() != entry["payloadSha256"]:
                raise ValueError("Payload hash mismatch")
            size = entry["width"], entry["height"]
            pixel_format = entry["format"]
            formats = {"PF_BC7": 7, "PF_DXT5": 3, "PF_DXT1": 1, "PF_DXT3": 2, "PF_BC5": 5}
            if pixel_format in formats:
                mode = "RGB" if pixel_format == "PF_BC5" else "RGBA"
                image = Image.frombytes(mode, size, payload, "bcn", formats[pixel_format])
            elif pixel_format == "PF_B8G8R8A8":
                image = Image.frombytes("RGBA", size, payload, "raw", "BGRA")
            elif pixel_format == "PF_G8":
                image = Image.frombytes("L", size, payload)
            elif pixel_format == "PF_R8G8B8A8":
                image = Image.frombytes("RGBA", size, payload)
            else:
                raise ValueError(f"Unsupported pixel format: {pixel_format}")
            with target.open("xb") as output:
                image.save(output, format="PNG")
            with Image.open(target) as check:
                check.verify()
            with Image.open(target) as check:
                if check.size != size:
                    raise ValueError("PNG dimension mismatch")
            png = target.read_bytes()
            entry["pngSha256"] = hashlib.sha256(png).hexdigest()
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.exists():
                entry["status"] = "existing-preserved"
                entry["existingSha256"] = hashlib.sha256(destination.read_bytes()).hexdigest()
            else:
                with destination.open("xb") as output:
                    output.write(png)
                if hashlib.sha256(destination.read_bytes()).hexdigest() != entry["pngSha256"]:
                    raise ValueError("Reference PNG hash mismatch")
                entry["status"] = "published"
        except Exception as error:
            entry["status"] = "decode-failed"
            entry["error"] = str(error)
        manifest.write(json.dumps(entry, ensure_ascii=False) + "\n")
        manifest.flush()

counts = {}
for line in manifest_path.read_text(encoding="utf-8").splitlines():
    status = json.loads(line)["status"]
    counts[status] = counts.get(status, 0) + 1
print(json.dumps(counts))
