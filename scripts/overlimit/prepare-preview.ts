import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getActivePreview, getPreviewSeasonKey } from "../../lib/content-preview";
import { parseOverlimitCatalog } from "../../lib/overlimit-catalog";
import { projectOverlimitLinks } from "../../lib/overlimit-links";
import { parseModifierProviderRegistry, type ModifierProviderRegistry, type ModifierProviderRegistrySource } from "../../lib/modifier-provider-registry";
import { modifierRecipientSchema } from "../../lib/num-modifier-semantics";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import { generatePreviewCards } from "./preview-cards";
import { buildPreviewRules } from "./preview-rules";
import { applyPreviewAnnouncement } from "./preview-announcement";
import { checkCatalog } from "./catalog";
import multiplierData from "../../data/guides/multiplier.json";

const selectedSchema = z.object({
  expression: z.object({ row: z.string().startsWith("lc:"), field: z.enum(["base", "coefficient"]), scale: z.number().optional() }),
  raw: z.record(z.string(), z.unknown()),
  recipient: modifierRecipientSchema.optional(),
});
const cardEvidenceSchema = z.object({ id: z.string(), passiveKey: z.string(), chain: z.array(z.string()), selected: z.array(selectedSchema) });
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

/** Publish a preview, or prepare an isolated current candidate for the reviewed activate workflow. */
async function main() {
  const { values } = parseArgs({ options: { "content-root": { type: "string" }, "updated-at": { type: "string" },
    channel: { type: "string", default: "preview" }, "output-directory": { type: "string" },
    "source-lock": { type: "string" }, "rules-review": { type: "string" }, "announcement": { type: "string" }, "source-review": { type: "string" },
  } });
  if (!values["content-root"] || !values["updated-at"]) throw new Error("Usage: tsx scripts/overlimit/prepare-preview.ts --content-root PATH --updated-at YYYY-MM-DD");
  if (!["preview", "current"].includes(values.channel)) throw new Error("Invalid channel");
  const current = values.channel === "current";
  if (current && (!values["output-directory"] || !values["source-lock"] || !values["rules-review"] || !values.announcement)) {
    throw new Error("Current candidates require --output-directory, --source-lock, --rules-review and --announcement");
  }
  const version = read("config/content-version.json");
  const active = current ? { season: version.season as string, version: version.version as string, label: String(version.version).toUpperCase() } : getActivePreview();
  if (!active) throw new Error("Register the next preview in config/content-version.json first");
  const season = current ? undefined : getPreviewSeasonKey(active);
  const cards = await generatePreviewCards(values["content-root"], {
    sourceLockPath: values["source-lock"], iconNamespace: current ? "cards" : "preview",
  });
  const rules = buildPreviewRules(values["content-root"], values["rules-review"]);
  const reviewFiles = [values["rules-review"] ?? "scripts/overlimit/preview-rules-review.json", values["source-review"]]
    .filter((file): file is string => Boolean(file)).map(file => ({ path: file, sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") }));
  const provenance = [...new Map([...cards.provenanceFiles, ...rules.provenanceFiles, ...reviewFiles].map(file => [file.path, file])).values()].sort((a, b) => a.path.localeCompare(b.path));
  const catalog = applyPreviewAnnouncement(parseOverlimitCatalog({
    schemaVersion: 1,
    season: { id: active.version, label: active.label, status: current ? "current" : "preload", updatedAt: values["updated-at"] },
    provenance: { contentRoot: path.relative(process.cwd(), path.resolve(values["content-root"])).replaceAll("\\", "/"),
      note: "预下载客户端审定投影。服务端卡池概率和适用限制未提供；未完成的卡片数值审计逐卡标注。地图排期来自预载配置，非正式上线日期承诺。", files: provenance },
    cards: cards.cards, independentDamage: cards.independentDamage, bonds: rules.bonds, mapRotation: rules.mapRotation, levels: null,
  }), values.announcement ? read(values.announcement) : undefined, values.announcement);
  checkCatalog(catalog, process.cwd());
  const registry: ModifierProviderRegistry = read("data/modifier-providers.json");
  parseModifierProviderRegistry(registry);
  const owns = (source: ModifierProviderRegistrySource) => (source.type === "overlimit-card" || source.type === "overlimit-bond") && source.season === season;
  registry.providers = registry.providers.filter(entry => !owns(entry.source));
  registry.exclusions = registry.exclusions.filter(entry => !owns(entry.source));
  const numerical = current ? { season: active.season, source: provenance.find(file => file.path.startsWith("Attributes/AutoGenerate/")), rows: {} } : read("data/perk-preview-modifiers.json");
  const numericalSource = provenance.find(file => file.path === numerical.source.path);
  if (!current && (numerical.season !== active.season || numericalSource?.sha256 !== numerical.source.sha256)) {
    throw new Error("Preview Numerical source differs from the already reviewed perk/weapon evidence; review together before importing");
  }
  function register(id: string, label: string, source: ModifierProviderRegistrySource,
    selected: z.infer<typeof selectedSchema>[], basis: string[], passiveSkillId?: string, reviewedExclusion?: string) {
    const evidence = { basis, ...(passiveSkillId ? { passiveSkillId } : {}) };
    if (!selected.length) {
      registry.exclusions.push({ id, label, source,
        reasonCode: reviewedExclusion ? "not-damage-multiplier" : "unverified-evidence",
        reason: reviewedExclusion ?? "本版尚无可发布的 Numerical 属性引用；机制与直接执行参数单独保存在本版审定证据，不借用同名普通插件来源。", evidence });
      return;
    }
    for (const item of selected) {
      const key = item.expression.row.slice(3);
      if (numerical.rows[key] && json(numerical.rows[key]) !== json(item.raw)) throw new Error(`Conflicting preview row: ${key}`);
      numerical.rows[key] = item.raw;
    }
    const applications = selected.map(item => ({ expression: item.expression, context: { recipient: item.recipient ?? "unknown" as const } }));
    const resolver = createNumModifierResolver({ ...NUM_MODIFIER_LOCK, rows: { lc: Object.fromEntries(selected.map(item => {
      const key = item.expression.row.slice(3);
      return [key, { row_name: key, raw: item.raw as (typeof NUM_MODIFIER_LOCK.rows.lc)[string]["raw"] }];
    })) } }, NUM_MODIFIER_SEMANTICS);
    const indexedFacets = new Set(multiplierData.damageChannelMatrix.channels.map(channel => channel.facetId));
    const hasMultiplierSource = applications.some(item => {
      const effect = resolver.resolveEffect(item.expression, item.context);
      return effect.facets.some(facet => facet.consumer === "damage" ||
        (facet.consumer === "index" && indexedFacets.has(facet.id)) ||
        (effect.direction === "increase" && indexedFacets.has(facet.id)));
    });
    if (hasMultiplierSource) registry.providers.push({ id, label, source, evidence: { kind: "reviewed-chain", ...evidence }, applications });
    else registry.exclusions.push({ id, label, source, reasonCode: "not-damage-multiplier",
      reason: "审定 Numerical 行仅提供属性效果，不产生增伤乘区；表达式保留供属性审计。", evidence: { ...evidence, applications } });
  }
  for (const raw of cards.evidence) {
    const evidence = cardEvidenceSchema.parse(raw);
    const card = catalog.cards.find(card => card.id === evidence.id)!;
    register(`overlimit-card:${season ? `${season}:` : ""}${card.id}`, `${card.name}（${active.label}超限）`,
      { type: "overlimit-card", id: card.id, ...(season ? { season } : {}) }, evidence.selected, evidence.chain, evidence.passiveKey);
  }
  // Each reviewed stage is independently scoped, including stages without a Numerical modifier.
  const ruleEvidence = z.array(z.object({ name: z.string(), count: z.number().int().positive(),
    selected: z.array(selectedSchema), basis: z.array(z.string()).min(1), exclusion: z.string().trim().min(1).optional(),
  })).parse(rules.providerEvidence);
  const remainingStages = new Set(catalog.bonds?.flatMap(bond => bond.effects.map(effect => `${bond.name}:${effect.count}`)));
  for (const stage of ruleEvidence) {
    const key = `${stage.name}:${stage.count}`;
    if (!remainingStages.delete(key)) throw new Error(`Duplicate or unpublished bond stage evidence: ${key}`);
    if (Boolean(stage.selected.length) === Boolean(stage.exclusion)) {
      throw new Error(`Bond stage must have Numerical applications or an explicit reviewed exclusion: ${key}`);
    }
    const published = catalog.bonds!.find(bond => bond.name === stage.name)!.effects.find(effect => effect.count === stage.count)!;
    const basis = [...stage.basis];
    if (published.overrides?.length) basis.push(`本档替代原阶段序号 ${published.overrides.join("、")}；索引分别列出来源，不表示各档效果可重复叠加。`);
    register(`overlimit-bond:${season ? `${season}:` : ""}${stage.name}:${stage.count}`,
      `${stage.name} ${stage.count}件（${active.label}）`, { type: "overlimit-bond", name: stage.name, count: stage.count, ...(season ? { season } : {}) },
      stage.selected, basis, undefined, stage.exclusion);
  }
  if (remainingStages.size) throw new Error(`Missing bond stage evidence: ${[...remainingStages].join(", ")}`);
  parseModifierProviderRegistry(registry);
  if (current) {
    const output = path.resolve(values["output-directory"]!);
    const relative = path.relative(path.resolve("MD/_local"), output);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || fs.existsSync(output)) throw new Error("Current candidate output must be a new MD/_local directory");
    fs.mkdirSync(output, { recursive: true });
    const candidate = {
      "catalog.json": catalog,
      "evidence.json": { schemaVersion: 1, season: active.season, cards: cards.evidence, rules: rules.evidence },
      "providers.json": { schemaVersion: registry.schemaVersion, providers: registry.providers.filter(entry => owns(entry.source)), exclusions: registry.exclusions.filter(entry => owns(entry.source)) },
      "numerical.json": numerical,
    };
    for (const [file, value] of Object.entries(candidate)) fs.writeFileSync(path.join(output, file), json(value), { flag: "wx" });
    console.log(`${active.label}: prepared ${catalog.cards.length} cards and ${catalog.bonds?.length} bonds in ${output}. No shared registry or Lock written.`);
    return;
  }
  const writes: Record<string, unknown> = {
    "data/overlimit/preview.json": catalog,
    "data/overlimit/preview-links.json": { season, ...projectOverlimitLinks(catalog) },
    "data/overlimit/preview-evidence.json": { schemaVersion: 1, season, cards: cards.evidence, rules: rules.evidence },
    "data/perk-preview-modifiers.json": numerical,
    "data/modifier-providers.json": registry,
  };
  for (const [file, value] of Object.entries(writes)) fs.writeFileSync(file, json(value));
  console.log(`${active.label}: ${catalog.cards.length} cards, ${catalog.bonds?.length} bonds, ${catalog.mapRotation?.periods.length} map periods. Run pnpm num-modifier:project and pnpm build.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
