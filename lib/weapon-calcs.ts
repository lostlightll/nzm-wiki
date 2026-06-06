import type { DamageMode, WeaponChangeClip } from "@/types";

/** 射速 RPM = 60 / 射击间隔 */
export function calcRPM(mode: DamageMode): number {
  return mode.fireIntervalBase > 0 ? 60 / mode.fireIntervalBase : 0;
}

/** 换弹动画耗时 = timeBase（WeaponChangeClipTimeBase） */
export function calcReloadTime(changeClip?: WeaponChangeClip): number | undefined {
  if (!changeClip) return undefined;
  return changeClip.timeBase;
}

/** 换弹后摇 = reloadRecovery（EarlyExitFromReloadAnim_C LinkValue） */
export function calcReloadRecovery(changeClip?: WeaponChangeClip): number | undefined {
  if (!changeClip) return undefined;
  return changeClip.reloadRecovery;
}

/** 完整换弹 = timeBase + reloadRecovery */
export function calcFullReload(changeClip?: WeaponChangeClip): number | undefined {
  if (!changeClip) return undefined;
  return changeClip.timeBase + changeClip.reloadRecovery;
}

/** 单发面板伤害 = base * 500（游戏内显示规则），四舍五入取整。霰弹 x 弹丸数由 UI 层处理 */
export function calcDisplayDamage(mode: DamageMode): number {
  return Math.round(mode.damage.base * 500);
}

/** 理论 DPS = 单发面板伤害 / 射击间隔 */
export function calcDPS(mode: DamageMode): number {
  if (mode.fireIntervalBase <= 0) return 0;
  return (mode.damage.base * 500) / mode.fireIntervalBase;
}

/** 充能速率 %/秒 = 100 / skillCooldown，保留 2 位小数 */
export function calcChargeRate(skillCooldown?: number): number | undefined {
  if (!skillCooldown || skillCooldown <= 0) return undefined;
  return Math.round((100 / skillCooldown) * 100) / 100;
}
