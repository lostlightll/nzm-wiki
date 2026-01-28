import { getAllWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";

export default async function WeaponsPage() {
  const weapons = await getAllWeapons();

  return <WeaponsClient weapons={weapons} />;
}
