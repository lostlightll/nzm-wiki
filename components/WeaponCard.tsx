"use client";

import { useState } from "react";
import Image from "next/image";
import { CatalogLink } from "@/components/CatalogLink";
import { useWeaponDetail } from "@/components/WeaponDetailContext";
import { RARITY_CARD_STYLES, RARITY_KEY_MAP } from "@/constants/common";
import {
  getFullReloadTime,
  getResolvedFieldValue,
  type ConsumerDamageSource,
  type ConsumerDamageSourceSummary,
  type ConsumerField,
  type WeaponCatalogEntry,
} from "@/lib/weapon-consumers";
import { getAssetPath } from "@/lib/path";
import type { ElementType } from "@/types";

const ELEMENT_ICONS: Record<ElementType, string> = {
  火焰: "/icons/elements/fire.png",
  寒冷: "/icons/elements/cryo.png",
  电弧: "/icons/elements/shock.png",
  腐蚀: "/icons/elements/corossive.png",
  物理: "/icons/elements/kinetic.png",
};

const TOUGHNESS_LABELS = {
  none: "无",
  impulse: "冲击",
  penetration: "贯穿",
  explosion: "爆炸",
} as const;

type DisplaySource = ConsumerDamageSource | ConsumerDamageSourceSummary;

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatPercent(value: number): string {
  const percent = Math.round(value * 1000) / 10;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
}

function formatNumber(value: number | undefined, suffix = ""): string {
  return value === undefined ? "-" : `${value}${suffix}`;
}

function formatRpm(value: number | undefined): string {
  return value === undefined ? "-" : String(Math.round(value));
}

function formatPrecise(value: number | undefined): string {
  if (value === undefined) return "-";
  return (Math.round(value * 100) / 100)
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, ".0");
}

