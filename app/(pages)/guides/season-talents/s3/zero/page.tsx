import type { Metadata } from "next";
import { S3SeasonTalentBuilder } from "@/components/season-talents/s3/S3SeasonTalentBuilder";

export const metadata: Metadata = {
  title: "零点天赋树（S3）",
  description: "逆战未来 S3 赛季天赋零点的专属与通用节点、等级和效果详情。",
  alternates: { canonical: "/guides/season-talents/s3/zero" },
};

export default function ZeroTalentPage() {
  return <S3SeasonTalentBuilder talentId="zero" />;
}
