import type { Metadata } from "next";
import TrapsClient from "@/app/(pages)/traps/client";
import TDEnemiesClient from "@/app/(pages)/enemies/td/client";
import { getAllTDEnemies, tdEnemyToEnemy } from "@/lib/td-enemies";
import { getAllTraps } from "@/lib/traps";
import TowerDefensePageClient from "./client";

export const metadata: Metadata = {
  title: "塔防图鉴",
  description: "逆战未来塔防图鉴，收录塔防陷阱与塔防敌人资料。",
  alternates: { canonical: "/tower-defense" },
};

export default async function TowerDefensePage() {
  const [traps, tdEnemies] = await Promise.all([
    getAllTraps(),
    getAllTDEnemies(),
  ]);

  return (
    <TowerDefensePageClient
      trapsPanel={<TrapsClient traps={traps} showHeading={false} />}
      enemiesPanel={
        <TDEnemiesClient
          enemies={tdEnemies.map(tdEnemyToEnemy)}
          showHeading={false}
        />
      }
    />
  );
}
