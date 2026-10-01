export interface ShootingRangeTarget {
  id: string;
  title: string;
  kind: string;
  image: string | null;
  health: number;
  shield: number;
}

export const SHOOTING_RANGE_TARGETS: readonly ShootingRangeTarget[] = [
  { id: "mutant-zombie-man", title: "变异丧尸男", kind: "小怪", image: "/icons/enemies/lc/shooting-range/14512031.png", health: 875, shield: 0 },
  { id: "charge-engineer", title: "冲锋工程师", kind: "精英怪", image: "/icons/enemies/lc/shooting-range/14511041.png", health: 12_660, shield: 50_640 },
  { id: "yizhishu", title: "衣之枢", kind: "Boss", image: "/icons/enemies/lc/boss/衣之枢.png", health: 1_215_360, shield: 0 },
];
