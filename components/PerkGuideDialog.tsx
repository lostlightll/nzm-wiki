"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { recordPerkGuideVisit, setPerkGuideDismissed, type PerkGuideVersion } from "@/lib/perk-guide";

export function PerkGuideDialog({ currentLabel, previewLabel, version }: {
  currentLabel: string;
  previewLabel: string;
  version: PerkGuideVersion;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    // Defer until mount settles so Strict Mode's effect replay does not consume a visit.
    const timer = window.setTimeout(() => {
      if (!element?.isConnected) return;
      try {
        if (recordPerkGuideVisit(window.localStorage, version)) element.showModal();
      } catch {
        // Optional onboarding must not interrupt browsing when storage is blocked.
      }
    }, 0);
    return () => { window.clearTimeout(timer); element?.close(); };
  }, [version]);

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-300 shadow-2xl backdrop:bg-black/65">
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold text-white">插件图鉴更新了</h2>
          <button type="button" aria-label="关闭使用提示" onClick={() => dialog.current?.close()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-700 focus-visible:text-white focus-visible:outline-none">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <ol className="space-y-4 text-sm leading-7">
          <li><strong className="text-white">1. 版本选择</strong><br />顶部按钮可切换 {currentLabel} 和 {previewLabel}，两版插件内容独立。</li>
          <li><strong className="text-white">2. Preview默认优先查看新插件</strong><br />也可以选择“改动插件”或“老插件”。上下线默认不限制。</li>
          <li><strong className="text-white">3. 支持组合筛选</strong><br />左侧选“已上线 / 已下线”，右侧选插件分类。再次点击已选项可取消；一组都不选，就不限制这一条件。</li>
        </ol>
        <p className="mt-4 text-xs leading-6 text-zinc-400">预览中的上下线状态以预览配置为准，不代表当前正式服状态。</p>
        <form method="dialog" className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-zinc-300" onChange={event => {
              try { setPerkGuideDismissed(window.localStorage, version, event.target.checked); } catch { /* Storage is optional. */ }
            }} />
            不再提醒
          </label>
          <button className="min-h-11 rounded-lg border border-zinc-500 bg-zinc-700 px-6 text-sm font-medium text-white hover:bg-zinc-600 focus-visible:underline focus-visible:outline-none">知道了</button>
        </form>
      </div>
    </dialog>
  );
}
