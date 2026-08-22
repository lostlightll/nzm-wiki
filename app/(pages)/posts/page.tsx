import type { Metadata } from "next";
import { PostArchiveList, type PostArchiveItem } from "@/components/PostArchiveList";
import { getMDXList } from "@/lib/mdx";
import { sortPostArchiveItems } from "@/lib/post-archive";

export const metadata: Metadata = {
  title: "攻略文章",
  description: "逆战未来攻略文章与机制资料归档。",
  alternates: { canonical: "/posts" },
};

export default function PostsPage() {
  const posts = sortPostArchiveItems(
    getMDXList("posts") as PostArchiveItem[],
  );

  return (
    <div className="[--guide-accent:#e6b656] [--guide-muted:#b5b5bb] [--guide-text:#e4e4e7]">
      <h1 className="sr-only">攻略文章</h1>
      <PostArchiveList posts={posts} />
    </div>
  );
}
