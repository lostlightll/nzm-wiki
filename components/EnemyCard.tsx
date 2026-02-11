"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Enemy, EnemyType } from "@/types";
import { getAssetPath } from "@/lib/path";
import { ENEMY_CARD_STYLES, ENEMY_GLOW_COLOR } from "@/constants/common";

// ============================================================
// EnemyImage — 统一图片组件
// ============================================================

function EnemyImage({
  name,
  iconPrefix,
  type,
  className,
}: {
  name: string;
  iconPrefix: string;
  type: EnemyType;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const glowColor = ENEMY_GLOW_COLOR[type];

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-[10px] text-zinc-600 ${className ?? ""}`}
      >
        No IMG
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
    >
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${glowColor} to-transparent opacity-40`}
      />
      <Image
        src={getAssetPath(`/icons/enemies/${iconPrefix}/${name}.png`)}
        alt={name}
        width={256}
        height={256}
        className="not-prose h-full w-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

// ============================================================
// EnemyCard — 列表卡片（BossCard 风格）
// ============================================================

export function EnemyCard({ enemy }: { enemy: Enemy }) {
  const style = ENEMY_CARD_STYLES[enemy.type];

  return (
    <Link
      href={`${enemy.linkPrefix}/${encodeURIComponent(enemy.slug)}`}
      className="group block no-underline"
    >
      <div
        className={`not-prose relative flex h-32 w-full overflow-hidden rounded border ${style.border} ${style.bg} transition-all duration-300 ${style.hoverBorder} ${style.hoverBg} ${style.hoverShadow}`}
      >
        {/* 左侧图片区域 */}
        <div className={`w-32 shrink-0 border-r ${style.divider} bg-black/20`}>
          <EnemyImage
            name={enemy.title}
            iconPrefix={enemy.iconPrefix}
            type={enemy.type}
          />
        </div>

        {/* 右侧信息区域 */}
        <div className="flex flex-1 flex-col justify-center px-5 py-2 min-w-0">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="w-fit min-w-0">
              <h3
                className={`truncate text-lg font-bold text-white transition-colors ${style.hoverText}`}
              >
                {enemy.title}
              </h3>
              <div
                className="mt-1.5 h-0.5 w-full rounded-full"
                style={{
                  backgroundColor:
                    enemy.type === "boss"
                      ? "#d1ac69"
                      : enemy.type === "elite"
                        ? "#a65aae"
                        : "#9ca3af",
                  opacity: 0.6,
                }}
              />
            </div>
            {enemy.map && (
              <span
                className={`shrink-0 self-center rounded border border-[#d1ac69]/20 bg-[#d1ac69]/10 px-1.5 py-0.5 text-[10px] ${style.text} opacity-70`}
              >
                {enemy.map}
              </span>
            )}
          </div>

          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
            {enemy.hp && (
              <>
                <span className="text-zinc-500 font-medium text-xs">血量</span>
                <span
                  className={`font-mono ${style.text} text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis`}
                >
                  {enemy.hp}
                </span>
              </>
            )}
            {enemy.hp2 && (
              <>
                <span className="text-zinc-500 font-medium text-xs">
                  阶段二
                </span>
                <span className="font-mono text-red-400 text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                  {enemy.hp2}
                </span>
              </>
            )}
            {enemy.attack && (
              <>
                <span className="text-zinc-500 font-medium text-xs">
                  攻击力
                </span>
                <span className="font-mono text-zinc-300 text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                  {enemy.attack}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 右上角三角装饰 */}
        {enemy.type !== "normal" && (
        <div className="absolute top-0 right-0 p-1 opacity-50">
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path
              d="M0 0H10V10L0 0Z"
              fill={
                enemy.type === "boss"
                  ? "#d1ac69"
                  : "#a65aae"
              }
            />
          </svg>
        </div>
        )}
      </div>
    </Link>
  );
}

// ============================================================
// EnemyCardGrid — 网格容器
// ============================================================

export function EnemyCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose mx-auto grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
      {children}
    </div>
  );
}

// ============================================================
// EnemyDetailCard — 详情页卡片
// ============================================================

export function EnemyDetailCard({ enemy }: { enemy: Enemy }) {
  const style = ENEMY_CARD_STYLES[enemy.type];

  const isEmpty = (val: number | string | null | undefined) => {
    return val === null || val === undefined || val === "" || val === "-";
  };

  const stats: {
    label: string;
    value: number | string | undefined;
    color?: string;
  }[] = [
    { label: "血量 (HP)", value: enemy.hp },
    { label: "阶段二血量 (P2)", value: enemy.hp2, color: "text-[#ff4d4f]" },
    { label: "攻击力 (ATK)", value: enemy.attack },
    { label: "击退条", value: enemy.hitback_hp },
    { label: "韧性条", value: enemy.hardstraight_hp },
    { label: "体重", value: enemy.weight },
    { label: "速度", value: enemy.speed },
    { label: "所属地图", value: enemy.map },
  ];

  const visibleStats = stats.filter((s) => !isEmpty(s.value));

  return (
    <div
      className={`not-prose relative overflow-hidden rounded-lg border ${style.border} ${style.bg} p-6 shadow-sm`}
    >
      <div className="flex flex-col-reverse gap-8 sm:flex-row sm:items-center">
        {/* 左侧信息区 */}
        <div className="flex-1 space-y-4">
          <div
            className={`border-l-4 pl-4`}
            style={{
              borderColor:
                enemy.type === "boss"
                  ? "#d1ac69"
                  : enemy.type === "elite"
                    ? "#a65aae"
                    : "#9ca3af",
            }}
          >
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{enemy.title}</h1>
              <span className={`text-sm font-medium ${style.text}`}>
                {style.label}
              </span>
            </div>
            {enemy.nickname && (
              <p className="mt-1 text-sm text-zinc-400">{enemy.nickname}</p>
            )}
          </div>

          {/* 描述 */}
          {enemy.description && (
            <p className="text-sm text-zinc-300 leading-relaxed">
              {enemy.description}
            </p>
          )}

          <h2
            className={`mb-4 text-xs font-bold uppercase tracking-[0.2em] ${style.text} opacity-80`}
          >
            Enemy Attributes / 敌人属性
          </h2>

          {/* 属性 Grid */}
          {visibleStats.length > 0 && (
            <div className="grid grid-cols-2 gap-8">
              {visibleStats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">
                    {stat.label}
                  </span>
                  <span
                    className={`font-mono text-lg font-bold tabular-nums tracking-tight ${stat.color ?? "text-white"}`}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
              {/* 没有 hp2 且是 boss 时不再显示 Danger Level，保持简洁 */}
            </div>
          )}
        </div>

        {/* 右侧图片区 */}
        <div className="flex shrink-0 justify-center self-center sm:justify-end">
          <div
            className={`relative h-48 w-48 shrink-0 overflow-hidden rounded border ${style.divider} bg-black/20 sm:h-56 sm:w-56`}
          >
            <EnemyImage
              name={enemy.title}
              iconPrefix={enemy.iconPrefix}
              type={enemy.type}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
