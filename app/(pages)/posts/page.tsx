import { getMDXList } from "@/lib/mdx";
import Link from "next/link";

interface Post {
  slug: string;
  title?: string;
  tag?: string;
}

export default function PostsPage() {
  const posts = getMDXList("posts") as Post[];

  return (
    <div className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold text-white mb-6">文章归档</h1>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug} className="flex items-center gap-3">
            {post.tag && (
              <span className="px-2 py-0.5 text-xs rounded bg-zinc-700 text-zinc-300">
                {post.tag}
              </span>
            )}
            <Link
              href={`/posts/${post.slug}`}
              className="text-zinc-300 hover:text-white transition-colors"
            >
              {post.title || post.slug}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
