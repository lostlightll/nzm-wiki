import type { Metadata } from "next";
import { ShootingRangeCatalog } from "@/components/ShootingRangeCatalog";

export const metadata: Metadata = {
  title: "靶场图鉴",
  description: "逆战未来靶场练习目标的生命与护盾配置。",
  alternates: { canonical: "/enemies/lc/shooting-range" },
};

export default function ShootingRangePage() {
  return <ShootingRangeCatalog />;
}
