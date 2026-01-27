import { getAllWeaponsFromNotion } from "@/lib/weapons-notion";
import WeaponsClient from "./client";

export default async function WeaponsPage() {
  const weapons = await getAllWeaponsFromNotion();

  return <WeaponsClient weapons={weapons} />;
}
