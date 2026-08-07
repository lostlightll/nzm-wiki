"use client";

import { useState } from "react";
import Image from "next/image";
import { CatalogLink } from "@/components/CatalogLink";
import { useWeaponDetail } from "@/components/WeaponDetailContext";
import type { ElementType } from "@/types";
import { getAssetPath } from "@/lib/path";
import {
  getFullReloadTime,
  getNonMainMeleeSources,
  getResolvedFieldValue,
  type ConsumerDamageSource,
  type ConsumerDamageSourceSummary,
  type ConsumerField,
  type WeaponCatalogEntry,
  type WeaponDetailData,
} from "@/lib/weapon-consumers";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";

type DisplaySource = ConsumerDamageSource | ConsumerDamageSourceSummary;

const TOUGHNESS_LABELS = {
  none: "无",
  impulse: "冲击",
  penetration: "贯穿",
  explosion: "爆炸",
} as const;

const ELEMENT_ICONS: Record<ElementType, string> = {
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
  物理: "/icons/elements/kinetic.png",
};

/** 安全保留 1 位小数，避免 IEEE 754 toFixed 陷阱（如 0.15→0.1） */
function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** 百分比格式化：整数去小数，非整数1位 */
function formatPercent(rate: number): string {
  const pct = Math.round(rate * 100 * 10) / 10; // round to 1 decimal
  if (Math.abs(pct - Math.round(pct)) < 0.001) return String(Math.round(pct));
  return pct.toFixed(1);
}

/** 最多保留 2 位小数，尾部 0 去掉，至少保 1 位 */
function formatPrecise(n: number | undefined): string {
  if (n === undefined) return "-";
  const fixed = (Math.round(n * 100) / 100).toFixed(2);
  return fixed.replace(/0+$/, "").replace(/\.$/, ".0");
}

function formatDamageValue(
  base: number | undefined,
  hpMultiplier = 500,
  pellets?: number,
): string {
  if (base === undefined) return "-";

  const damage = round1(base * hpMultiplier);
  if (pellets && pellets > 1) {
    return `${damage} × ${pellets}`;
  }
  return damage;
}

function formatDamage(mode: DisplaySource, hpMultiplier = 500): string {
  return formatDamageValue(
    getResolvedFieldValue(mode.damage.base),
    hpMultiplier,
    getResolvedFieldValue(mode.fire.pellets),
  );
}

function formatMeter(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return `${round1(numberValue)}m`;
}

function formatAttenuationLimit(
  scale: number | string | null | undefined,
): string {
  const scaleValue = Number(scale);
  if (!Number.isFinite(scaleValue)) {
    return "-";
  }
  return `${formatPercent(1 - scaleValue)}%`;
}

