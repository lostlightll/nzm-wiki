import type { Metadata } from "next";
import { getOverlimitCatalog, getOverlimitVersions } from "@/lib/overlimit";
import OverlimitPageClient from "./client";

const catalog = getOverlimitCatalog();
const sections = ["超限卡片", catalog.bonds && "羁绊效果", catalog.levels && "等级概率与重抽费用", catalog.mapRotation && "地图轮换"].filter(Boolean);

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    `逆战未来 ${catalog.season.label} 超限图鉴，收录${sections.join("、")}。`,
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  return (
    <OverlimitPageClient
      season={catalog.season}
      versions={getOverlimitVersions()}
      initialCards={catalog.cards}
      bondCatalog={catalog.bonds}
      levelCatalog={catalog.levels}
      mapRotation={catalog.mapRotation}
    />
  );
}
