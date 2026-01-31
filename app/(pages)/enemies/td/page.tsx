import { getAllTDEnemies } from "@/lib/td-enemies";
import TDEnemiesClient from "./client";

export default async function TDEnemiesPage() {
  const enemies = await getAllTDEnemies();
  return <TDEnemiesClient enemies={enemies} />;
}
