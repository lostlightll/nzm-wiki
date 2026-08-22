import Link from "next/link";

export interface PostArchiveItem {
  slug: string;
  title?: string;
  tag?: string | string[];
}

export function PostArchiveList({
  posts,
}: {
  posts: readonly PostArchiveItem[];
}) {
  return (
    <ul className="mx-auto mt-2 flex w-full max-w-xl flex-col items-start gap-3">
      {posts.map((post) => {
        const tags = post.tag
          ? Array.isArray(post.tag)
            ? post.tag
            : [post.tag]
          : [];

        return (
          <li
            key={post.slug}
            className="flex max-w-full flex-wrap items-center gap-2 text-left"
          >
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/posts/tags/${encodeURIComponent(tag)}`}
                className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-600"
              >
                {tag}
              </Link>
            ))}
            <Link
              href={`/posts/${post.slug}`}
              className="text-zinc-300 transition-colors hover:text-white"
            >
              {post.title || post.slug}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
