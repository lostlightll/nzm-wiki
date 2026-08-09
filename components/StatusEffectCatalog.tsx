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

function formatSeconds(value: number) {
  return value < 0 ? "持续存在" : `${value} 秒`;
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
                {ELEMENT_STATUS_LABELS[element.id].element}异常 · 配置持续 {formatSeconds(element.duration)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            {element.description || "导出配置未提供公开描述。"}
          </p>
          <p className="m-0 mt-2 text-xs text-zinc-500">
            清除时间配置：{formatSeconds(element.clearTime)}
          </p>
          <details className="mt-3 border-t border-white/10 pt-1 text-xs leading-5">
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
