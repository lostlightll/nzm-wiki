"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Boss } from "@/types";
import { getAssetPath } from "@/lib/path";

// 统一金色主题
const THEME_COLOR = "#d1ac69";

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
      {/* 底部光晕：保留，增加层次感 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#d1ac69]/20 to-transparent opacity-40" />

      <Image
        src={src}
        alt={name}
        width={256}
        height={256}
        // 修改点 1 & 2:
        // - 移除了 p-2: 图片不再缩进，直接贴边
        // - 移除了 group-hover:scale-110: 图片不再放大
        // - 改为 object-cover: 强制填满容器（可能会裁剪掉边缘，保证填满）
        // - not-prose: 防止被排版插件干扰
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
      {/* 外层容器：h-32 (128px) 保持不变 */}
      <div className="not-prose relative flex h-32 w-full overflow-hidden rounded border border-[#d1ac69]/30 bg-[#d1ac69]/5 transition-all duration-300 hover:border-[#d1ac69]/80 hover:bg-[#d1ac69]/10 hover:shadow-[0_0_20px_-5px_rgba(209,172,105,0.2)]">
        {/* 左侧图片区域：w-32 (128px) 保持正方形 */}
        <div className="w-32 shrink-0 border-r border-[#d1ac69]/10 bg-black/20">
          <BossImage name={boss.title} />
        </div>

        {/* 右侧信息区域 */}
        <div className="flex flex-1 flex-col justify-center px-5 py-2 min-w-0">
          {/* 标题部分 */}
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
            {/* 装饰线 */}
            <div className="mt-1.5 h-0.5 w-8 rounded-full bg-[#d1ac69]/60" />
          </div>

          {/* 数据面板：保持 whitespace-nowrap 防止换行 */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 text-sm">
            {/* P1 */}
            <span className="text-zinc-500 font-medium text-xs">HP</span>
            <span className="font-mono text-[#d1ac69] text-base tabular-nums tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
              {boss.hp}
            </span>

            {/* P2 */}
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

        {/* 右上角装饰小三角 */}
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
  // 保持一行两个，防止文字挤压
  return (
    <div className="not-prose grid grid-cols-1 gap-4 lg:grid-cols-2">
      {children}
    </div>
  );
}

export function BossDetailCard({ boss }: { boss: Boss }) {
  return (
    <div className="not-prose relative overflow-hidden rounded-lg border border-[#d1ac69]/40 bg-[#d1ac69]/5 p-6 shadow-sm">
      <div className="flex flex-col-reverse gap-6 sm:flex-row">
        <div className="flex-1 space-y-4">
          <div className="border-l-4 border-[#d1ac69] pl-4">
            <h1 className="text-3xl font-bold text-white">{boss.title}</h1>
            <p className="mt-1 text-sm text-[#d1ac69] opacity-80">{boss.map}</p>
          </div>

          <div className="mt-4 max-w-sm rounded bg-black/20 p-4 border border-[#d1ac69]/20">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              数据面板
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-[#d1ac69]/10 pb-1">
                <span className="text-zinc-400">一阶段血量</span>
                <span className="font-mono text-white text-base">
                  {boss.hp}
                </span>
              </div>
              {boss.hp2 && (
                <div className="flex justify-between pt-1">
                  <span className="text-zinc-400">二阶段血量</span>
                  <span className="font-mono text-red-400 text-base">
                    {boss.hp2}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-center self-center sm:justify-end">
          <div className="relative h-40 w-40 sm:h-48 sm:w-48">
            <BossImage name={boss.title} className="drop-shadow-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
