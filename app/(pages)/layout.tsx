"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Search, Command, Menu, X, Github } from "lucide-react";
import { BossDifficultyProvider, useBossDifficulty } from "@/components/BossDifficultyProvider";

const NAV_ITEMS = [
  { href: "/weapons", label: "武器图鉴" },
  { href: "/tower-defense", label: "塔防图鉴" },
  { href: "/bosses", label: "首领图鉴" },
  { href: "/perks", label: "插件图鉴" },
  { href: "/overlimit", label: "超限图鉴" },
  { href: "/credits", label: "致谢" },
];

const GITHUB_REPO = "https://github.com/lostlightll/nzm-wiki";

function getMobileBackLink(pathname: string) {
  if (pathname.startsWith("/perks/")) {
    return { href: "/perks", label: "返回插件图鉴" };
  }

  if (/^\/overlimit\/[^/]+\/?$/.test(pathname)) {
    return { href: "/overlimit", label: "返回超限图鉴" };
  }

  if (
    /^\/bosses\/[^/]+\/?$/.test(pathname) ||
    /^\/enemies\/lc\/[^/]+\/?$/.test(pathname)
  ) {
    return { href: "/bosses", label: "返回首领图鉴" };
  }

  if (pathname.startsWith("/traps/")) {
    return { href: "/tower-defense#traps", label: "返回塔防图鉴" };
  }

  if (pathname.startsWith("/enemies/td/")) {
    return { href: "/tower-defense#enemies", label: "返回塔防图鉴" };
  }

  return null;
}

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
  const [navIndicator, setNavIndicator] = useState({
    x: 0,
    width: 0,
    visible: false,
  });
  const pathname = usePathname();
  const { withDifficulty } = useBossDifficulty();
  const mobileBackLink = getMobileBackLink(pathname);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const navLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const isActive = (href: string) => {
    if (href === "/bosses") {
      return (
        pathname === "/bosses" ||
        pathname.startsWith("/bosses/") ||
        pathname === "/enemies/lc" ||
        pathname.startsWith("/enemies/lc/")
      );
    }

    if (href === "/tower-defense") {
      return (
        pathname === "/tower-defense" ||
        pathname.startsWith("/tower-defense/") ||
        pathname === "/traps" ||
        pathname.startsWith("/traps/") ||
        pathname === "/enemies/td" ||
        pathname.startsWith("/enemies/td/")
      );
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const activeHref = NAV_ITEMS.find(({ href }) => isActive(href))?.href;

  useLayoutEffect(() => {
    const nav = desktopNavRef.current;
    const activeLink = activeHref ? navLinkRefs.current[activeHref] : null;

    if (!nav || !activeLink) return;

    const updateIndicator = () => {
      const navRect = nav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();

      setNavIndicator({
        x: linkRect.left - navRect.left,
        width: linkRect.width,
        visible: true,
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(nav);
    resizeObserver.observe(activeLink);
    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeHref, pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-700 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* 左侧：Logo + 导航链接 */}
        <div className="flex items-center gap-6">
          {mobileBackLink && (
            <Link
              href={
                mobileBackLink.href === "/bosses"
                  ? withDifficulty(mobileBackLink.href)
                  : mobileBackLink.href
              }
              aria-label={mobileBackLink.label}
              title={mobileBackLink.label}
              className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:bg-zinc-700 md:hidden"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <Link
            href="/"
            className={`text-lg font-bold text-white hover:text-zinc-300 ${mobileBackLink ? "hidden md:block" : ""}`}
          >
            逆战未来 维基
          </Link>
          {/* 桌面端导航链接 */}
          <div ref={desktopNavRef} className="relative hidden gap-1 md:flex">
            {activeHref && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 rounded-lg bg-zinc-800 transition-[transform,width,opacity] duration-200 ease-out motion-reduce:transition-none"
                style={{
                  width: navIndicator.width,
                  opacity: navIndicator.visible ? 1 : 0,
                  transform: `translateX(${navIndicator.x}px)`,
                }}
              />
            )}
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href === "/bosses" ? withDifficulty(href) : href}
                ref={(element) => {
                  navLinkRefs.current[href] = element;
                }}
                aria-current={isActive(href) ? "page" : undefined}
                className={`relative z-10 flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${
                  isActive(href)
                    ? "text-white"
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
                href={href === "/bosses" ? withDifficulty(href) : href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${
                  isActive(href)
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
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
    <BossDifficultyProvider>
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </div>
    </BossDifficultyProvider>
  );
}
