"use client";

import type { Enemy } from "@/types";
import { EnemyCard, EnemyCardGrid } from "@/components/EnemyCard";

const MAP_ORDER = ["大都会", "黑暗复活节", "冰点源起", "昆仑神宫", "精绝古城"];

export default function LCEnemiesClient({ enemies }: { enemies: Enemy[] }) {
  const grouped = MAP_ORDER.map((map) => ({
    map,
    enemies: enemies.filter((e) => e.map === map),
  })).filter((g) => g.enemies.length > 0);

  // 不在已知地图中的敌人
  const knownMaps = new Set(MAP_ORDER);
  const others = enemies.filter((e) => e.map && !knownMaps.has(e.map));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold text-white">猎场首领图鉴</h1>

      {grouped.map((group) => (
        <section key={group.map} className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-zinc-300">
            {group.map}
          </h2>
          <EnemyCardGrid>
            {group.enemies.map((enemy) => (
              <EnemyCard key={enemy.slug} enemy={enemy} />
            ))}
          </EnemyCardGrid>
        </section>
      ))}

      {others.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-zinc-300">其他</h2>
          <EnemyCardGrid>
            {others.map((enemy) => (
              <EnemyCard key={enemy.slug} enemy={enemy} />
            ))}
          </EnemyCardGrid>
        </section>
      )}

      {enemies.length === 0 && (
        <div className="py-16 text-center text-zinc-500">没有首领数据</div>
      )}
    </div>
  );
}
