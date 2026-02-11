"use client";

import type { Enemy, EnemyType } from "@/types";
import { EnemyCard, EnemyCardGrid } from "@/components/EnemyCard";
import { ENEMY_CARD_STYLES } from "@/constants/common";

const ENEMY_TYPE_ORDER: EnemyType[] = ["normal", "elite", "boss"];

export default function TDEnemiesClient({ enemies }: { enemies: Enemy[] }) {
  const grouped = ENEMY_TYPE_ORDER.map((type) => ({
    type,
    label: ENEMY_CARD_STYLES[type].label,
    enemies: enemies.filter((e) => e.type === type),
  })).filter((g) => g.enemies.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold text-white">塔防敌人图鉴</h1>

      {grouped.map((group) => (
        <section key={group.type} className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-zinc-300">
            {group.label}
          </h2>
          <EnemyCardGrid>
            {group.enemies.map((enemy) => (
              <EnemyCard key={enemy.slug} enemy={enemy} />
            ))}
          </EnemyCardGrid>
        </section>
      ))}

      {enemies.length === 0 && (
        <div className="py-16 text-center text-zinc-500">
          没有敌人数据
        </div>
      )}
    </div>
  );
}
