import type { Metadata } from "next";
import { MultiplierOverview } from "@/app/(pages)/guides/MultiplierOverview";
import type { MultiplierTargetIndexEntry } from "@/app/(pages)/guides/MultiplierBidirectionalIndex";
import { getApplicableModifierTypes } from "@/lib/multiplier-data";
import { buildWeaponBaseDamageIndex } from "@/lib/weapon-base-damage";
import { getAllResolvedWeapons } from "@/lib/weapons";

export const metadata: Metadata = {
  title: "游戏乘区",
  description: "逆战未来伤害来源、增伤乘区及适用关系资料。",
  alternates: { canonical: "/multiplier" },
};

export default async function MultiplierPage() {
  const [lcWeapons, tdWeapons] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const baseDamageEntries = buildWeaponBaseDamageIndex({
    lc: lcWeapons,
    td: tdWeapons,
  });
  const multiplierTargets: MultiplierTargetIndexEntry[] = lcWeapons.flatMap(
    (weapon) =>
      weapon.damageSources.flatMap((source) => {
        if (
          source.damage.base.state !== "resolved" &&
          source.damage.base.state !== "zero"
        ) {
          return [];
        }
        const relations = getApplicableModifierTypes(source);
        if (relations.length === 0) return [];
        return [
          {
            id: `${weapon.slug}:${source.id}`,
            label: source.name,
            sourceLabel: weapon.title,
            href: `/weapons/${encodeURIComponent(weapon.slug)}#damage-source-${encodeURIComponent(source.id)}`,
            relations,
          },
        ];
      }),
  );

  return (
    <div className="[--guide-accent:#e6b656] [--guide-accent-soft:rgba(172,124,39,0.2)] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7] [--guide-warning-border:rgba(190,139,48,0.45)]">
      <h1 className="sr-only">游戏乘区</h1>
      <MultiplierOverview
        baseDamageEntries={baseDamageEntries}
        targets={multiplierTargets}
      />
    </div>
  );
}
