import type { ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { MDXDetailLayout } from "@/components/MDXDetailLayout";
import { WeaponDetailCard } from "@/components/WeaponCard";
import {
  WeaponAttenuationChart,
  type WeaponAttenuationChartProps,
} from "@/components/WeaponAttenuationChart";
import { WeaponSkill } from "@/components/WeaponSkill";
import { mdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import type { Weapon } from "@/types";

interface WeaponDetailContentProps {
  weapon: Weapon;
  content: string;
  metadata: Record<string, unknown>;
}

export function WeaponDetailContent({
  weapon,
  content,
  metadata,
}: WeaponDetailContentProps) {
  const AttenuationChartForWeapon = (props: WeaponAttenuationChartProps) => (
    <WeaponAttenuationChart {...props} weapon={props.weapon ?? weapon} />
  );
  const WeaponSkillForWeapon = ({ children }: { children: ReactNode }) => (
    <>
      <WeaponSkill>{children}</WeaponSkill>
      <WeaponAttenuationChart weapon={weapon} />
    </>
  );
  const weaponMdxComponents = {
    ...mdxComponents,
    AttenuationChart: AttenuationChartForWeapon,
    WeaponAttenuationChart: AttenuationChartForWeapon,
    WeaponSkill: WeaponSkillForWeapon,
  };

  return (
    <MDXDetailLayout
      pageWidth={metadata["page-width"]}
      toc={metadata.toc !== false}
    >
      <WeaponDetailCard weapon={weapon} />

      {content.trim() && (
        <article className="prose prose-lg prose-invert mt-8 max-w-none">
          <MDXRemote
            source={content}
            components={weaponMdxComponents}
            options={mdxOptions}
          />
        </article>
      )}
    </MDXDetailLayout>
  );
}
