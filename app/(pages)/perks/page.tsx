import type { Metadata } from "next";
import { getAllPerks } from "@/lib/perks";
import { getPerkPreviewCatalog } from "@/lib/perk-preview";
import { getShanghaiDateKey } from "@/lib/date-key";
import PerksPageClient from "./client";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";
import contentVersion from "@/config/content-version.json";

export const metadata: Metadata = {
  title: "插件图鉴",
  description: "逆战未来当前正式版插件图鉴，按槽位、稀有度和适用武器筛选插件。",
  alternates: { canonical: "/perks" },
};

export default function PerksPage() {
  const perks = getAllPerks();
  const preview = getPerkPreviewCatalog();
  if (!perks.length) return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-5 text-3xl font-bold">插件图鉴</h1>
      <OverlimitVersionNavigation ariaLabel="插件版本" activePath="/perks" versions={[
        { href: "/perks", label: `${contentVersion.version.toUpperCase()}（待更新）` },
        ...(preview ? [{ href: "/perks/preview", label: preview.season.label }] : []),
      ]} />
      <p className="text-zinc-400">上一赛季插件已归档，正式版内容正在更新。{preview && "预览内容仍可通过上方入口查看。"}</p>
    </div>
  );
  return (
    <PerksPageClient
      initialPerks={perks}
      previewLabel={getPerkPreviewCatalog()?.season.label}
      initialDateKey={getShanghaiDateKey()}
    />
  );
}
