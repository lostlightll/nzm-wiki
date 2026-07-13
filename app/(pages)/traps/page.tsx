import { getAllTraps } from "@/lib/traps";
import TrapsClient from "./client";

export default async function TrapsPage() {
  const traps = await getAllTraps();
  return <TrapsClient traps={traps} />;
}
