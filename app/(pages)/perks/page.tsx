import { getAllPerks } from "@/lib/perks";
import PerksPageClient from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特性图鉴",
  description: "逆战未来特性效果、槽位与稀有度资料",
  alternates: { canonical: "/perks" },
};

export default function PerksPage() {
  const perks = getAllPerks();
  return <PerksPageClient initialPerks={perks} />;
}
