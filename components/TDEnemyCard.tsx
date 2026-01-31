"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TDEnemy, TDEnemyType } from "@/types";
import { getAssetPath } from "@/lib/path";
import { TD_ENEMY_CARD_STYLES } from "@/constants/common";

function TDEnemyImage({
  name,
  type,
  size = 128,
  className,
}: {
  name: string;
  type: TDEnemyType;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-zinc-500 ${className ?? ""}`}
        style={className ? undefined : { width: size, height: size }}
      >
        No Image
      </div>
    );
  }

  return (
    <Image
      src={getAssetPath(`/icons/enemies/td/${type}/${name}.png`)}
      alt={name}
      width={192}
      height={192}
      className={`object-contain ${className ?? ""}`}
      style={className ? undefined : { width: size, height: size }}
      onError={() => setHasError(true)}
    />
  );
}

function SimpleCard({ enemy }: { enemy: TDEnemy }) {
  const style = TD_ENEMY_CARD_STYLES[enemy.type] || TD_ENEMY_CARD_STYLES.normal;

  return (
    <Link href={`/enemies/td/${encodeURIComponent(enemy.slug)}`}>
      <div
        className={`rounded-lg border-2 ${style.border} ${style.bg} p-4 transition-transform hover:scale-[1.02]`}
      >
        <div className="flex justify-center mb-3">
          <TDEnemyImage name={enemy.title} type={enemy.type} />
        </div>
        <h3 className={`text-center text-lg font-semibold ${style.text}`}>
          {enemy.title}
        </h3>
      </div>
    </Link>
  );
}

function DetailedCard({ enemy }: { enemy: TDEnemy }) {
  const style = TD_ENEMY_CARD_STYLES[enemy.type] || TD_ENEMY_CARD_STYLES.normal;

  return (
    <Link href={`/enemies/td/${encodeURIComponent(enemy.slug)}`}>
      <div
        className={`rounded-lg border-2 ${style.border} ${style.bg} p-4 transition-transform hover:scale-[1.02] min-w-[280px]`}
      >
        <div className="flex gap-4">
          {/* 左侧图片 */}
          <div className="flex-shrink-0">
            <TDEnemyImage name={enemy.title} type={enemy.type} size={96} />
          </div>
          {/* 右侧信息 */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${style.text} truncate`}>
              {enemy.title}
            </h3>
            {enemy.nickname && (
              <p className="text-sm text-zinc-400 truncate">{enemy.nickname}</p>
            )}
            {/* 攻击和血量 */}
            <div className="mt-2 space-y-1 text-sm">
              {enemy.attack && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">攻击</span>
                  <span className="text-white">{enemy.attack}</span>
                </div>
              )}
              {enemy.hp && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">血量</span>
                  <span className="text-white">{enemy.hp}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function TDEnemyCard({
  enemy,
  showDetails = false,
}: {
  enemy: TDEnemy;
  showDetails?: boolean;
}) {
  if (showDetails) {
    return <DetailedCard enemy={enemy} />;
  }
  return <SimpleCard enemy={enemy} />;
}

/**
 * 详情页敌人卡片
 */
export function TDEnemyDetailCard({ enemy }: { enemy: TDEnemy }) {
  const style = TD_ENEMY_CARD_STYLES[enemy.type] || TD_ENEMY_CARD_STYLES.normal;

  const isEmpty = (val: number | string | null | undefined) => {
    return val === null || val === undefined || val === "" || val === "-";
  };

  const stats: { label: string; value: number | string | undefined }[] = [
    { label: "攻击", value: enemy.attack },
    { label: "血量", value: enemy.hp },
    { label: "体重", value: enemy.weight },
    { label: "速度", value: enemy.speed },
  ];

  const visibleStats = stats.filter((s) => !isEmpty(s.value));

  return (
    <div className={`rounded-lg border-2 ${style.border} ${style.bg} p-6`}>
      {/* 头部：左侧信息 + 右侧图片 */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
        {/* 左侧信息 */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{enemy.title}</h1>
            <span className={`text-sm font-medium ${style.text}`}>
              {style.label}
            </span>
          </div>
          {enemy.nickname && (
            <p className="mt-1 text-sm text-zinc-400">{enemy.nickname}</p>
          )}

          {/* 描述 */}
          {enemy.description && (
            <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
              {enemy.description}
            </p>
          )}

          {/* 属性 */}
          {visibleStats.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-400">
                敌人属性
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {visibleStats.map((stat) => (
                  <div key={stat.label} className="flex justify-between">
                    <span className="text-zinc-500">{stat.label}</span>
                    <span className="text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧图片 */}
        <div className="flex-shrink-0 self-center sm:self-start">
          <TDEnemyImage
            name={enemy.title}
            type={enemy.type}
            className="w-32 h-32 sm:w-48 sm:h-48"
          />
        </div>
      </div>
    </div>
  );
}
