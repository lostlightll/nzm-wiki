import { TriangleAlert } from "lucide-react";

export function TalentDraftNotice() {
  return (
    <div role="note" aria-label="制作中提示" className="relative z-30 flex shrink-0 items-start gap-3 border-l-4 border-amber-400 bg-[#482d0e] px-4 py-3 text-amber-100">
      <TriangleAlert aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-amber-300" />
      <p className="min-w-0 text-sm leading-6">
        <strong className="mr-2 font-bold text-amber-300">目前制作中</strong>
        不保证准确性与可用性，天赋描述、数值及模拟加点仅供参考。
      </p>
    </div>
  );
}
