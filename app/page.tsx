import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Sword, Zap, Target, Skull, Github } from "lucide-react";
import { getOptimizedImagePath } from "@/lib/path";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const GITHUB_UPSTREAM = "https://github.com/qiekn/nzm-wiki";
const GITHUB_FORK = "https://github.com/lostlightll/nzm-wiki";

interface NavCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
}

const NAV_ITEMS = [
  { href: "/weapons", icon: <Sword className="h-8 w-8 sm:h-10 sm:w-10" />, title: "武器图鉴" },
  { href: "/perks", icon: <Zap className="h-8 w-8 sm:h-10 sm:w-10" />, title: "插件图鉴" },
  { href: "/traps", icon: <Target className="h-8 w-8 sm:h-10 sm:w-10" />, title: "塔防陷阱" },
  { href: "/enemies/td", icon: <Skull className="h-8 w-8 sm:h-10 sm:w-10" />, title: "塔防敌人" },
];

function NavCard({ href, icon, title }: NavCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition-colors hover:border-zinc-500 hover:bg-zinc-700/50 hover:scale-[1.02] active:scale-[0.98]"
    >
      <span className="text-zinc-400 group-hover:text-white transition-colors">{icon}</span>
      <span className="mt-2 text-base sm:text-lg font-medium text-white">{title}</span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Logo 和标题 */}
      <div className="flex flex-col items-center mb-8">
        <Image
          src={getOptimizedImagePath("/logo.png")}
          alt="逆战未来 维基"
          width={180}
          height={180}
          className="mb-5 sm:mb-6"
          style={{ width: "clamp(130px, 28vw, 180px)", height: "auto" }}
          priority
        />
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
          逆战未来 维基
        </h1>
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
            />
          ))}
        </div>
      </div>

      {/* 致谢 */}
      <div className="mt-5 flex items-center justify-center w-full max-w-md">
        <Link
          href="/credits"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          致谢名单
        </Link>
      </div>

      {/* Fork 声明 */}
      <div className="mt-3 px-5 py-4 rounded-xl border border-zinc-800 bg-zinc-800/30 max-w-md">
        <p className="text-sm text-zinc-300 leading-relaxed">
          本站 Fork 自{" "}
          <a
            href={GITHUB_UPSTREAM}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-200 hover:text-white underline underline-offset-2 transition-colors font-medium"
          >
            qiekn/nzm-wiki
          </a>
          。
        </p>
        <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
          原站武器伤害机制信息不够准确，且原作者较少维护，于是决定创建此站
        </p>
        <p className="mt-3 text-xs text-zinc-600 leading-relaxed">
          <a
            href={GITHUB_FORK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Github className="h-3 w-3" />
            查看 Fork 仓库
          </a>
          {" · "}
          继续完善中，欢迎反馈
        </p>
      </div>

      {/* 快捷键提示 */}
      <div className="mt-6 hidden sm:flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5">Ctrl+P</kbd>
          <span>搜索</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5">Ctrl+Shift+P</kbd>
          <span>命令面板</span>
        </span>
      </div>
    </div>
  );
}
