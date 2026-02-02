"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Boss } from "@/types";
import { getAssetPath } from "@/lib/path";

const MAP_COLORS: Record<string, string> = {
  大都会: "bg-blue-500/20 text-blue-400",
  黑暗复活节: "bg-purple-500/20 text-purple-400",
  冰点源起: "bg-cyan-500/20 text-cyan-400",
};

function BossImage({
  name,
  size = 96,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 ${className ?? ""}`}
        style={className ? undefined : { width: size, height: size }}
      >
        No Image
      </div>
    );
  }

  return (
    <Image
      src={getAssetPath(`/icons/enemies/boss/${name}.png`)}
      alt={name}
      width={256}
      height={256}
      className={`object-contain ${className ?? ""}`}
      style={className ? undefined : { width: size, height: size }}
      onError={() => setHasError(true)}
    />
  );
}

export function BossCard({ boss, showMap = false }: { boss: Boss; showMap?: boolean }) {
  const mapColor = MAP_COLORS[boss.map] ?? "bg-zinc-500/20 text-zinc-400";

  return (
    <Link href={`/enemies/lc/${encodeURIComponent(boss.title)}`} className="no-underline">
      <div className="rounded-lg border-2 border-[#d1ac69]/60 bg-[#d1ac69]/10 p-4 transition-transform hover:scale-[1.02]">
        <div className="flex gap-4">
          {/* 图片 */}
          <div className="flex-shrink-0 self-center">
            <BossImage name={boss.title} />
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              {boss.title}
            </h3>

            {/* 副本标签 */}
            {showMap && (
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${mapColor}`}
              >
                {boss.map}
              </span>
            )}

            {/* 血量 */}
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  {boss.hp2 ? "一阶段血量" : "血量"}
                </span>
                <span className="text-white">{boss.hp}</span>
              </div>
              {boss.hp2 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">二阶段血量</span>
                  <span className="text-white">{boss.hp2}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BossCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

/**
 * 详情页首领卡片
 */
export function BossDetailCard({ boss }: { boss: Boss }) {
  const mapColor = MAP_COLORS[boss.map] ?? "bg-zinc-500/20 text-zinc-400";

  return (
    <div className="rounded-lg border-2 border-[#d1ac69]/60 bg-[#d1ac69]/10 p-6">
      {/* 头部：左侧信息 + 右侧图片 */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
        {/* 左侧信息 */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{boss.title}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${mapColor}`}
            >
              {boss.map}
            </span>
          </div>

          {/* 血量属性 */}
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-400">
              首领属性
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  {boss.hp2 ? "一阶段血量" : "血量"}
                </span>
                <span className="text-white">{boss.hp}</span>
              </div>
              {boss.hp2 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">二阶段血量</span>
                  <span className="text-white">{boss.hp2}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧图片 */}
        <div className="flex-shrink-0 self-center sm:self-start">
          <BossImage
            name={boss.title}
            className="w-32 h-32 sm:w-48 sm:h-48"
          />
        </div>
      </div>
    </div>
  );
}
