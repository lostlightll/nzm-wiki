import { getMDXList, getMDXDetail } from "@/lib/mdx";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { PerkDetailCard } from "@/components/PerkCard";
import { EffectValuesPanel } from "@/components/EffectValues";
import { IndependentDamagePanel } from "@/components/TriggerDamageCatalog";
import { MultiplierProviderPanel } from "@/components/MultiplierBadges";
import { RARITY_NUM_MAP } from "@/constants/common";
import { getIndependentDamageByPerkSlug } from "@/lib/independent-damage";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { getPerkBySlug } from "@/lib/perks";
import type { Rarity } from "@/types";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const items = getMDXList("perks");
  return items.map((item) => ({
    slug: item.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");
  const { metadata } = getMDXDetail("perks", slugPath);
  const title = metadata.title || slugPath;
  return {
    title,
    description: `${title} — 逆战未来特性详情`,
    alternates: { canonical: `/perks/${slugPath}` },
  };
}

const PAGE_WIDTH_CLASSES: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  full: "max-w-7xl",
};

function isCustomWidth(value: string): boolean {
  return /^\d+(px|rem|em|vw|%)$/.test(value);
}

function normalizeDescriptionMarkup(source: string): string {
  return source.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

export default async function PerkDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug.map(decodeURIComponent).join("/");

  const { content, metadata } = getMDXDetail("perks", slugPath);
  const showToc = metadata.toc !== false;
  const independentDamage = await getIndependentDamageByPerkSlug(slugPath);
  const perk = getPerkBySlug(slugPath);
  const multiplierSource = {
    type: "perk" as const,
    slot: metadata.slot,
    slug: slugPath.split("/").at(-1) ?? metadata.title,
  };

  const pageWidth = metadata["page-width"] as string | undefined;
  const isCustom = pageWidth && isCustomWidth(pageWidth);
  const widthClass = isCustom
    ? ""
    : pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
      ? PAGE_WIDTH_CLASSES[pageWidth]
      : "max-w-3xl";
  const customStyle = isCustom ? { maxWidth: pageWidth } : undefined;

  const rarity: Rarity | undefined =
    typeof metadata.rarity === "number"
      ? RARITY_NUM_MAP[metadata.rarity]
      : metadata.rarity;

  const descriptionNode = perk?.description ? (
    <MDXRemote
      source={normalizeDescriptionMarkup(perk.description)}
      components={mdxComponents}
    />
  ) : undefined;

  return (
    <>
      <TableOfContents enabled={showToc} />
      <div
        className={`mx-auto ${widthClass} py-6 ${isCustom ? "max-md:max-w-full" : ""}`}
        style={customStyle}
      >
        <PerkDetailCard
          name={metadata.title}
          icon={metadata.icon}
          slot={metadata.slot}
          rarity={rarity}
          description={descriptionNode}
          weaponType={metadata.weaponType}
          weaponNames={metadata.weaponNames}
        />
        {independentDamage.map((entry) => (
          <IndependentDamagePanel
            key={`${entry.name}-${entry.numericalId}`}
            entry={entry}
          />
        ))}
        {perk?.effectValues?.length ? (
          <EffectValuesPanel
            id="multiplier-provider"
            effects={perk.effectValues}
            relations={getProviderRelationsForSource(multiplierSource)}
            className="mt-4"
          />
        ) : (
          <MultiplierProviderPanel
            source={multiplierSource}
            className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/60"
          />
        )}

        {content.trim() && (
          <article className="prose prose-lg prose-invert mt-8 max-w-none">
            <MDXRemote
              source={content}
              components={mdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </>
  );
}
