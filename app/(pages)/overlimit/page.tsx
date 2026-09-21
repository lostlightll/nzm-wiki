import type { Metadata } from "next";
import { getOverlimitCatalog, getOverlimitVersions } from "@/lib/overlimit";
import OverlimitPageClient from "./client";
import { OverlimitVersionNavigation } from "@/components/OverlimitVersionNavigation";

const catalog = getOverlimitCatalog();
const sections = ["超限卡片", catalog.bonds && "羁绊效果", catalog.levels && "等级概率与重抽费用", catalog.mapRotation && "地图轮换"].filter(Boolean);

export const metadata: Metadata = {
  title: "超限图鉴",
  description:
    catalog.withdrawn ? "上一赛季超限已归档，正式版内容正在更新。" : `逆战未来 ${catalog.season.label} 超限图鉴，收录${sections.join("、")}。`,
  alternates: { canonical: "/overlimit" },
};

export default function OverlimitPage() {
  if (catalog.withdrawn) return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-5 text-3xl font-bold">超限图鉴</h1>
      <OverlimitVersionNavigation versions={getOverlimitVersions()} activePath="/overlimit" />
      <p className="text-zinc-400">上一赛季超限已归档，正式版内容正在更新。预览内容仍可通过上方入口查看。</p>
    </div>
  );
  return (
    <OverlimitPageClient
      season={catalog.season}
      versions={getOverlimitVersions()}
      initialCards={catalog.cards}
      bondCatalog={catalog.bonds}
      levelCatalog={catalog.levels}
      mapRotation={catalog.mapRotation}
    />
  );
}
