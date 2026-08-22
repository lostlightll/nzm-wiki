import type { Metadata } from "next";
import { SeasonTalentCatalog } from "@/components/SeasonTalentCatalog";

export const metadata: Metadata = {
  title: "赛季天赋",
  description: "逆战未来赛季天赋图鉴与天赋树详情入口。",
  alternates: { canonical: "/season-talents" },
};

export default function SeasonTalentsPage() {
  return (
    <div className="[--guide-accent:#e6b656] [--guide-accent-soft:rgba(172,124,39,0.2)] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7]">
      <h1 className="sr-only">赛季天赋</h1>
      <SeasonTalentCatalog />
    </div>
  );
}
