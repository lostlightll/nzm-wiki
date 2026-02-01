import Link from "next/link";
import Image from "next/image";

// 1. 定义 props 的类型接口
interface NavCardProps {
  href: string;
  icon: string;
  title: string;
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

// 2. 在组件参数里使用该类型 (: NavCardProps)
function NavCard({ href, icon, title }: NavCardProps) {
  return (
    <Link
      href={href}
      className="flex h-32 w-48 flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
    >
      <span className="text-3xl">{icon}</span>
      <span className="mt-2 text-lg font-medium text-white">{title}</span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4">
      <Image
        src={`${basePath}/logo.png`}
        alt="逆战未来 维基"
        width={200}
        height={200}
        className="mb-6"
        priority
      />
      <h1 className="mb-8 text-4xl font-bold text-white">逆战未来 维基</h1>
      <div className="grid gap-4 sm:grid-cols-2">
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
  );
}
