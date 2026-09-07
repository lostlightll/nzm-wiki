"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SquarePen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FullscreenTalentStage } from "@/components/season-talents/FullscreenTalentStage";
import catalog from "@/data/season-talents/s2/catalog.json";
import { getAssetPath } from "@/lib/path";
import { getS2TalentTree } from "@/lib/s2-season-talents";
import { restoreS2Build, s2SpentPoints } from "@/lib/s2-season-talent-builder";
import styles from "./s2.module.css";

export function S2SeasonTalentCatalog() {
  const [summaries, setSummaries] = useState<Record<string, { points: number; passiveIcon?: string; passiveName?: string }>>({});
  const layout = useRef<HTMLDivElement>(null);
  const [sceneScale, setSceneScale] = useState(1);

  useEffect(() => {
    if (!layout.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSceneScale(Math.min(1, entry.contentRect.width / 1600, entry.contentRect.height / 900));
    });
    observer.observe(layout.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setSummaries(Object.fromEntries(catalog.trees.map(({ id }) => {
      const tree = getS2TalentTree(id)!;
      try {
        const build = restoreS2Build(tree, JSON.parse(localStorage.getItem(`nzm-wiki:s2-talents:${id}:v1`) ?? "null"));
        const passive = tree.passives.find(p => p.id === build.passiveId);
        return [id, { points: s2SpentPoints(tree, build.levels), passiveIcon: passive?.icon, passiveName: passive?.name }];
      } catch { return [id, { points: 0 }]; }
    })));
    const frame = requestAnimationFrame(sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  return (
    <FullscreenTalentStage background={catalog.background} backgroundAlt="S2 樱之渊" className={styles.catalog} contentClassName={styles.catalogContent}>
      <div className={styles.brand}>
        <Image src={getAssetPath(catalog.logo)} alt="樱之渊 S2" width={360} height={110} priority />
        <h1>赛季天赋</h1>
      </div>
      <div ref={layout} className={styles.artLayout}>
      <div className={styles.composition} style={{ "--scene-scale": sceneScale } as CSSProperties}>
      {catalog.trees.map((tree, index) => (
        <div key={tree.id} className={`${styles.branchGroup} ${styles[tree.id]}`}>
          <div className={styles.branch}>
            <Image src={getAssetPath(catalog.decorations[[1, 2, 0][index]])} alt="" fill sizes="(max-width: 700px) 100vw, 70vw" className={styles.branchArt} />
          <span className={styles.coreArt}>
            <Image src={getAssetPath(catalog.markers[index].glow)} alt="" fill sizes="(max-width: 700px) 80px, 150px" className={styles.coreGlow} />
            <Image src={getAssetPath(catalog.markers[index].shell)} alt="" fill sizes="(max-width: 700px) 112px, 250px" />
            {/* Temporarily hide T_SeasonalTalentS2_Selected; keep the asset for restoration.
            <Image src={getAssetPath(catalog.frame)} alt="" fill sizes="(max-width: 700px) 112px, 250px" className={styles.coreFrame} />
            */}
          </span>
          </div>
          <Link href={`/guides/season-talents/s2/${tree.id}`} className={styles.core}>
            {/* <span className={styles.markerStatus}>使用中</span> */}
            <span className={styles.markerTitle}>
              <Image src={getAssetPath(catalog.markers[index].title)} alt="" width={356} height={150} className={styles.markerTexture} />
              <strong>{tree.name}</strong>
              <span className={styles.markerInfo} aria-hidden="true"><span>i</span></span>
              <span className={styles.markerEmblem} title={summaries[tree.id]?.passiveName ?? "被动天赋"}>
                <Image src={getAssetPath(summaries[tree.id]?.passiveIcon ?? getS2TalentTree(tree.id)!.passives[0].icon)} alt="" width={30} height={30} />
              </span>
            </span>
            <span className={styles.markerSubtitle}>{tree.subtitle}</span>
            <span className={styles.markerFooter}>
              <span className={styles.markerPoints} aria-label={`${tree.name}已分配 ${summaries[tree.id]?.points ?? 0} 点，预算 ${tree.pointLimit} 点`}><strong>{summaries[tree.id]?.points ?? 0}</strong><span>/{tree.pointLimit}</span></span>
              <span className={styles.markerEdit}><SquarePen size={12} aria-hidden="true" />编辑天赋</span>
            </span>
          </Link>
        </div>
      ))}
      </div>
      </div>
    </FullscreenTalentStage>
  );
}
