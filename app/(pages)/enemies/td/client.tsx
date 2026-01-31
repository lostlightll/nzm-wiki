"use client";

import type { TDEnemy, TDEnemyType } from "@/types";
import { useState } from "react";
import { useSelection } from "@/hooks/useSelection";
import { FilterSection } from "@/components/Filter";
import { TDEnemyCard } from "@/components/TDEnemyCard";

const ENEMY_TYPES: { type: TDEnemyType; label: string }[] = [
  { type: "normal", label: "普通" },
  { type: "elite", label: "精英" },
  { type: "boss", label: "首领" },
];

export default function TDEnemiesClient({ enemies }: { enemies: TDEnemy[] }) {
  const typeState = useSelection<TDEnemyType>();
  const [showDetails, setShowDetails] = useState(true);

  const hasFilter = typeState.selected.size > 0;

  const resetFilters = () => {
    typeState.clear();
  };

  const typeOrder: Record<TDEnemyType, number> = { normal: 0, elite: 1, boss: 2 };

  const filteredEnemies = enemies
    .filter((enemy) => {
      const typeMatch =
        typeState.selected.size === 0 || typeState.selected.has(enemy.type);
      return typeMatch;
    })
    .sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">塔防敌人图鉴</h1>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {showDetails ? "简洁模式" : "详细模式"}
        </button>
      </div>

      {/* 筛选区域 */}
      <div className="mb-8 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <FilterSection
          title="敌人类型"
          items={ENEMY_TYPES}
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
        共 {filteredEnemies.length} 个敌人
      </p>

      {/* 敌人列表 */}
      <div className={`grid gap-4 ${showDetails ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`}>
        {filteredEnemies.map((enemy) => (
          <TDEnemyCard key={enemy.slug} enemy={enemy} showDetails={showDetails} />
        ))}
      </div>

      {filteredEnemies.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有符合条件的敌人
        </div>
      )}
    </>
  );
}
