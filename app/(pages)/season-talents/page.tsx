import type { Metadata } from "next";
import blackHoleData from "@/data/season-talents/s4/black-hole.json";
import dualStarData from "@/data/season-talents/s4/dual-star.json";
import matrixSymbiosisData from "@/data/season-talents/s4/matrix-symbiosis.json";
import passiveData from "@/data/season-talents/s4/passives.json";
import { SeasonTalentTabs } from "@/components/season-talents/SeasonTalentTabs";

export const metadata: Metadata = {
  title: "赛季天赋",
  description: "逆战未来赛季天赋图鉴与天赋树详情入口。",
  alternates: { canonical: "/season-talents" },
};

export default async function SeasonTalentsPage() {
  const showS4 =
    process.env.NODE_ENV === "development" ||
    [blackHoleData, dualStarData, matrixSymbiosisData, passiveData].every(
      (data) => data.draft !== true,
    );
  const s4Panel = showS4
    ? await import(
        "@/components/season-talents/s4/S4SeasonTalentPreview"
      ).then(({ S4SeasonTalentPreview }) => <S4SeasonTalentPreview />)
    : null;

  return (
    <div className="h-full [--guide-accent:#e6b656] [--guide-accent-soft:rgba(172,124,39,0.2)] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7]">
      <h1 className="sr-only">赛季天赋</h1>
      <SeasonTalentTabs s4Panel={s4Panel} />
    </div>
  );
}
