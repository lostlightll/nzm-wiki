import { getAllBosses, bossToEnemy } from "@/lib/bosses";
import LCEnemiesClient from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "猎场首领",
  description: "逆战未来僵尸猎场首领属性与攻略资料",
  alternates: { canonical: "/enemies/lc" },
};

export default async function LCEnemiesPage() {
  const bosses = await getAllBosses();
  const enemies = bosses.map(bossToEnemy);
  return <LCEnemiesClient enemies={enemies} />;
}
