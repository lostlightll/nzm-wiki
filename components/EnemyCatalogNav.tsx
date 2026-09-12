"use client";

import Link from "next/link";
import { useBossDifficulty } from "@/components/BossDifficultyProvider";

export function EnemyCatalogNav({ active }: { active: "bosses" | "monsters" }) {
  const { withDifficulty } = useBossDifficulty();
  return (
    <nav aria-label="敌人图鉴模块" className="mb-6 flex gap-2">
      {[
        { id: "bosses", title: "Boss 首领", href: "/bosses" },
      ].map(item => (
        <Link key={item.id} href={withDifficulty(item.href)} aria-current={active === item.id ? "page" : undefined}
          className={`min-h-11 rounded border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 ${active === item.id ? "border-zinc-400 bg-zinc-700 text-white" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
