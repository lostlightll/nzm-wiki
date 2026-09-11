import { Suspense } from "react";
import type { Metadata } from "next";
import { HunterMonsterCatalog } from "@/components/HunterMonsterCatalog";
import { getHunterMonsters } from "@/lib/hunter-monsters";

export const metadata: Metadata = {
  title: "猎场怪物图鉴",
  description: "逆战未来猎场普通怪物、队长与精英档案，按地图、难度和区域查询血量。",
  alternates: { canonical: "/enemies/lc/monsters" },
};

export default function Page() {
  return <Suspense fallback={<p className="text-zinc-400">正在加载怪物图鉴…</p>}><HunterMonsterCatalog monsters={getHunterMonsters()} /></Suspense>;
}
