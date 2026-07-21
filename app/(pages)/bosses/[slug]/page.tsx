import { BossDetailPage } from "@/components/BossDetailPage";
import {
  getBossDetailMetadata,
  getBossStaticParams,
} from "@/lib/boss-routes";

export function generateStaticParams() {
  return getBossStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return getBossDetailMetadata(params);
}

export default async function BossPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BossDetailPage slug={slug} />;
}
