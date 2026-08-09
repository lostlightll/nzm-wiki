import { getMDXList } from "@/lib/mdx";
import { sortPostArchiveItems } from "@/lib/post-archive";
import Link from "next/link";

interface Post {
  slug: string;
  title?: string;
  tag?: string | string[];
}

export default function PostsPage() {
  const posts = sortPostArchiveItems(getMDXList("posts") as Post[]);

  const renderTags = (tag: string | string[] | undefined) => {
    if (!tag) return null;
    const tags = Array.isArray(tag) ? tag : [tag];
    return tags.map((t, i) => (
      <Link
        key={i}
        href={`/posts/tags/${encodeURIComponent(t)}`}
        className="px-2 py-0.5 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
      >
        {t}
      </Link>
    ));
  };

  return (
    <div className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold text-white mb-6">文章归档</h1>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug} className="flex items-center gap-2">
            {renderTags(post.tag)}
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