function WeaponImage({ name, size = "normal" }: { name: string; size?: "small" | "normal" }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  const height = size === "small" ? "h-24" : "h-28";

  return (
    <div className={`relative ${height} w-full overflow-hidden`}>
      <Image
        src={getAssetPath(`/icons/weapons/normal/${name}.png`)}
        alt={name}
        width={320}
        height={160}
        className="mx-auto h-full w-auto object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function formatValue(val: number | undefined): string {
  if (val === undefined || val === -1) return "-";
  return String(val);
}

function isMeleeWeapon(weapon: {
  useType?: string;
  weaponType: ConsumerField<string>;
  weaponTypeId: ConsumerField<number>;
}): boolean {
  return (
    getResolvedFieldValue(weapon.weaponTypeId) === 13 ||
    weapon.useType === "近战武器" ||
    getResolvedFieldValue(weapon.weaponType) === "近战武器"
  );
}

function getMeleeDamageBase(
  weapon: Pick<WeaponDetailData, "melee">,
  mode: DisplaySource,
  key: "light" | "heavy",
): number | undefined {
  const value = getResolvedFieldValue(weapon.melee[key]);
  if (value !== undefined) return value;
  const base = getResolvedFieldValue(mode.damage.base);
  if (key === "heavy" && base !== undefined && base > 0) return base;
  return undefined;
}

/**
 * 简洁模式卡片 - 只有名称、图片、元素图标
 */
function SimpleCard({ weapon }: { weapon: WeaponCatalogEntry }) {
  const mode = weapon.mainSource;

  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityKey = rarity ? RARITY_KEY_MAP[rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const element = mode
    ? getResolvedFieldValue(mode.element)
    : getResolvedFieldValue(weapon.element);
  const elementIcon = element ? ELEMENT_ICONS[element] : undefined;

  return (
    <CatalogLink
      href={`/weapons${weapon.table === "td" ? "/td" : ""}/${encodeURIComponent(weapon.slug)}`}
    >
      <div
        className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 transition-transform hover:scale-[1.02]`}
      >
        {elementIcon && (
          <div className="absolute right-2 top-2 z-10">
            <Image
              src={getAssetPath(elementIcon)}
              alt={element ?? ""}
              width={20}
              height={20}
            />
          </div>
        )}
        <h3 className="mb-2 text-base font-semibold text-white">{weapon.title}</h3>
        <WeaponImage name={weapon.title} size="small" />
        {!mode && <div className="mt-2 text-xs text-zinc-500">不可攻击</div>}
      </div>
    </CatalogLink>
  );
}

/**
 * 详细模式卡片 - 显示更多属性
 */
function DetailedCard({ weapon }: { weapon: WeaponCatalogEntry }) {
  const mode = weapon.mainSource;
  const [showReloadDetail, setShowReloadDetail] = useState(false);

  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityKey = rarity ? RARITY_KEY_MAP[rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const element = mode
    ? getResolvedFieldValue(mode.element)
    : getResolvedFieldValue(weapon.element);
  const elementIcon = element ? ELEMENT_ICONS[element] : undefined;
  const tags = weapon.tags;
  const hpMul = weapon.table === "td" ? 400 : 500;
  const isMelee = isMeleeWeapon(weapon);
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const scope = getResolvedFieldValue(weapon.scope);
  const fullReload = getFullReloadTime(weapon.changeClip);
  const reloadTime = getResolvedFieldValue(weapon.changeClip.timeBase);
  const reloadRecovery = getResolvedFieldValue(
    weapon.changeClip.reloadRecovery,
  );
  const chargeTime = weapon.activeSkill
    ? getResolvedFieldValue(weapon.activeSkill.chargeTime)
    : undefined;
  const lightMeleeModes = isMelee
    ? getNonMainMeleeSources(weapon)
    : [];

  if (!mode) {
    return (
      <CatalogLink
        href={`/weapons${weapon.table === "td" ? "/td" : ""}/${encodeURIComponent(weapon.slug)}`}
      >
        <div
          className={`relative w-full min-w-0 rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-5`}
        >
          <h3 className="text-xl font-semibold text-white">{weapon.title}</h3>
          <div className="mt-1 text-sm text-zinc-400">{weapon.useType}</div>
          <WeaponImage name={weapon.title} />
          <div className="mt-3 border-t border-zinc-700 pt-3 text-sm text-zinc-500">
            不可攻击
          </div>
        </div>
      </CatalogLink>
    );
  }

  return (
    <CatalogLink
      href={`/weapons${weapon.table === "td" ? "/td" : ""}/${encodeURIComponent(weapon.slug)}`}
    >
      <div
        className={`relative w-full min-w-0 rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-5 transition-shadow hover:shadow-lg hover:shadow-black/20`}
      >
        {elementIcon && (
          <div className="absolute right-4 top-4 z-10">
            <Image
              src={getAssetPath(elementIcon)}
              alt={element ?? ""}
              width={28}
              height={28}
            />
          </div>
        )}

        <h3 className="text-xl font-semibold text-white">{weapon.title}</h3>
        <div className="mt-1 mb-4 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400">
          {weapon.useType && <span>{weapon.useType}</span>}
          {weaponType && <span>· {weaponType}</span>}
          {scope && <span>· {scope}</span>}
          {tags.map((tag) => (
            <span key={tag}>· {tag}</span>
          ))}
        </div>

        <div className="flex justify-center">
          <Image
            src={getAssetPath(`/icons/weapons/normal/${weapon.title}.png`)}
            alt={weapon.title || ""}
            width={320}
            height={160}
            className="h-auto w-full max-w-[320px] object-contain"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-y-2 text-base sm:grid-cols-2 sm:gap-x-6">
          {isMelee ? (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">轻击伤害</span>
                <span className="text-white">
                  {lightMeleeModes.length > 0
                    ? lightMeleeModes
                        .map((source) => formatDamage(source, hpMul))
                        .join(" / ")
                    : formatDamageValue(
                        getResolvedFieldValue(weapon.melee.light),
                        hpMul,
                      )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">重击伤害</span>
                <span className="text-white">
                  {formatDamageValue(
                    getMeleeDamageBase(weapon, mode, "heavy"),
                    hpMul,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">元素异常概率</span>
                <span className="text-white">
                  {getResolvedFieldValue(mode.elementAddRate) === undefined
                    ? "-"
                    : `${formatPercent(getResolvedFieldValue(mode.elementAddRate)!)}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">弱点倍率</span>
                <span className="text-white">
                  {formatValue(getResolvedFieldValue(mode.weaknessMultiplier))}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">单发伤害</span>
                <span className="text-white">{formatDamage(mode, hpMul)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">射速</span>
                <span className="text-white">
                  {formatValue(
                    !weapon.previewRpm ||
                      getResolvedFieldValue(weapon.previewRpm) === undefined
                      ? undefined
                      : Math.round(getResolvedFieldValue(weapon.previewRpm)!),
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">弹夹</span>
                <span className="text-white">
                  {formatValue(getResolvedFieldValue(weapon.magazine))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">总弹量</span>
                <span className="text-white">
                  {formatValue(getResolvedFieldValue(weapon.totalAmmo))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">弱点倍率</span>
                <span className="text-white">
                  {formatValue(getResolvedFieldValue(mode.weaknessMultiplier))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">破韧伤害</span>
                <span className="text-white">
                  {formatValue(getResolvedFieldValue(mode.damage.toughness))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">元素异常概率</span>
                <span className="text-white">
                  {getResolvedFieldValue(mode.elementAddRate) === undefined
                    ? "-"
                    : `${formatPercent(getResolvedFieldValue(mode.elementAddRate)!)}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">技能冷却</span>
                <span className="text-white">{formatValue(chargeTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">完整换弹</span>
                <span className="text-white">
                  {fullReload === undefined
                    ? "-"
                    : `${(Math.ceil(fullReload * 100) / 100).toFixed(2)}s`}
                </span>
              </div>
              <div
                className="flex justify-between cursor-pointer"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReloadDetail(!showReloadDetail); }}
              >
                <span className="text-zinc-500">
                  换弹详情 {showReloadDetail ? "▴" : "▸"}
                </span>
                <span className="text-white">&nbsp;</span>
              </div>
              {reloadTime !== undefined && (
                <div
                  className={`col-span-1 grid min-h-0 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none sm:col-span-2 ${
                    showReloadDetail
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-6">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">换弹动画</span>
                        <span className="text-zinc-300">
                          {reloadTime.toFixed(2)}s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">换弹后摇</span>
                        <span className="text-zinc-300">
                          {(reloadRecovery ?? 0).toFixed(2)}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CatalogLink>
  );
}

/**
 * 列表页武器卡片
 */
export function WeaponCard({
  weapon,
  showDetails = false,
}: {
  weapon: WeaponCatalogEntry;
  showDetails?: boolean;
}) {
  if (showDetails) {
    return <DetailedCard weapon={weapon} />;
  }
  return <SimpleCard weapon={weapon} />;
}

/**
 * 单个模式属性面板（标准 9 字段网格）
 */
function ModeStats({
  mode,
  showName,
  compact,
  hpMultiplier = 500,
}: {
  mode: ConsumerDamageSource;
  showName: boolean;
  compact?: boolean;
  hpMultiplier?: number;
}) {
  const rpmValue = getResolvedFieldValue(mode.fire.rpm);
  const rpm = rpmValue === undefined ? undefined : Math.round(rpmValue);
  const interval = getResolvedFieldValue(mode.fire.interval);
  const attackInterval = getResolvedFieldValue(mode.attack.interval);
  const attackCount = getResolvedFieldValue(mode.attack.count);
  const attackIntervalDisplay =
    attackInterval === undefined
      ? "-"
      : `${attackInterval.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}s`;
  const toughness = getResolvedFieldValue(mode.damage.toughness);
  const weaknessMultiplier = getResolvedFieldValue(mode.weaknessMultiplier);
  const enableWeakness = getResolvedFieldValue(mode.enableWeakness) === true;
  const enableCritical = getResolvedFieldValue(mode.enableCritical) === true;
  const elementAddRate = getResolvedFieldValue(mode.elementAddRate);
  const toughnessType = getResolvedFieldValue(mode.toughness);

  return (
    <div className="mb-3">
      {showName && (
        <h3 className="mb-1.5 text-sm font-semibold text-zinc-300">
          {mode.name}
        </h3>
      )}

      {compact ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          {attackInterval === undefined ? (
            <>
              <Stat label="射速" value={formatValue(rpm)} />
              <Stat
                label="单发耗时"
                value={
                  interval
                    ? `${interval.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}s`
                    : "-"
                }
              />
            </>
          ) : (
            <>
              <Stat label="攻击间隔" value={attackIntervalDisplay} />
              {attackCount !== undefined && (
                <Stat label="攻击次数" value={String(attackCount)} />
              )}
            </>
          )}
        </div>
      ) : (interval === undefined || interval === 0) && attackInterval === undefined ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label={mode.label || "命中伤害"} value={formatDamage(mode, hpMultiplier)} />
          <Stat label="单发破韧值" value={formatPrecise(toughness)} />
          <Stat label="弱点倍率" value={enableWeakness ? formatValue(weaknessMultiplier) : "-"} />
          <Stat
            label="元素异常概率"
            value={
              elementAddRate === undefined
                ? "-"
                : `${formatPercent(elementAddRate)}%`
            }
          />
          <Stat label="暴击" value={enableCritical ? "可暴击" : "否"} />
          <Stat label="弱点" value={enableWeakness ? "可弱点" : "否"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label={mode.label || "命中伤害"} value={formatDamage(mode, hpMultiplier)} />
          <Stat label="单发破韧值" value={formatPrecise(toughness)} />
          <Stat label="弱点倍率" value={enableWeakness ? formatValue(weaknessMultiplier) : "-"} />
          <Stat
            label="元素异常概率"
            value={
              elementAddRate === undefined
                ? "-"
                : `${formatPercent(elementAddRate)}%`
            }
          />
          <Stat label="暴击" value={enableCritical ? "可暴击" : "否"} />
          <Stat label="弱点" value={enableWeakness ? "可弱点" : "否"} />
          {attackInterval === undefined ? (
            <>
              <Stat label="射速" value={formatValue(rpm)} />
              <Stat
                label="单发耗时"
                value={interval ? `${interval.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}s` : "-"}
              />
            </>
          ) : (
            <>
              <Stat label="攻击间隔" value={attackIntervalDisplay} />
              {attackCount !== undefined && (
                <Stat label="攻击次数" value={String(attackCount)} />
              )}
            </>
          )}
          <Stat
            label="破韧类型"
            value={toughnessType ? TOUGHNESS_LABELS[toughnessType] : "-"}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}

function SkillSection({
  modes,
  primaryModes,
  hpMultiplier = 500,
}: {
  modes: readonly ConsumerDamageSource[];
  primaryModes: readonly ConsumerDamageSource[];
  hpMultiplier?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = modes.length > 3;
  const visible = collapsible && !expanded ? modes.slice(0, 2) : modes;
  const hiddenCount = modes.length - 2;

  return (
    <div className="mb-3">
      <h2 className="mb-2 text-sm font-semibold text-zinc-400">
        技能 / 特殊攻击
      </h2>
      {visible.map((m) => {
        const base = getResolvedFieldValue(m.damage.base);
        const isVariant = m.section === "variant" || primaryModes.some(
          (primary) => getResolvedFieldValue(primary.damage.base) === base,
        );
        return <ModeStats key={m.id} mode={m} showName compact={isVariant} hpMultiplier={hpMultiplier} />;
      })}
      {collapsible && !expanded && (
        <div className="text-center">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            展开更多 ({hiddenCount})
          </button>
        </div>
      )}
      {collapsible && expanded && (
        <div className="text-center">
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            收起
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 详情页武器卡片 - 完整版
 */
export function WeaponDetailCard() {
  const { weapon, mainSource: mode } = useWeaponDetail();
  const [showReloadDetail, setShowReloadDetail] = useState(false);
  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityKey = rarity ? RARITY_KEY_MAP[rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];

  if (!mode) {
    return (
      <div className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-6`}>
        <h1 className="text-2xl font-bold text-white">{weapon.title}</h1>
        <div className="mt-1 text-sm text-zinc-400">{weapon.useType}</div>
        <div className="relative my-6 h-32 w-full">
          <Image
            src={getAssetPath(`/icons/weapons/normal/${weapon.title}.png`)}
            alt={weapon.title || ""}
            width={320}
            height={160}
            className="mx-auto object-contain"
          />
        </div>
        <div className="border-t border-zinc-700 pt-4 text-sm text-zinc-500">
          不可攻击
        </div>
      </div>
    );
  }

  const element = getResolvedFieldValue(mode.element);
  const elementIcon = element ? ELEMENT_ICONS[element] : undefined;
  const tags = weapon.tags;
  const hpMul = weapon.table === "td" ? 400 : 500;
  const isMelee = isMeleeWeapon(weapon);
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const scope = getResolvedFieldValue(weapon.scope);
  const fireModes = weapon.damageSources.filter(
    (source) => source.section === "fire_mode",
  );
  const primaryModes = fireModes.length > 0 ? fireModes : [mode];
  const primaryModeIds = new Set(primaryModes.map((source) => source.id));
  const extraModes = weapon.damageSources.filter(
    (source) => !primaryModeIds.has(source.id),
  );
  const lightMeleeModes = isMelee
    ? getNonMainMeleeSources({
        mainSourceId: weapon.mainSourceId,
        meleeSources: weapon.damageSources,
      })
    : [];
  const chargeTime = weapon.activeSkill
    ? getResolvedFieldValue(weapon.activeSkill.chargeTime)
    : undefined;
  const skillDuration = getResolvedFieldValue(weapon.skillDuration);
  const skillBlocking = getResolvedFieldValue(weapon.skillBlocking) === true;
  const showDuration = getResolvedFieldValue(weapon.showDuration) === true;
  const shootingEnergy = getResolvedFieldValue(weapon.shootingEnergy) === true;
  const fullReload = getFullReloadTime(weapon.changeClip);
  const reloadTime = getResolvedFieldValue(weapon.changeClip.timeBase);
  const reloadRecovery = getResolvedFieldValue(
    weapon.changeClip.reloadRecovery,
  );

  const cycleTime =
    chargeTime !== undefined
      ? skillBlocking && skillDuration !== undefined
        ? chargeTime + skillDuration
        : chargeTime
      : null;

  return (
    <div className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-6`}>
      {/* 头部 */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{weapon.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            {weapon.useType && <span>{weapon.useType}</span>}
            {weaponType && <span>· {weaponType}</span>}
            {scope && <span>· {scope}</span>}
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-2">
                <span>·</span>
                <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                  {tag}
                </span>
              </span>
            ))}
          </div>
        </div>
        {elementIcon && (
          <Image
            src={getAssetPath(elementIcon)}
            alt={element ?? ""}
            width={32}
            height={32}
          />
        )}
      </div>

      {/* 武器图片 */}
      <div className="relative mb-6 h-32 w-full">
        <Image
          src={getAssetPath(`/icons/weapons/normal/${weapon.title}.png`)}
          alt={weapon.title || ""}
          width={320}
          height={160}
          className="mx-auto object-contain"
        />
      </div>

      {/* 射击模式 */}
      {isMelee ? (
        <div className="mb-3">
          <h2 className="mb-2 text-sm font-semibold text-zinc-400">近战攻击</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
            <Stat
              label="轻击伤害"
              value={
                lightMeleeModes.length > 0
                  ? lightMeleeModes
                      .map((source) => formatDamage(source, hpMul))
                      .join(" / ")
                  : formatDamageValue(
                      getMeleeDamageBase(weapon, mode, "light"),
                      hpMul,
                    )
              }
            />
            <Stat
              label="重击伤害"
              value={formatDamageValue(getMeleeDamageBase(weapon, mode, "heavy"), hpMul)}
            />
            <Stat label="单发破韧值" value={formatPrecise(getResolvedFieldValue(mode.damage.toughness))} />
            <Stat label="弱点倍率" value={getResolvedFieldValue(mode.enableWeakness) ? formatValue(getResolvedFieldValue(mode.weaknessMultiplier)) : "-"} />
            <Stat
              label="元素异常概率"
              value={
                getResolvedFieldValue(mode.elementAddRate) === undefined
                  ? "-"
                  : `${formatPercent(getResolvedFieldValue(mode.elementAddRate)!)}%`
              }
            />
            <Stat label="暴击" value={getResolvedFieldValue(mode.enableCritical) ? "可暴击" : "否"} />
          </div>
        </div>
      ) : primaryModes.length > 1 ? (
        primaryModes.map((m) => (
          <ModeStats
            key={m.id}
            mode={m}
            showName
            hpMultiplier={hpMul}
          />
        ))
      ) : (
        <div className="mb-3">
          <h2
            className={
              "mb-2 text-sm font-semibold " +
              (extraModes.length > 0
                ? "text-zinc-300"
                : "text-zinc-400")
            }
          >
            {primaryModes[0].name}
          </h2>
          <ModeStats mode={primaryModes[0]} showName={false} hpMultiplier={hpMul} />
        </div>
      )}

      {/* 技能 / 特殊攻击 */}
      {!isMelee && extraModes.length > 0 && (
        <SkillSection modes={extraModes} primaryModes={primaryModes} hpMultiplier={hpMul} />
      )}

      {/* 武器衰减 */}
      {!isMelee && mode.attenuation.status === "applicable" && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-400">武器衰减</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
            <Stat
              label="开始衰减"
              value={formatMeter(mode.attenuation.beginMeters)}
            />
            <Stat
              label="结束衰减"
              value={formatMeter(mode.attenuation.endMeters)}
            />
            <Stat
              label="衰减上限"
              value={formatAttenuationLimit(mode.attenuation.minScale)}
            />
          </div>
        </div>
      )}

      {/* 武器属性 */}
      <div className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">武器属性</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          {!isMelee && <Stat label="弹夹" value={formatValue(getResolvedFieldValue(weapon.magazine))} />}
          {!isMelee && <Stat label="总弹量" value={formatValue(getResolvedFieldValue(weapon.totalAmmo))} />}
          {!isMelee && <Stat label="精准度" value={formatValue(getResolvedFieldValue(weapon.accuracy))} />}
          {!isMelee && <Stat label="稳定度" value={formatValue(getResolvedFieldValue(weapon.stability))} />}
          {!isMelee && showReloadDetail && reloadTime !== undefined ? (
            <>
              <div className="flex justify-between gap-1 text-sm">
                <span className="text-zinc-500 shrink-0">换弹动画</span>
                <span className="text-white text-right">
                  {reloadTime.toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between gap-1 text-sm">
                <span className="text-zinc-500 shrink-0">换弹后摇</span>
                <span className="text-white text-right">
                  {(reloadRecovery ?? 0).toFixed(2)}s
                </span>
              </div>
            </>
          ) : !isMelee ? (
            <Stat
              label="完整换弹"
              value={
                fullReload === undefined
                  ? "-"
                  : `${(Math.ceil(fullReload * 100) / 100).toFixed(2)}s`
              }
            />
          ) : null}
          {!isMelee && (
            <div
              className="flex justify-between gap-1 text-sm cursor-pointer"
              onClick={() => setShowReloadDetail(!showReloadDetail)}
            >
              <span className="text-zinc-500 shrink-0">
                换弹详情 {showReloadDetail ? "▴" : "▸"}
              </span>
              <span className="text-white text-right">&nbsp;</span>
            </div>
          )}
          <Stat
            label="技能冷却"
            value={chargeTime !== undefined ? `${chargeTime}s` : "-"}
          />
          {shootingEnergy && (
            <Stat
              label="射击耗能"
              value={getResolvedFieldValue(weapon.shootingEnergyCount) !== undefined ? `${getResolvedFieldValue(weapon.shootingEnergyCount)}次` : "-"}
            />
          )}
          {showDuration && (
            <Stat
              label="持续时间"
              value={skillDuration !== undefined ? `${skillDuration}s` : "-"}
            />
          )}
          {showDuration && (
            <Stat
              label="周期时长"
              value={cycleTime != null ? `${cycleTime}s` : "-"}
            />
          )}
        </div>
      </div>

    </div>
  );
}
