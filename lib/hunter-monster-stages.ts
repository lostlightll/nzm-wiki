import layout from "@/data/enemies/lc/monsters/map-layout.json";
import { LC_MAPS } from "@/lib/lc-maps";
import type { HunterMonster, MonsterAppearance } from "@/lib/hunter-monster-health";
import type { BossDifficulty } from "@/types";

export function groupMonstersByStage(monsters: HunterMonster[], difficulty: BossDifficulty, filters: { map?: string; area?: string; kind?: string; query?: string } = {}) {
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  return LC_MAPS.filter(map => !filters.map || map.name === filters.map).map(map => {
    const stages = layout.find(row => row.map === map.name && row.difficulty === difficulty);
    const sections = [...(stages?.areas ?? []), "区域待核实"].map((area, index) => ({
      area,
      number: area === "区域待核实" ? null : stages!.orders[index],
      entries: monsters.flatMap(monster => {
        if (filters.kind && monster.kind !== filters.kind) return [];
        const row = monster.appearances.find(row => row.map === map.name && row.area === area);
        if (!row || (filters.area && row.area !== filters.area)) return [];
        if (query && !`${map.name} ${area} ${monster.title} ${monster.description}`.toLocaleLowerCase().includes(query)) return [];
        return [{ monster, row }];
      }) as { monster: HunterMonster; row: MonsterAppearance }[],
    })).filter(section => !filters.area || section.area === filters.area).filter(section => section.entries.length || (!query && !filters.kind && section.number !== null));
    return { ...map, supported: !!stages, sections: stages ? sections : [] };
  }).filter(map => map.sections.length || (!map.supported && !query && !filters.kind && !filters.area));
}
