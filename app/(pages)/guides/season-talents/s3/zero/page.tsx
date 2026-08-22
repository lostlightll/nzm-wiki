import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ZeroTalentTree } from "@/components/season-talents/s3/ZeroTalentTree";

export const metadata: Metadata = {
  title: "零点天赋树（S3）",
  description: "逆战未来 S3 赛季天赋零点的专属与通用节点、等级和效果详情。",
  alternates: { canonical: "/guides/season-talents/s3/zero" },
};

export default function ZeroTalentPage() {
  return (
    <>
      <nav aria-label="面包屑" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400">
        <Link
          href="/season-talents"
          className="min-h-11 touch-manipulation content-center transition-colors hover:text-white focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 md:min-h-0"
        >
          赛季天赋
        </Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-zinc-600" />
        <span>赛季天赋</span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-zinc-600" />
        <span className="text-zinc-200">S3 · 零点</span>
      </nav>
      <ZeroTalentTree />
    </>
  );
}
