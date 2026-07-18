import type { Metadata } from "next";
import overlimitCards from "@/data/overlimit-cards.json";
import type { OverlimitCard } from "@/types";
import OverlimitPageClient from "./client";

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    "逆战未来肉鸽猎场超限卡片图鉴，收录卡片效果、套装词条、适用武器与抽取权重。",
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  return (
    <OverlimitPageClient initialCards={overlimitCards as OverlimitCard[]} />
  );
}
