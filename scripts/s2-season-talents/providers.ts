import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseNumModifierDataLock } from "../../lib/num-modifier-data-lock";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import { parseModifierProviderRegistry, type ModifierProviderRegistry } from "../../lib/modifier-provider-registry";

const root = "refs/Exports/NZM/Content_S2/";
const snapshotPath = "data/season-talents/s2/provider-evidence.json";
type Row = Record<string, unknown>;
type Asset = { Name: string; Properties?: Row; Rows?: Record<string, Row> };
const slugs = ["invisibility", "inferno-arm", "holographic-sync"];

/** Rebuild the historical evidence only; never resolve against the current season lock. */
export function buildS2ProviderEvidence() {
  const sourceHashes: Record<string, string> = {};
  function asset(file: string): Asset[] {
    const raw = readFileSync(root + file + ".json", "utf8");
    sourceHashes[file] = createHash("sha256").update(raw).digest("hex");
    return JSON.parse(raw);
  }
  const rows = (file: string) => asset(file)[0].Rows!;
  const basic = rows("DataTables/SeasonTalent/SeasonTalentBasicTable");
  const passive = rows("DataTables/MGE/MGEPassive_Season");
  const passiveNodes = rows("DataTables/SeasonTalent/SeasonTalentPassiveConfigTable");
  const mges = rows("DataTables/MGE/GPModularGameplayEffectTable");
  const buffs = rows("DataTables/Buff/BuffConfigDatatableNew");
  const numPath = "Attributes/AutoGenerate/numerical_modifier_config";
  const attrPath = "DataTables/AttributeDescMapTable";
  const numerical = rows(numPath);
  const attributes = rows(attrPath);
  const confirmed = new Map<number, { ids: number[]; basis: string[]; recipient: "damage-event" | "unknown" }>();
  const missingChains = new Map<number, string[]>();
  for (const id of [1319031007, 1319031008, 1319031011, 1379020160, 1319032002]) {
    const p = passive[`${id}_1`];
    const mgeId = (p.MGE as { Id: string }).Id;
    const file = (mges[mgeId].MGEClass as { AssetPathName: string }).AssetPathName.split(".")[0].replace(/^\/Game\//, "");
    const blueprint = asset(file);
    const properties = blueprint.find(item => item.Name.startsWith("Default__"))!.Properties!;
    const basis = [`${root}DataTables/MGE/MGEPassive_Season.json:${id}_1.MGE.Id=${mgeId}`, `${root}DataTables/MGE/GPModularGameplayEffectTable.json:${mgeId}.MGEClass`, `${root}${file}.json:Default__`];
    let ids: number[];
    if (typeof properties.ModifierID === "number") {
      ids = [properties.ModifierID];
      basis.push(`Default__.ModifierID=${properties.ModifierID}`);
    } else {
      const key = id === 1319032002 ? "OverclockBuffName" : "BuffName";
      const buffName = properties[key] as string;
      assert.ok(buffName && buffs[buffName]);
      ids = buffs[buffName].GPModifyIDs as number[];
      basis.push(`Default__.${key}=${buffName}`, `${root}DataTables/Buff/BuffConfigDatatableNew.json:${buffName}.GPModifyIDs=${ids.join(",")}`);
    }
    assert.ok(ids.length);
    const signature = id === 1319031007 ? "CallFunc_CreateAsyncAddScopedModifier_ReturnValue" : id === 1319031008 ? "CallFunc_AddScopedModifierForActivatedSkill_ReturnValue" : null;
    if (signature) {
      assert.ok(JSON.stringify(blueprint).includes(`"Name":"${signature}"`));
      basis.push(`${root}${file}.json:ChildProperties.${signature}（限定技能/命中结算的函数签名；非完整执行字节码）`);
    }
    if ([1379020160, 1319032002].includes(id)) {
      missingChains.set(id, [...basis, "Buff 默认属性引用已确认，但历史 JSON 未导出执行连线，无法确认实际加载、接收者及动态等级，暂不发布。"]);
    } else confirmed.set(id, { ids, basis, recipient: [1319031007, 1319031008].includes(id) ? "damage-event" : "unknown" });
  }
  const ids = new Set([...confirmed.values()].flatMap(item => item.ids));
  const selected = Object.fromEntries(Object.entries(numerical).filter(([, row]) => ids.has(row.ID as number)).map(([key, raw]) => [key, { row_name: key, raw }]));
  const usedAttributes = new Set(Object.values(selected).map(row => row.raw.AttributeName));
  const selectedAttributes = Object.fromEntries(Object.entries(attributes).filter(([, row]) => usedAttributes.has(row.attr_realname)).map(([key, raw]) => [key, { row_name: key, raw }]));
  const metadata = (file: string, count: number) => ({ source_path: root + file + ".json", sha256: sourceHashes[file], row_count: count });
  const lock = parseNumModifierDataLock({ schema_version: 2, sources: { lc: { modifiers: metadata(numPath, Object.keys(numerical).length), attribute_descriptions: metadata(attrPath, Object.keys(attributes).length) } }, rows: { lc: selected }, attribute_descriptions: { lc: selectedAttributes } });
  const resolver = createNumModifierResolver(lock, parseNumModifierSemantics(JSON.parse(readFileSync("data/num-modifier-semantics.json", "utf8"))));
  const guide = JSON.parse(readFileSync("data/guides/multiplier.json", "utf8"));
  const damageFacets = new Set(guide.damageChannelMatrix.channels.map((row: { facetId: string }) => row.facetId));
  const providers: ModifierProviderRegistry["providers"] = [];
  const exclusions: ModifierProviderRegistry["exclusions"] = [];
  for (const [index, slug] of slugs.entries()) {
    const tree = JSON.parse(readFileSync(`data/season-talents/s2/${slug}.json`, "utf8"));
    const entries = [...tree.nodes.map((node: { id: string; name: string; sourceIds: number[] }) => ({ node, isPassive: false })), ...tree.passives.map((node: { id: string; name: string; sourceId: number }) => ({ node, isPassive: true }))];
    for (const { node, isPassive } of entries) {
      const sourceRows = isPassive ? Object.values(passiveNodes).filter(row => row.SeasonID === 2 && row.PassiveSkillType === index + 1 && String(row.TalentID) === node.id) : node.sourceIds.map((id: number) => basic[String(id)]);
      assert.ok(sourceRows.length && sourceRows.every(Boolean));
      const identity = { id: `season:s2:${slug}:${isPassive ? "passive:" : ""}${node.id}`, label: `S2 ${tree.name}·${node.name}`, source: { type: "season-talent" as const, season: "s2", tree: slug, ...(isPassive ? { passiveId: node.id } : { nodeId: node.id }) } };
      const skill = Number(isPassive ? sourceRows[0].PassiveSkillsID : sourceRows[0].SeasonSkill || sourceRows[0].TalentSkillsID);
      const review = confirmed.get(skill);
      const basis = [`${root}DataTables/SeasonTalent/${isPassive ? "SeasonTalentPassiveConfigTable" : "SeasonTalentBasicTable"}.json:${node.id} -> ${skill}`];
      const applications: NonNullable<ModifierProviderRegistry["providers"][number]["applications"]> = [];
      if (review) for (const source of sourceRows) {
        const level = isPassive ? 1 : Number(source.TalentILevel);
        const p = passive[`${skill}_${level}`];
        assert.equal((p?.MGE as { Id: string })?.Id, (passive[`${skill}_1`].MGE as { Id: string }).Id);
        basis.push(`${root}DataTables/MGE/MGEPassive_Season.json:${skill}_${level}`);
        // The export proves the modifier identity, not the runtime level argument.
        // A baseline row identifies its facet without claiming dynamic values.
        if (level !== 1) continue;
        for (const [name, row] of Object.entries(selected)) if (review.ids.includes(Number(row.raw.ID)) && row.raw.Level === 1) {
          const application = { expression: { row: `lc:${name}` as const, field: "base" as const }, context: { recipient: review.recipient } };
          if (resolver.resolveEffect(application.expression, application.context, identity.id).facets.some(facet => damageFacets.has(facet.id))) applications.push(application);
        }
      }
      if (applications.length) providers.push({ ...identity, applications, evidence: { kind: "reviewed-chain", passiveSkillId: String(skill), basis: [...basis, ...review!.basis, "Level=1 历史基准行仅用于识别属性分面；JSON 未提供 ModifierLevel 执行参数，动态等级、实际增伤数值与叠层尚未证实。unknown 接收者表示导出属性未证实执行对象，不据描述推断。"] } });
      else exclusions.push({ ...identity, reasonCode: "unverified-evidence", reason: review ? "已连通历史 ModifierID，但当前语义未提供可发布的伤害分面；保留证据等待语义核验，不等同于没有增伤。" : "尚未连通该 S2 节点的可发布增伤属性身份链；描述数值及函数变量名不替代 ModifierID 证据。", evidence: { basis: [...basis, ...(review?.basis ?? []), ...(missingChains.get(skill) ?? [])] } });
    }
  }
  parseModifierProviderRegistry({ schemaVersion: 1, evidencePriority: ["Content_S2 historical identity chain"], providers, exclusions });
  return { schemaVersion: 1, source: root.slice(0, -1), sourceHashes, limitations: "历史蓝图 JSON 保留默认属性和函数签名，未包含完整执行字节码；不宣称接收者 unknown 的运行时对象、叠层或等级动态覆写已获验证。未连通来源显式排除。", lock, providers, exclusions };
}

/** Registry synchronization is offline and uses the reviewed committed snapshot. */
export function syncS2Providers(write = false) {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as { providers: ModifierProviderRegistry["providers"]; exclusions: ModifierProviderRegistry["exclusions"] };
  const registryPath = "data/modifier-providers.json";
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as ModifierProviderRegistry;
  parseModifierProviderRegistry(registry);
  const isS2 = (entry: { source: { type: string; season?: string } }) => entry.source.type === "season-talent" && entry.source.season === "s2";
  if (write) {
    registry.providers = [...registry.providers.filter(entry => !isS2(entry)), ...snapshot.providers];
    registry.exclusions = [...registry.exclusions.filter(entry => !isS2(entry)), ...snapshot.exclusions];
    parseModifierProviderRegistry(registry);
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  } else {
    assert.deepEqual(registry.providers.filter(isS2), snapshot.providers, "S2 provider registry drift");
    assert.deepEqual(registry.exclusions.filter(isS2), snapshot.exclusions, "S2 exclusion registry drift");
  }
  return snapshot;
}

export function syncS2ProviderEvidence(write = false) {
  const snapshot = buildS2ProviderEvidence();
  if (write) writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
  else assert.deepEqual(JSON.parse(readFileSync(snapshotPath, "utf8")), snapshot, "S2 provider evidence drift; rerun scripts/s2-season-talents/providers.ts --refresh");
  console.log(`S2: ${snapshot.providers.length} historical multiplier sources; ${snapshot.exclusions.length} explicit exclusions.`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--refresh")) syncS2ProviderEvidence(true);
  else if (process.argv.includes("--audit")) syncS2ProviderEvidence(false);
  else syncS2Providers(process.argv.includes("--write"));
}
