"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Boss } from "@/types";
import { getAssetPath } from "@/lib/path";

function BossImage({ name, className }: { name: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  const src = getAssetPath(`/icons/enemies/lc/boss/${name}.png`);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-[10px] text-zinc-600 ${className}`}
      >
        No IMG
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* 底部光晕 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#d1ac69]/20 to-transparent opacity-40" />

      <Image
        src={src}
        alt={name}
        width={256}
        height={256}
        // 核心：object-cover 确保填满容器
        className="not-prose h-full w-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function BossCard({
  boss,
  showMap = false,
}: {
  boss: Boss;
  showMap?: boolean;
}) {
  return (
    <Link
      href={`/enemies/lc/${encodeURIComponent(boss.title)}`}
      className="group block no-underline"
    >
      <div className="not-prose relative flex h-32 w-full overflow-hidden rounded border border-[#d1ac69]/30 bg-[#d1ac69]/5 transition-all duration-300 hover:border-[#d1ac69]/80 hover:bg-[#d1ac69]/10 hover:shadow-[0_0_20px_-5px_rgba(209,172,105,0.2)]">
        {/* 左侧图片区域：w-32 正方形框 */}
        <div className="w-32 shrink-0 border-r border-[#d1ac69]/10 bg-black/20">
          <BossImage name={boss.title} />
        </div>

        {/* 右侧信息区域 */}
        <div className="flex flex-1 flex-col justify-center px-5 py-2 min-w-0">
          <div className="mb-2 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-lg font-bold text-white group-hover:text-[#d1ac69] transition-colors">
                {boss.title}
              </h3>
              {showMap && (
                <span className="shrink-0 rounded border border-[#d1ac69]/20 bg-[#d1ac69]/10 px-1.5 py-0.5 text-[10px] text-[#d1ac69] opacity-70">
                  {boss.map}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-0.5 w-8 rounded-full bg-[#d1ac69]/60" />
          </div>

          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-zinc-500 font-medium text-xs">HP</span>
            <span className="font-mono text-[#d1ac69] text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
              {boss.hp}
            </span>
            {boss.hp2 && (
              <>
                <span className="text-zinc-500 font-medium text-xs">P2</span>
                <span className="font-mono text-red-400 text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                  {boss.hp2}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 p-1 opacity-50">
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M0 0H10V10L0 0Z" fill="#d1ac69" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export function BossCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose grid grid-cols-1 gap-4 lg:grid-cols-2">
      {children}
    </div>
  );
}

/**
 * 详情页首领卡片
 */
export function BossDetailCard({ boss }: { boss: Boss }) {
  return (
    <div className="not-prose relative overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#d1ac69]/5 p-6 shadow-sm">
      <div className="flex flex-col-reverse gap-8 sm:flex-row sm:items-center">
        {/* 左侧信息区 */}
        <div className="flex-1 space-y-4">
          <div className="border-l-4 border-[#d1ac69] pl-4">
            <h1 className="text-3xl font-bold text-white">{boss.title}</h1>
            <p className="mt-1 text-sm text-[#d1ac69] opacity-80">{boss.map}</p>
          </div>

          {/* <div className="mt-3 text-sm text-zinc-400 leading-relaxed"> */}
          {/*   <p>首领描述信息(待更新)</p> */}
          {/* </div> */}

          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#d1ac69] opacity-80">
            Enemy Attributes / 首领属性
          </h2>

          {/* 属性 Grid：模仿参考图的宽间距、大数字风格 */}
          <div className="grid grid-cols-2 gap-8">
            {/* 属性块 1 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">
                {boss.hp2 ? "阶段一血量 (HP)" : "血量 (HP)"}
              </span>
              <span className="font-mono text-2xl font-bold text-white tabular-nums tracking-tight">
                {boss.hp}
              </span>
            </div>

            {/* 属性块 2 (如果有) */}
            {boss.hp2 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500">
                  阶段二血量 (P2)
                </span>
                <span className="font-mono text-2xl font-bold text-[#ff4d4f] tabular-nums tracking-tight">
                  {boss.hp2}
                </span>
              </div>
            ) : (
              /* 如果没有 P2，可以放一个占位或者其他属性，这里放一个装饰性的 "Danger Level" */
              <div className="flex flex-col gap-1 opacity-50">
                <span className="text-xs font-medium text-zinc-500">
                  Danger Level
                </span>
                <div className="flex gap-1 pt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#d1ac69]"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧图片区
         */}
        <div className="flex shrink-0 justify-center self-center sm:justify-end">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded border border-[#d1ac69]/10 bg-black/20 sm:h-56 sm:w-56">
            <BossImage name={boss.title} />
          </div>
        </div>
      </div>
    </div>
  );
}
