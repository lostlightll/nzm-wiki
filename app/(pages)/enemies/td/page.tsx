import { getAllTDEnemies, tdEnemyToEnemy } from "@/lib/td-enemies";
import TDEnemiesClient from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "塔防敌人",
  description: "逆战未来塔防模式敌人属性与图鉴资料",
  alternates: { canonical: "/enemies/td" },
};

export default async function TDEnemiesPage() {
  const enemies = await getAllTDEnemies();
  const converted = enemies.map(tdEnemyToEnemy);
  return <TDEnemiesClient enemies={converted} />;
}
