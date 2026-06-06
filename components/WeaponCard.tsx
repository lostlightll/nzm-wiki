"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Weapon, ElementType, DamageMode } from "@/types";
import { getAssetPath } from "@/lib/path";
import {
  calcRPM,
  calcFullReload,
  calcReloadTime,
  calcReloadRecovery,
} from "@/lib/weapon-calcs";
import { RARITY_KEY_MAP, RARITY_CARD_STYLES } from "@/constants/common";

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
function formatPrecise(n: number): string {
  const fixed = (Math.round(n * 100) / 100).toFixed(2);
  return fixed.replace(/0+$/, "").replace(/\.$/, ".0");
}

function formatDamage(mode: DamageMode): string {
  const damage = round1(mode.damage.base * 500);
  if (mode.pellets && mode.pellets > 1) {
    return `${damage} × ${mode.pellets}`;
  }
  return damage;
}

function formatMeter(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return `${round1(numberValue)}m`;
}

function formatAttenuationSpeed(
  begin: number | string | null | undefined,
  end: number | string | null | undefined,
  scale: number | string | null | undefined,
): string {
  const beginValue = Number(begin);
  const endValue = Number(end);
  const scaleValue = Number(scale);
  if (
    !Number.isFinite(beginValue) ||
    !Number.isFinite(endValue) ||
    !Number.isFinite(scaleValue) ||
    endValue <= beginValue
  ) {
    return "-";
  }
  const percentPerMeter = ((1 - scaleValue) / (endValue - beginValue)) * 100;
  return `${round1(percentPerMeter)}%`;
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

/**
 * 简洁模式卡片 - 只有名称、图片、元素图标
 */
function SimpleCard({ weapon }: { weapon: Weapon }) {
  const mode = weapon.damageModes[0];
  if (!mode) return <div className="text-zinc-500">武器数据异常</div>;

  const rarityKey = weapon.rarity ? RARITY_KEY_MAP[weapon.rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const elementIcon = ELEMENT_ICONS[mode.element];

  return (
    <Link href={`/weapons/${encodeURIComponent(weapon.slug)}`}>
      <div
        className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 transition-transform hover:scale-[1.02]`}
      >
        {elementIcon && (
          <div className="absolute right-2 top-2 z-10">
            <Image
              src={getAssetPath(elementIcon)}
              alt={mode.element}
              width={20}
              height={20}
            />
          </div>
        )}
        <h3 className="mb-2 text-base font-semibold text-white">{weapon.title}</h3>
        <WeaponImage name={weapon.title} size="small" />
      </div>
    </Link>
  );
}

/**
 * 详细模式卡片 - 显示更多属性
 */
function DetailedCard({ weapon }: { weapon: Weapon }) {
  const mode = weapon.damageModes[0];
  if (!mode) return <div className="text-zinc-500">武器数据异常</div>;

  const [showReloadDetail, setShowReloadDetail] = useState(false);

  const rarityKey = weapon.rarity ? RARITY_KEY_MAP[weapon.rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const elementIcon = ELEMENT_ICONS[mode.element];
  const tags = weapon.tags || [];

  return (
    <Link href={`/weapons/${encodeURIComponent(weapon.slug)}`}>
      <div
        className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-5 transition-transform hover:scale-[1.02] min-w-[360px]`}
      >
        {elementIcon && (
          <div className="absolute right-4 top-4 z-10">
            <Image
              src={getAssetPath(elementIcon)}
              alt={mode.element}
              width={28}
              height={28}
            />
          </div>
        )}

        <h3 className="text-xl font-semibold text-white">{weapon.title}</h3>
        <div className="mt-1 mb-4 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400">
          {weapon.use_type && <span>{weapon.use_type}</span>}
          {weapon.weapon_type && <span>· {weapon.weapon_type}</span>}
          {weapon.scope && <span>· {weapon.scope}</span>}
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
            className="object-contain"
            style={{ width: 320, height: "auto" }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-base">
          <div className="flex justify-between">
            <span className="text-zinc-500">单发伤害</span>
            <span className="text-white">{formatDamage(mode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">射速</span>
            <span className="text-white">{Math.round(calcRPM(mode))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">弹夹</span>
            <span className="text-white">{formatValue(weapon.magazine)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">总弹量</span>
            <span className="text-white">{formatValue(weapon.totalAmmo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">弱点倍率</span>
            <span className="text-white">{mode.weaknessMultiplier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">破韧伤害</span>
            <span className="text-white">{formatValue(mode.damage.toughness)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">元素异常概率</span>
            <span className="text-white">
              {mode.elementAddRate > 0
                ? `${formatPercent(mode.elementAddRate)}%`
                : "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">技能冷却</span>
            <span className="text-white">{formatValue(weapon.skillCooldown)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">完整换弹</span>
            <span className="text-white">
              {weapon.changeClip
                ? `${(Math.ceil(calcFullReload(weapon.changeClip)! * 100) / 100).toFixed(2)}s`
                : "-"}
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
          {showReloadDetail && weapon.changeClip && (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">换弹动画</span>
                <span className="text-zinc-300">
                  {calcReloadTime(weapon.changeClip)!.toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">换弹后摇</span>
                <span className="text-zinc-300">
                  {calcReloadRecovery(weapon.changeClip)!.toFixed(2)}s
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * 列表页武器卡片
 */
export function WeaponCard({ weapon, showDetails = false }: { weapon: Weapon; showDetails?: boolean }) {
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
}: {
  mode: DamageMode;
  showName: boolean;
  compact?: boolean;
}) {
  const rpm = Math.round(calcRPM(mode));

  return (
    <div className="mb-3">
      {showName && (
        <h3 className="mb-1.5 text-sm font-semibold text-zinc-300">{mode.name}</h3>
      )}

      {compact ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label="射速" value={String(rpm)} />
          <Stat
            label="单发耗时"
            value={
              mode.fireIntervalBase
                ? `${mode.fireIntervalBase.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}s`
                : "-"
            }
          />
        </div>
      ) : mode.fireIntervalBase === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label={mode.damageLabel || "命中伤害"} value={formatDamage(mode)} />
          <Stat label="单发破韧值" value={formatPrecise(mode.damage.toughness)} />
          <Stat label="弱点倍率" value={mode.enableWeakness ? String(mode.weaknessMultiplier) : "-"} />
          <Stat
            label="元素异常概率"
            value={
              mode.elementAddRate > 0
                ? `${formatPercent(mode.elementAddRate)}%`
                : "-"
            }
          />
          <Stat label="暴击" value={mode.enableCritical ? "可暴击" : "否"} />
          <Stat label="弱点" value={mode.enableWeakness ? "可弱点" : "否"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label={mode.damageLabel || "命中伤害"} value={formatDamage(mode)} />
          <Stat label="单发破韧值" value={formatPrecise(mode.damage.toughness)} />
          <Stat label="弱点倍率" value={mode.enableWeakness ? String(mode.weaknessMultiplier) : "-"} />
          <Stat
            label="元素异常概率"
            value={
              mode.elementAddRate > 0
                ? `${formatPercent(mode.elementAddRate)}%`
                : "-"
            }
          />
          <Stat label="暴击" value={mode.enableCritical ? "可暴击" : "否"} />
          <Stat label="弱点" value={mode.enableWeakness ? "可弱点" : "否"} />
          <Stat label="射速" value={String(rpm)} />
          <Stat
            label="单发耗时"
            value={mode.fireIntervalBase ? `${mode.fireIntervalBase.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}s` : "-"}
          />
          <Stat label="破韧类型" value={mode.toughnessType} />
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

function SkillSection({ weapon }: { weapon: Weapon }) {
  const [expanded, setExpanded] = useState(false);
  const modes = weapon.extraModes!;
  const collapsible = modes.length > 3;
  const visible = collapsible && !expanded ? modes.slice(0, 2) : modes;
  const hiddenCount = modes.length - 2;

  return (
    <div className="mb-3">
      <h2 className="mb-2 text-sm font-semibold text-zinc-400">
        技能 / 特殊攻击
      </h2>
      {visible.map((m, i) => {
        const damageAllZero = Object.values(m.damage).every((v) => v === 0);
        const isVariant = damageAllZero || weapon.damageModes.some(
          (dm) => dm.damage.base === m.damage.base
        );
        return <ModeStats key={i} mode={m} showName compact={isVariant} />;
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
export function WeaponDetailCard({ weapon }: { weapon: Weapon }) {
  const mode = weapon.damageModes[0];
  if (!mode) {
    return (
      <div className="rounded-lg border-2 border-zinc-700 bg-zinc-900 p-6 text-center text-zinc-500">
        武器数据异常
      </div>
    );
  }

  const rarityKey = weapon.rarity ? RARITY_KEY_MAP[weapon.rarity] : "common";
  const rarityStyle = RARITY_CARD_STYLES[rarityKey];
  const elementIcon = ELEMENT_ICONS[mode.element];
  const tags = weapon.tags || [];

  const [showReloadDetail, setShowReloadDetail] = useState(false);

  const cycleTime =
    weapon.skillCooldown != null
      ? weapon.skillBlocking && weapon.skillDuration != null
        ? weapon.skillCooldown + weapon.skillDuration
        : weapon.skillCooldown
      : null;

  return (
    <div className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-6`}>
      {/* 头部 */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{weapon.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            {weapon.use_type && <span>{weapon.use_type}</span>}
            {weapon.weapon_type && <span>· {weapon.weapon_type}</span>}
            {weapon.scope && <span>· {weapon.scope}</span>}
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
            alt={mode.element}
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
      {weapon.damageModes.length > 1 ? (
        weapon.damageModes.map((m, i) => (
          <ModeStats key={i} mode={m} showName />
        ))
      ) : (
        <div className="mb-3">
          <h2
            className={
              "mb-2 text-sm font-semibold " +
              (weapon.extraModes && weapon.extraModes.length > 0
                ? "text-zinc-300"
                : "text-zinc-400")
            }
          >
            普通射击
          </h2>
          <ModeStats mode={weapon.damageModes[0]} showName={false} />
        </div>
      )}

      {/* 技能 / 特殊攻击 */}
      {weapon.extraModes && weapon.extraModes.length > 0 && (
        <SkillSection weapon={weapon} />
      )}

      {/* 武器衰减 */}
      {(weapon.attenuation_begin != null || weapon.attenuation_end != null) && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-400">武器衰减</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
            <Stat
              label="开始衰减"
              value={formatMeter(weapon.attenuation_begin)}
            />
            <Stat
              label="结束衰减"
              value={formatMeter(weapon.attenuation_end)}
            />
            <Stat
              label="衰减速率"
              value={formatAttenuationSpeed(
                weapon.attenuation_begin,
                weapon.attenuation_end,
                weapon.attenuation_scale,
              )}
            />
          </div>
        </div>
      )}

      {/* 武器属性 */}
      <div className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">武器属性</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
          <Stat label="弹夹" value={formatValue(weapon.magazine)} />
          <Stat label="总弹量" value={formatValue(weapon.totalAmmo)} />
          <Stat label="精准度" value={formatValue(weapon.accuracy)} />
          <Stat label="稳定度" value={formatValue(weapon.stability)} />
          {showReloadDetail && weapon.changeClip ? (
            <>
              <div className="flex justify-between gap-1 text-sm">
                <span className="text-zinc-500 shrink-0">换弹动画</span>
                <span className="text-white text-right">
                  {calcReloadTime(weapon.changeClip)!.toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between gap-1 text-sm">
                <span className="text-zinc-500 shrink-0">换弹后摇</span>
                <span className="text-white text-right">
                  {calcReloadRecovery(weapon.changeClip)!.toFixed(2)}s
                </span>
              </div>
            </>
          ) : (
            <Stat
              label="完整换弹"
              value={
                weapon.changeClip
                  ? `${(Math.ceil(calcFullReload(weapon.changeClip)! * 100) / 100).toFixed(2)}s`
                  : "-"
              }
            />
          )}
          <div
            className="flex justify-between gap-1 text-sm cursor-pointer"
            onClick={() => setShowReloadDetail(!showReloadDetail)}
          >
            <span className="text-zinc-500 shrink-0">
              换弹详情 {showReloadDetail ? "▴" : "▸"}
            </span>
            <span className="text-white text-right">&nbsp;</span>
          </div>
          <Stat
            label="技能冷却"
            value={weapon.skillCooldown != null ? `${weapon.skillCooldown}s` : "-"}
          />
          {weapon.shootingEnergy && (
            <Stat
              label="射击耗能"
              value={weapon.shootingEnergyCount != null ? `${weapon.shootingEnergyCount}次` : "-"}
            />
          )}
          {weapon.showDuration && (
            <Stat
              label="持续时间"
              value={weapon.skillDuration != null ? `${weapon.skillDuration}s` : "-"}
            />
          )}
          {weapon.showDuration && (
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
