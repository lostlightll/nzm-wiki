import { Suspense } from "react";
import { getAllWeapons, getAllTDWeapons } from "@/lib/weapons";
import WeaponsClient from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "武器图鉴",
  description: "逆战未来猎场与塔防武器属性、伤害和技能资料",
  alternates: { canonical: "/weapons" },
};

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
