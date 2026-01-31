"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Trap } from "@/types";
import { getAssetPath } from "@/lib/path";

function TrapImage({ name, size = 128, className }: { name: string; size?: number; className?: string }) {
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
      src={getAssetPath(`/icons/traps/${name}.png`)}
      alt={name}
      width={192}
      height={192}
      className={`object-contain ${className ?? ""}`}
      style={className ? undefined : { width: size, height: size }}
      onError={() => setHasError(true)}
    />
  );
}

export function TrapCard({ trap }: { trap: Trap }) {
  return (
    <Link href={`/traps/${encodeURIComponent(trap.slug)}`}>
      <div className="rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-4 transition-transform hover:scale-[1.02] hover:border-zinc-600">
        <div className="flex justify-center mb-3">
          <TrapImage name={trap.title} />
        </div>
        <h3 className="text-center text-lg font-semibold text-white">{trap.title}</h3>
      </div>
    </Link>
  );
}

/**
 * 详情页陷阱卡片
 */
export function TrapDetailCard({ trap }: { trap: Trap }) {
  const formatValue = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || val === "" || val === -1) return "-";
    if (typeof val === "string") {
      return val.replace(/(\d+)\s*[xX]\s*(\d+)/g, "$1×$2");
    }
    return val;
  };

  return (
    <div className="rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-6">
      {/* 头部：左侧信息 + 右侧图片 */}
      <div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
        {/* 左侧信息 */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{trap.title}</h1>
          {trap.position && (
            <p className="mt-1 text-sm text-zinc-400">{trap.position}</p>
          )}

          {/* 描述 */}
          {trap.description && (
            <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
              {trap.description}
            </p>
          )}

          {/* 属性 */}
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-400">陷阱属性</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">攻击</span>
                <span className="text-white">{formatValue(trap.attack)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">射程</span>
                <span className="text-white">{formatValue(trap.range)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">防御</span>
                <span className="text-white">{formatValue(trap.defense)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">价格</span>
                <span className="text-white">{formatValue(trap.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">面积</span>
                <span className="text-white">{formatValue(trap.area)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧图片 */}
        <div className="flex-shrink-0 self-center sm:self-start">
          <TrapImage name={trap.title} className="w-32 h-32 sm:w-48 sm:h-48" />
        </div>
      </div>
    </div>
  );
}
