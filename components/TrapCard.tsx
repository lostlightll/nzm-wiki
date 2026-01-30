"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Trap } from "@/types";
import { getAssetPath } from "@/lib/path";

function TrapImage({ name, size = 128 }: { name: string; size?: number }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className="flex items-center justify-center bg-zinc-800 text-zinc-500"
        style={{ width: size, height: size }}
      >
        No Image
      </div>
    );
  }

  return (
    <Image
      src={getAssetPath(`/icons/traps/${name}.png`)}
      alt={name}
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
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
        {trap.position && (
          <p className="mt-1 text-center text-sm text-zinc-400">{trap.position}</p>
        )}
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
    return val;
  };

  return (
    <div className="rounded-lg border-2 border-zinc-700 bg-zinc-800/50 p-6">
      {/* 头部 */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">{trap.title}</h1>
        {trap.position && (
          <p className="mt-1 text-sm text-zinc-400">{trap.position}</p>
        )}
      </div>

      {/* 图片 */}
      <div className="mb-6 flex justify-center">
        <TrapImage name={trap.title} size={256} />
      </div>

      {/* 属性 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">陷阱属性</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
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
  );
}
