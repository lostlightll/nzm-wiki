"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Command, Menu, X, Github } from "lucide-react";

const NAV_ITEMS = [
  { href: "/weapons", label: "武器图鉴" },
  { href: "/traps", label: "塔防陷阱" },
  { href: "/enemies/td", label: "塔防敌人" },
  { href: "/perks", label: "插件图鉴" },
  { href: "/credits", label: "致谢" },
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
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
          <div className="hidden gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${
                  isActive(href)
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                }`}
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
            type="button"
            onClick={() => triggerShortcut("p", true, false)}
            aria-label="搜索本站"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
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
            type="button"
            onClick={() => triggerShortcut("p", true, true)}
            aria-label="打开命令面板"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="命令面板 (Ctrl+Shift+P)"
          >
            <Command className="h-4 w-4" />
          </button>

          {/* GitHub 链接 */}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="打开 GitHub 仓库"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>

          {/* 移动端菜单按钮 */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "关闭导航菜单" : "打开导航菜单"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors md:hidden"
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
        <div ref={mobileMenuRef} id="mobile-navigation" className="border-t border-zinc-800 bg-background/95 backdrop-blur md:hidden">
          <div className="px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${isActive(href) ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
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
    <div className="min-h-dvh bg-background">
      <a href="#main-content" className="skip-link">跳到主要内容</a>
      <NavBar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-20 pt-8 xl:pb-8">{children}</main>
    </div>
  );
}
