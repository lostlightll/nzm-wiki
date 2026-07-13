import { getAllTDEnemies, tdEnemyToEnemy } from "@/lib/td-enemies";
import TDEnemiesClient from "./client";

export default async function TDEnemiesPage() {
  const enemies = await getAllTDEnemies();
  const converted = enemies.map(tdEnemyToEnemy);
  return <TDEnemiesClient enemies={converted} />;
}
