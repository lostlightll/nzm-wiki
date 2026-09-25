import type { Metadata } from "next";
import catalog from "@/data/origin/runes.json";
import type { OriginRuneCatalog } from "@/lib/origin-runes";
import OriginRunesClient from "./client";

const runes = catalog as OriginRuneCatalog;

export const metadata: Metadata = {
  title: "原点图鉴",
  description: `逆战未来原点猎场强化图鉴，收录 ${runes.runes.length} 项强化，可按名称、品质与标签检索。`,
  alternates: { canonical: "/origin" },
};

export default function OriginPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">原点图鉴</h1>
      </header>
      <nav aria-label="原点图鉴模块" className="mb-6 flex flex-wrap items-center gap-2">
        {["原点天赋", "武器图鉴", "词条图鉴"].map((label) => (
          <button key={label} type="button" disabled title="暂未开放"
            className="min-h-11 cursor-not-allowed rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-base font-semibold text-zinc-500">
            {label}
          </button>
        ))}
        <a href="#runes" aria-current="page"
          className="flex min-h-11 touch-manipulation items-center rounded border border-zinc-400 bg-zinc-600 px-4 py-2 text-base font-semibold text-white outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
          强化图鉴
        </a>
      </nav>
      <OriginRunesClient catalog={runes} />
    </main>
  );
}
