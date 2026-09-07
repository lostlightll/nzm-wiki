import Image from "next/image";
import { getAssetPath } from "@/lib/path";
import { legacyAsset, type LegacySeason } from "@/lib/s0s1-talent-presentation";
import styles from "./legacy-talents.module.css";

export function LegacyTalentScene({ season }: { season: LegacySeason }) {
  return (
    <div className={styles.scene} aria-hidden="true">
      <Image src={getAssetPath(legacyAsset(season === "s0" ? "T_SeasonalTalent_SP_Bg_01" : "T_TalentCandleTomb_SP_Bg_004"))} alt="" fill sizes="100vw" priority className={styles.backdrop} />
      {season === "s1" && ["006", "007", "008", "009"].map((part, index) => (
        <Image key={part} src={getAssetPath(legacyAsset(`T_TalentCandleTomb_SP_Bg_${part}`))} alt="" width={1800} height={900} sizes="50vw" className={`${styles.decoration} ${styles[`edge${index}`]}`} />
      ))}
    </div>
  );
}
