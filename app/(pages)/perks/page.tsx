import type { Metadata } from "next";
import { getAllPerks } from "@/lib/perks";
import { getPerkPreviewCatalog } from "@/lib/perk-preview";
import { getShanghaiDateKey } from "@/lib/date-key";
import PerksPageClient from "./client";

export const metadata: Metadata = {
  title: "插件图鉴",
  description: "逆战未来当前正式版插件图鉴，按槽位、稀有度和适用武器筛选插件。",
  alternates: { canonical: "/perks" },
};

export default function PerksPage() {
  const perks = getAllPerks();
  return (
    <PerksPageClient
      initialPerks={perks}
      previewLabel={getPerkPreviewCatalog()?.season.label}
      initialDateKey={getShanghaiDateKey()}
    />
  );
}
