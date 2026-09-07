import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Archive } from "lucide-react";
import type { CSSProperties } from "react";
import { getAssetPath } from "@/lib/path";
import { LEGACY_TALENT_CATALOG, legacyAsset, legacyTalentHref, type LegacySeason } from "@/lib/s0s1-talent-presentation";
import { LegacyTalentScene } from "./LegacyTalentScene";
import styles from "./legacy-talents.module.css";

export function LegacyTalentCatalog({ season }: { season: LegacySeason }) {
  const talents = LEGACY_TALENT_CATALOG.filter(t => t.season === season && t.confirmed);
  return (
    <section className={styles.catalog} aria-label={`${season.toUpperCase()} 赛季天赋`}>
      <LegacyTalentScene season={season} />
      <div className={styles.catalogContent}>
        <header className={styles.seasonTitle}>
          <Image src={getAssetPath(legacyAsset(season === "s1" ? "T_TalentCandleTomb_SP_De_001" : "T_SeasonalTalent_SP_De_16"))} alt={season === "s1" ? "鬼吹灯 S1" : "钢铁起源 S0"} width={688} height={season === "s1" ? 624 : 220} className={season === "s1" ? styles.logo : styles.steelLogo} priority />
        </header>
        <div className={styles.catalogBranches}>
          {talents.map(talent => (
            <Link key={talent.id} href={legacyTalentHref(season, talent.id)} className={styles.branch} style={{ "--talent-color": talent.color } as CSSProperties}>
              <Image src={getAssetPath(legacyAsset(talent.icon))} alt="" width={260} height={260} className={styles.branchIcon} priority />
              <h3>{talent.name}</h3><p>{talent.subtitle}</p>
              <span className={styles.branchAction}>天赋树 <ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
        {season === "s0" && <Link href={legacyTalentHref("s0", "destruction-dream")} className={styles.archiveLink}><Archive size={15} aria-hidden="true" /> 毁灭之梦 <span>历史配置 · 录像未收录</span><ArrowRight size={14} aria-hidden="true" /></Link>}
      </div>
    </section>
  );
}
