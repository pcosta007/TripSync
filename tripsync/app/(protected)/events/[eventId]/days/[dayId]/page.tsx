import type { Metadata } from "next";
import { use } from "react";
import DaySummaryClient from "./DaySummaryClient";

export const metadata: Metadata = { title: "Daily Summary" };

export default function DaySummaryPage({
  params,
}: {
  params: Promise<{ eventId: string; dayId: string }>;
}) {
  const { eventId, dayId } = use(params);
  return <DaySummaryClient eventId={eventId} dayId={dayId} />;
}