import { getAllWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";

export default function WeaponsPage() {
  const weapons = getAllWeapons();

  return <WeaponsClient weapons={weapons} />;
}
