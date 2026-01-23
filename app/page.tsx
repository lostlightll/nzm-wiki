import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 px-4">
      <Image
        src="/logo.png"
        alt="逆战未来 维基"
        width={200}
        height={200}
        className="mb-6"
        priority
      />
      <h1 className="mb-8 text-4xl font-bold text-white">逆战未来 维基</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/weapons"
          className="flex h-32 w-48 flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
        >
          <span className="text-3xl">🔫</span>
          <span className="mt-2 text-lg font-medium text-white">武器列表</span>
        </Link>
        <Link
          href="/perks"
          className="flex h-32 w-48 flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition-colors hover:border-zinc-500 hover:bg-zinc-700"
        >
          <span className="text-3xl">⚡</span>
          <span className="mt-2 text-lg font-medium text-white">插件图鉴</span>
        </Link>
      </div>
    </div>
  );
}
