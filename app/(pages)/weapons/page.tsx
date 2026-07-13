import { Suspense } from "react";
import { getAllWeapons, getAllTDWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";

export default async function WeaponsPage() {
  const [lcWeapons, tdWeapons] = await Promise.all([
    getAllWeapons(),
    getAllTDWeapons(),
  ]);

  return (
    <Suspense>
      <WeaponsClient weapons={lcWeapons} tdWeapons={tdWeapons} />
    </Suspense>
  );
}
