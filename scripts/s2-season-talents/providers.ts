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
  const confirmed = new Map<number, { ids: number[]; basis: string[]; recipient: "damage-event" | "unknown"; field?: "base" | "coefficient" }>();
  const missingChains = new Map<number, string[]>();
  const configs = rows("DataTables/MGE/MGEConfig_Season");
  const mainConfigs = rows("DataTables/MGE/DT_MGEParamConfig_Main");
  for (const id of [1319033001, 1319033002, 1319033007, 1319033004, 1379020070, 1379020090, 1379020120, 1379020200, 1379020170]) {
    const p = passive[`${id}_1`];
    const configId = (p.MGEConfig as { Id: string }).Id;
    const mgeId = (p.MGE as { Id: string }).Id;
    const mgeClass = (mges[mgeId].MGEClass as { AssetPathName: string }).AssetPathName;
    const basis = [`${root}DataTables/MGE/MGEPassive_Season.json:${id}_1.MGE.Id=${mgeId}; MGEConfig.Id=${configId}`, `${root}DataTables/MGE/GPModularGameplayEffectTable.json:${mgeId}.MGEClass=${mgeClass}`];
    for (const [file, table] of [["MGEConfig_Season", configs], ["DT_MGEParamConfig_Main", mainConfigs]] as const) {
      const config = table[configId];
      if (config) {
        for (const key of ["Parameters", "MGEPassiveParameters", "MGEIdParameters", "MGEParamIdParameters", "MGCIdParameters", "MGEClassParameters", "MGEObjectParameters"]) assert.deepEqual(config[key], []);
        basis.push(`${root}DataTables/MGE/${file}.json:${configId} 的全部参数数组为空，缺少 Modifier/Buff 绑定。`);
      } else basis.push(`${root}DataTables/MGE/${file}.json:缺少 ConfigId=${configId} 行。`);
    }
    if (mgeClass.startsWith("/Game/")) {
      const file = mgeClass.split(".")[0].replace(/^\/Game\//, "");
      const properties = asset(file).find(item => item.Name.startsWith("Default__"))!.Properties!;
      assert.equal(properties.ModifierID, undefined);
      assert.equal(properties.BuffName, undefined);
      basis.push(`${root}${file}.json:Default__ 未保存 ModifierID/BuffName，且 JSON 未导出执行连线；描述 Token 和函数变量名不能补足属性身份。`);
    }
    missingChains.set(id, basis);
  }
  for (const id of [1319031007, 1319031008, 1319031011, 1379020160, 1319032002, 1319032005, 1319032008]) {
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
    } else if (id === 1319032005 || id === 1319032008) {
      const skillFile = "Abilities/Skills/Season/S3/YHFS/SKT_S3_YHFS2";
      const skillProperties = asset(skillFile).find(item => item.Name.startsWith("Default__"))!.Properties!;
      const [skillKey, buffKey] = id === 1319032005
        ? ["side1-DamageUp", "side1-DamageUpBuffName"]
        : ["side4-Phase2DamageUp", "side4-DamageUpBuffName"];
      assert.equal(skillProperties[skillKey], id);
      const buffName = skillProperties[buffKey] as string;
      assert.ok(buffName && buffs[buffName]);
      ids = buffs[buffName].GPModifyIDs as number[];
      basis.push(`${root}${skillFile}.json:Default__.${skillKey}=${id}`, `${root}${skillFile}.json:Default__.${buffKey}=${buffName}`, `${root}DataTables/Buff/BuffConfigDatatableNew.json:${buffName}.GPModifyIDs=${ids.join(",")}`);
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
    if ([1379020160, 1319032002, 1319032005, 1319032008].includes(id)) {
      basis.push("默认属性中的技能/Buff 引用仅确认配置身份；历史 JSON 未导出执行连线，不确认实际加载对象、接收者、动态等级或叠层。仅用 Level=1 基准行识别属性分面。");
    }
    confirmed.set(id, { ids, basis, recipient: [1319031007, 1319031008].includes(id) ? "damage-event" : "unknown" });
  }
  // Explicitly reviewed talent-to-Modifier identities supplied by the maintainer.
  // These publish attribute facets, not proof of Blueprint execution or stacking.
  for (const [skill, modifier, attributeNames] of [
    [1319033001, 160303001, ["GPAttributeSetGiveDamageRatio.WeaponHitDamageRatio", "GPAttributeSetGiveDamageRatio.WeaponExplodeDamageRatio"]],
    [1319033002, 160303005, ["GPAttributeSetCritical.CriticalDamageRatio"]],
    [1319033007, 160303004, ["GPAttributeSetCritical.CriticalDamageRatio"]],
    [1319033004, 160303006, ["GPAttributeSetGiveDamageRatio.WeaponHitDamageRatio", "GPAttributeSetGiveDamageRatio.WeaponExplodeDamageRatio"]],
  ] as const) {
    const modifierRows = Object.entries(numerical).filter(([, row]) => row.ID === modifier && row.Level === 1);
    assert.deepEqual(modifierRows.map(([, row]) => row.AttributeName).sort(), [...attributeNames].sort());
    assert.ok(modifierRows.every(([, row]) => row.GPModifierOp === "B1"));
    confirmed.set(skill, {
      ids: [modifier], recipient: "unknown",
      basis: [
        `2026-09-12 维护者明确确认匿踪天赋 PassiveSkill=${skill} -> ModifierID=${modifier}，用于乘区索引；不是按描述文本自动匹配。`,
        ...modifierRows.map(([name]) => `${snapshotPath}#lock.rows.lc.${name}，以历史 Numerical 的 AttributeName 和 GPModifierOp 识别增伤分面。`),
        "该映射不声称历史蓝图调用链已补全；触发、运行时接收者与叠层仍不由索引推断。",
      ],
    });
  }
  for (const [skill, modifier, field] of [
    [1379020070, 111030002, "base"],
    [1379020090, 111030003, "base"],
    [1379020120, 111030006, "coefficient"],
  ] as const) {
    const damageRows = Object.entries(numerical).filter(([, row]) => row.ID === modifier && row.Level === 1 && String(row.AttributeName).startsWith("GPAttributeSetGiveDamageRatio."));
    assert.deepEqual(damageRows.map(([, row]) => row.AttributeName).sort(), ["Fire", "Corossive", "Cryo", "Shock"].map(element => `GPAttributeSetGiveDamageRatio.${element}DebuffDamageRatio`).sort());
    confirmed.set(skill, {
      ids: [modifier], recipient: "unknown", field,
      basis: [
        `2026-09-12 人工核对天赋数值引用 PassiveSkill=${skill} -> ModifierID=${modifier}，按元素异常增伤归入大稀释乘区。`,
        `data/season-talents/s2/evidence.json#${skill}_1.rows；${snapshotPath}#lock.rows.lc.${modifier}_1_0`,
        "索引仅登记增伤属性；持续时间、异常施加概率不作为乘区，动态接收者与叠层不由索引推断。",
      ],
    });
  }
  const enhancedShot = numerical["111030011_1_0"];
  assert.equal(enhancedShot.ID, 111030011);
  assert.equal(enhancedShot.AttributeName, "GPAttributeSetGiveDamageRatio.WeaponDamageRatio");
  assert.equal(enhancedShot.GPModifierOp, "B1");
  confirmed.set(1379020200, {
    ids: [111030011], recipient: "unknown", field: "coefficient",
    basis: [
      "2026-09-12 人工核对强化射击 PassiveSkill=1379020200 -> ModifierID=111030011；登记属性索引，不宣称蓝图执行链已补全。",
      "data/season-talents/s2/evidence.json#1379020200_1.rows=s2:111030011_1_0，核对既有天赋数值引用。",
      `${snapshotPath}#lock.rows.lc.111030011_1_0：WeaponDamageRatio，B1，使用 CoefValue 识别每层增伤；BaseValue 为零，不用于判断该效果方向。`,
    ],
  });
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
          const application = { expression: { row: `lc:${name}` as const, field: review.field ?? "base" as const }, context: { recipient: review.recipient } };
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
