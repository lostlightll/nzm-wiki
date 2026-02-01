"use client";

import { ReactNode } from "react";

interface ProseTableProps {
  children: ReactNode;
}

export function ProseTable({ children }: ProseTableProps) {
  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-zinc-700">
      <table className="w-full text-sm [&_thead]:bg-zinc-800/80 [&_thead_th]:px-4 [&_thead_th]:py-3 [&_thead_th]:text-center [&_thead_th]:font-medium [&_thead_th]:text-foreground [&_tbody_tr]:border-t [&_tbody_tr]:border-zinc-700/50 [&_tbody_tr]:bg-zinc-800/30 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-zinc-700/30 [&_tbody_td]:px-4 [&_tbody_td]:py-2.5 [&_tbody_td]:text-center [&_tbody_td]:text-foreground">
        {children}
      </table>
    </div>
  );
}
