import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createNumModifierResolver, type NumModifierValueExpression } from "../../lib/num-modifier";
import { NUM_MODIFIER_LOCK, NUM_MODIFIER_SEMANTICS } from "../../lib/num-modifier-data";
import type { OverlimitCard, PerkEffectValue, PerkSlot } from "../../types";
import { PREVIEW_CARD_MECHANICS } from "./preview-card-mechanics";
import multiplierData from "../../data/guides/multiplier.json";
import type { ModifierRecipient } from "../../lib/num-modifier-semantics";

type Row = Record<string, unknown>;
type Rows = Record<string, Row>;
type ReviewedNative = { description: string; rows?: (NumModifierValueExpression & { condition?: string; recipient?: ModifierRecipient; label?: string })[]; evidence: string[]; partial?: string };
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const localized = (value: unknown): string => typeof value === "string" ? value : String(object(value).LocalizedString ?? object(value).SourceString ?? "");
const clean = (text: string) => text.replace(/[\u200b\ufeff]/g, "").replace(/<[^>]*>/g, "").trim();
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const number = (value: number) => String(Number(value.toFixed(6)));
const indexedFacets = new Set(multiplierData.damageChannelMatrix.channels.map(channel => channel.facetId));

/** Structured CDO properties whose player-facing meanings were individually checked. */
const CDO_DETAILS: Record<string, [string, string, number?][]> = {
  "20703040435": [["TriggerInterval", "叠层间隔", 1]], "20703040436": [["TriggerInterval", "叠层间隔", 1]],
  "20703040090": [["CheckNum", "触发命中次数"], ["CooldownDuration", "冷却", 1]],
  "20703040437": [["Probability", "触发概率", 100], ["CooldownDuration", "配置冷却", 1]],
  "20703040438": [["AddNum", "穿透增加"]], "20703040439": [["Probability", "刷新概率", 100]],
  "20703040442": [["AddBulletNum", "过充弹药"], ["CooldownDuration", "冷却", 1]],
  "20703040443": [["Probability", "触发概率", 100], ["AddBulletNum", "额外弹道"], ["CooldownDuration", "冷却", 1]],
  "20703040088": [["CheckHitNum", "触发伤害次数"]], "20703040284": [["TriggerNum", "触发弱点命中次数"], ["CooldownDuration", "冷却", 1]],
  "20703040092": [["Threshold", "触发弱点命中次数"], ["BuffDuration", "狂热持续", 1], ["CDSecond", "冷却", 1]],
  "20703040202": [["DmgTrigger", "累计伤害阈值"], ["ExplosionNum", "爆炸次数"], ["CooldownDuration", "冷却", 1]],
  "20703040263": [["Probability", "触发概率", 100], ["CooldownDuration", "冷却", 1]],
  "20703040330": [["TriggerTime", "移动触发间隔", 1]], "20703040332": [["AddReboundNum", "额外弹射"]],
  "20703040341": [["TriggerNum", "触发命中次数"]], "20703040469": [["Probability", "触发概率", 100]],
  "20703040391": [["CooldownDuration", "冷却", 1]], "20703040407": [["CustomCD", "狂热冷却", 1]],
  "20703040406": [["CD", "恢复生命冷却", 1]], "20703040112": [["ShootThreshold", "连续射击阈值"]],
  "20703040116": [["TriggerPeriod", "叠层间隔", 1]], "20703040201": [["DmgTrigger", "累计伤害阈值"]],
  "20703040302": [["CoolDuration", "冷却", 1]], "20703040107": [["ChargeValue", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040200": [["DmgTrigger", "累计伤害阈值"], ["CooldownDuration", "冷却", 1]],
  "20703040003": [["Probability", "触发概率", 100], ["AmmoCount", "填充弹药"], ["CooldownDuration", "冷却", 1]],
  "20703040252": [["Probability", "触发概率", 100], ["AmmoCount", "填充弹药"]],
  "20703040012": [["TriggerCount", "暴击次数"], ["AmmoCount", "填充弹药"]],
  "20703040199": [["DmgTrigger", "累计伤害阈值"], ["ReloadAmmoPercent", "过充比例", 100], ["CooldownDuration", "冷却", 1]],
  "20703040384": [["CheckFireNum", "连续开火阈值"]], "20703040078": [["TriggerValue", "弱点命中次数"], ["AmmoCount", "填充弹药"]],
  "20703040021": [["AddEnergyNum", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040351": [["CooldownDuration", "冷却", 1]], "20703040355": [["AOEInterval", "冲击环间隔", 1]],
  "20703040470": [["Probability_Mode1", "模式一概率", 100], ["AddBullet_Mode1", "模式一额外弹道"], ["Probability_Mode2", "模式二概率", 100], ["AddBullet_Mode2", "模式二额外弹道"]],
  "20703040338": [["CheckHitNum", "累计命中阈值"], ["CooldownDuration", "冷却", 1]],
  "20703040339": [["BulletNumAdd", "额外抛体"]], "20703040346": [["cd", "冷却", 1]],
  "20703040393": [["AddChargeValue", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040388": [["Probability", "触发概率", 100]], "20703040001": [["Probability", "不消耗备弹概率", 100]],
  "20703040004": [["AmmoCount", "填充弹药"], ["CooldownDuration", "冷却", 1]], "20703040005": [["AmmoCount", "填充弹药"], ["CooldownDuration", "冷却", 1]],
  "20703040025": [["CooldownDuration", "配置冷却", 1]], "20703040066": [["Value", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040068": [["Value", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]], "20703040080": [["ChargeRatio", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040103": [["TriggerCount", "触发命中次数"], ["ChargeValue", "直接充能", 0.01]],
  "20703040129": [["AddEnergy", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]], "20703040132": [["AddEnergy", "直接充能", 0.01], ["CooldownDuration", "冷却", 1]],
  "20703040150": [["TriggerValue", "末尾弹药阈值"]], "20703040471": [["LaunchNum1", "通常导弹数"], ["LaunchNum2", "单目标导弹数"], ["CooldownDuration", "冷却", 1]],
  "20703040472": [["AOEInterval", "冲击波间隔", 1], ["AOEDuration", "持续", 1]], "20703040473": [["DamageThreshold", "累计伤害阈值"]],
  "20703040474": [["CooldownDuration", "冷却", 1]], "20703040526": [["Add Bullet Ratio", "过充比例", 100], ["Check Bullet Ratio", "强化弹药比例", 100]],
  "20703040527": [["Check Num", "触发命中次数"], ["Ammo Percent", "装填比例", 100]], "20703040529": [["Add Charge Value", "直接充能", 0.01]],
  "20703040523": [["SpawnEffectZoneInterval", "电弧生成间隔", 1]], "20703040522": [["AddBuffInterval", "动能积攒间隔", 1], ["CustomCD", "冷却", 1]],
  "20703040514": [["CustomCD", "二次伤害冷却", 1]], "20703040478": [["CheckBuffStack", "贯穿触发层数"]],
  "20703040482": [["CheckKillNum", "延时所需击杀"], ["AddBuffDurationByKill", "延长持续", 1]],
  "1317113001": [["TriggerInterval", "叠层间隔", 1]], "1317128001": [["CooldownDuration", "冷却", 1]], "1317129001": [["CooldownDuration", "冷却", 1]],
};

export async function generatePreviewCards(contentRoot: string, options: { publicRoot?: string; iconRoot?: string } = {}) {
  const root = path.resolve(contentRoot);
  const provenanceFiles = new Map<string, { path: string; sha256: string }>();
  function read(relative: string): unknown {
    const bytes = fs.readFileSync(path.join(root, relative));
    provenanceFiles.set(relative, { path: relative, sha256: digest(bytes) });
    return JSON.parse(bytes.toString("utf8"));
  }
  function rows(relative: string): Rows {
    const table = asArray(read(relative)).map(object).find(item => item.Rows);
    if (!table) throw new Error(`Missing Rows: ${relative}`);
    return object(table.Rows) as Rows;
  }
  const cardRows = rows("DataTables/HuntingGroundRoguelike/HuntingGroundRoguelikeWeaponModTable.json");
  const mods = rows("DataTables/LuaDataTable/WeaponModItemData.json");
  const passives = rows("DataTables/MGE/MGEPassive_BD.json");
  const mges = rows("DataTables/MGE/GPModularGameplayEffectTable.json");
  const configs = rows("DataTables/MGE/MGEConfig_Season.json");
  const buffs = rows("DataTables/Buff/BuffConfigDatatableNew.json");
  const numerical = rows("Attributes/AutoGenerate/numerical_modifier_config.json");
  const sets = rows("DataTables/LuaDataTable/WeaponModSetTable.json");
  const resolver = createNumModifierResolver({ ...NUM_MODIFIER_LOCK, rows: { lc: Object.fromEntries(Object.entries(numerical).map(([key, raw]) => [key, { row_name: key, raw }])) } }, NUM_MODIFIER_SEMANTICS);
  const nativePath = "scripts/overlimit/preview-native-review.json";
  const native: Record<string, ReviewedNative> = fs.existsSync(nativePath) ? JSON.parse(fs.readFileSync(nativePath, "utf8")) : {};
  const ordinaryPath = "scripts/overlimit/preview-ordinary-review.json";
  const ordinary: Record<string, Omit<ReviewedNative, "description">> = fs.existsSync(ordinaryPath) ? JSON.parse(fs.readFileSync(ordinaryPath, "utf8")) : {};
  const sourceLockPath = "scripts/overlimit/preview-card-source-lock.json";
  const sourceLock: { commonFiles: { path: string; sha256: string }[]; cards: Record<string, { path: string; sha256: string }[]> } = JSON.parse(fs.readFileSync(sourceLockPath, "utf8"));
  const checkedSources = new Set<string>();
  function verifySource(source: { path: string; sha256: string }) {
    if (checkedSources.has(source.path)) return;
    const bytes = fs.readFileSync(path.join(root, source.path));
    if (digest(bytes) !== source.sha256) throw new Error(`Reviewed preview evidence drift: ${source.path}; re-audit before regenerating`);
    provenanceFiles.set(source.path, source); checkedSources.add(source.path);
  }
  const cards: OverlimitCard[] = [];
  const evidence: Row[] = [];
  const modsById = new Map(Object.values(mods).map(mod => [String(mod.MODItemID), mod]));

  for (const [id, raw] of Object.entries(cardRows)) {
    if (raw.IsShow !== true) continue;
    const mod = modsById.get(id);
    const passiveKey = mod ? String(mod.PassiveSkill_ID).replace(":", "_") : `${id}_1`;
    const passive = passives[passiveKey];
    if (!passive) throw new Error(`Missing passive identity ${id}/${passiveKey}`);
    const mgeId = String(object(passive.MGE).Id);
    const configId = String(object(passive.MGEConfig).Id);
    const classPath = String(object(mges[mgeId]?.MGEClass).AssetPathName ?? "");
    const classFile = classPath.startsWith("/Game/") ? `${classPath.slice(6).split(".")[0]}.json` : null;
    const exports = classFile && fs.existsSync(path.join(root, classFile)) ? asArray(read(classFile)).map(object) : [];
    const cdo = object(exports.find(item => String(item.Name).startsWith("Default__"))?.Properties);
    const chain: string[] = [`DataTables/MGE/MGEPassive_BD.json#${passiveKey}`, `DataTables/MGE/GPModularGameplayEffectTable.json#${mgeId}`];
    const rowEvidence = new Map<string, { condition?: string; via: string }>();
    function selectModifier(modifier: unknown, via: string, condition?: string) {
      for (const [key, row] of Object.entries(numerical)) {
        if (String(row.ID) === String(modifier) && row.Level === 1) rowEvidence.set(key, { via, condition });
      }
    }
    // Only the generic character-modifier MGE consumes these config fields. Unique Blueprints may ignore them.
    const generic = mgeId === "2001004001";
    if (!generic) {
      if (!sourceLock.cards[id]) throw new Error(`Missing reviewed source hashes for ${id}`);
      for (const source of [...sourceLock.commonFiles, ...sourceLock.cards[id]]) verifySource(source);
    }
    if (generic) for (const parameter of asArray(configs[configId]?.Parameters).map(object)) {
      if (parameter.Name === "CharacterModifierList") for (const modifier of String(parameter.Value).match(/\d+/g) ?? []) selectModifier(modifier, `MGEConfig_Season#${configId}.Parameters.CharacterModifierList`);
    }
    for (const [key, value] of Object.entries(native[id] ? {} : cdo)) {
      if (/^(?:ModifierID(?:_\d+)?|ModiferID|ModifierId|DamageModifier|HitModifierID|modifier)$/.test(key) && typeof value === "number") selectModifier(value, `${classFile}#Default__.Properties.${key}`);
      if (typeof value === "string" && buffs[value]) {
        const buff = buffs[value];
        const condition = Number(buff.StackLimitCount) > 1 && buff.bMagnitudesFactorInStackCount === true ? "每层" : undefined;
        for (const modifier of asArray(buff.GPModifyIDs)) selectModifier(modifier, `${classFile}#Default__.Properties.${key}→BuffConfigDatatableNew#${value}.GPModifyIDs`, condition);
        chain.push(`DataTables/Buff/BuffConfigDatatableNew.json#${value}`);
      }
    }
    for (const expression of native[id]?.rows ?? []) rowEvidence.set(expression.row.slice(3), { via: native[id].evidence.join("; "), condition: expression.condition });
    const effects = new Map<string, PerkEffectValue>();
    const selected: Row[] = [];
    const auditedRows: Row[] = [];
    const unresolved: string[] = [];
    const reviewed = native[id] ?? ordinary[id];
    for (const expression of ordinary[id]?.rows ?? []) rowEvidence.set(expression.row.slice(3), { via: ordinary[id].evidence.join("; "), condition: expression.condition });
    for (const [key, source] of rowEvidence) {
      const row = numerical[key];
      if (!row) throw new Error(`Missing reviewed Numerical ${id}: ${key}`);
      const field = reviewed?.rows?.find(item => item.row === `lc:${key}`)?.field ?? "base";
      const reviewExpression = reviewed?.rows?.find(item => item.row === `lc:${key}`);
      const expression: NumModifierValueExpression = { row: `lc:${key}`, field, ...(reviewExpression?.scale ? { scale: reviewExpression.scale } : {}) };
      auditedRows.push({ expression, via: source.via, raw: row });
      // A zero B1 modifier has no effect; it is not an unresolved formula.
      if (row.GPModifierOp === "B1" && row.BaseValue === 0 && row.CoefValue === 0) continue;
      if (!reviewExpression && row.BaseValue === 0 && row.CoefValue !== 0) { unresolved.push(`${key}: coefficient requires runtime multiplier audit; not published as zero`); continue; }
      try {
        const scope = resolver.describeAttribute(String(row.AttributeName)).scope;
        const resolved = resolver.resolveEffect(expression, { recipient: reviewExpression?.recipient ?? (scope === "damage-event" ? "damage-event" : "unknown") });
        const facet = resolved.facets.find(item => item.consumer === "damage" || item.consumer === "stat" || indexedFacets.has(item.id));
        if (!facet || !["B1", "B2"].includes(String(row.GPModifierOp))) { unresolved.push(`${key}: 属性/运算尚无审定展示语义`); continue; }
        const parameterOnly = facet.consumer === "index";
        const value = resolver.resolveValue(expression, parameterOnly ? "number" : resolved.attribute.quantity === "ratio" ? "signed-percent" : "signed-number").text;
        const stage = { ...(source.condition ? { condition: source.condition } : {}), value };
        const existing = effects.get(facet.id);
        if (existing) { if (!existing.stages.some(item => item.value === value && item.condition === stage.condition)) existing.stages.push(stage); }
        else if (facet.consumer === "damage") effects.set(facet.id, { kind: "damage", modifierTypeId: facet.id, label: reviewExpression?.label ?? facet.label, stages: [stage] });
        else effects.set(facet.id, { kind: "stat", statId: facet.id, label: facet.label, stages: [stage] });
        selected.push({ expression, recipient: resolved.context.recipient, via: source.via, raw: row });
      } catch (error) { unresolved.push(`${key}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    let description = native[id]?.description ?? PREVIEW_CARD_MECHANICS[id];
    if (generic && effects.size) description = [...effects.values()].map(effect => `${effect.label}${effect.stages.map(stage => stage.value).join(" / ")}`).join("；") + "。";
    if (!description) throw new Error(`Missing reviewed mechanics for card ${id}`);
    const verifiedDetails: Row[] = [];
    if (!native[id]) for (const [field, label, format] of CDO_DETAILS[id] ?? []) {
      const value = cdo[field];
      if (typeof value !== "number") throw new Error(`Reviewed CDO field disappeared: ${id}/${field}`);
      const text = format === 100 ? `${number(value * 100)}%` : format === 0.01 ? `${number(value)}%` : format === 1 ? `${number(value)}秒` : number(value);
      description += `${label}${text}；`;
      verifiedDetails.push({ path: `${classFile}#Default__.Properties.${field}`, value, text });
    }
    description = description.replace(/；$/, "。");
    const iconAsset = String(object(raw.IconPath).AssetPathName);
    const iconFile = `${iconAsset.slice(6).split(".")[0]}.png`;
    const iconCandidates = [path.join(root, iconFile), path.join(options.iconRoot ?? "MD/_local/overlimit/preview-icons", iconFile), path.join("public/icons/overlimit/cards", path.basename(iconFile))];
    const iconSource = iconCandidates.find(candidate => fs.existsSync(candidate));
    if (!iconSource) throw new Error(`Missing selected icon ${id}: ${iconFile}; run export-preview-icons.ps1 then decode-preview-icons.py`);
    const iconBytes = fs.readFileSync(iconSource);
    const icon = `/icons/overlimit/preview/${digest(iconBytes).slice(0, 20)}.webp`;
    const destination = path.join(options.publicRoot ?? path.join(process.cwd(), "public"), icon);
    if (!fs.existsSync(destination)) { fs.mkdirSync(path.dirname(destination), { recursive: true }); await sharp(iconBytes).webp({ lossless: true }).toFile(destination); }
    const iconProvenance = iconSource === iconCandidates[0] ? iconFile : path.relative(process.cwd(), iconSource).replaceAll("\\", "/");
    provenanceFiles.set(iconProvenance, { path: iconProvenance, sha256: digest(iconBytes) });
    if (iconSource === iconCandidates[1]) for (const extension of ["uasset", "uexp"]) {
      const relative = iconFile.replace(/\.png$/, `.${extension}`); const bytes = fs.readFileSync(path.join(root, relative));
      provenanceFiles.set(relative, { path: relative, sha256: digest(bytes) });
    }
    const pendingReasons = [
      ...unresolved,
      ...(reviewed?.partial ? [reviewed.partial] : []),
      ...(!generic && !reviewed ? ["卡片执行参数尚未完成审定。"] : []),
    ];
    const partial = pendingReasons.length > 0;
    const perkSlots = asArray(object(mod?.MODSlotIndex).Values);
    const perkSlot = perkSlots.length === 1 && [1, 2, 3, 4].includes(Number(perkSlots[0])) && typeof perkSlots[0] === "number"
      ? perkSlots[0] as PerkSlot : undefined;
    const slot = raw.bSlot4 === true ? 4 : perkSlot;
    const slotEvidence = slot === undefined ? undefined : {
      slot,
      fallback: raw.bSlot4 !== true,
      via: raw.bSlot4 === true
        ? `HuntingGroundRoguelikeWeaponModTable#${id}.bSlot4`
        : `WeaponModItemData#MODItemID=${id}.MODSlotIndex.Values`,
    };
    const card: OverlimitCard = {
      id, ...(mod ? { perkItemId: id } : {}), name: clean(localized(raw.Name)), description, icon,
      quality: raw.Quality as 3 | 4 | 5, ...(slot === undefined ? {} : { slot }),
      applicabilityKnown: false, weaponType: [], weaponItems: [], weaponNames: [],
      tags: asArray(object(raw.ModSetIdList).Values).map(tagId => { const tag = sets[String(tagId)]; if (!tag) throw new Error(`Unknown tag ${tagId}`); return { id: String(tagId), name: localized(tag.SetName), icon: "", tone: String(tag.SetColor ?? "") }; }),
      ...(effects.size ? { effectValues: [...effects.values()] } : {}),
      ...(partial ? { verification: { status: "partial" as const, note: reviewed?.partial ?? (unresolved.length ? "仍有属性或运算尚未完成数值审定。" : "卡片执行参数尚未完成审定。") } } : {}),
    };
    cards.push(card);
    if (slotEvidence) verifiedDetails.push({ slotSource: slotEvidence });
    evidence.push({ id, passiveKey, mgeId, configId, classFile, sourceDescription: clean(localized(raw.OverrideDesc)), publicationDescription: description, selected, auditedRows, verifiedDetails, iconSource: iconProvenance, iconFallback: iconSource === iconCandidates[2], chain: [...chain, ...(reviewed?.evidence ?? [])], numericAudit: partial ? "partial" : "verified", unresolved: pendingReasons });
  }
  return { cards, independentDamage: {}, provenanceFiles: [...provenanceFiles.values()], evidence };
}
