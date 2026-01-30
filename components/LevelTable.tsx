"use client";

interface LevelTableProps {
  headers: string[];
  data: (string | number)[][];
}

// 格式化单元格内容，处理类似 "250x2=500" 的格式
function formatCell(value: string | number) {
  if (typeof value === "number") return value;

  // 匹配 "数字x数字=结果" 格式，替换 x 为 ×
  const match = value.match(/^(\d+)\s*[xX×]\s*(\d+)\s*=\s*(\d+)$/);
  if (match) {
    const [, base, multiplier, result] = match;
    return `${base} × ${multiplier} = ${result}`;
  }

  return value;
}

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-zinc-400",
  2: "bg-[#4b6b2f]",
  3: "bg-[#b19f37]",
  4: "bg-[#5b2c82]",
};

export function LevelTable({ headers, data }: LevelTableProps) {
  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-zinc-700">
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-3" />
          {headers.map((_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-zinc-800/80">
            <th className="p-0" />
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-3 text-center font-medium text-zinc-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const level = Number(row[0]);
            const colorClass = LEVEL_COLORS[level] || "bg-zinc-400";
            return (
              <tr
                key={rowIndex}
                className="border-t border-zinc-700/50 bg-zinc-800/30 transition-colors hover:bg-zinc-700/30"
              >
                {/* 装饰竖条 */}
                <td className="relative p-0">
                  <div className="absolute left-1 top-1 bottom-1 flex gap-[2px]">
                    <div className={`w-[3px] ${colorClass}`} />
                    <div className={`w-[1px] ${colorClass} opacity-60`} />
                  </div>
                </td>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-2.5 text-center text-zinc-300 ${cellIndex === 0 ? "font-medium" : ""}`}
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
