import Link from "next/link";

export function OverlimitVersionNavigation({ versions, activePath, ariaLabel = "超限赛季版本" }: {
  versions: readonly { href: string; label: string }[];
  activePath: string;
  ariaLabel?: string;
}) {
  if (versions.length < 2) return null;
  return (
    <nav aria-label={ariaLabel} className="mb-5 flex flex-wrap gap-2">
      {versions.map(version => <Link key={version.href} href={version.href}
        aria-current={version.href === activePath ? "page" : undefined}
        className={`inline-flex min-h-10 items-center rounded border px-4 py-2 text-sm font-semibold outline-none focus-visible:underline focus-visible:underline-offset-4 ${version.href === activePath
          ? "border-zinc-400 bg-zinc-600 text-white"
          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}>
        {version.label}
      </Link>)}
    </nav>
  );
}
