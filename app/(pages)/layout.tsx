import Link from "next/link";

const NAV_ITEMS = [
  { href: "/weapons", label: "武器列表" },
  { href: "/perks", label: "插件图鉴" },
];

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-700 bg-zinc-900/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link
          href="/"
          className="text-lg font-bold text-white hover:text-zinc-300"
        >
          逆战未来 维基
        </Link>
        <div className="flex gap-4">
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
    </nav>
  );
}

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-900">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