function formatDamage(source: DisplaySource, hpMultiplier: number): string {
  const base = getResolvedFieldValue(source.damage.base);
  if (base === undefined) return "-";
  const damage = round1(base * hpMultiplier);
  const pellets = getResolvedFieldValue(source.fire.pellets);
  return pellets !== undefined && pellets > 1
    ? `${damage} × ${pellets}`
    : damage;
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

function weaponHref(weapon: Pick<WeaponCatalogEntry, "slug" | "table">) {
  return `/weapons${weapon.table === "td" ? "/td" : ""}/${encodeURIComponent(weapon.slug)}`;
}

function WeaponImage({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  if (hasError) return null;
  return (
    <div
      className={`relative w-full overflow-hidden ${compact ? "h-24" : "h-32"}`}
    >
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

function ElementIcon({ element, size }: { element?: ElementType; size: number }) {
  if (!element) return null;
  return (
    <Image
      src={getAssetPath(ELEMENT_ICONS[element])}
      alt={element}
      width={size}
      height={size}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}

function SimpleCard({ weapon }: { weapon: WeaponCatalogEntry }) {
  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityStyle = RARITY_CARD_STYLES[
    rarity ? RARITY_KEY_MAP[rarity] : "common"
  ];
  const element = getResolvedFieldValue(weapon.element);
  return (
    <CatalogLink href={weaponHref(weapon)}>
      <div
        className={`relative rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-3 transition-transform hover:scale-[1.02]`}
      >
        <div className="absolute right-2 top-2 z-10">
          <ElementIcon element={element} size={20} />
        </div>
        <h3 className="mb-2 pr-7 text-base font-semibold text-white">
          {weapon.title}
        </h3>
        <WeaponImage name={weapon.title} compact />
        {!weapon.isAttackCapable && (
          <div className="mt-2 text-xs text-zinc-500">不可攻击</div>
        )}
      </div>
    </CatalogLink>
  );
}

function DetailedCard({ weapon }: { weapon: WeaponCatalogEntry }) {
  const [showReloadDetail, setShowReloadDetail] = useState(false);
  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityStyle = RARITY_CARD_STYLES[
    rarity ? RARITY_KEY_MAP[rarity] : "common"
  ];
  const element = getResolvedFieldValue(weapon.element);
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const scope = getResolvedFieldValue(weapon.scope);
  const hpMultiplier = weapon.table === "td" ? 400 : 500;
  const source = weapon.mainSource;
  const fullReload = getFullReloadTime(weapon.changeClip);

  return (
    <CatalogLink href={weaponHref(weapon)}>
      <div
        className={`relative w-full min-w-0 rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-5 transition-shadow hover:shadow-lg hover:shadow-black/20`}
      >
        <div className="absolute right-4 top-4 z-10">
          <ElementIcon element={element} size={28} />
        </div>
        <h3 className="pr-10 text-xl font-semibold text-white">{weapon.title}</h3>
        <div className="mb-4 mt-1 flex flex-wrap gap-x-1.5 text-sm text-zinc-400">
          {weapon.useType && <span>{weapon.useType}</span>}
          {weaponType && <span>· {weaponType}</span>}
          {scope && <span>· {scope}</span>}
          {weapon.tags.map((tag) => (
            <span key={tag}>· {tag}</span>
          ))}
        </div>
        <WeaponImage name={weapon.title} />

        {!source ? (
          <div className="mt-3 border-t border-zinc-700 pt-3 text-sm text-zinc-500">
            不可攻击
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-y-2 text-base sm:grid-cols-2 sm:gap-x-6">
            <Stat
              label={source.label ?? source.name}
              value={formatDamage(source, hpMultiplier)}
            />
            <Stat
              label="射速"
              value={formatRpm(getResolvedFieldValue(source.fire.rpm))}
            />
            <Stat
              label="弹夹"
              value={formatNumber(getResolvedFieldValue(weapon.magazine))}
            />
            <Stat
              label="总弹量"
              value={formatNumber(getResolvedFieldValue(weapon.totalAmmo))}
            />
            <Stat
              label="弱点倍率"
              value={formatNumber(
                getResolvedFieldValue(source.weaknessMultiplier),
              )}
            />
            <Stat
              label="破韧伤害"
              value={formatPrecise(
                getResolvedFieldValue(source.damage.toughness),
              )}
            />
            <Stat
              label="技能充能"
              value={formatNumber(
                weapon.activeSkill
                  ? getResolvedFieldValue(weapon.activeSkill.chargeTime)
                  : undefined,
                "s",
              )}
            />
            {!isMeleeWeapon(weapon) && (
              <Stat
                label="完整换弹"
                value={
                  fullReload === undefined ? "-" : `${fullReload.toFixed(2)}s`
                }
              />
            )}
            {!isMeleeWeapon(weapon) && (
              <button
                type="button"
                className="text-left text-sm text-zinc-500 hover:text-zinc-300 focus-visible:underline focus-visible:underline-offset-4"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowReloadDetail((value) => !value);
                }}
              >
                {showReloadDetail ? "收起换弹详情" : "查看换弹详情"}
              </button>
            )}
            {showReloadDetail && !isMeleeWeapon(weapon) && (
              <>
                <Stat
                  label="换弹动画"
                  value={formatNumber(
                    getResolvedFieldValue(weapon.changeClip.timeBase),
                    "s",
                  )}
                />
                <Stat
                  label="换弹后摇"
                  value={formatNumber(
                    getResolvedFieldValue(weapon.changeClip.reloadRecovery),
                    "s",
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>
    </CatalogLink>
  );
}

export function WeaponCard({
  weapon,
  showDetails = false,
}: {
  weapon: WeaponCatalogEntry;
  showDetails?: boolean;
}) {
  return showDetails ? (
    <DetailedCard weapon={weapon} />
  ) : (
    <SimpleCard weapon={weapon} />
  );
}

function SourceStats({
  source,
  hpMultiplier,
}: {
  source: ConsumerDamageSource;
  hpMultiplier: number;
}) {
  const enableWeakness = getResolvedFieldValue(source.enableWeakness);
  const enableCritical = getResolvedFieldValue(source.enableCritical);
  const elementRate = getResolvedFieldValue(source.elementAddRate);
  const toughness = getResolvedFieldValue(source.toughness);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-3">
      <Stat
        label={source.label ?? "伤害"}
        value={formatDamage(source, hpMultiplier)}
      />
      <Stat
        label="单发破韧值"
        value={formatPrecise(getResolvedFieldValue(source.damage.toughness))}
      />
      <Stat
        label="弱点倍率"
        value={
          enableWeakness
            ? formatNumber(getResolvedFieldValue(source.weaknessMultiplier))
            : "-"
        }
      />
      <Stat
        label="元素异常概率"
        value={elementRate === undefined ? "-" : `${formatPercent(elementRate)}%`}
      />
      <Stat label="暴击" value={enableCritical ? "可暴击" : "否"} />
      <Stat label="弱点" value={enableWeakness ? "可弱点" : "否"} />
      <Stat
        label="射速"
        value={formatRpm(getResolvedFieldValue(source.fire.rpm))}
      />
      <Stat
        label="单发耗时"
        value={formatNumber(getResolvedFieldValue(source.fire.interval), "s")}
      />
      <Stat
        label="破韧类型"
        value={toughness ? TOUGHNESS_LABELS[toughness] : "-"}
      />
    </div>
  );
}

export function WeaponDetailCard() {
  const {
    weapon,
    selectedSource,
    selectedSourceId,
    selectSource,
  } = useWeaponDetail();
  const [showReloadDetail, setShowReloadDetail] = useState(false);
  const rarity = getResolvedFieldValue(weapon.rarity);
  const rarityStyle = RARITY_CARD_STYLES[
    rarity ? RARITY_KEY_MAP[rarity] : "common"
  ];
  const weaponType = getResolvedFieldValue(weapon.weaponType);
  const scope = getResolvedFieldValue(weapon.scope);
  const selectedElement = selectedSource
    ? getResolvedFieldValue(selectedSource.element)
    : undefined;
  const hpMultiplier = weapon.table === "td" ? 400 : 500;
  const fullReload = getFullReloadTime(weapon.changeClip);
  const chargeTime = weapon.activeSkill
    ? getResolvedFieldValue(weapon.activeSkill.chargeTime)
    : undefined;
  const duration = getResolvedFieldValue(weapon.skillDuration);
  const skillBlocking = getResolvedFieldValue(weapon.skillBlocking);
  const cycleTime =
    chargeTime === undefined
      ? undefined
      : skillBlocking && duration !== undefined
        ? chargeTime + duration
        : chargeTime;

  return (
    <div
      className={`rounded-lg border-2 ${rarityStyle.border} ${rarityStyle.bg} p-4 sm:p-6`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{weapon.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            {weapon.useType && <span>{weapon.useType}</span>}
            {weaponType && <span>· {weaponType}</span>}
            {scope && <span>· {scope}</span>}
            {weapon.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <ElementIcon element={selectedElement} size={32} />
      </div>

      <WeaponImage name={weapon.title} />

      {weapon.damageSources.length > 1 && (
        <div
          className="mb-4 flex max-w-full gap-1 overflow-x-auto border-b border-zinc-700 pb-1"
          role="tablist"
          aria-label="伤害来源"
        >
          {weapon.damageSources.map((source) => {
            const selected = source.id === selectedSourceId;
            return (
              <button
                key={source.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`min-h-10 shrink-0 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:underline focus-visible:underline-offset-4 ${
                  selected
                    ? "border-sky-400 bg-zinc-800 text-white"
                    : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
                onClick={() => selectSource(source.id)}
              >
                {source.name}
              </button>
            );
          })}
        </div>
      )}

      {!selectedSource ? (
        <div className="border-t border-zinc-700 pt-4 text-sm text-zinc-500">
          不可攻击
        </div>
      ) : (
        <>
          <section className="mb-4" aria-labelledby="selected-source-title">
            <h2
              id="selected-source-title"
              className="mb-2 text-sm font-semibold text-zinc-300"
            >
              {selectedSource.name}
            </h2>
            <SourceStats source={selectedSource} hpMultiplier={hpMultiplier} />
          </section>

          {selectedSource.attenuation.status === "applicable" && (
            <section className="mb-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-400">
                武器衰减
              </h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-3">
                <Stat
                  label="开始衰减"
                  value={`${round1(selectedSource.attenuation.beginMeters)}m`}
                />
                <Stat
                  label="结束衰减"
                  value={`${round1(selectedSource.attenuation.endMeters)}m`}
                />
                <Stat
                  label="衰减上限"
                  value={`${formatPercent(1 - selectedSource.attenuation.minScale)}%`}
                />
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">武器属性</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-3">
          {!isMeleeWeapon(weapon) && (
            <Stat
              label="弹夹"
              value={formatNumber(getResolvedFieldValue(weapon.magazine))}
            />
          )}
          {!isMeleeWeapon(weapon) && (
            <Stat
              label="总弹量"
              value={formatNumber(getResolvedFieldValue(weapon.totalAmmo))}
            />
          )}
          {!isMeleeWeapon(weapon) && (
            <Stat
              label="精准度"
              value={formatNumber(getResolvedFieldValue(weapon.accuracy))}
            />
          )}
          {!isMeleeWeapon(weapon) && (
            <Stat
              label="稳定度"
              value={formatNumber(getResolvedFieldValue(weapon.stability))}
            />
          )}
          {!isMeleeWeapon(weapon) && (
            <Stat
              label="完整换弹"
              value={
                fullReload === undefined ? "-" : `${fullReload.toFixed(2)}s`
              }
            />
          )}
          <Stat label="技能充能" value={formatNumber(chargeTime, "s")} />
          {getResolvedFieldValue(weapon.shootingEnergy) && (
            <Stat
              label="射击耗能"
              value={formatNumber(
                getResolvedFieldValue(weapon.shootingEnergyCount),
                "次",
              )}
            />
          )}
          {getResolvedFieldValue(weapon.showDuration) && (
            <Stat label="持续时间" value={formatNumber(duration, "s")} />
          )}
          {getResolvedFieldValue(weapon.showDuration) && (
            <Stat label="周期时长" value={formatNumber(cycleTime, "s")} />
          )}
          {!isMeleeWeapon(weapon) && (
            <button
              type="button"
              className="text-left text-sm text-zinc-500 hover:text-zinc-300 focus-visible:underline focus-visible:underline-offset-4"
              onClick={() => setShowReloadDetail((value) => !value)}
            >
              {showReloadDetail ? "收起换弹详情" : "查看换弹详情"}
            </button>
          )}
          {showReloadDetail && !isMeleeWeapon(weapon) && (
            <>
              <Stat
                label="换弹动画"
                value={formatNumber(
                  getResolvedFieldValue(weapon.changeClip.timeBase),
                  "s",
                )}
              />
              <Stat
                label="换弹后摇"
                value={formatNumber(
                  getResolvedFieldValue(weapon.changeClip.reloadRecovery),
                  "s",
                )}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
