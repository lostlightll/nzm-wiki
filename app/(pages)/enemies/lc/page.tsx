import { getAllBosses, bossToEnemy } from "@/lib/bosses";
import LCEnemiesClient from "./client";

export default async function LCEnemiesPage() {
  const bosses = await getAllBosses();
  const enemies = bosses.map(bossToEnemy);
  return <LCEnemiesClient enemies={enemies} />;
}
