import type { Metadata } from "next";
import overlimitCards from "@/data/overlimit-cards.json";
import levelCatalog from "@/data/overlimit-levels.json";
import mapRotation from "@/data/overlimit-map-rotation.json";
import type {
  OverlimitCard,
  OverlimitLevelCatalog,
  OverlimitMapRotationSchedule,
} from "@/types";
import OverlimitPageClient from "./client";

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    "逆战未来肉鸽猎场超限图鉴，收录超限卡片效果、等级品质概率、4 插卡池概率、重抽费用与地图羁绊档期。",
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  return (
    <OverlimitPageClient
      initialCards={overlimitCards as OverlimitCard[]}
      levelCatalog={levelCatalog as OverlimitLevelCatalog}
      mapRotation={mapRotation as OverlimitMapRotationSchedule}
    />
  );
}
