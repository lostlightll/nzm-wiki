"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// 帮助信息
const HELP_TEXT = [
  "支持: + - * / ^ () 和变量",
  "示例: 2+3, x=10, x*2, _+1, x=1",
  "_ 表示上次结果",
  "",
  "命令: ",
  "- 清屏: clear/cl",
  "- 显示帮助: help",
  "- 退出: exit/q",
];

// 简单的表达式解析器，支持四则运算、幂运算、变量和 _ 表示上一次结果
function evaluate(
  expr: string,
  variables: Record<string, number>,
): { value: number; error?: string } {
  try {
    // 替换变量
    let processed = expr.trim();

    // 替换所有变量（包括 _）
    for (const [name, val] of Object.entries(variables)) {
      // 使用单词边界来精确匹配变量名
      const regex = new RegExp(
        `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "g",
      );
      processed = processed.replace(regex, `(${val})`);
    }

    // 支持 ^ 作为幂运算
    processed = processed.replace(/\^/g, "**");

    // 安全检查：只允许数字、运算符、括号、空格
    if (!/^[\d+\-*/().%\s*]+$/.test(processed)) {
      return { value: NaN, error: "无效表达式" };
    }

    // 使用 Function 构造器计算（比 eval 稍微安全一点）
    const result = new Function(`return (${processed})`)();

    if (typeof result !== "number" || !isFinite(result)) {
      return { value: NaN, error: "计算错误" };
    }

    return { value: result };
  } catch {
    return { value: NaN, error: "语法错误" };
  }
}

// 解析赋值语句 x = 123 或 x = 1 + 2
function parseAssignment(
  input: string,
): { varName: string; expr: string } | null {
  const match = input.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
  if (match) {
    return { varName: match[1], expr: match[2] };
  }
  return null;
}

interface HistoryItem {
  input: string;
  output: string | string[];
  isError: boolean;
  isSystem?: boolean;
}

export function Calculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({ _: 0 });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setVariables({ _: 0 });
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    // 处理命令
    if (trimmed === "clear" || trimmed === "cl") {
      clearHistory();
      setInput("");
      return;
    }

    if (trimmed === "help") {
      setHistory((prev) => [
        ...prev,
        { input: "help", output: HELP_TEXT, isError: false, isSystem: true },
      ]);
      setInput("");
      setHistoryIndex(-1);
      return;
    }

    if (trimmed === "exit" || trimmed === "quit" || trimmed === "q") {
      setIsOpen(false);
      setInput("");
      return;
    }

    // 恢复原始大小写进行计算
    const originalInput = input.trim();
    let output: string;
    let isError = false;

    // 检查是否是赋值语句
    const assignment = parseAssignment(originalInput);

    if (assignment) {
      const { varName, expr } = assignment;
      const result = evaluate(expr, variables);

      if (result.error) {
        output = result.error;
        isError = true;
      } else {
        output = String(result.value);
        setVariables((prev) => ({
          ...prev,
          [varName]: result.value,
          _: result.value,
        }));
      }
    } else {
      const result = evaluate(originalInput, variables);

      if (result.error) {
        output = result.error;
        isError = true;
      } else {
        output = String(result.value);
        setVariables((prev) => ({ ...prev, _: result.value }));
      }
    }

    setHistory((prev) => [...prev, { input: originalInput, output, isError }]);
    setInput("");
    setHistoryIndex(-1);
  }, [input, variables, clearHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const inputHistory = history.filter((h) => !h.isSystem);
      if (inputHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? inputHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex].input);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const inputHistory = history.filter((h) => !h.isSystem);
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= inputHistory.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(inputHistory[newIndex].input);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // 获取当前定义的变量（排除 _）
  const userVars = Object.entries(variables).filter(([k]) => k !== "_");

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {/* 折叠按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg ring-1 ring-zinc-700 transition-all hover:bg-zinc-700 hover:text-white"
          title="计算器"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </button>
      )}

      {/* 展开的计算器 */}
      {isOpen && (
        <div className="flex w-80 flex-col overflow-hidden rounded-lg bg-zinc-900 shadow-2xl ring-1 ring-zinc-700">
          {/* 标题栏 */}
          <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-2">
            <span className="text-sm font-medium text-zinc-300">计算器</span>
            <div className="flex gap-1">
              <button
                onClick={clearHistory}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                title="清空"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                title="关闭"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 变量显示区 */}
          {userVars.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-850 px-2 py-1.5">
              {userVars.map(([name, val]) => (
                <span
                  key={name}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400"
                >
                  {name}={val}
                </span>
              ))}
            </div>
          )}

          {/* 历史记录 */}
          <div
            ref={historyRef}
            className="max-h-60 min-h-[120px] overflow-y-auto bg-zinc-950 p-2 font-mono text-sm"
          >
            {history.length === 0 ? (
              <div className="text-xs text-zinc-600">
                <p>支持: + - * / ^ () 和变量</p>
                <p>输入 <span className="text-zinc-400">help</span> 查看详细帮助</p>
                <p>示例: 2+3, x=10, x*2, _+1, x=1</p>
                <p className="text-zinc-700">_ 表示上次结果</p>
              </div>
            ) : (
              history.map((item, i) => (
                <div key={i} className="mb-1">
                  <div className="text-zinc-400">
                    <span className="text-zinc-600">&gt; </span>
                    {item.input}
                  </div>
                  {Array.isArray(item.output) ? (
                    <div className="text-zinc-500">
                      {item.output.map((line, j) => (
                        <div key={j}>{line || "\u00A0"}</div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={
                        item.isError ? "text-red-400" : "text-amber-200"
                      }
                    >
                      {item.output}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 输入框 */}
          <div className="border-t border-zinc-800 bg-zinc-900 p-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                placeholder="输入表达式或命令..."
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
