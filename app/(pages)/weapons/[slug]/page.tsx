import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { WeaponAttenuationChart } from "@/components/WeaponAttenuationChart";
import { WeaponDetailCard } from "@/components/WeaponCard";
import { WeaponDetailProvider } from "@/components/WeaponDetailContext";
import { MultiplierProviderPanel } from "@/components/MultiplierBadges";
import {
  ActiveSkill,
  WeaponSkill,
  type ActiveSkillProps,
} from "@/components/WeaponSkill";
import {
  getActiveSkillDisplay,
  toWeaponDetailData,
} from "@/lib/weapon-consumers";
import { mdxComponents, TableOfContents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import {
  getResolvedWeaponDocument,
  getResolvedWeaponSlugs,
} from "@/lib/weapons";

export async function generateStaticParams() {
  return (await getResolvedWeaponSlugs("lc")).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = await getResolvedWeaponDocument(slug, "lc");
  const title = document?.weapon.title ?? decodeURIComponent(slug);
  return {
    title,
    description: `${title} — 逆战未来武器详情`,
    alternates: { canonical: `/weapons/${slug}` },
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

export default async function WeaponDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const document = await getResolvedWeaponDocument(slug, "lc");
  if (!document) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <p className="text-zinc-500">武器不存在</p>
      </div>
    );
  }

  const weapon = toWeaponDetailData(document.weapon);
  const pageWidth = document.page.pageWidth;
  const customWidth = pageWidth !== undefined && isCustomWidth(pageWidth);
  const widthClass = customWidth
    ? ""
    : pageWidth && PAGE_WIDTH_CLASSES[pageWidth]
      ? PAGE_WIDTH_CLASSES[pageWidth]
      : "max-w-3xl";
  const customStyle = customWidth ? { maxWidth: pageWidth } : undefined;

  const ActiveSkillForWeapon = (props: ActiveSkillProps) => {
    const display = getActiveSkillDisplay(weapon.activeSkill, props.count);
    return (
      <ActiveSkill
        {...props}
        cooldown={display.cooldown}
        count={display.count}
      />
    );
  };
  const WeaponSkillForWeapon = ({ children }: { children: ReactNode }) => (
    <>
      <WeaponSkill>{children}</WeaponSkill>
      <WeaponAttenuationChart />
    </>
  );
  const weaponMdxComponents = {
    ...mdxComponents,
    ActiveSkill: ActiveSkillForWeapon,
    AttenuationChart: WeaponAttenuationChart,
    WeaponAttenuationChart,
    WeaponSkill: WeaponSkillForWeapon,
  };

  return (
    <WeaponDetailProvider weapon={weapon}>
      <TableOfContents enabled={document.page.toc} />
      <div
        className={`mx-auto ${widthClass} py-6 ${customWidth ? "max-md:max-w-full" : ""}`}
        style={customStyle}
      >
        <WeaponDetailCard />
        <MultiplierProviderPanel
          source={{ type: "weapon", slug: weapon.slug }}
          className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/60"
        />
        {document.content.trim() && (
          <article className="prose prose-lg prose-invert mt-8 max-w-none">
            <MDXRemote
              source={document.content}
              components={weaponMdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </WeaponDetailProvider>
  );
}
