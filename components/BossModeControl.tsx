"use client";

import { useBossDifficulty } from "@/components/BossDifficultyProvider";
import { getOriginRooms, type OriginDifficulty } from "@/lib/origin-boss-health";

export function BossModeControl({ className = "" }: { className?: string }) {
  const { mode, setMode } = useBossDifficulty();

  return (
    <div className={className}>
      <h2 className="mb-3 text-base font-semibold text-zinc-300">猎场模式</h2>
      <div aria-label="选择猎场模式" className="inline-grid grid-cols-2 rounded border border-zinc-700 bg-zinc-900/75 p-1">
        {(["classic", "origin"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`min-h-11 touch-manipulation rounded px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 ${mode === option ? "bg-[#d1ac69]/20 text-[#efd59f]" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
          >
            {option === "classic" ? "常规猎场" : "原点猎场"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BossRoomControl() {
  const { difficulty, roomIndex, setRoomIndex } = useBossDifficulty();
  const rooms = getOriginRooms(difficulty as OriginDifficulty);

  return (
    <div>
      <label htmlFor="origin-room" className="mb-3 block text-base font-semibold text-zinc-300">房间序号</label>
      <select
        id="origin-room"
        value={roomIndex ?? ""}
        onChange={(event) => setRoomIndex(event.target.value === "" ? null : Number(event.target.value))}
        className="min-h-11 max-w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus-visible:border-[#d1ac69] focus-visible:outline-none"
      >
        <option value="">无倍率</option>
        {rooms.map((factor, index) => <option key={index} value={index}>房间 {index} · ×{Math.round(factor * 10) / 10}</option>)}
      </select>
      <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">原点血量随房间序号变化，选择实际房间后显示配置推算值</p>
    </div>
  );
}
