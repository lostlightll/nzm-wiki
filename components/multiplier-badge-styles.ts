import type { MultiplierFactorId } from "@/lib/multiplier-data";

const FACTOR_STYLES = {
  base: "border-zinc-500/60 bg-zinc-500/10 text-zinc-200",
  "weakpoint-multiplier": "border-rose-400/50 bg-rose-400/10 text-rose-200",
  "game-mode": "border-sky-400/50 bg-sky-400/10 text-sky-200",
  "independent-amplification": "border-lime-400/50 bg-lime-400/10 text-lime-200",
  dilution: "border-amber-400/50 bg-amber-400/10 text-amber-200",
  element: "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",
  "element-vulnerability": "border-blue-400/50 bg-blue-400/10 text-blue-200",
  weakness: "border-red-400/50 bg-red-400/10 text-red-200",
  critical: "border-orange-400/50 bg-orange-400/10 text-orange-200",
  correction: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
  vulnerability: "border-teal-400/50 bg-teal-400/10 text-teal-200",
} satisfies Record<MultiplierFactorId, string>;

export function getMultiplierFactorStyle(factorId: string): string {
  return FACTOR_STYLES[factorId as MultiplierFactorId] ?? FACTOR_STYLES.base;
}
