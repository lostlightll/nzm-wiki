/** ItemID -> CommonItem.NormalIcon -> reference PNG -> public PNG/lossless WebP.
 * Read-only by default. --write updates only selected icons and their MDX icon line.
 * Existing ItemID-qualified names are stable; conflicting shared basenames get an
 * ItemID suffix. --report <local JSON path> records the complete identity audit.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import sharp from "sharp";

const root = process.cwd();
const args = process.argv.slice(2);
const argument = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const content = path.resolve(root, argument("--content-root", "refs/Exports/NZM/Content"));
const reportPath = path.resolve(root, argument("--report", "MD/_local/perk-icons/report.json"));
const write = args.includes("--write");
const pngRoot = path.join(root, "public/icons/perks");
const webpRoot = path.join(root, "public/webp/icons/perks");
const hash = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const readFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? readFiles(path.join(directory, entry.name))
    : entry.name.endsWith(".mdx") ? [path.join(directory, entry.name)] : []);

async function pixels(bytes: Buffer) {
  const result = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // RGB under fully transparent pixels is not observable and PNG/WebP may omit it.
  for (let offset = 0; offset < result.data.length; offset += 4) {
    if (result.data[offset + 3] === 0) result.data.fill(0, offset, offset + 3);
  }
  return { width: result.info.width, height: result.info.height,
    hash: hash(Buffer.concat([Buffer.from(`${result.info.width}x${result.info.height}:`), result.data])) };
}

async function main() {
  const tablePath = path.join(content, "DataTables/System/Items/CommonItemDataTable.json");
  const rows = JSON.parse(fs.readFileSync(tablePath, "utf8"))[0].Rows as Record<string, {
    ItemID: number; IconPath?: { NormalIcon?: { AssetPathName?: string } };
  }>;
  const files = readFiles(path.join(root, "data/perks")).sort();
  const seen = new Set<string>();
  const plans = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const data = matter(text).data;
    if (data.draft === true) continue;
    const id = String(data.id);
    if (!/^\d+$/.test(id) || seen.has(id)) throw new Error(`Invalid or duplicate ItemID: ${file}`);
    seen.add(id);
    const row = rows[id];
    if (!row || String(row.ItemID) !== id) throw new Error(`CommonItem identity mismatch: ${id}`);
    const asset = row.IconPath?.NormalIcon?.AssetPathName;
    if (!asset?.startsWith("/Game/UI/") || asset.includes("..")) throw new Error(`Missing exact UI NormalIcon: ${id}`);
    const relative = asset.split(".")[0].slice("/Game/".length) + ".png";
    const source = path.join(content, relative);
    const image = fs.readFileSync(source);
    const decoded = await pixels(image);
    const base = path.basename(source, ".png").replace(/^T_Icons_Plugins_MGE_/, "");
    if (!/^[\w-]+$/.test(base)) throw new Error(`Unsafe icon basename: ${id}`);
    plans.push({ file, text, id, title: String(data.title), previousIcon: String(data.icon ?? ""),
      asset, source: relative, image, decoded, base, icon: base });
  }

  for (const plan of plans) {
    const qualified = `${plan.base}-${plan.id}`;
    const existingBase = path.join(pngRoot, `${plan.base}.png`);
    const conflictingSource = plans.some((other) => other.base === plan.base && other.decoded.hash !== plan.decoded.hash);
    const existingMismatch = fs.existsSync(existingBase) && (await pixels(fs.readFileSync(existingBase))).hash !== plan.decoded.hash;
    if (plan.previousIcon === qualified || fs.existsSync(path.join(pngRoot, `${qualified}.png`)) || conflictingSource || existingMismatch) {
      plan.icon = qualified;
    }
    const otherOwner = plans.find((other) => other.id !== plan.id && other.previousIcon === plan.icon && other.decoded.hash !== plan.decoded.hash);
    if (otherOwner) throw new Error(`Icon belongs to another ItemID: ${plan.icon}`);
  }

  // Complete every identity/source/collision check before any public asset changes.
  fs.mkdirSync(pngRoot, { recursive: true });
  fs.mkdirSync(webpRoot, { recursive: true });
  const report = [];
  for (const plan of plans) {
    const png = path.join(pngRoot, `${plan.icon}.png`);
    const webp = path.join(webpRoot, `${plan.icon}.webp`);
    const pngChanged = !fs.existsSync(png) || hash(fs.readFileSync(png)) !== hash(plan.image);
    const webpChanged = !fs.existsSync(webp) || (await pixels(fs.readFileSync(webp))).hash !== plan.decoded.hash;
    const metadataChanged = plan.previousIcon !== plan.icon;
    if (write) {
      if (pngChanged) fs.writeFileSync(png, plan.image);
      if (webpChanged) {
        const encoded = await sharp(plan.image).webp({ lossless: true, effort: 6 }).toBuffer();
        if ((await pixels(encoded)).hash !== plan.decoded.hash) throw new Error(`WebP pixel mismatch: ${plan.id}`);
        fs.writeFileSync(webp, encoded);
      }
      if (metadataChanged) {
        if (!/^icon:.*$/m.test(plan.text)) throw new Error(`Missing icon line: ${plan.file}`);
        const updated = plan.text.replace(/^icon:.*$/m, `icon: "${plan.icon}"`);
        if (String(matter(updated).data.id) !== plan.id) throw new Error(`MDX identity changed: ${plan.id}`);
        if (fs.readFileSync(plan.file, "utf8") !== plan.text) throw new Error(`MDX changed during icon sync: ${plan.id}`);
        const temporary = `${plan.file}.icon-sync.tmp`;
        try {
          fs.writeFileSync(temporary, updated, { flag: "wx" });
          fs.renameSync(temporary, plan.file);
        } finally {
          if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        }
      }
    }
    report.push({ itemId: plan.id, title: plan.title, source: plan.source, asset: plan.asset,
      previousIcon: plan.previousIcon, icon: plan.icon, pngChanged, webpChanged, metadataChanged,
      sourceSha256: hash(plan.image), pixels: plan.decoded });
  }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const summary = { count: report.length, pngChanged: report.filter((row) => row.pngChanged).length,
    webpChanged: report.filter((row) => row.webpChanged).length, metadataChanged: report.filter((row) => row.metadataChanged).length };
  fs.writeFileSync(reportPath, JSON.stringify({ write, commonItemSha256: hash(fs.readFileSync(tablePath)), summary, entries: report }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
}

void main();
