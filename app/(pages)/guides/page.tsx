import type { Metadata } from "next";
import Link from "next/link";
import { getMDXList } from "@/lib/mdx";
import { getApplicableModifierTypes } from "@/lib/multiplier-data";
import { buildWeaponBaseDamageIndex } from "@/lib/weapon-base-damage";
import { getAllResolvedWeapons } from "@/lib/weapons";
import GuidesPageClient from "./client";
import type { MultiplierTargetIndexEntry } from "./MultiplierBidirectionalIndex";

export const metadata: Metadata = {
  title: "攻略机制",
  description: "逆战未来的游戏乘区、赛季天赋与攻略文章归档。",
  alternates: { canonical: "/guides" },
};

interface Post {
  slug: string;
  title?: string;
  tag?: string | string[];
}

export default async function GuidesPage() {
  const posts = getMDXList("posts") as Post[];
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
    <GuidesPageClient
      baseDamageEntries={baseDamageEntries}
      multiplierTargets={multiplierTargets}
      archivePanel={
        <ul className="space-y-3">
          {posts.map((post) => {
            const tags = post.tag
              ? Array.isArray(post.tag)
                ? post.tag
                : [post.tag]
              : [];

            return (
              <li key={post.slug} className="flex items-center gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/posts/tags/${encodeURIComponent(tag)}`}
                    className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-600"
                  >
                    {tag}
                  </Link>
                ))}
                <Link
                  href={`/posts/${post.slug}`}
                  className="text-zinc-300 transition-colors hover:text-white"
                >
                  {post.title || post.slug}
                </Link>
              </li>
            );
          })}
        </ul>
      }
    />
  );
}
