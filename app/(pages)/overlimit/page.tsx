import type { Metadata } from "next";
import bondCatalog from "@/data/overlimit-bonds.json";
import levelCatalog from "@/data/overlimit-levels.json";
import mapRotation from "@/data/overlimit-map-rotation.json";
import { getAllOverlimitCards } from "@/lib/overlimit-cards";
import type {
  OverlimitBondCatalog,
  OverlimitLevelCatalog,
  OverlimitMapRotationSchedule,
} from "@/types";
import OverlimitPageClient from "./client";

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    "逆战未来肉鸽猎场超限图鉴，收录超限卡片、羁绊效果、等级品质概率、4 插卡池概率、重抽费用与地图羁绊档期。",
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  const cards = getAllOverlimitCards();
  return (
    <OverlimitPageClient
      initialCards={cards}
      bondCatalog={bondCatalog as OverlimitBondCatalog}
      levelCatalog={levelCatalog as OverlimitLevelCatalog}
      mapRotation={mapRotation as OverlimitMapRotationSchedule}
    />
  );
}
