import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  GalleryVerticalEnd,
  GitBranch,
  Search,
  Skull,
  Sword,
  Target,
  Terminal,
  Zap,
} from "lucide-react";
import { getAssetPath } from "@/lib/path";

const GITHUB_FORK = "https://github.com/lostlightll/nzm-wiki";

interface NavCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  wide?: boolean;
}

const NAV_ITEMS = [
  { href: "/weapons", icon: <Sword className="h-8 w-8 sm:h-10 sm:w-10" />, title: "武器图鉴" },
  { href: "/perks", icon: <Zap className="h-8 w-8 sm:h-10 sm:w-10" />, title: "插件图鉴" },
  { href: "/tower-defense", icon: <Target className="h-8 w-8 sm:h-10 sm:w-10" />, title: "塔防图鉴" },
  { href: "/bosses", icon: <Skull className="h-8 w-8 sm:h-10 sm:w-10" />, title: "首领图鉴" },
  {
    href: "/overlimit",
    icon: <GalleryVerticalEnd className="h-8 w-8 sm:h-10 sm:w-10" />,
    title: "超限图鉴",
    wide: true,
  },
];

function NavCard({ href, icon, title, wide = false }: NavCardProps) {
  return (
    <Link
      href={href}
      className={`home-nav-card group flex flex-col items-center justify-center rounded-xl border border-zinc-600/90 bg-zinc-800/50 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:scale-[1.02] hover:border-zinc-400/80 hover:bg-zinc-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1014] active:scale-[0.98] ${wide ? "col-span-2 px-4 py-0.5" : "p-4"}`}
    >
      <span className="relative z-10 text-zinc-400 transition-colors group-hover:text-white">{icon}</span>
      <span className="relative z-10 mt-2 text-base font-medium text-white sm:text-lg">{title}</span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="home-page flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Logo 和标题 */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src={getAssetPath("/logo.png")}
          alt="逆战未来 维基"
          width={180}
          height={180}
          className="mb-4 sm:mb-5"
          style={{ width: "clamp(130px, 28vw, 180px)", height: "auto" }}
          priority
        />
        <h1 className="text-2xl font-bold tracking-normal text-zinc-100 sm:text-4xl">
          逆战未来 维基
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          武器、插件、首领、超限卡片与塔防图鉴资料库
        </p>
      </div>

      {/* 导航卡片网格 */}
      <div className="w-full max-w-md">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {NAV_ITEMS.map((item) => (
            <NavCard
              key={item.href}
              href={item.href}
              icon={item.icon}
              title={item.title}
              wide={item.wide}
            />
          ))}
        </div>
      </div>

      {/* 社区维护信息 */}
      <section className="home-community mt-5 w-full max-w-[26rem] rounded-xl border border-zinc-700/90 bg-zinc-900/60 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <GitBranch aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">社区维护项目</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                基于 qiekn/nzm-wiki 构建
              </p>
            </div>
          </div>
          <a
            href={GITHUB_FORK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
          >
            查看仓库
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="my-4 h-px bg-zinc-700/70" />
        <p className="text-sm leading-relaxed text-zinc-300">
          原项目的武器与怪物资料可能不完整，本站将继续补充与维护，欢迎反馈。
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 border-t border-zinc-700/70 pt-3 text-xs text-zinc-400">
          <a
            href={GITHUB_FORK}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-100"
          >
            项目说明
          </a>
          <Link href="/credits" className="transition-colors hover:text-zinc-100">
            致谢名单
          </Link>
          <a
            href={`${GITHUB_FORK}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-100"
          >
            问题反馈
          </a>
        </div>
      </section>

      {/* 快捷键提示 */}
      <div className="home-shortcuts mt-6 hidden items-center justify-center gap-4 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-5 py-3 text-xs text-zinc-400 sm:flex">
        <span className="flex items-center gap-2">
          <Search aria-hidden="true" className="h-4 w-4" />
          <span>搜索资料</span>
          <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">Ctrl P</kbd>
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-zinc-700" />
        <span className="flex items-center gap-2">
          <Terminal aria-hidden="true" className="h-4 w-4" />
          <span>命令面板</span>
          <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">Ctrl Shift P</kbd>
        </span>
      </div>
    </main>
  );
}
