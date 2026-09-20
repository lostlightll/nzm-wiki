import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseOverlimitCatalog, type OverlimitCatalog } from "../../lib/overlimit-catalog";
import { checkCatalog } from "./catalog";
import announcement from "./preview-announcement.json";

/** Official availability overrides client affix schedules, not audited numerical effects. */
export function applyPreviewAnnouncement(catalog: OverlimitCatalog): OverlimitCatalog {
  if (catalog.season.id !== announcement.version) return catalog;
  if (!catalog.mapRotation) throw new Error("Missing preview affix schedule");
  const sourcePeriods = catalog.mapRotation.periods;
  catalog.mapRotation.periods = announcement.periods.map(period => {
    const source = sourcePeriods.find(entry => entry.startDate <= period.startDate &&
      (!entry.endDate || period.startDate <= entry.endDate));
    if (!source) throw new Error(`Missing affix period: ${period.startDate}`);
    return { startDate: period.startDate, endDate: period.endDate,
      ...(period.endDate === null ? { endLabel: "赛季结束" } : {}),
      maps: period.maps.map(name => {
        const map = source.maps.find(entry => entry.name === name);
        if (!map) throw new Error(`Missing affix map: ${period.startDate}/${name}`);
        return map;
      }) };
  });
  for (const [id, description] of Object.entries(announcement.cardDescriptions)) {
    const card = catalog.cards.find(entry => entry.id === id);
    if (!card) throw new Error(`Missing announcement card: ${id}`);
    card.description = description;
  }
  for (const update of announcement.bondDescriptions) {
    const stage = catalog.bonds?.find(bond => bond.name === update.name)?.effects.find(effect => effect.count === update.count);
    if (!stage) throw new Error(`Missing announcement bond: ${update.name}/${update.count}`);
    stage.description = update.description;
  }
  catalog.season.updatedAt = announcement.reviewedAt;
  catalog.provenance.note = "S4 预览：副本开放日期按最新官方公告；地图羁绊与已审定数值来自预载配置。公告与配置冲突处单独标注，服务端概率及未审定数值不作推断。";
  const file = "scripts/overlimit/preview-announcement.json";
  catalog.provenance.files = catalog.provenance.files.filter(entry => entry.path !== file);
  catalog.provenance.files.push({ path: file, sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") });
  return parseOverlimitCatalog(catalog);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = "data/overlimit/preview.json";
  const catalog = applyPreviewAnnouncement(parseOverlimitCatalog(JSON.parse(fs.readFileSync(file, "utf8"))));
  checkCatalog(catalog, process.cwd());
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Applied official announcement to ${catalog.season.id}.`);
}
