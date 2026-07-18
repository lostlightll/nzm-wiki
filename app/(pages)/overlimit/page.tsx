import type { Metadata } from "next";
import overlimitCards from "@/data/overlimit-cards.json";
import mapRotation from "@/data/overlimit-map-rotation.json";
import type {
  OverlimitCard,
  OverlimitMapRotationSchedule,
} from "@/types";
import OverlimitPageClient from "./client";

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    "逆战未来肉鸽猎场超限图鉴，收录超限卡片效果、套装词条、地图轮换与地图羁绊档期。",
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  return (
    <OverlimitPageClient
      initialCards={overlimitCards as OverlimitCard[]}
      mapRotation={mapRotation as OverlimitMapRotationSchedule}
    />
  );
}
