"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calculator as CalculatorIcon, Eraser, X } from "lucide-react";

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

interface CalculatorProps {
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Calculator({
  externalOpen,
  onOpenChange,
}: CalculatorProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({ _: 0 });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [position, setPosition] = useState({ right: 16, bottom: 16 });
  const [size, setSize] = useState({ width: 320, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, right: 0, bottom: 0 });
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, width: 0, height: 0 });
  const hasDraggedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // 支持外部控制和内部控制
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = useCallback(
    (open: boolean) => {
      if (onOpenChange) {
        onOpenChange(open);
      }
      setInternalOpen(open);
    },
    [onOpenChange],
  );

  // 自动滚动到底部
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [history]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 延迟聚焦，等待动画完成
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 拖拽开始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      hasDraggedRef.current = false;
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        right: position.right,
        bottom: position.bottom,
      };
      setIsDragging(true);
    },
    [position],
  );

  // 拖拽移动和结束
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartRef.current.mouseX - e.clientX;
      const deltaY = dragStartRef.current.mouseY - e.clientY;

      // 如果移动超过 5px，标记为拖拽
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newRight = Math.max(
        0,
        Math.min(window.innerWidth - 60, dragStartRef.current.right + deltaX),
      );
      const newBottom = Math.max(
        0,
        Math.min(window.innerHeight - 60, dragStartRef.current.bottom + deltaY),
      );

      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 处理点击打开（区分拖拽和点击）
  const handleButtonClick = useCallback(() => {
    if (!hasDraggedRef.current) {
      setIsOpen(true);
    }
  }, [setIsOpen]);

  // 调整大小开始
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: size.width,
        height: size.height,
      };
      setIsResizing(true);
    },
    [size],
  );

  // 调整大小移动和结束
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = resizeStartRef.current.mouseX - e.clientX;
      const deltaY = resizeStartRef.current.mouseY - e.clientY;

      const newWidth = Math.max(
        280,
        Math.min(600, resizeStartRef.current.width + deltaX),
      );
      const newHeight = Math.max(
        200,
        Math.min(500, resizeStartRef.current.height + deltaY),
      );

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

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
  }, [input, variables, clearHistory, setIsOpen]);

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

  // 计算窗口的安全位置，确保在可视范围内
  const getWindowStyle = useCallback(() => {
    if (typeof window === "undefined") {
      return { right: position.right, bottom: position.bottom };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 计算窗口右下角的位置
    let right = position.right;
    let bottom = position.bottom;

    // 确保窗口不会超出左边界
    if (right > viewportWidth - size.width) {
      right = viewportWidth - size.width - 16;
    }

    // 确保窗口不会超出上边界
    if (bottom > viewportHeight - size.height) {
      bottom = viewportHeight - size.height - 16;
    }

    // 确保不小于 0
    right = Math.max(16, right);
    bottom = Math.max(16, bottom);

    return { right, bottom };
  }, [position, size]);

  return (
    <>
      {/* 折叠按钮 - 可拖拽 */}
      <div
        className={`fixed z-50 ${isDragging ? "select-none" : ""}`}
        style={{ right: position.right, bottom: position.bottom }}
      >
        <div
          className={`transition-all duration-300 ease-out ${
            isOpen
              ? "pointer-events-none scale-50 opacity-0"
              : "scale-100 opacity-100"
          }`}
        >
          <div
            onMouseDown={handleMouseDown}
            onClick={handleButtonClick}
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg ring-1 ring-zinc-700 transition-all hover:bg-zinc-700 hover:text-white hover:scale-110 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            title="计算器 (Ctrl+Shift+P)"
          >
            <CalculatorIcon className="h-6 w-6 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 展开的计算器 - 独立定位 */}
      <div
        className={`fixed z-50 flex flex-col overflow-hidden rounded-lg bg-zinc-900 shadow-2xl ring-1 ring-zinc-700 ${
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-75 opacity-0"
        } ${isDragging || isResizing ? "select-none" : ""} ${!isDragging && !isResizing ? "transition-all duration-300 ease-out" : ""}`}
        style={{ width: size.width, height: size.height, ...getWindowStyle() }}
      >
        {/* 左上角调整大小手柄 - 四分之一圆弧 */}
        <div
          className="absolute left-1 top-1 w-4 h-4 cursor-nwse-resize z-10 group"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-zinc-600 rounded-tl-md opacity-40 group-hover:opacity-80 transition-opacity" />
        </div>

        {/* 标题栏 - 可拖拽 */}
        <div
          className={`flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-2 ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
        >
          <span className="text-sm font-medium text-zinc-300 select-none">
            计算器
          </span>
          <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={clearHistory}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title="清空"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              title="关闭 (Esc)"
            >
              <X className="h-4 w-4" />
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
          className="flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-sm"
        >
          {history.length === 0 ? (
            <div className="text-xs text-zinc-600">
              <p>
                输入: <span className="text-zinc-400">help</span> 查看详细帮助
              </p>
              <p>支持: + - * / ^ () 和变量</p>
              <p>注意: _ 为默认变量，表示上次计算结果</p>
              <p>示例: 2+3, x=10, x*2, _+1, x=1</p>
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
                    className={item.isError ? "text-red-400" : "text-amber-200"}
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
    </>
  );
}
