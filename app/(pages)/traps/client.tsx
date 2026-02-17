"use client";

import type { Trap, TrapType } from "@/types";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { TrapCard } from "@/components/TrapCard";

const TRAP_TYPES: { type: TrapType }[] = [
  { type: "地面" },
  { type: "墙壁" },
  { type: "天花板" },
];

export default function TrapsClient({ traps }: { traps: Trap[] }) {
  const typeState = useSelection<TrapType>("type");

  const hasFilter = typeState.selected.size > 0;

  const resetFilters = () => {
    typeState.clear();
  };

  const filteredTraps = traps.filter((trap) => {
    const typeMatch =
      typeState.selected.size === 0 ||
      (trap.position && typeState.selected.has(trap.position));
    return typeMatch;
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">陷阱图鉴</h1>
      </div>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="位置类型"
          items={TRAP_TYPES}
          selected={typeState.selected}
          onToggle={typeState.toggle}
          gridClass="grid grid-cols-3 gap-2"
        />

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="mt-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            重置筛选
          </button>
        )}
      </div>

      {/* 结果统计 */}
      <p className="mb-4 text-sm text-zinc-500">
        共 {filteredTraps.length} 个陷阱
      </p>

      {/* 陷阱列表 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filteredTraps.map((trap) => (
          <TrapCard key={trap.slug} trap={trap} />
        ))}
      </div>

      {filteredTraps.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的陷阱
        </div>
      )}
    </>
  );
}
