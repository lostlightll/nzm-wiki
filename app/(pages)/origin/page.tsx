import type { Metadata } from "next";
import catalog from "@/data/origin/runes.json";
import talentCatalog from "@/data/origin/talents.json";
import type { OriginRuneCatalog } from "@/lib/origin-runes";
import type { OriginTalentCatalog } from "@/lib/origin-talents";
import OriginCatalogClient from "./catalog-client";

const runes = catalog as OriginRuneCatalog;

export const metadata: Metadata = {
  title: "原点图鉴",
  description: `逆战未来原点图鉴，查看战斗、幸运、技巧天赋树、升级消耗与解锁条件，并检索 ${runes.runes.length} 项强化。`,
  alternates: { canonical: "/origin" },
};

export default function OriginPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">原点图鉴</h1>
      </header>
      <OriginCatalogClient runes={runes} talents={talentCatalog as OriginTalentCatalog} />
    </main>
  );
}
