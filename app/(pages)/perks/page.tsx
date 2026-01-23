import { getAllPerks } from "@/lib/perks";
import type { Perk } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  装填类: "bg-blue-600",
  伤害类: "bg-red-600",
  生存类: "bg-green-600",
  辅助类: "bg-yellow-600",
};

function PerkCard({ perk }: { perk: Perk }) {
  const categoryColor = CATEGORY_COLORS[perk.category] || "bg-gray-600";

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 transition-transform hover:scale-105">
      {/* 图标占位 */}
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
        <span className="text-4xl text-zinc-500">⚡</span>
      </div>

      {/* 悬停显示详情 */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium text-white ${categoryColor}`}
          >
            {perk.category}
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold text-white">{perk.name}</h3>
        {perk.description && (
          <p className="mt-1 text-xs text-zinc-400">{perk.description}</p>
        )}
      </div>

      {/* 名称始终显示 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 group-hover:opacity-0">
        <h3 className="text-center text-sm font-medium text-white">
          {perk.name}
        </h3>
      </div>
    </div>
  );
}

export default function PerksPage() {
  const perks = getAllPerks();

  // 按分类分组
  const categories = ["装填类", "伤害类", "生存类", "辅助类"];
  const groupedPerks = categories.reduce(
    (acc, cat) => {
      acc[cat] = perks.filter((p) => p.category === cat);
      return acc;
    },
    {} as Record<string, Perk[]>
  );

  return (
    <div className="min-h-screen bg-zinc-900 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-white">插件图鉴</h1>

        {categories.map((category) => {
          const categoryPerks = groupedPerks[category];
          if (!categoryPerks || categoryPerks.length === 0) return null;

          return (
            <section key={category} className="mb-10">
              <h2 className="mb-4 text-xl font-semibold text-zinc-300">
                {category}
              </h2>
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {categoryPerks.map((perk) => (
                  <PerkCard key={perk.id} perk={perk} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
