// ============================================================
// 逆战未来 Wiki - 数据类型定义
// ============================================================
// 这个文件定义了所有数据的"形状"，类似于 C++ 的 struct/class 定义
// TypeScript 的 interface 就像 C++ 的 struct，但只定义结构不实现方法

// ------------------------------------------------------------
// 武器相关类型
// ------------------------------------------------------------

/**
 * 武器类型枚举
 * 类似 C++ 的 enum class WeaponType { ... }
 */

// prettier-ignore
export type WeaponType =
  | "突击步枪"    // Assault Rifle (ar)
  | "狙击步枪"    // Sniper Rifle (sr)
  | "霰弹枪"      // Shotgun (shg)
  | "火箭发射器"  // Rocket Launcher (rocket)
  | "冲锋枪"      // SMG (smg)
  | "机枪"        // LMG (lmg)
  | "手枪"        // Pistol (pistol)
  | "单发榴弹"    // Single Grenade Launcher (grenade-single)
  | "弓箭"        // Bow (bow)
  | "喷火器"      // Flamethrower (flamethrower)
  | "射手步枪"    // Marksman Rifle (dmr)
  | "连发榴弹" // Auto Grenade Launcher (grenade-auto)

/**
 * 元素类型
 */
export type ElementType = "物理" | "火焰" | "寒冷" | "电弧" | "腐蚀";

/**
 * 武器标签（特性）
 */
export type WeaponTag = "高倍镜" | "穿透" | "破甲" | "爆炸" | "连发" | "三连发";

/**
 * 武器稀有度
 */
export type Rarity = "普通" | "稀有" | "史诗" | "传说";

/**
 * 武器属性接口
 * interface 定义了对象必须有哪些字段，类似 C++ struct
 *
 * 例如 C++ 中你会写:
 * struct WeaponStats {
 *   int damage;
 *   int fireRate;
 *   ...
 * };
 */

// prettier-ignore
export interface WeaponStats {
  damage: number           // 单发伤害
  fireRate: number         // 射速 (发/分钟)
  magazine: number         // 弹夹容量
  totalAmmo: number        // 总弹量
  accuracy: number         // 精准度 (0-100)
  stability: number        // 稳定度 (0-100)
  weaknessMultiplier: number  // 弱点倍率
  toughnessBase: number    // 破韧伤害
}

/**
 * 武器技能接口
 */

// prettier-ignore
export interface WeaponSkill {
  id: string
  name: string
  description: string
  icon?: string        // ? 表示可选字段，类似 C++ 的 std::optional
  isActive: boolean    // true = 主动技能, false = 被动技能
}

/**
 * 瞄准镜类型
 */
export type ScopeType = "低倍镜" | "中倍镜" | "高倍镜";

/**
 * 完整武器数据接口
 */

// prettier-ignore
export interface Weapon {
  id: string                    // 唯一标识符，如 "death-hunter"
  name: string                  // 显示名称，如 "死神猎手"
  type: WeaponType              // 武器类型
  elementType: ElementType      // 元素类型
  tags: WeaponTag[]             // 标签数组，[] 表示数组类型
  rarity: Rarity                // 稀有度
  scope?: ScopeType             // 瞄准镜类型（可选）
  unlockTime?: string           // 解锁时间（可选）
  stats: WeaponStats            // 嵌套的属性对象
  skillCooldown: number         // 技能冷却时间（秒）
  skills: WeaponSkill[]         // 技能数组
  image?: string                // 武器图片路径
  description?: string          // 武器描述
}

// ------------------------------------------------------------
// 插件 (Perk) 相关类型
// ------------------------------------------------------------

/**
 * 插件安装位置
 * 游戏中有4个不同的插件槽位
 */
export type PerkSlot = 1 | 2 | 3 | 4;

/**
 * 插件类型/分类
 */

// prettier-ignore
export type PerkCategory =
  | "装填类"    // 影响装填相关
  | "伤害类"    // 影响伤害输出
  | "生存类"    // 影响生存能力
  | "辅助类" // 其他辅助效果

/**
 * 插件效果接口
 * 一个插件在不同槽位可能有不同效果
 */

// prettier-ignore
export interface PerkEffect {
  slot: PerkSlot          // 在哪个槽位
  description: string     // 效果描述
  values?: {              // 具体数值（用于计算器）
    [key: string]: number // 键值对，类似 C++ 的 std::map<string, double>
  }
}

/**
 * 完整插件数据接口
 */
export interface Perk {
  id: string;
  name: string; // 如 "幸运装填"
  slot: PerkSlot; // 插件所属槽位
  rarity: Rarity; // 插件稀有度
  category: PerkCategory;
  icon?: string;
  effects: PerkEffect[]; // 在不同槽位的效果
  description?: string; // 通用描述
}

// ------------------------------------------------------------
// 伤害计算器相关类型
// ------------------------------------------------------------

/**
 * 伤害计算配置
 */
export interface DamageCalculation {
  weapon: Weapon;
  equippedPerks: {
    slot1?: Perk;
    slot2?: Perk;
    slot3?: Perk;
    slot4?: Perk;
  };
  targetType: "普通" | "精英" | "Boss";
  distance: number; // 距离（米）
  isHeadshot: boolean; // 是否爆头
  isBackstab: boolean; // 是否背击
}

/**
 * 伤害计算结果
 */

// prettier-ignore
export interface DamageResult {
  baseDamage: number            // 基础伤害
  finalDamage: number           // 最终伤害
  dps: number                   // 每秒伤害
  ttk: number                   // Time to Kill (秒)
  modifiers: {                  // 各种加成明细
    name: string
    value: number
    type: "add" | "multiply"    // 加算还是乘算
  }[]
}
