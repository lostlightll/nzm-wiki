import { Suspense } from "react";
import { toWeaponCatalogEntry } from "@/lib/weapon-consumers";
import { getAllResolvedWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";

export default async function WeaponsPage() {
  const [lcResolved, tdResolved] = await Promise.all([
    getAllResolvedWeapons("lc"),
    getAllResolvedWeapons("td"),
  ]);
  const lcWeapons = lcResolved.map(toWeaponCatalogEntry);
  const tdWeapons = tdResolved.map(toWeaponCatalogEntry);

  return (
    <Suspense>
      <WeaponsClient weapons={lcWeapons} tdWeapons={tdWeapons} />
    </Suspense>
  );
}
