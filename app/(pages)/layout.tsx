import Link from "next/link";

const NAV_ITEMS = [
  { href: "/weapons", label: "武器图鉴" },
  { href: "/traps", label: "塔防陷阱" },
  { href: "/enemies/td", label: "塔防敌人" },
  { href: "/perks", label: "插件图鉴" },
  { href: "/posts", label: "文章归档" },
];

const GITHUB_REPO = "https://github.com/qiekn/nzm-wiki";

function GitHubIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-700 bg-zinc-900/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
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
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          title="GitHub"
        >
          <GitHubIcon />
          <span className="hidden sm:inline text-sm">qiekn/nzm-wiki</span>
        </a>
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
