import Link from "next/link";
import Image from "next/image";

interface NavCardProps {
  href: string;
  icon: string;
  title: string;
  description?: string;
}

const NAV_ITEMS = [
  { href: "/weapons", icon: "🔫", title: "武器图鉴" },
  { href: "/perks", icon: "⚡", title: "插件图鉴" },
  { href: "/traps", icon: "🪤", title: "塔防陷阱" },
  { href: "/enemies/td", icon: "👾", title: "塔防敌人" },
  { href: "/posts", icon: "📄", title: "文章归档" },
];

const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/nzm-wiki" : "";

function NavCard({ href, icon, title, description }: NavCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition-all hover:border-zinc-500 hover:bg-zinc-700/50 hover:scale-[1.02] active:scale-[0.98]"
    >
      <span className="text-2xl sm:text-3xl">{icon}</span>
      <span className="mt-2 text-base sm:text-lg font-medium text-white">{title}</span>
      {description && (
        <span className="mt-1 text-xs text-zinc-500 text-center hidden sm:block">
          {description}
        </span>
      )}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Logo 和标题 */}
      <div className="flex flex-col items-center mb-8">
        <Image
          src={`${basePath}/logo.png`}
          alt="逆战未来 维基"
          width={160}
          height={160}
          className="mb-4 sm:mb-6"
          style={{ width: "clamp(120px, 30vw, 160px)", height: "auto" }}
          priority
        />
        <h1 className="text-2xl sm:text-4xl font-bold text-white">逆战未来 维基</h1>
      </div>

      {/* 导航卡片网格 - 固定 2 列 */}
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

      {/* 快捷键提示 - 仅桌面端显示 */}
      <div className="mt-8 hidden sm:flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
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
