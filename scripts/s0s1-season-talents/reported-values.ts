import { z } from "zod";
import raw from "../../data/season-talents/reported-values.json";
import type { LegacyTalentLevel, LegacyTalentSeason } from "../../lib/s0s1-season-talents";

export const REPORTED_VALUES = z.object({ source: z.string(), entries: z.array(z.object({
  season: z.enum(["s0", "s1"]), nodeId: z.string(), levels: z.array(z.number().int().positive()),
  from: z.string(), to: z.string(), note: z.string(),
})) }).parse(raw);

export function applyReportedValues(season: LegacyTalentSeason, nodeId: string, level: LegacyTalentLevel, onFill?: (start: number, count: number) => void) {
  for (const entry of REPORTED_VALUES.entries.filter(entry => entry.season === season && entry.nodeId === nodeId && entry.levels.includes(level.level))) {
    const template = level.descriptionTemplate ?? "";
    if (!entry.from.includes("〔数值待核实〕") || template.split(entry.from).length !== 2) throw new Error(`REPORTED_VALUE_DRIFT: ${nodeId}/${level.level}`);
    const start = [...template.slice(0, template.indexOf(entry.from)).matchAll(/〔数值待核实〕/g)].length;
    const count = [...entry.from.matchAll(/〔数值待核实〕/g)].length;
    onFill?.(start, count);
    level.descriptionTemplate = template.replace(entry.from, entry.to);
    level.reportedReview ??= { source: REPORTED_VALUES.source, notes: [], count: 0 };
    level.reportedReview.notes.push(entry.note);
    level.reportedReview.count += [...entry.from.matchAll(/〔数值待核实〕/g)].length;
  }
}
