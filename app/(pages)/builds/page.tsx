import type { Metadata } from "next";
import { BuildGuideCatalog } from "@/components/build-guides/BuildGuideView";
import { getBuildGuideSummaries } from "@/lib/build-guides";

export const metadata: Metadata = {
  title: "搭配攻略",
  description: "逆战未来 S3 猎场武器、插件与赛季天赋搭配攻略。",
  alternates: { canonical: "/builds" },
};

export default async function BuildsPage() {
  const guides = await getBuildGuideSummaries();

  return (
    <div className="[--guide-accent:#e6b656] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7]">
      <BuildGuideCatalog guides={guides} />
    </div>
  );
}
