import Image from "next/image";
import { getAssetPath } from "@/lib/path";
import {
  getElementStatusSummaries,
  getStatusEffectCatalog,
} from "@/lib/status-effects";
import type { StatusEffectTarget } from "@/types";
import { StatusEffectCatalogClient } from "./StatusEffectCatalogClient";

const ELEMENT_STYLES = {
  fire: "border-orange-700/70 bg-orange-950/20",
  cryo: "border-sky-700/70 bg-sky-950/20",
  shock: "border-violet-700/70 bg-violet-950/20",
  corossive: "border-lime-700/70 bg-lime-950/20",
} as const;

const ELEMENT_STATUS_LABELS = {
  fire: { status: "灼烧", element: "火焰" },
  cryo: { status: "冰缓", element: "寒冷" },
  shock: { status: "感电", element: "电弧" },
  corossive: { status: "溶解", element: "腐蚀" },
} as const;

const ELEMENT_STATUS_DESCRIPTIONS = {
  fire: "每 2 秒受到 10 × 当前层数的火焰伤害，并减少 1 层。",
  cryo: "每层移动速度降低 15%，最多叠加 3 层。",
  shock: "受到的伤害增加 5%。",
  corossive:
    "每 1 秒受到 5 × 当前层数的腐蚀伤害，最多叠加 10 层。",
} as const;

function formatSeconds(value: number) {
  return value < 0 ? "持续存在" : `${value} 秒`;
}

function getDurationRule(
  element: ReturnType<typeof getElementStatusSummaries>[number],
) {
  return element.id === "fire"
    ? `每 ${formatSeconds(element.enemyStatus.duration)}衰减 1 层`
    : `${formatSeconds(element.enemyStatus.duration)}未刷新消失`;
}

export function ElementStatusSummary() {
  const elements = getElementStatusSummaries();

  return (
    <div className="not-prose my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {elements.map((element) => (
        <article
          key={element.id}
          className={`min-w-0 rounded-lg border p-4 ${ELEMENT_STYLES[element.id]}`}
        >
            <div className="flex items-center gap-3">
              <Image
                src={getAssetPath(element.icon)}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="m-0 text-base font-semibold text-zinc-100">
                  {ELEMENT_STATUS_LABELS[element.id].status}
                </p>
                <p className="m-0 mt-1 text-xs text-zinc-400">
                  {ELEMENT_STATUS_LABELS[element.id].element}异常
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {ELEMENT_STATUS_DESCRIPTIONS[element.id]}
            </p>
            <dl className="mt-3 space-y-1.5 text-xs leading-5">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-zinc-500">叠层上限</dt>
                <dd className="m-0 text-right font-medium tabular-nums text-zinc-200">
                  {element.enemyStatus.stackLimit} 层
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-zinc-500">持续 / 衰减</dt>
                <dd className="m-0 text-right font-medium tabular-nums text-zinc-200">
                  {getDurationRule(element)}
                </dd>
              </div>
              {element.enemyStatus.period > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-zinc-500">伤害结算</dt>
                  <dd className="m-0 text-right font-medium tabular-nums text-zinc-200">
                    每 {formatSeconds(element.enemyStatus.period)}
                  </dd>
                </div>
              )}
            </dl>
            <details className="mt-3 text-xs leading-5">
              <summary className="flex min-h-11 w-fit cursor-pointer items-center text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4">
                查看敌方 / 玩家配置对应关系
              </summary>
              <dl className="space-y-2 pb-1">
                <div>
                  <dt className="inline text-zinc-500">敌方配置：</dt>{" "}
                  <dd className="inline break-words text-zinc-300">
                    {element.enemyBuffNames.join("、") || "未配置"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-zinc-500">玩家配置：</dt>{" "}
                  <dd className="inline break-words text-zinc-300">
                    {element.playerBuffNames.join("、") || "未配置"}
                  </dd>
                </div>
              </dl>
            </details>
        </article>
      ))}
    </div>
  );
}

export function StatusEffectCatalog({ target }: { target: StatusEffectTarget }) {
  const catalog = getStatusEffectCatalog(target);
  return <StatusEffectCatalogClient target={target} {...catalog} />;
}
