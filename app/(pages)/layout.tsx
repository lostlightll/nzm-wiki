"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Command, Menu, X, Github } from "lucide-react";

const NAV_ITEMS = [
  { href: "/weapons", label: "武器图鉴" },
  { href: "/traps", label: "塔防陷阱" },
  { href: "/enemies/td", label: "塔防敌人" },
  { href: "/perks", label: "插件图鉴" },
];

const GITHUB_REPO = "https://github.com/lostlightll/nzm-wiki";

// 触发全局快捷键
function triggerShortcut(key: string, ctrlKey = true, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey,
    shiftKey,
    metaKey: false,
    bubbles: true,
  });
  document.dispatchEvent(event);
}

function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-700 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* 左侧：Logo + 导航链接 */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-bold text-white hover:text-zinc-300"
          >
            逆战未来 维基
          </Link>
          {/* 桌面端导航链接 */}
          <div className="hidden md:flex gap-4">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-1">
          {/* 搜索按钮 */}
          <button
            onClick={() => triggerShortcut("p", true, false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title="搜索 (Ctrl+P)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline text-sm">搜索</span>
            <kbd className="hidden lg:inline rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
              Ctrl+P
            </kbd>
          </button>

          {/* 命令面板按钮 */}
          <button
            onClick={() => triggerShortcut("p", true, true)}
            className="flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title="命令面板 (Ctrl+Shift+P)"
          >
            <Command className="h-4 w-4" />
          </button>

          {/* GitHub 链接 */}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>

          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title="菜单"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-background/95 backdrop-blur">
          <div className="px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
